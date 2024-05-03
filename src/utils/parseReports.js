const fs = require("fs/promises");
const path = require("path");
const stamp = Date.now();
const inboundReportsPath = path.resolve(__dirname, "..", "..", "reports");
const outboundDataPath = path.resolve(
  __dirname,
  "..",
  "..",
  "out",
  `data-${stamp}`
);

(async function () {
  await init();
  await calculateAverageStageTime("spinner_stage");
  await calculateAverageStageTime("pre_login_redirect");
  await calculateAverageStageTime("login");
  await gatherCapabilitiesByRegion();
  await getMostExpensiveRequests();
  await calculateIndividualAndTotalTimes("static");
  await calculateIndividualAndTotalTimes("rpc");
  await calculateIndividualAndTotalTimes("productsettings");
  await getRequestTimeline();
  await getRunningReqTime("static");
  await getRunningReqTime("rpc");
  await getRunningReqTime("productsettings");
})();

async function init() {
  console.log(
    `Parsing reports from ${inboundReportsPath} to ${outboundDataPath}`
  );
  await fs.mkdir(path.resolve(outboundDataPath), {
    recursive: true,
  });
}

async function getMostExpensiveRequests(numRequests = 10) {
  const files = await fs.readdir(inboundReportsPath);
  const requests = [];
  for (const file of files) {
    if (!file.startsWith("requests-") || !file.endsWith(".json")) continue;

    const filePath = path.join(inboundReportsPath, file);
    const fileData = await fs.readFile(filePath, "utf8");
    const jsonData = JSON.parse(fileData);
    for (const url in jsonData) {
      const duration = jsonData[url];
      const time = duration.responseEnd - duration.requestStart;
      requests.push({ url, time });
    }

    requests.sort((a, b) => b.time - a.time);
  }

  await fs.writeFile(
    path.join(outboundDataPath, "most-expensive-requests.json"),
    JSON.stringify(requests.slice(0, numRequests), null, 2)
  );
}

async function getRequestTimeline() {
  const requestTimelinebyRegion = {
    eastus: {},
    australiacentral: {},
    brazilsouth: {},
    local: {},
  };

  const files = await fs.readdir(inboundReportsPath);
  for (const file of files) {
    if (!file.startsWith("requests-") || !file.endsWith(".json")) continue;
    const region = getRegionFromUrl(file);

    const filePath = path.join(inboundReportsPath, file);
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
    path.join(outboundDataPath, `request-timeline-by-region.json`),
    JSON.stringify(requestTimelinebyRegion, null, 2)
  );
}

