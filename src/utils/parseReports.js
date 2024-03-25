const fs = require("fs/promises");
const path = require("path");
const directoryPath = path.resolve(__dirname, "..", "..", "reports");

function calculateStatistics(capabilityName, slowCapabilitiesDurations) {
  const sum = slowCapabilitiesDurations.reduce(
    (acc, duration) => acc + duration,
    0
  );
  const count = slowCapabilitiesDurations.length;
  const average = sum / count;
  const minimum = Math.min(...slowCapabilitiesDurations);
  const maximum = Math.max(...slowCapabilitiesDurations);

  console.log("Capability:", capabilityName);
  console.log("Average:", average);
  console.log("Minimum:", minimum);
  console.log("Maximum:", maximum);
  console.log("\n");
}

async function caclulateStatsFromFullReport() {
  const files = await fs.readdir(directoryPath);
  const capabilitiesData = {};

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const filePath = path.join(directoryPath, file);
    const fileData = await fs.readFile(filePath, "utf8");
    const jsonData = JSON.parse(fileData);

    jsonData.fullReport?.slowCapabilities?.forEach((capability) => {
      if (capability.isError) return;

      const capabilityName = `${capability.moduleId}_${capability.capability}_${capability.lifecycleEvent}`;
      const duration = capability.duration;

      if (!capabilitiesData[capabilityName]) {
        capabilitiesData[capabilityName] = [];
      }

      capabilitiesData[capabilityName].push(duration);
    });
  }

  console.log(`==== Capabilities statistics ====`);
  for (const capabilityName in capabilitiesData) {
    const slowCapabilitiesDurations = capabilitiesData[capabilityName];
    calculateStatistics(capabilityName, slowCapabilitiesDurations);
  }
}

async function getMostExpensiveRequests(numRequests = 30) {
  const files = await fs.readdir(directoryPath);
  const requests = [];
  for (const file of files) {
    if (!file.startsWith("requests-") || !file.endsWith(".json")) continue;

    const filePath = path.join(directoryPath, file);
    const fileData = await fs.readFile(filePath, "utf8");
    const jsonData = JSON.parse(fileData);
    for (const url in jsonData) {
      const durations = jsonData[url];
      const sum = durations.reduce(
        (acc, duration) => acc + (duration.responseEnd - duration.requestStart),
        0
      );
      const average = sum / durations.length;
      requests.push({ url, average });
    }

    requests.sort((a, b) => b.average - a.average);

    console.log(`==== Top ${numRequests} most expensive requests ====`);
    console.log(requests.slice(0, numRequests)); // log final report to console.
  }
}

async function calculateIndividualAndTotalTimeOfStaticAssets() {
  const files = await fs.readdir(directoryPath);
  for (const file of files) {
    const staticAssets = [];
    if (!file.startsWith("requests-") || !file.endsWith(".json")) continue;

    const filePath = path.join(directoryPath, file);
    const fileData = await fs.readFile(filePath, "utf8");
    const jsonData = JSON.parse(fileData);
    for (const url in jsonData) {
      if (url.includes("static")) {
        const durations = jsonData[url];
        const sum = durations.reduce(
          (acc, duration) =>
            acc + (duration.responseEnd - duration.requestStart),
          0
        );
        const average = sum / durations.length;
        staticAssets.push({ url, average });
      }
    }
    staticAssets.sort((a, b) => b.average - a.average);

    // log reports to console
    console.log("==== Static assets ====");
    console.log(staticAssets);

    const totalTime = staticAssets.reduce(
      (acc, asset) => acc + asset.average,
      0
    );
    console.log(
      `\nTotal time of static assets: ${totalTime} (${
        totalTime / 1000
      }s) for ${file} `
    );
  }
}

caclulateStatsFromFullReport().then(() => {
  getMostExpensiveRequests();
  calculateIndividualAndTotalTimeOfStaticAssets();
});

module.exports = {
  calculateStatistics,
  caclulateStatsFromFullReport,
  getMostExpensiveRequests,
};
