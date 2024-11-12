#!/usr/bin/env bash

# Get the directory of the current script
SCRIPT_DIR=$(dirname "$0")

# Go up one directory from the script location and then to the config file
CONFIG_FILE="${SCRIPT_DIR}/../client_config.json"

# Resolve to an absolute path just to make sure we can find it
CONFIG_FILE=$(realpath "$CONFIG_FILE")

# Ensure CONFIG_FILE points to the correct path
echo "Using config file: $CONFIG_FILE"

# Check if the config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Config file not found: $CONFIG_FILE"
    exit 1
fi

# Extract necessary information from the config file
SUDO_PASSWORD=$(jq -r '.sudoPassword' "$CONFIG_FILE")
API_SERVER=$(jq -r '.apiServer' "$CONFIG_FILE")

# Check if jq command was successful
if [ $? -ne 0 ]; then
    echo "Failed to extract information using jq"
    exit 1
fi

# Location of the known_ips.txt file
KNOWN_IPS_FILE="$HOME/alphaverse-auto/bin/known_ips.txt"

# Function to clean up tr46Check screens
cleanup_screens() {
    screen -ls | grep -o '[0-9]*\.tr46Check' | while read -r session; do
        screen -X -S "$session" kill
    done
}

# Clean up screens
cleanup_screens

