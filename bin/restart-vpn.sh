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

# Location of the known_ips.txt file
KNOWN_IPS_FILE="$HOME/alphaverse-auto/bin/known_ips.txt"

cd $HOME/alphaverse-auto/
echo $SUDO_PASSWORD | sudo -S echo hello
sshpass -p "$SUDO_PASSWORD" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${user}@${API_SERVER}:/home/${USER}/alphaverse-auto/known_ips.txt $KNOWN_IPS_FILE
screen -X -S client kill


# Function to connect to VPN
connect_vpn() {
    VPN_LOCATIONS=("de_berlin" "de_frankfurt" "france" "denmark" "finland" "hungary" "ireland" "malta" "norway" "poland")
    VPN=$(( RANDOM % ${#VPN_LOCATIONS[@]} ))
    LOCATION=${VPN_LOCATIONS[$VPN]}
    echo "Connecting to $LOCATION..."
    sudo cp $HOME/VPN/${LOCATION}.ovpn /etc/openvpn/client.conf
    sudo -S systemctl restart openvpn@client.service
}

# Function to check IP
check_ip() {
    CURRENT_IP=$(curl -s ifconfig.io)
    echo "Current IP: $CURRENT_IP"
    
    # Read known IPs from file
    if [[ -f "$KNOWN_IPS_FILE" ]]; then
        mapfile -t KNOWN_IPS < "$KNOWN_IPS_FILE"
    else
        echo "Known IPs file does not exist."
        return 1
    fi
    
    for ip in "${KNOWN_IPS[@]}"; do
        if [[ "$CURRENT_IP" == "$ip" ]]; then
            return 1 # IP match found
        fi
    done
    return 0 # No match found
}

# Main loop
while true; do
    # Kill any existing OpenVPN processes
    echo "Killing existing OpenVPN processes..."
    echo $SUDO_PASSWORD | sudo -S killall openvpn

    # Connect to a VPN
    connect_vpn

    # Wait for a moment to ensure VPN connection is established
    echo "Establishing VPN connection..."
    sleep 5

    # Check the current public IP
    if check_ip; then
        echo "Unique IP obtained."
	sleep 2
	screen -dmS client && screen -S client -X stuff 'cd /mnt/alphaverse-auto && npm run client\n'
	sleep 3
        break  # Correct IP obtained, exit the loop
    else
        echo "Known IP detected. Trying a different VPN..."
        # Continue the loop to try a different VPN
    fi
done

