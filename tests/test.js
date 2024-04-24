const fs = require("fs/promises");
const path = require("path");
const dotenv = require("dotenv");
const { loginPopup } = require("./auth.js");
const { addResults } = require("./blobs.js");
const { TestBrowserAuthorizationClient } = require("@itwin/oidc-signin-tool");
const { BeDuration, Guid } = require("@itwin/core-bentley");
const { execSync } = require("child_process");
dotenv.config();

const baseUrl = process.env.baseUrl;
const username = process.env.TEST_USERNAME;
const password = process.env.TEST_PASSWORD;
const iTwinId = process.env.iTwinID;
const iModelId = process.env.iModelID;

// Optional variables.
const changeSetId = process.env.changeSetId;
const orchestratorBaseUrl = process.env.orchestratorBaseUrl;
const clientId = process.env.IMJS_AUTH_CLIENT_ID;
const backendClientId = process.env.BACKEND_CLIENT_ID;
const redirectUri = process.env.IMJS_AUTH_CLIENT_REDIRECT_URI;
const scope = process.env.IMJS_AUTH_CLIENT_SCOPES;
const authority = process.env.IMJS_AUTH_AUTHORITY;
const backendName = process.env.IMJS_BACKEND_NAME;
const backendVersion = process.env.IMJS_BACKEND_VERSION;
const needChangesetId = process.env.needChangesetId;
const deleteBackend = process.env.deleteBackend;
const region = process.env.REGION_NAME ?? "local";
const customQueryParams = process.env.CUSTOM_QUERY_PARAMS;

if (!username || !password || !iTwinId || !iModelId || !baseUrl) {
  throw new Error(
    "Missing environment variables. Ensure you've set the following: username, password, iTwinID, iModelID, baseUrl"
  );
}

const requests = {};
const requestTimes = {};
const LONG_TIMEOUT = process.env.DEFAULT_TIMEOUT_MS
  ? parseInt(process.env.DEFAULT_TIMEOUT_MS)
  : 480000;
const BACKEND_DELETE_COOLDOWN =
  parseInt(process.env.BACKEND_DELETE_COOLDOWN_MS) || 35000;

const appURL = `${baseUrl}/context/${iTwinId}/imodel/${iModelId}?it3mode&logToConsole&${customQueryParams ?? ""}`;
const testUser = {
  username,
  password,
};

async function untilCanvas(page, vuContext, events, test) {
  const { step } = test;
  const timestamp = Date.now();
  const testRunIdentifier = `${region}-${vuContext.vars.$uuid}-${iModelId}-${timestamp}`;
  let popup;

  await step("pre_login_redirect", async () => {
    startRequestProfiling(page, vuContext);
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
    await page.waitForURL(appURL);
  });

  let lazyFullReport;
  await step("spinner_stage", async () => {
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
}

async function startRequestProfiling(page) {
  const regex = /(.*)\/changeset\/([\w\d]+)(\/.*)?/;
  page.on("requestfinished", async (request) => {
    let url = request.url();
    const numberOfUrlRequests = requestTimes[url] ?? 0;
    requestTimes[url] = numberOfUrlRequests + 1;
    if (numberOfUrlRequests !== 0) url = `${url}_${numberOfUrlRequests}`;
    requests[url] = request.timing();

    if (needChangesetId) {
      const match = url.match(regex);
      if (match) {
        const changesetId = match[2];
        console.log(`Changeset id found: ${changesetId}`);
      }
    }
  });
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

async function teardownBackend(requestParams, response, context, ee, next) {
  const userCred = {
    email: username,
    password: password,
  };

  const authClientConfig = {
    clientId,
    redirectUri,
    scope,
    authority,
  };

  if (deleteBackend) {
    console.log("Manually deleting provisioned backend...");
    const client = new TestBrowserAuthorizationClient(
      authClientConfig,
      userCred
    );
    const accessToken = await client.getAccessToken();

    try {
      const orchestratorUrl = `${orchestratorBaseUrl}/${backendName}/${backendVersion}/mode/1/context/${iTwinId}/imodel/${iModelId}/changeset/${changeSetId}/client/${backendClientId}`;

      const options = {
        method: "DELETE",
        headers: {
          Authorization: accessToken,
          "x-correlation-id": Guid.createValue(),
        },
      };
      const response = await fetch(orchestratorUrl, options);
      if (response.status === 200) {
        // Sleep for some time before responding to ensure backend is deleted
        await BeDuration.wait(BACKEND_DELETE_COOLDOWN);
        console.log("Backend deleted successfully!");
        return;
      }
      console.log(
        `Response was not ok for url ${orchestratorUrl}: ${response.status}, ${response.statusText}`
      );
    } catch (err) {
      if (err.response.statusCode === 404) {
        console.log("No running backend instance to delete.", iModelId);
      } else {
        console.log(`Error deleting backend: ${err.message}`, iModelId);
      }
    }
  } else {
    console.log("Provisioned backend won't be deleted manually.");
  }
}

async function uploadArtilleryReport() {
  const timestamp = Date.now();
  const newReportFilename = `test-run-report-${region}-${iModelId}-${timestamp}`;
  const currentReport = path.resolve(__dirname, "..", `test-run-report.json`);
  execSync(`npm run generateHTMLReport`);
  await addResults(
    `${newReportFilename}.json`,
    await fs.readFile(currentReport)
  );

  await addResults(
    `${newReportFilename}.html`,
    await fs.readFile(
      path.resolve(__dirname, "..", `test-run-report.json.html`)
    )
  );
}

module.exports = { untilCanvas, teardownBackend, uploadArtilleryReport };
