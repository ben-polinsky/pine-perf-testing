FROM mcr.microsoft.com/azure-functions/node:4-node18-slim

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

WORKDIR /home/site/wwwroot
COPY package.json /home/site/wwwroot
RUN npm install
RUN npx playwright install-deps
COPY . /home/site/wwwroot
