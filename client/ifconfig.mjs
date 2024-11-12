import fetch from 'node-fetch';
import { exec } from 'child_process';

// Helper function to validate IP address (IPv4 and IPv6)
const isValidIp = (ip) => {
    const ipv4Pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Pattern = /^[0-9a-fA-F:]+$/;
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
};

// Helper function to use curl to get the IP address with retries
const getIpWithCurl = (retries = 3) => {
    return new Promise((resolve, reject) => {
        const attempt = (retryCount) => {
            exec("curl -s ifconfig.io", (error, stdout, stderr) => {
                if (error || stderr) {
                    if (retryCount > 0) {
                        console.warn(`Retrying curl... attempts left: ${retryCount}`);
                        attempt(retryCount - 1);
                    } else {
                        reject(error || new Error(stderr));
                    }
                    return;
                }
                const ip = stdout.trim();
                if (isValidIp(ip)) {
                    resolve(ip);
                } else {
                    reject(new Error('Invalid IP address format from curl.'));
                }
            });
        };
        attempt(retries);
    });
};

// Helper function to fetch the IP from a web service with retries
const getIpWithFetch = async (retries = 3) => {
    const attempt = async (retryCount) => {
        try {
            const response = await fetch('https://ifconfig.me/ip');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const ipAddress = await response.text();
            const trimmedIp = ipAddress.trim();
            if (isValidIp(trimmedIp)) {
                return trimmedIp;
            } else {
                throw new Error('Invalid IP address format from fetch.');
            }
        } catch (error) {
            if (retryCount > 0) {
                console.warn(`Retrying fetch... attempts left: ${retryCount}`);
                return await attempt(retryCount - 1);
            } else {
                throw error;
            }
        }
    };
    return attempt(retries);
};

// Main function to get the IP address
export default async function getIpAddress() {
    try {
        // Try to get the IP with curl first
        return await getIpWithCurl();
    } catch (curlError) {
        console.error('Error retrieving IP with curl:', curlError.message);
        // If curl fails, try to fetch from ifconfig.me
        try {
            return await getIpWithFetch();
        } catch (fetchError) {
            console.error('Error retrieving IP with fetch:', fetchError.message);
            return 'N/A';
        }
    }
}
