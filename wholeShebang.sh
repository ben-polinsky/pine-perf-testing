set -e
# 1. sets environment variables from the local .env file
# 2. provisions azure resources via the utils/setupAzResources.js script
# 3. runs tests in all regions by triggering each of the regions endpoint using the triggerFns.sh script in this folder
# 4. downloads reports via the utils/downloadReports.js node script (I know I started using sh halfway through)
# 5. runs the utils/parseReports.js node script to parse the reports and output a summary

# set an array variable to hold the regions
regions=("brazilsouth" "eastus" "australiacentral")

# 1. set environment variables
source .env

# load variables from az.json file
azVars=$(cat ./az.json | jq -c '.[]')
while IFS= read -r line; do
    name=$(echo $line | jq -r '.name')
    value=$(echo $line | jq -r '.value')
    slotSetting=$(echo $line | jq -r '.slotSetting')
    export $name=$value
done <<<"$azVars"

# ensure environment variables are set
if [ -z "$TEST_USERNAME" ] ||
    [ -z "$TEST_PASSWORD" ] ||
    [ -z "$baseUrl" ] ||
    [ -z "$DOCKER_CUSTOM_IMAGE_NAME" ] ||
    [ -z "$AZ_RESOURCE_GROUP" ] ||
    [ -z "$STORAGE_ACCOUNT_NAME" ] ||
    [ -z "$AZ_REGIONS" ] ||
    [ -z "$AZ_FNPLAN_NAME" ] ||
    [ -z "$AZ_FNAPP_NAME" ] ||
    [ -z "$AZ_FN_NAME" ]; then
    echo "Please ensure all required environment variables are set in the .env file"

    exit 1
fi

if [[ "$AZ_REGIONS" != "ALL" ]]; then
    regions=($AZ_REGIONS)
fi

# 2. provision azure resources
echo "Provisioning Azure resources with command: ./src/utils/setupAzResources.js $AZ_RESOURCE_GROUP $STORAGE_ACCOUNT_NAME ALL $AZ_FNPLAN_NAME $AZ_FNAPP_NAME $AZ_FN_NAME $DOCKER_CUSTOM_IMAGE_NAME"
# ./src/utils/setupAzResources.js $AZ_RESOURCE_GROUP $STORAGE_ACCOUNT_NAME $AZ_REGIONS $AZ_FNPLAN_NAME $AZ_FNAPP_NAME $AZ_FN_NAME $DOCKER_CUSTOM_IMAGE_NAME

# 3. run tests in all regions

# Store PIDs of background jobs
pids=()

# Define a function to kill all background jobs
kill_jobs() {
    for pid in "${pids[@]}"; do
        kill $pid 2>/dev/null
    done
}

# Set a trap to kill all background jobs when the script exits
trap kill_jobs EXIT SIGINT

for region in "${regions[@]}"; do
    url="https://$AZ_FNAPP_NAME-$region.azurewebsites.net/api/$AZ_FN_NAME?iModelId=$iModelId&iTwinId=$iTwinId&$CUSTOM_QUERY_PARAMS"
    echo "Running tests in $region"
    ./triggerFns.sh $url 10 &
    pids+=($!) # Store PID of background job
done

wait

# 4. download and parse reports
node ./src/utils/downloadReports.js
node ./src/utils/parseReports.js
