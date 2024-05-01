#!/usr/bin/env zx

// cli access
if (process.argv.length === 5) {
  const [, , , resourceGroupName, functionAppName] = process.argv;
  console.log(functionAppName, resourceGroupName);
  uploadEnvToAzFn(resourceGroupName, functionAppName);
}

// Uploads configuration via az.json file. Yes, the '@' is needed.
// Otherwise you can name the json file whatever you want.
// It's much faster than uploading each setting individually.
async function uploadEnvToAzFn(resourceGroupName, functionAppName) {
  if (!functionAppName || !resourceGroupName)
    throw new Error(
      "Please provide a functionAppName and resourceGroupName: node uploadEnvToAzFn.js <functionAppName> <resourceGroupName>"
    );

  await $`az functionapp config appsettings set --name ${functionAppName} --resource-group ${resourceGroupName} --settings @az.json`;
}

module.exports = { uploadEnvToAzFn };
