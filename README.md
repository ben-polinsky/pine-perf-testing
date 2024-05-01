# Pine Perf Tests

## Creating azure function to run tests in docker container

1. Fill in the `.env` file with necessary info (see `.env.example`).
1. Download [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) and [login](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli) to the subscription you'll use.
1. Run `./src/utils/setupAzResources.js {resourceGroup} {storageAccount} {region} {functionPlanName} {functionAppName} PinePerfTests benpolinsky/pineperf:latest`. You'll need to have a created resourceGroup with the ability to generate connection strings.

**Note - to run in multiple regions, set the region to 'All' and the script will deploy in east-us, australia central, and brazil south.**

| Argument                    | Description                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| resourceGroup               | The resource group to create the resources in - **this must be created beforehand**                               |
| storageAccount              | The storage account to create the blob storage in.                                                                |
| region                      | The region to create the resources in. **set to 'All' to deploy in east-us, australia central, and brazil south** |
| functionPlanName            | The name of the function plan to create.                                                                          |
| functionAppName             | The name of the function app to create.                                                                           |
| PinePerfTests               | The name of the function method to run. This should be left as-is.                                                |
| benpolinsky/pineperf:latest | The docker image to use. This is the image that contains the tests and should be left as-is                       |

At the end of this script, a url you can hit to run the function and tests will be returned. A simple curl request will suffice:

```bash
curl https://myfnapp.azurewebsites.net/api/pineperftests
```

In addition, there's a simple shell script to run the tests consecutively. Provide the url, and the number of times you'd like to run the fn.
`./triggerFns.sh https://pineperfdockercau.azurewebsites.net/api/pineperftests 10`

After finished running your tests, you can gather some data by running `pnpm parseReports`. This will output some stats to the console and produce a number of files in a `out/data-{timestamp}` folder.

When you are finished with your resources, you can delete them from azure with the `teardownAzResources` script:
`./src/utils/teardownAzResources.js {resourceGroup} {storageAccount} {functionPlanName} {functionName}`
**The above script is not behaving well right now, so you may need to manually delete the resources in the azure portal.**

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
