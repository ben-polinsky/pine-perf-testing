const fs = require("fs/promises");
const path = require("path");
const dotenv = require("dotenv");
const { existsSync, mkdirSync } = require("fs");
const { loginPopup } = require("./auth.js");
const { addResults } = require("./blobs.js");
dotenv.config();

const baseUrl = process.env.baseUrl;
const username = process.env.TEST_USERNAME;
const password = process.env.TEST_PASSWORD;
const iTwinId = process.env.iTwinID;
const iModelId = process.env.iModelID;
const requests = {};
const LONG_TIMEOUT = 240000;
if (!username || !password || !iTwinId || !iModelId || !baseUrl) {
  throw new Error(
    "Missing environment variables. Ensure you've set the following: username, password, iTwinID, iModelID"
  );
}

const testUser = {
  username,
  password,
};

const appURL = `${baseUrl}/context/${iTwinId}/imodel/${iModelId}?testMode&logToConsole`;

async function untilCanvas(page, vuContext, events, test) {
  const { step } = test;

  let popup;
  const timestamp = Date.now();
  const region = process.env.REGION_NAME;
  const testRunIdentifier = `${region}-${vuContext.vars.$uuid}-${iModelId}-${timestamp}`;
  await step("pre_login_redirect", async () => {
    // We can use this to measure time to retrieve Pineapple's chunked bundle files.
    await page.goto(appURL, { timeout: LONG_TIMEOUT });
    [popup] = await Promise.all([
      page.waitForEvent("popup", { timeout: LONG_TIMEOUT }),
    ]);
    await popup.waitForLoadState();
  });

  await step("login", async () => {
    popup = await loginPopup(page, popup, testUser, appURL);
  });
  await step("post_login", async () => {
    await popup.reload(); // for the test user, the popup fails to load the auth redirect for some reason, but the login succeeds. A reload cures all.
    await page.waitForURL(appURL);
  });

  let lazyFullReport;
  await step("spinner_stage", async () => {
    startRequestProfiling(page);
    lazyFullReport = getFullReport(page);
    await page.waitForSelector("canvas", { timeout: LONG_TIMEOUT });
  });

  const fullReport = await lazyFullReport;
  await addResults(
    `fullReport-${testRunIdentifier}.json`,
    JSON.stringify(fullReport, null, 2)
  );

  await addResults(
    `requests-${testRunIdentifier}.json`,
    JSON.stringify(requests, null, 2)
  );

  const reportFolderPath = path.resolve(__dirname, "..", "reports");
  if (!existsSync(reportFolderPath)) {
    // if folder doesn't exist, create.
    mkdirSync(reportFolderPath);
  }
  await fs.writeFile(
    path.resolve(reportFolderPath, `./fullReport-${testRunIdentifier}.json`),
    JSON.stringify(fullReport, null, 2)
  );

  await fs.writeFile(
    path.resolve(reportFolderPath, `./requests-${testRunIdentifier}.json`),
    JSON.stringify(requests, null, 2)
  );

  // TODO: Implement imodel backend shutdown function here. Also, probably do this after all vu sessions, instead of per vu session? If per vu session, then gotta set a delay in artillery yaml.
  // TODO: If doing after all vu sessions, we can user the afterResponse param in extension-apis, and call the shutdown function.
}

async function getFullReport(page) {
  return new Promise((resolve) => {
    page.on("console", async (msg) => {
      for (const arg of msg.args()) {
        if (`${arg}`.includes("fullReport")) resolve(arg.jsonValue());
      }
    });
  });
}

async function startRequestProfiling(page) {
  page.on("requestfinished", async (request) => {
    const url = request.url();
    if (!requests[url]) {
      requests[url] = [];
    }
    requests[url].push(request.timing());
  });
}

module.exports = { untilCanvas };
