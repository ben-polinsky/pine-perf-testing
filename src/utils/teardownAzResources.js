#!/usr/bin/env zx

const [resourceGroup, storageAccountName, planName, functionAppName] =
  process.argv.slice(3);

async function deleteFunction() {
  await $`az functionapp delete --name ${functionAppName} --resource-group ${resourceGroup}`;
}

async function deleteFunctionPlan() {
  await $`az functionapp plan delete --name ${planName} --resource-group ${resourceGroup}`;
}

async function deleteStorageAccount() {
  await $`az storage account delete --name ${storageAccountName} --resource-group ${resourceGroup}`;
}

async function deleteResources() {
  console.time("Teardown");
  await deleteFunction();
  console.log("Function deleted.");
  await deleteFunctionPlan();
  console.log("Function Plan deleted.");
  await deleteStorageAccount();
  console.log("Storage Account deleted.");
  console.timeEnd("Teardown");
}

deleteResources().then();
