import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const directoryPath = path.join(__dirname, "reports");

const calculateStatistics = (capabilityName, slowCapabilitiesDurations) => {
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
};

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

for (const capabilityName in capabilitiesData) {
  const slowCapabilitiesDurations = capabilitiesData[capabilityName];
  calculateStatistics(capabilityName, slowCapabilitiesDurations);
}
