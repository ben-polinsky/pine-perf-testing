const { app } = require("@azure/functions");
const { execSync } = require("child_process");

app.http("PinePerfTests", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    const lsBody = execSync("npm run test");
    return {
      body: `Hello, PinePerfTests: ${lsBody}`,
    };
  },
});
