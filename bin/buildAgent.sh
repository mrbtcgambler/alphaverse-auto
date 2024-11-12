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

# Extract sudo password from config file
SUDO_PASSWORD=$(jq -r '.sudoPassword' "$CONFIG_FILE")

echo $SUDO_PASSWORD | sudo -S echo Building Agent..

cd
rm -rf proxy
mkdir proxy
cp -r ~/alphaverse-auto/agent/* ~/proxy/
cd proxy/
npm install
npm update
sudo chown root ~/proxy/node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 ~/proxy/node_modules/electron/dist/chrome-sandbox

