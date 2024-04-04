import Chart from "chart.js/auto";
import data from "./data/PROD/static-assets-by-region-short.json";
import capabilityData from "./data/PROD/capabilities-by-region.json";
import timelineData from "./data/PROD/request-timeline-by-region.json";
import rpcData from "./data/rpc-by-region-short.json";

(async function () {
  drawStaticAssetsChart();
  drawCombinedStaticAssets();
  drawTimelineContextByRegion();
  drawRPCTimes();
})();

function drawStaticAssetsChart() {
  new Chart(document.getElementById("static-assets"), {
    type: "bar",
    data: {
      labels: Object.keys(data),
      datasets: [
        {
          label: "Total static asset time (s) by region",
          data: Object.values(data).map((region) => region.totalTime / 1000),
        },
      ],
    },
  });
}

function drawCombinedStaticAssets() {
  let labels = [];
  let datasets = [];

  for (const region in data) {
    if (region === "other") continue;

    const regionLabels = data[region].mostExpensive.map((record) =>
      new URL(record.url).pathname.replace("/static/js/", "")
    );

    labels = [...new Set([...labels, ...regionLabels])];

    datasets.push({
      label: `${region}`,
      data: labels.map(
        (label) =>
          data[region].mostExpensive.find(
            (record) =>
              new URL(record.url).pathname.replace("/static/js/", "") === label
          )?.average / 1000 || 0
      ),
    });
  }

  const ctx = document.getElementById(`combined-static-assets`);
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets,
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Top 10 most expensive static assets by region (avg) in seconds",
        },
      },
      indexAxis: "y",
      scales: {
        x: {
          ticks: {
            maxRotation: 0,
            minRotation: 0,
          },
        },
      },
    },
  });
}

function drawRPCTimes() {
  const rpcTimes = document.getElementById(`rpc-times`);
  const allUrls = new Set(
    Object.values(rpcData)
      .map((u) => Object.keys(u))
      .flat()
      .filter((u) => u.startsWith("https://"))
      .map((s) => new URL(s).pathname)
    // .map((s) => new URL(s).pathname)
  );
  const rpcDatasets = Object.keys(rpcData).map((region) => {
    return {
      label: region,
      data: Object.entries(rpcData[region]).map(
        ([url, record]) => record.average / 1000
      ),
    };
  });

  new Chart(rpcTimes, {
    type: "line",
    data: {
      labels: Array.from(allUrls),
      datasets: rpcDatasets,
    },
    options: {
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        title: {
          display: true,
          text: "RPC times by region (s)",
        },
      },
    },
  });
}

function drawTimelineContextByRegion() {
  const timelineContextByRegion = document.getElementById(`request-timeline`);
  const allurls = Object.values(timelineData);
  const timelineDatasets = Object.keys(timelineData).map((region) => {
    let timeElapsed = 0;
    const entries = Object.entries(timelineData[region]);
    const innerData = entries.map(([url, record]) => {
      timeElapsed = timeElapsed + record.end - record.start;
      return timeElapsed / 1000;
    });
    return {
      label: region,
      data: innerData,
    };
  });

  const allUrls = new Set(allurls.map((u) => Object.keys(u)).flat());

  new Chart(timelineContextByRegion, {
    type: "line",
    data: {
      labels: Array.from(allUrls),
      datasets: timelineDatasets,
    },
    legend: {},
    options: {
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        title: {
          display: true,
          text: "Request waterfall by region (s)",
        },
      },
    },
  });
}
