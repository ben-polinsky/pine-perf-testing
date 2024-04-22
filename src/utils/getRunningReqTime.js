const fs = require("fs");

function getRunningReqTime(searchTerm = "static") {
  const runninReqTimeByRegion = {
    eastus: { start: 0, end: 0 },
    australiacentral: { start: 0, end: 0 },
    brazilsouth: { start: 0, end: 0 },
    local: { start: 0, end: 0 },
  };

  const data = JSON.parse(
    fs.readFileSync(
      "src/chart-app/data/request-timeline-by-region.json",
      "utf8"
    )
  );

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
    console.log(`Region ${region} duration: ${regionDuration / 1000}`);
  }
  return runninReqTimeByRegion;
}

getRunningReqTime("api.bentley.com/productsettings");
