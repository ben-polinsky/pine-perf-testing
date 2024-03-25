// download reports from az blob storage
const { BlobServiceClient } = require("@azure/storage-blob");
const dotenv = require("dotenv");
dotenv.config();

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.azBlobConnectionString
);

const containerName = "main";
const reportsPath = "./";

// download all files from the reports path as individual files, saved locally to the "reports" folder
async function downloadReports() {
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const reportFiles = containerClient.listBlobsFlat(reportsPath);

  for await (const file of reportFiles) {
    console.log(file.name);
    const blockBlobClient = containerClient.getBlockBlobClient(file.name);
    blockBlobClient.downloadToFile(`./reports/${file.name}`);
  }
}

downloadReports();
