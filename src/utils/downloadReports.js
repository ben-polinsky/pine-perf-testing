// download reports from az blob storage
const fs = require("fs");
const { BlobServiceClient } = require("@azure/storage-blob");
const dotenv = require("dotenv");
dotenv.config();

if (!process.env.AzureWebJobsStorage) {
  throw new Error("AzureWebJobsStorage is not defined");
}

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AzureWebJobsStorage
);

const containerName = "main";
const reportsPath = "./";

// download all files from the reports path as individual files, saved locally to the "reports" folder
async function downloadReports() {
  // create local reports folder

  if (!fs.existsSync("./reports")) {
    fs.mkdirSync("./reports");
  }

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const reportFiles = containerClient.listBlobsFlat(reportsPath);

  for await (const file of reportFiles) {
    console.log(file.name);
    const blockBlobClient = containerClient.getBlockBlobClient(file.name);
    try {
      await blockBlobClient.downloadToFile(`./reports/${file.name}`);
    } catch {}
  }
}

downloadReports();
