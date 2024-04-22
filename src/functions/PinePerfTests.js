const { app } = require("@azure/functions");
const { execSync } = require("child_process");

app.http("PinePerfTests", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = execSync("npm run test");
      return {
        body,
      };
    } catch (error) {
      console.error(error);
      return {
        status: 500,
        body: "Error running tests - please see logs",
      };
    }
  },
});