async function calculateIndividualAndTotalTimes(searchTerm) {
  const files = await fs.readdir(inboundReportsPath);

  const byRegion = {
    eastus: {},
    australiacentral: {},
    brazilsouth: {},
    local: {},
  };

  for (const file of files) {
    if (!file.startsWith("requests-") || !file.endsWith(".json")) continue;
    const region = getRegionFromUrl(file);

    const filePath = path.join(inboundReportsPath, file);
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

  let grandSummary = "";
  for (const region in byRegion) {
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
  }
  await fs.writeFile(
    path.join(outboundDataPath, `${searchTerm}-by-region.json`),
    JSON.stringify(byRegion, null, 2)
  );

  await fs.writeFile(
    path.join(outboundDataPath, `${searchTerm}-summary.txt`),
    grandSummary
  );
}

async function calculateAverageStageTime(stage) {
  const timesByRegion = {
    eastus: [],
    australiacentral: [],
    brazilsouth: [],
    local: [],
  };

  const files = await fs.readdir(inboundReportsPath);
  for (const file of files) {
    if (!file.startsWith("test-run-report") || !file.endsWith(".json"))
      continue;
    const region = getRegionFromUrl(file.replace("test-run-report", ""));
    const filePath = path.join(inboundReportsPath, file);
    const fileData = await fs.readFile(filePath, "utf8");
    const jsonData = JSON.parse(fileData);

    let duration;
    try {
      duration = jsonData.aggregate.summaries[`browser.step.${stage}`].max;
      timesByRegion[region].push(duration);
    } catch (error) {
      console.error(`couldn't get ${stage} data from ${file}`);
    }
  }

  let output = "";
  for (const region in timesByRegion) {
    // throw out the first value as it's always an outlier
    // const throwingOut = timesByRegion[region].shift();

    const sum = timesByRegion[region].reduce(
      (acc, duration) => acc + duration,
      0
    );
    const count = timesByRegion[region].length;
    const average = sum / count;
    const minimum = Math.min(...timesByRegion[region]);
    const maximum = Math.max(...timesByRegion[region]);
    const median = timesByRegion[region].sort()[Math.floor(count / 2)];

    output += `==== ${region} ====\n`;
    console.log(`==== ${region} ====`);
    output += `Average ${stage} time: ${average}\n\n`;
    console.log(`Average ${stage} time: ${average}\n`);

    output += `Minimum ${stage} time: ${minimum}\n\n`;
    console.log(`Minimum ${stage} time: ${minimum}\n`);

    output += `Maximum ${stage} time: ${maximum}\n\n`;
    console.log(`Maximum ${stage} time: ${maximum}\n`);

    output += `Median ${stage} time: ${median}\n\n`;
    console.log(`Median ${stage} time: ${median}\n`);

    // output += `Throwing out first as: ${throwingOut}\n\n`;
    // console.log(`Throwing out first as: ${throwingOut}\n\n`);
  }

  // ensure the data directory exists before writing to it
  await fs.mkdir(outboundDataPath, {
    recursive: true,
  });

  fs.writeFile(path.join(outboundDataPath, `${stage}-stats.txt`), output);
}

async function getRunningReqTime(searchTerm) {
  const runninReqTimeByRegion = {
    eastus: { start: 0, end: 0 },
    australiacentral: { start: 0, end: 0 },
    brazilsouth: { start: 0, end: 0 },
    local: { start: 0, end: 0 },
  };
  const file = await fs.readFile(
    path.join(outboundDataPath, "request-timeline-by-region.json"),
    "utf8"
  );
  let output = `${searchTerm} running request times:\n`;
  console.log(output);
  const data = JSON.parse(file);

  for (const region in data) {
    let regionDuration = 0;
    for (const url in data[region]) {
      if (url.includes(searchTerm)) {
        const { start, end } = data[region][url];

        if (start === 0) {
          runninReqTimeByRegion[region].start = start;
          runninReqTimeByRegion[region].end = end;
          regionDuration += end - start;
          continue;
        }

        if (end <= runninReqTimeByRegion[region].end) {
          runninReqTimeByRegion[region].start = start;
          continue;
        }

        if (
          end > runninReqTimeByRegion[region].end &&
          start <= runninReqTimeByRegion[region].end
        ) {
          regionDuration += end - runninReqTimeByRegion[region].end;
          runninReqTimeByRegion[region].end = end;
          continue;
        }

        if (start > runninReqTimeByRegion[region].end) {
          runninReqTimeByRegion[region].start = start;
          runninReqTimeByRegion[region].end = end;
          regionDuration += end - start;
          continue;
        }
      }
    }

    const outString = `Region ${region} requests matching '${searchTerm}' running duration: ${
      regionDuration / 1000
    }`;
    output += `${outString}\n`;
    console.log(outString);
  }

  output += "\n";
  console.log("\n");
  await fs.writeFile(
    path.join(outboundDataPath, `${searchTerm}-running-req-time.txt`),
    output
  );
  return runninReqTimeByRegion;
}

function calculateCapabilityStatistics(
  capabilityName,
  slowCapabilitiesDurations
) {
  const sum = slowCapabilitiesDurations.reduce(
    (acc, duration) => acc + duration,
    0
  );
  const count = slowCapabilitiesDurations.length;
  const average = sum / count;
  const minimum = Math.min(...slowCapabilitiesDurations);
  const maximum = Math.max(...slowCapabilitiesDurations);
  const median = slowCapabilitiesDurations.sort()[Math.floor(count / 2)];

  const standardDeviation = Math.sqrt(
    slowCapabilitiesDurations.reduce(
      (acc, duration) => acc + Math.pow(duration - average, 2),
      0
    ) / count
  );

  console.log("Capability:", capabilityName);
  console.log("Minimum:", minimum);
  console.log("Maximum:", maximum);
  console.log("Average:", average);
  console.log("Median:", median);
  console.log("Standard Deviation:", standardDeviation);
  console.log("\n");
}

async function gatherCapabilitiesByRegion() {
  const files = await fs.readdir(inboundReportsPath);
  const capabilitiesData = {};

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const region = getRegionFromUrl(file);

    const filePath = path.join(inboundReportsPath, file);
    const fileData = await fs.readFile(filePath, "utf8");
    const jsonData = JSON.parse(fileData);

    jsonData.fullReport?.slowCapabilities?.forEach((capability) => {
      if (capability.isError) return;

      const capabilityName = `${capability.moduleId}-${capability.capability}-${capability.lifecycleEvent}`;
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

    // calculateCapabilityStatistics(
    //   capabilityName,
    //   capabilitiesData[capabilityName][region]
    // );
  }

  await fs.writeFile(
    path.join(outboundDataPath, "capabilities-by-region.json"),
    JSON.stringify(capabilitiesData, null, 2)
  );
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

module.exports = {
  getMostExpensiveRequests,
};
