const dotenv = require("dotenv");
const { BlobServiceClient } = require("@azure/storage-blob");

dotenv.config();

async function addResults(blobName, content) {
  if (!process.env.AzureWebJobsStorage) {
    console.log(
      "No AzureWebJobsStorage provided. Results will not be uploaded."
    );
    return;
  }
  const blobClient = BlobServiceClient.fromConnectionString(
    process.env.AzureWebJobsStorage
  );
  //

  const containerClient = blobClient.getContainerClient("main");
  if (!(await containerClient.exists())) {
    await containerClient.create();
  }

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.upload(content, content.length);
}

module.exports = { addResults };
