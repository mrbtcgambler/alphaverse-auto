#!/usr/bin/env bash

# Get the directory of the current script
SCRIPT_DIR=$(dirname "$0")

# Go up one directory from the script location and then to the bin directory
CLEANUP_SCRIPT="${SCRIPT_DIR}/cleanup_screens.sh"

# Resolve to an absolute path just to make sure we can find it
CLEANUP_SCRIPT=$(realpath "$CLEANUP_SCRIPT")

# Ensure CLEANUP_SCRIPT points to the correct path
echo "Using cleanup script: $CLEANUP_SCRIPT"

# Check if the cleanup script exists
if [ ! -f "$CLEANUP_SCRIPT" ]; then
    echo "Cleanup script not found: $CLEANUP_SCRIPT"
    exit 1
fi

# Get the current user's crontab
crontab -l > mycron

# Add the new cron job to run every 5 minutes
echo "*/5 * * * * $CLEANUP_SCRIPT" >> mycron

# Install the new cron file
crontab mycron
rm mycron

echo "Cron job added to run $CLEANUP_SCRIPT every 5 minutes"
