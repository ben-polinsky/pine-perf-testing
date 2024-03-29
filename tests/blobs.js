const dotenv = require("dotenv");
const { BlobServiceClient } = require("@azure/storage-blob");

dotenv.config();

// Create a new blob in the main container
async function addResults(blobName, content) {
  if (!process.env.azBlobConnectionString) {
    console.warn(
      "No azBlobConnectionString provided. Results will not be uploaded."
    );
    return;
  }
  const blobClient = BlobServiceClient.fromConnectionString(
    process.env.azBlobConnectionString
  );
  const containerClient = blobClient.getContainerClient("main");
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.upload(content, content.length);
}

module.exports = { addResults };
