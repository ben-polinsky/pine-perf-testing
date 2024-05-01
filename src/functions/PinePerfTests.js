const { app } = require("@azure/functions");
const { spawn } = require("child_process");

app.http("PinePerfTests", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const iModelId = request.query.get("iModelId");
      const iTwinId = request.query.get("iTwinId");
      context.log(
        `Running tests for iTwinId: ${iTwinId}, iModelId: ${iModelId}\n`
      );
      request.query.delete("iModelId");
      request.query.delete("iTwinId");

      const customQueryParams = request.query.toString();
      const childProcess = spawn("npm", ["run", "test"], {
        env: {
          ...process.env,
          iModelId,
          iTwinId,
          CUSTOM_QUERY_PARAMS: customQueryParams,
        },
      });

      return new Promise((resolve, reject) => {
        childProcess.stdout.on("data", (data) => {
          context.log(data.toString());
        });

        childProcess.stderr.on("data", (data) => {
          context.error(data.toString());
        });

        childProcess.on("close", (code) => {
          if (code === 0) {
            context.log("Tests completed successfully");

            resolve({
              status: 200,
              text: "Tests completed successfully",
            });
          } else {
            context.log(`Tests failed with code ${code}`);
            reject({
              status: 500,
              text: `Tests failed with code ${code}`,
            });
          }
        });
      });
    } catch (error) {
      context.error(error);
      return {
        status: 500,
        body: "Error running tests - please see logs",
      };
    }
  },
});
