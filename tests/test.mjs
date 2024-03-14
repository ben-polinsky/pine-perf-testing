import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { loginPopup } from "./auth.mjs";
import * as dotenv from "dotenv";
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

export async function untilCanvas(page) {
  await loginPopup(page, testUser, appURL);
  const lazyFullReport = getFullReport(page);
  await page.waitForSelector("canvas");
  const fullReport = await lazyFullReport;
  await fs.writeFile(
    path.resolve(__dirname, "..", "reports", `./fullReport-${Date.now()}.json`),
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
