import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const directoryPath = path.join(__dirname, "reports");

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

export function caclulateStatsFromFullReport() {
  for (const capabilityName in capabilitiesData) {
    const slowCapabilitiesDurations = capabilitiesData[capabilityName];
    calculateStatistics(capabilityName, slowCapabilitiesDurations);
  }
}

export async function getMostExpensiveRequests(numRequests = 10) {
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

    // sort the requests by duration and take the first 10
    requests.sort((a, b) => b.average - a.average);
    console.log(requests.slice(0, numRequests));
  }
}

caclulateStatsFromFullReport();
getMostExpensiveRequests();
