#!/usr/bin/env zx

const [resourceGroup, storageAccountName, planName, functionAppName, region] =
  process.argv.slice(3);

async function deleteFunction(r) {
  try {
    // check if functionapp exists
    await $`az functionapp show --name ${functionAppName}-${r} --resource-group ${resourceGroup}`;
    await $`az functionapp delete --name ${functionAppName}-${r} --resource-group ${resourceGroup}`;
  } catch (error) {}
}

async function deleteFunctionPlan(r) {
  try {
    // check if functionapp plan exists
    await $`az functionapp plan show --name ${planName}_${r} --resource-group ${resourceGroup}`;
    const res =
      await $`az functionapp plan delete --name ${planName}_${r} --resource-group ${resourceGroup}`;
    console.log(res);
  } catch (error) {
    console.log(error);
  }
}

async function deleteStorageAccount() {
  try {
    // check if storage account exists
    const sa =
      await $`az storage account show --name ${storageAccountName} --resource-group ${resourceGroup}`;
    await $`az storage account delete --name ${storageAccountName} --resource-group ${resourceGroup}`;
  } catch (error) {
    console.log(error);
  }
}

async function deleteResources() {
  let regions = [region];
  if (!region || region.toLocaleLowerCase() === "all") {
    regions = ["eastus", "AustraliaCentral", "BrazilSouth"];
  }
  for (const _region of regions) {
    console.log(`Deleting resources in ${_region}...`);
    await deleteFunction(_region);
    console.log(`Function '${functionAppName}-${_region}' deleted.`);
    await deleteFunctionPlan(_region);
    console.log(`Function Plan '${planName}_${_region}' deleted.`);
  }

  await deleteStorageAccount();
  console.log("Storage Account deleted.");
}

deleteResources()
  .then(() => {
    console.log("All clean");
  })
  .catch((e) => {
    console.error(e);
  });
