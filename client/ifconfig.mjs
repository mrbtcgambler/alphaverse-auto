import { exec } from 'child_process';
import fetch from 'node-fetch';

/** -----------------------
 *  IP VALIDATION CHECKER
 *  -----------------------
 */
function isValidIp(ip) {
  const ipv4Pattern =
    /^(25[0-5]|2[0-4][0-9]|[01]?\d\d?)\.(25[0-5]|2[0-4][0-9]|[01]?\d\d?)\.(25[0-5]|2[0-4][0-9]|[01]?\d\d?)\.(25[0-5]|2[0-4][0-9]|[01]?\d\d?)$/;
  const ipv6Pattern = /^[0-9a-fA-F:]+$/;
  return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

/** -----------------------
 *   1) DIG-BASED APPROACH
 *  -----------------------
 *  Uses OpenDNS to get your public IP.
 */
function getIpWithDig(retries = 3, delayMs = 500) {
  return new Promise((resolve, reject) => {
    const attempt = (remainingRetries, currentDelay) => {
      exec(
        'dig +short myip.opendns.com @resolver1.opendns.com',
        (error, stdout, stderr) => {
          if (error || stderr) {
            console.warn(
              `dig error. Retries left: ${remainingRetries - 1}. Output: ${stderr || error.message}`
            );
            if (remainingRetries > 1) {
              setTimeout(
                () => attempt(remainingRetries - 1, currentDelay * 2),
                currentDelay
              );
            } else {
              reject(error || new Error(stderr));
            }
            return;
          }

          const ip = stdout.trim();
          if (isValidIp(ip)) {
            resolve(ip);
          } else {
            console.warn(`dig returned an invalid IP: ${ip}`);
            if (remainingRetries > 1) {
              setTimeout(
                () => attempt(remainingRetries - 1, currentDelay * 2),
                currentDelay
              );
            } else {
              reject(new Error('Invalid IP address format from dig.'));
            }
          }
        }
      );
    };
    attempt(retries, delayMs);
  });
}

/** ----------------------------
 *   2) MULTI-SERVICE APPROACH
 *  ----------------------------
 *  Fallback URLs in case dig fails.
 */
const IP_SERVICE_URLS = [
  'https://ifconfig.me/ip',
  'https://ifconfig.io/ip',
  'https://icanhazip.com',
];

/**
 * Fetch IP from a single endpoint with retry and exponential backoff
 */
async function fetchIpWithBackoff(url, retries = 3, delayMs = 500) {
  if (retries <= 0) {
    throw new Error(`All retries failed for ${url}`);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP status: ${response.status}`);
    }

    const ipAddress = (await response.text()).trim();
    if (!isValidIp(ipAddress)) {
      throw new Error('Invalid IP address format.');
    }

    return ipAddress;
  } catch (error) {
    console.warn(`Error fetching IP from ${url}: ${error.message}`);
    console.warn(`Retries left: ${retries - 1}, next delay: ${delayMs * 2}ms`);
    await new Promise((res) => setTimeout(res, delayMs));
    return fetchIpWithBackoff(url, retries - 1, delayMs * 2);
  }
}

/**
 * Try a list of endpoints in sequence
 */
async function getIpFromMultipleServices() {
  for (const url of IP_SERVICE_URLS) {
    try {
      const ip = await fetchIpWithBackoff(url);
      return ip;
    } catch (err) {
      console.error(`Failed to fetch IP from ${url}: ${err.message}`);
    }
  }
  throw new Error('All IP services failed.');
}

/** -------------------
 *   3) CURL FALLBACK
 *  -------------------
 */
function getIpWithCurl(retries = 3, delayMs = 500) {
  return new Promise((resolve, reject) => {
    const attempt = (remainingRetries, currentDelay) => {
      exec('curl -s ifconfig.io', (error, stdout, stderr) => {
        if (error || stderr) {
          console.warn(
            `curl error. Retries left: ${remainingRetries - 1}. Output: ${stderr || error.message}`
          );
          if (remainingRetries > 1) {
            setTimeout(
              () => attempt(remainingRetries - 1, currentDelay * 2),
              currentDelay
            );
          } else {
            reject(error || new Error(stderr));
          }
          return;
        }

        const ip = stdout.trim();
        if (isValidIp(ip)) {
          resolve(ip);
        } else {
          console.warn(`curl returned an invalid IP: ${ip}`);
          if (remainingRetries > 1) {
            setTimeout(
              () => attempt(remainingRetries - 1, currentDelay * 2),
              currentDelay
            );
          } else {
            reject(new Error('Invalid IP address format from curl.'));
          }
        }
      });
    };
    attempt(retries, delayMs);
  });
}

/** -----------------------
 *   MAIN RETRIEVAL LOGIC
 *  -----------------------
 */
export default async function getIpAddress() {
  try {
    // 1) Prefer the DNS-based approach via dig
    return await getIpWithDig();
  } catch (digError) {
    console.error('Error retrieving IP with dig:', digError.message);

    // 2) If dig fails, attempt multiple services
    try {
      return await getIpFromMultipleServices();
    } catch (multiError) {
      console.error('Error retrieving IP from all services:', multiError.message);

      // 3) Final fallback to curl
      try {
        return await getIpWithCurl();
      } catch (curlError) {
        console.error('Error retrieving IP with curl:', curlError.message);
        return 'N/A';
      }
    }
  }
}
