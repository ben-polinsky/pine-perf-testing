#!/usr/bin/env zx

const { uploadEnvToAzFn } = require("./uploadEnvToAzFn");

if (process.argv.length < 10) {
  console.log(
    `Usage: ${process.argv[2]} <resource-group> <storage-account-name> <region> <plan-name> <function-app-name> <function-name> <docker-image-name>`
  );
  console.log(
    "Example: ./setupAzResources.ts my-rg my-storage-account eastus my-plan my-function-app my-docker-image"
  );
  process.exit(1);
}

const [
  resourceGroup,
  storageAccountName,
  region,
  planName,
  functionAppName,
  functionName,
  dockerImageName,
] = process.argv.slice(3);

if (
  !resourceGroup ||
  !storageAccountName ||
  !region ||
  !planName ||
  !functionAppName ||
  !functionName ||
  !dockerImageName
) {
  throw new Error("Missing required arguments");
}

async function createStorageAccount(_region) {
  let storageAccountExists = false;
  try {
    await $`az storage account show --name ${storageAccountName} --resource-group ${resourceGroup}`;
    storageAccountExists = true;
    console.log(`Storage account '${storageAccountName}' already exists.`);
  } catch (error) {
    console.log("Creating storage account...");
    await $`az storage account create --name ${storageAccountName} --resource-group ${resourceGroup} --location ${_region} --sku Standard_LRS`;
  }
}

async function createFunctionPlan(_region) {
  await $`az functionapp plan create --resource-group ${resourceGroup} --name ${planName}_${_region} --location ${_region} --number-of-workers 1 --sku EP1 --is-linux`;
}

async function createFunction(_region) {
  await $`az functionapp create --name ${functionAppName}-${_region} --storage-account ${storageAccountName} --resource-group ${resourceGroup} --plan ${planName}_${_region} --image ${dockerImageName} --functions-version 4`;
}

async function getConnectionString() {
  const result =
    await $`az storage account show-connection-string --resource-group ${resourceGroup} --name ${storageAccountName} --query connectionString --output tsv`;
  return result.stdout.trim();
}

async function setImage(_region) {
  await $`az functionapp config container set --resource-group ${resourceGroup} --name ${functionAppName}-${_region} --image ${dockerImageName}`;
}

async function getInvokeUrl(_region) {
  const result =
    await $`az functionapp function show --resource-group ${resourceGroup} --name ${functionAppName}-${_region} --function-name ${functionName} --query invokeUrlTemplate`;
  return result.stdout.trim();
}

async function writeToLocalEnv(key, value) {
  await $`echo "${key}=${value}" >> .env`;
}

async function main() {
  let regions = [region];
  if (region.toLocaleLowerCase() === "all") {
    regions = ["eastus", "AustraliaCentral", "BrazilSouth"];
  }

  await createStorageAccount(regions[0]);
  console.log("Storage Account.... done");
  const connectionString = await getConnectionString();
  await writeToLocalEnv("AzureWebJobsStorage", connectionString);

  for (const r of regions) {
    console.log(`Creating resources for region: ${r}`);
    await createFunctionPlan(r);
    console.log("Function Plan created.");

    await createFunction(r);
    console.log("Function created.");

    await setImage(r);
    console.log("Docker image set for function app.");

    await uploadEnvToAzFn(resourceGroup, `${functionAppName}-${r}`);
    console.log("uploaded env config ");

    let invokeUrl;
    let tries = 0;

    while (!invokeUrl) {
      try {
        tries++;
        invokeUrl = await getInvokeUrl(r);
        console.log(`\ntrigger URL for region ${r}: ${invokeUrl}\n`);
        break;
      } catch (error) {}

      if (tries < 4) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        console.error("Failed to get invoke URL");
        break;
      }
    }
  }
}

main().catch(console.error);
