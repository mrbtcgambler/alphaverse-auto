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

# Check if jq command was successful
if [ $? -ne 0 ]; then
    echo "Failed to extract sudo password using jq"
    exit 1
fi
#Setting up ramdrive for dicebot_state.json
echo $SUDO_PASSWORD | sudo -S echo Setting up ramdrive for dicebot_state.json....

# Check if /mnt/ramdrive is already mounted
if mount | grep -q "/mnt/ramdrive"; then
    echo "/mnt/ramdrive is already mounted. No further action required."
else
    # Create the directory if it doesn't exist
    echo "Creating /mnt/ramdrive as it doesn't exist..."
    sudo mkdir -p /mnt/ramdrive

    # Mount the ramdrive
    echo "Mounting /mnt/ramdrive..."
    sudo mount -t tmpfs -o size=1M tmpfs /mnt/ramdrive
fi

sleep 3

screen -S dicebot -X quit
sleep 1
node client/withdrawFromVault.js
sleep 3
node client/StartBalance.js
sleep 3
cd /mnt/alphaverse-auto/
screen -dmS dicebot && screen -S dicebot -X stuff 'npm run dicebot\n'
sleep 1
exit
