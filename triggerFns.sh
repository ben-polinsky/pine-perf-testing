#!/bin/bash

url="$1"
count="$2"

if [ -z "$url" ]; then
    echo "URL is required"
    exit 1
fi

if [ -z "$count" ]; then
    count=1
fi

for ((i = 1; i <= $count; i++)); do
    echo "Calling URL: $url (#$i)"
    curl -s "$url"
    sleep 1
done
