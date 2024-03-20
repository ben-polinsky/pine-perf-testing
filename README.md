# Pine Perf Tests

- Create `.env` file and add info.
- `pnpm install`
- `pnpm test`
- `pnpm parseReports`

Note: add an azure blob storage connection string to the `.env` (azBlobConnectionString) file to upload reports.

### Running the tests on cold starts
In order to replicate cold starts consistently for every test run, we need to delete the provisioned iModel backend before starting the tests.

> This is optional, you can also run the performance tests on a warm backend too. This is feature flagged behind a `deleteBackend` env variable, which can be enabled by just passing any value in.

To run the backend deletion, you'll need the following env variables:
```
changeSetId=
orchestratorBaseUrl=
IMJS_URL_PREFIX=
IMJS_BACKEND_NAME=
IMJS_BACKEND_VERSION=
IMJS_AUTH_CLIENT_ID=
IMJS_AUTH_CLIENT_REDIRECT_URI=
IMJS_AUTH_AUTHORITY=
IMJS_AUTH_CLIENT_SCOPES=
```
We also have a `needChangesetId` env variable that can be enabled by passing any value in, which will output the changesetId of the imodel the tests run against.