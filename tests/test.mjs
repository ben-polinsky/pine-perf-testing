import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { loginPopup } from "./auth.mjs";
import * as dotenv from "dotenv";
import { existsSync, mkdirSync } from "fs";
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const username = process.env.username;
const password = process.env.password;
const iTwinId = process.env.iTwinID;
const iModelId = process.env.iModelID;

if (!username || !password || !iTwinId || !iModelId) {
  throw new Error(
    "Missing environment variables. Ensure you've set the following: username, password, iTwinID, iModelID"
  );
}

const testUser = {
  username,
  password,
};

const appURL = `/context/${iTwinId}/imodel/${iModelId}?testMode&logToConsole`;

export async function untilCanvas(page, vuContext, events, test) {
  const { step } = test;

  let popup;
  await step("pre_login_redirect", async () => { // We can use this to measure time to retrieve Pineapple's chunked bundle files.
    await page.goto(appURL, { timeout: 120000 });
    [ popup ] = await Promise.all([
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

  let fullReport;
  await step("spinner stage", async () => {
    const lazyFullReport = getFullReport(page);
    await page.waitForSelector("canvas");
    fullReport = await lazyFullReport;
  });
  const reportFolderPath = path.resolve(__dirname, "..", "reports");
  if (!existsSync(reportFolderPath)) { // if folder doesn't exist, create.
    mkdirSync(reportFolderPath);
  }
  await fs.writeFile(
    path.resolve(reportFolderPath,`./fullReport-${Date.now()}.json`),
    JSON.stringify(fullReport, null, 2)
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
