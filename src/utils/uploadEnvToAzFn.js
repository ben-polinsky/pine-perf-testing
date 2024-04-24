#!/usr/bin/env zx
if (process.platform !== "win32")
  $.shell = "/bin/zsh";

const { readFileSync } = require("fs");

async function uploadEnvToAzFn(resourceGroupName, functionAppName) {
  if (!functionAppName || !resourceGroupName)
    throw new Error(
      "Please provide a functionAppName and resourceGroupName: node uploadEnvToAzFn.js <functionAppName> <resourceGroupName>"
    );

  const envFilePath = "./.env";
  const envData = readFileSync(envFilePath, "utf8");

  const envPairs = envData.split("\n").reduce((acc, line) => {
    if (line.startsWith("#")) return acc;

    const [key, ...values] = line.split("=");
    const value = values.join("=");
    if (key && value) {
      acc[key.trim()] = value.trim();
    }
    return acc;
  }, {});

  for (const [key, value] of Object.entries(envPairs)) {
    try {
      if (key === "DOCKER_IMAGE_NAME") {
        await $`az functionapp config container set --name ${functionAppName} --resource-group ${resourceGroupName} --image ${value}`;
      } else {
        await $`az functionapp config appsettings set --name ${functionAppName} --resource-group ${resourceGroupName} --settings ${key}=${value}`;
      }

      console.log(`Successfully set ${key} in Azure Functions settings`);
    } catch (error) {
      console.error(
        `Failed to set ${key} in Azure Functions settings: ${error}`
      );
    }
  }
}
module.exports = { uploadEnvToAzFn };
