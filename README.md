# Pine Perf Tests

- Create `.env` file and add info.
- `npm install`
- `npm test`
- `npm parseReports`

Note: add an azure blob storage connection string to the `.env` (azBlobConnectionString) file to upload reports.

## Docker

This repo contains config and scripts for running artillery performance tests in a docker image inside of an azure function. The docker image primarily allows us to not run dependencies on the az fn.
**NOTE** The images for node azure functions are big! If you'd like to run the tests in a different environment, we'd recommend using a slimmer image.

## Running the tests in a child process

Unfortunately, Artillery does not have an official Node API. This requires us to run the tests in a child process. Apparently, there was at least some undocumented support for [running from node](https://github.com/artilleryio/artillery/discussions/1043). This should be investigated as time permits as spawning a child process from an az function is not ideal.

## Running the tests on cold starts

In order to replicate cold starts consistently for every test run, we need to delete the provisioned iModel backend before starting the tests.

> This is optional, you can also run the performance tests on a warm backend too. This is feature flagged behind a `deleteBackend` env variable, which can be enabled by just passing any value in.

To run the backend deletion, you'll need the following env variables:

```
changeSetId=
orchestratorBaseUrl=
IMJS_URL_PREFIX=
IMJS_BACKEND_NAME=
IMJS_BACKEND_VERSION=
IMJS_AUTH_CLIENT_ID=
BACKEND_CLIENT_ID=
IMJS_AUTH_CLIENT_REDIRECT_URI=
IMJS_AUTH_AUTHORITY=
IMJS_AUTH_CLIENT_SCOPES=
```

We also have a `needChangesetId` env variable that can be enabled by passing any value in, which will output the changesetId of the imodel the tests run against.

## Creating azure function to run tests in docker container

Followed this guide: https://learn.microsoft.com/en-us/azure/azure-functions/functions-deploy-container?tabs=acr%2Cbash%2Cazure-cli&pivots=programming-language-javascript. You can start [here](https://learn.microsoft.com/en-us/azure/azure-functions/functions-deploy-container?tabs=acr%2Cbash%2Cazure-cli&pivots=programming-language-javascript#create-supporting-azure-resources-for-your-function) if interested.

Essentially:

- Create Storage Account:
  - `az storage account create --name {StorageAccountName} --resource-group {ResourceGroup} --location {"Enter Region"} --sku Standard_LRS`
- Create Premium Function Plan. Region should be the intended region of your function:
  - `az functionapp plan create --resource-group {ResourceGroup} --name {PlanName} --location {"Enter Region"} --number-of-workers 1 --sku EP1 --is-linux`
- Create Function:
  - `az functionapp create --name {FunctionAppName} --storage-account {StorageAccountName} --resource-group {ResourceGroup} --plan {PlanName} --image benpolinsky/pineperf:latest --functions-version 4`
- Get connection string for storage account:
  - `az storage account show-connection-string --resource-group {ResourceGroup} --name {StorageAccountName} --query connectionString --output tsv`
- Set connection string for function app:
  - `az functionapp config appsettings set --name {FunctionAppName} --resource-group {ResourceGroup} --settings AzureWebJobsStorage={"Connection String"}`
- Set image for function (optional when changing image):
  - `az functionapp config container set --resource-group {ResourceGroup} --name {FunctionAppName} --image benpolinsky/pineperf:latest`
- Get URL to hit to trigger:
  - `az functionapp function show  --resource-group {ResourceGroup} --name {FunctionAppName} --function-name PinePerfTests --query invokeUrlTemplate`
- Upload environment variables using the `npm run uploadEnv` script in the `scripts` folder.

This should eventually be automated with a script or with an ARM template.
