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

cd
echo $SUDO_PASSWORD | sudo -S echo hello
screen -S client -X quit
screen -S dicebot -X quit
sudo umount /mnt/alphaverse-auto
echo "Creating /mnt/ramdrive if it doesn't exist..."
sudo mkdir -p /mnt/alphaverse-auto
echo "Mounting /mnt/ramdrive..."
sudo mount -t tmpfs -o size=900M,mode=777 tmpfs /mnt/alphaverse-auto/
sudo rsync -avz --exclude="alphaverse-1.0.4.AppImage" ~/alphaverse-auto/ /mnt/alphaverse-auto/
sudo chown ${USER} /mnt/alphaverse-auto/*
cd /mnt/alphaverse-auto/bin/
chmod +x *.sh
cd ..
./bin/RestartClient.sh
./bin/RestartDicebot.sh
touch client/pause
