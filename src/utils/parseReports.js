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
    const region = getRegionFromUrl(file);

    const filePath = path.join(directoryPath, file);
    const fileData = await fs.readFile(filePath, "utf8");
    const jsonData = JSON.parse(fileData);

    jsonData.fullReport?.slowCapabilities?.forEach((capability) => {
      if (capability.isError) return;

      const capabilityName = `${capability.moduleId}_${capability.capability}_${capability.lifecycleEvent}`;
      const duration = capability.duration;

      if (!capabilitiesData[capabilityName]) {
        capabilitiesData[capabilityName] = {
          eastus: [],
          australiacentral: [],
          brazilsouth: [],
          local: [],
        };
      }

      capabilitiesData[capabilityName][region].push(duration);
    });
  }

  console.log(`==== Capabilities statistics ====`);
  console.log(`==== Capabilities across regions ====`);
  for (const capabilityName in capabilitiesData) {
    const slowCapabilitiesDurations = capabilitiesData[capabilityName];
    const durations = Object.values(slowCapabilitiesDurations).flat();
    calculateStatistics(capabilityName, durations);
  }

  console.log(`==== Capabilities by region ====`);
  console.log(capabilitiesData);
  await fs.writeFile(
    path.resolve(
      __dirname,
      "..",
      "chart-app",
      "data",
      "capabilities-by-region.json"
    ),
    JSON.stringify(capabilitiesData, null, 2)
  );
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
      const duration = jsonData[url];
      const time = duration.responseEnd - duration.requestStart;
      requests.push({ url, time });
    }

    requests.sort((a, b) => b.time - a.time);
  }
  console.log(`==== Top ${numRequests} most expensive requests ====`);
  console.log(requests.slice(0, numRequests)); // log final report to console.
}

async function getRequestTimeline() {
  const requestTimelinebyRegion = {
    eastus: {},
    australiacentral: {},
    brazilsouth: {},
    local: {},
  };

  const files = await fs.readdir(directoryPath);
  for (const file of files) {
    if (!file.startsWith("requests-") || !file.endsWith(".json")) continue;
    const region = getRegionFromUrl(file);

    const filePath = path.join(directoryPath, file);
    const fileData = await fs.readFile(filePath, "utf8");
    const jsonData = JSON.parse(fileData);
    for (const url in jsonData) {
      const duration = jsonData[url];
      const timeline = {
        start: duration.startTime,
        end: duration.startTime + duration.responseEnd,
      };

      if (!requestTimelinebyRegion[region]?.[url]) {
        requestTimelinebyRegion[region][url] = { ...timeline, count: 1 };
      } else {
        const newAverageStart =
          (requestTimelinebyRegion[region][url].count *
            requestTimelinebyRegion[region][url].start +
            timeline.start) /
          (requestTimelinebyRegion[region][url].count + 1);

        const newAverageEnd =
          (requestTimelinebyRegion[region][url].count *
            requestTimelinebyRegion[region][url].end +
            timeline.end) /
          ++requestTimelinebyRegion[region][url].count;

        requestTimelinebyRegion[region][url].start = newAverageStart;
        requestTimelinebyRegion[region][url].end = newAverageEnd;
      }
    }
  }

  await fs.writeFile(
    path.join(
      path.resolve(__dirname, "..", "chart-app", "data"),
      `request-timeline-by-region.json`
    ),
    JSON.stringify(requestTimelinebyRegion, null, 2)
  );
}

