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
API_SERVER=$(jq -r '.apiServer' "$CONFIG_FILE")
# Check if jq command was successful
if [ $? -ne 0 ]; then
    echo "Failed to extract sudo password using jq"
    exit 1
fi

# Location of the change.sh bash script file
CHANGE_SCRIPT="$HOME/alphaverse-auto/bin/change.sh"

cd $HOME/alphaverse-auto/
echo $SUDO_PASSWORD | sudo -S echo hello
sshpass -p "$SUDO_PASSWORD" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${user}@${API_SERVER}:/home/${USER}/alphaverse-auto/bin/change.sh $CHANGE_SCRIPT

# Add executable rights to change.sh
chmod +x $CHANGE_SCRIPT

# Run the change script, no turning back!
cd $HOME/alphaverse-auto/
./bin/change.sh
sleep 5

