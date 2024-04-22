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

async function createStorageAccount() {
  await $`az storage account create --name ${storageAccountName} --resource-group ${resourceGroup} --location ${region} --sku Standard_LRS`;
}

async function createFunctionPlan() {
  await $`az functionapp plan create --resource-group ${resourceGroup} --name ${planName} --location ${region} --number-of-workers 1 --sku EP1 --is-linux`;
}

async function createFunction() {
  await $`az functionapp create --name ${functionAppName} --storage-account ${storageAccountName} --resource-group ${resourceGroup} --plan ${planName} --image ${dockerImageName} --functions-version 4`;
}

async function getConnectionString() {
  const result =
    await $`az storage account show-connection-string --resource-group ${resourceGroup} --name ${storageAccountName} --query connectionString --output tsv`;
  return result.stdout.trim();
}

async function setImage() {
  await $`az functionapp config container set --resource-group ${resourceGroup} --name ${functionAppName} --image ${dockerImageName}`;
}

async function getInvokeUrl() {
  const result =
    await $`az functionapp function show --resource-group ${resourceGroup} --name ${functionAppName} --function-name ${functionName} --query invokeUrlTemplate`;
  return result.stdout.trim();
}

async function writeToLocalEnv(key, value) {
  await $`echo "${key}=${value}" >> .env`;
}

async function main() {
  await createStorageAccount();
  console.log("Storage Account created.");

  await createFunctionPlan();
  console.log("Function Plan created.");

  await createFunction();
  console.log("Function created.");
  // conflicts with the env updating...
  const connectionString = await getConnectionString();
  // write connection string to local env file:
  await writeToLocalEnv("AzureWebJobsStorage", connectionString);

  console.log("Connection string set for function app.");

  await setImage();
  console.log("Docker image set for function app.");

  await uploadEnvToAzFn(resourceGroup, functionAppName);
  console.log("uploaded env config ");

  let invokeUrl;
  let tries = 0;

  while (!invokeUrl) {
    try {
      tries++;
      invokeUrl = await getInvokeUrl();
      console.log("trigger URL:", invokeUrl);
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

main().catch(console.error);