// tonight/tomorrow:
// it would be good, though to get the total time of static assets by region
// meaning the first request's start time and the last request's end time
async function calculateIndividualAndTotalTimeOfStaticAssets(
  searchTerm = "static"
) {
  const files = await fs.readdir(directoryPath);

  const byRegion = {
    eastus: {},
    australiacentral: {},
    brazilsouth: {},
    local: {},
  };

  for (const file of files) {
    if (!file.startsWith("requests-") || !file.endsWith(".json")) continue;
    const region = getRegionFromUrl(file);

    const filePath = path.join(directoryPath, file);
    const fileData = await fs.readFile(filePath, "utf8");
    const jsonData = JSON.parse(fileData);
    for (const url in jsonData) {
      if (url.includes(searchTerm)) {
        const time = jsonData[url].responseEnd - jsonData[url].requestStart;

        if (!byRegion[region]?.[url]) {
          byRegion[region][url] = {
            average: time,
            count: 1,
            url,
          };
        } else {
          byRegion[region][url].average =
            (byRegion[region][url].average * byRegion[region][url].count +
              time) /
            ++byRegion[region][url].count;
        }
      }
    }
    // sort by average
    for (const region in byRegion) {
      byRegion[region] = Object.fromEntries(
        Object.entries(byRegion[region]).sort(
          ([, a], [, b]) => b.average - a.average
        )
      );
    }
  }

  console.log(`==== ${searchTerm} by region ====\n`);
  let grandSummary = "";
  for (const region in byRegion) {
    console.log(`==== ${region} ====`);
    const regionData = Object.values(byRegion[region]);
    const totalTime = regionData.reduce(
      (acc, record) => acc + record.average,
      0
    );

    const mostExpensive = regionData.slice(0, 10);

    byRegion[region].totalTime = totalTime;
    byRegion[region].mostExpensive = mostExpensive;

    const summary = `
===${region}===
Total ${searchTerm} time (ms): ${totalTime}\n
Ordered by response time: \n
${formatUrlRecords(regionData)}\n
      `;
    grandSummary += summary;

    console.log(`Total time: ${totalTime}\n`);
    console.log(`Top 10 most expensive (${searchTerm}) `);
    console.log(formatUrlRecords(mostExpensive));
  }
  await fs.writeFile(
    path.join(
      path.resolve(__dirname, "..", "chart-app", "data"),
      `${searchTerm}-by-region-short.json`
    ),
    JSON.stringify(byRegion, null, 2)
  );

  await fs.writeFile(
    path.join(
      path.resolve(__dirname, "..", "chart-app", "data"),
      `${searchTerm}-summary.txt`
    ),
    grandSummary
  );
}

async function calculateAverageSpinnerTime() {
  const spinnerTimesbyRegion = {
    eastus: [],
    australiacentral: [],
    brazilsouth: [],
    local: [],
  };

  const files = await fs.readdir(directoryPath);
  for (const file of files) {
    if (!file.startsWith("test-run-report") || !file.endsWith(".json"))
      continue;
    const region = getRegionFromUrl(file);
    const filePath = path.join(directoryPath, file);
    const fileData = await fs.readFile(filePath, "utf8");
    const jsonData = JSON.parse(fileData);

    let spinnerDuration;
    let prelogin;
    try {
      spinnerDuration =
        jsonData.aggregate.summaries["browser.step.spinner_stage"].max;
      prelogin =
        jsonData.aggregate.summaries["browser.step.pre_login_redirect"].max;

      spinnerTimesbyRegion[region].push(prelogin);
    } catch (error) {
      console.error(`couldn't get spinner_stage data from ${file}`);
    }
  }

  for (const region in spinnerTimesbyRegion) {
    const sum = spinnerTimesbyRegion[region].reduce(
      (acc, duration) => acc + duration,
      0
    );
    const count = spinnerTimesbyRegion[region].length;
    const average = sum / count;
    console.log(`==== ${region} ====`);
    console.log(`Average pre_login_redirect time: ${average}`);
  }
}

function getRegionFromUrl(url) {
  return url.match(/-(\w+)-\w+/)?.[1] ?? "local";
}

function formatUrlRecords(records) {
  let output = "";
  Object.values(records).forEach((record) => {
    output += `${new URL(record.url).pathname} - ${record.average}\n`;
  });
  return output;
}

(async function () {
  await calculateAverageSpinnerTime();
  await caclulateStatsFromFullReport();
  await getMostExpensiveRequests();
  await calculateIndividualAndTotalTimeOfStaticAssets();
  await calculateIndividualAndTotalTimeOfStaticAssets("rpc");
  await getRequestTimeline();
})();

module.exports = {
  calculateStatistics,
  caclulateStatsFromFullReport,
  getMostExpensiveRequests,
};
