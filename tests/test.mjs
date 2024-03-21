import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as dotenv from "dotenv";
import { existsSync, mkdirSync } from "fs";
import { loginPopup } from "./auth.mjs";
import { addResults } from "./blobs.mjs";
import { TestBrowserAuthorizationClient } from "@itwin/oidc-signin-tool";
import { BeDuration, Guid } from "@itwin/core-bentley";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// Required variables.
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

const requests = {};
const LONG_TIMEOUT = 120000;

if (!username || !password || !iTwinId || !iModelId || !baseUrl) {
  throw new Error(
    "Missing environment variables. Ensure you've set the following: username, password, iTwinID, iModelID, baseUrl"
  );
}

const testUser = {
  username,
  password,
};

const appURL = `${baseUrl}/context/${iTwinId}/imodel/${iModelId}?testMode&logToConsole`;

export async function untilCanvas(page, vuContext, events, test) {
  const { step } = test;

  let popup;
  const timestamp = Date.now();
  const testRunIdentifier = `${vuContext.vars.$uuid}-${iModelId}-${timestamp}`;
  await step("pre_login_redirect", async () => {
    // We can use this to measure time to retrieve Pineapple's chunked bundle files.
    await page.goto(appURL, { timeout: LONG_TIMEOUT });
    [popup] = await Promise.all([
      page.waitForEvent("popup", { timeout: 60000 }),
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
    startRequestProfiling(page, vuContext);
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
  const regex = /(.*)\/changeset\/([\w\d]+)(\/.*)?/;
  page.on("requestfinished", async (request) => {
    const url = request.url();
    if (!requests[url]) {
      requests[url] = [];
    }
    requests[url].push(request.timing());
    if (needChangesetId) {
      const match = url.match(regex);
      if (match) {

        const changesetId = match[2];
        console.log(`Changeset id found: ${changesetId}`);
      }
    }

  });
}

export async function teardownBackend(requestParams, response, context, ee, next) {
  const userCred = {
    email: username,
    password: password
  }

  const authClientConfig = {
    clientId,
    redirectUri,
    scope,
    authority
  };

  if (deleteBackend) {
    console.log("Manually deleting provisioned backend...");
    const client = new TestBrowserAuthorizationClient(authClientConfig, userCred);
    const accessToken = await client.getAccessToken();

    try {
      const orchestratorUrl = `${orchestratorBaseUrl}/${backendName}/${backendVersion}/mode/1/context/${iTwinId}/imodel/${iModelId}/changeset/${changeSetId}/client/${backendClientId}`;

      const options = {
        method: "DELETE",
        headers: {
          'Authorization': accessToken,
          "x-correlation-id": Guid.createValue()
        }
      };
      const response = await fetch(orchestratorUrl, options);
      if (response.status === 200) {
        // Sleep for some time before responding to ensure backend is deleted
        await BeDuration.wait(35000);
        console.log("Backend deleted successfully!");
        return;
      }
      console.log(`Response was not ok for url ${orchestratorUrl}: ${response.status}, ${response.statusText}`);
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
