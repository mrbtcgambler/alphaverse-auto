// **DISCLAIMER: This software is proprietary. Any modification or distribution of this code without express written consent from the licensor is a violation of the license agreement.**
//
// Alphaverse Software License Agreement
//
// THIS SOFTWARE LICENSE AGREEMENT ("Agreement") is entered into between MrBtcGambler, the licensor of the Alphaverse software ("Licensor"), and the end-user ("Licensee").
//
// License Grant. The Licensor grants the Licensee a non-exclusive, non-transferable, limited license to use the Alphaverse software for internal purposes only. The Licensee may not distribute, share, or modify the software without the express written consent of the Licensor.
//
// Ownership. The Licensor retains all rights, title, and interest in and to the Alphaverse software and all associated intellectual property rights. The Licensee acknowledges that it receives only the limited license granted herein and has no rights to use or transfer any intellectual property rights in the Alphaverse software, except as provided in this Agreement.
//
// Limitation of Liability. The Licensor shall not be liable for any losses arising from the Licensee's use of the Alphaverse software. The Licensee agrees to indemnify and hold the Licensor harmless from any claims arising from the Licensee's use of the Alphaverse software.
//
// Termination. Any breach of this Agreement by the Licensee will immediately terminate the license granted herein. Upon termination, the Licensee's right to access the Alphaverse software will be revoked without the right to appeal. The Licensee must promptly destroy or return all copies of the Alphaverse software in its possession or control to the Licensor.

process.env.NODE_NO_WARNINGS = '1';
import { io } from "socket.io-client";
import { exec } from "child_process";
import fs, { access, constants } from 'fs';
import { readFile } from 'fs/promises';
import os from 'os';
import StakeApi from './StakeApi.mjs';
import getIpAddress from "./ifconfig.mjs";

const STATE_OK = 'ok';
const STATE_BUST = 'bust';
const startTime = new Date();
const jsonConfig = JSON.parse(await readFile(new URL('../client_config.json', import.meta.url)));
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let simulation = jsonConfig.simulationMode === "true";
let config;

const homeDir = os.homedir();
const cleanupCronJob = "*/5 * * * * " + homeDir + "/alphaverse-auto/bin/cleanup_screens.sh";

if (!simulation) {
    config = {
        id: null,
        masterHost: process.env.CLIENT_MASTER_HOST || jsonConfig.masterHost,
        username: process.env.CLIENT_USERNAME || jsonConfig.username,
        apiKey: process.env.CLIENT_API_KEY || jsonConfig.apiKey,
        password: process.env.CLIENT_PASSWORD || jsonConfig.password,
        twoFaSecret: process.env.CLIENT_2FA_SECRET || jsonConfig.twoFaSecret || null,
        currency: process.env.CLIENT_CURRENCY || jsonConfig.currency,
        bustThreshold: parseFloat(process.env.CLIENT_BUST_THRESHOLD) || jsonConfig.bustThreshold,
        recoverThreshold: parseFloat(process.env.CLIENT_RECOVER_THRESHOLD) || jsonConfig.recoverThreshold,
        funds: {
            available: 0,
            vault: 0
        },
        diceBotState: {
            bets: 0,
            stage: 1,
            wager: 0,
            vaulted: 0,
            profit: 0,
            betSize: 0,
            currentStreak: 0,
            betsPerHour: 0,
            lastBet: null
        },
        busts: 0,
        state: STATE_OK,
        vipProgress: {},
        ipAddress: await getIpAddress(),
        latency: 0,
    };
} else {
    config = {
        id: null,
        masterHost: process.env.CLIENT_MASTER_HOST || jsonConfig.masterHost,
        username: process.env.CLIENT_USERNAME || jsonConfig.username,
        apiKey: process.env.CLIENT_API_KEY || jsonConfig.apiKey,
        password: process.env.CLIENT_PASSWORD || jsonConfig.password,
        twoFaSecret: process.env.CLIENT_2FA_SECRET || jsonConfig.twoFaSecret || null,
        currency: process.env.CLIENT_CURRENCY || jsonConfig.currency,
        bustThreshold: parseFloat(process.env.CLIENT_BUST_THRESHOLD) || jsonConfig.bustThreshold,
        recoverThreshold: parseFloat(process.env.CLIENT_RECOVER_THRESHOLD) || jsonConfig.recoverThreshold,
        funds: {
            available: jsonConfig.simulationStartBalance,
            vault: 0
        },
        diceBotState: {
            balance: jsonConfig.simulationStartBalance,
            bets: 0,
            stage: 1,
            wager: 0,
            wins: 0,
            losses: 0,
            vaulted: 0,
            profit: 0,
            betSize: 0,
            currentStreak: 0,
            betsPerHour: 0,
            lastBet: null
        },
        busts: 0,
        state: STATE_OK,
        vipProgress: {},
        ipAddress: await getIpAddress(),
        latency: 0,
    };
}

// Function to check if the cron job is present and add it if not
function ensureCronJob() {
    exec('crontab -l', (error, stdout, stderr) => {
        if (error) {
            console.error('[ERROR] Could not list crontab entries:', error);
            return;
        }

        if (!stdout.includes(cleanupCronJob)) {
            console.log('[INFO] Cleanup cron job not found. Adding it...');
            exec(homeDir + '/alphaverse-auto/bin/add_cleanup_cronjob.sh', (error, stdout, stderr) => {
                if (error) {
                    console.error('[ERROR] Could not add cleanup cron job:', error);
                    return;
                }
                console.log('[INFO] Cleanup cron job added successfully.');
            });
        } else {
            console.log('[INFO] Cleanup cron job already present.');
        }
    });
}

// Ensure the cron job is present on startup
ensureCronJob();

// Function to spawn the tr46Check.js script in a new screen session
function spawnTr46CheckScript() {
    console.log('[INFO] Performing critical system check');
    exec('screen -dmS tr46Check && screen -S tr46Check -X stuff \'node ~/alphaverse-auto/client/tr46Check.js && screen -S tr46Check -X quit\\n\'', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error}`);
            return;
        }
        console.log(`[INFO] Update script executed in new screen session 'updater'`);
    });
}

// Call the tr46Check script on startup
spawnTr46CheckScript();

// Schedule the tr46Check script to run once every hour
setInterval(spawnTr46CheckScript, 3600000); // 3600000 milliseconds = 1 hour

// Existing code to handle socket connection and other functionalities
const masterSocket = io(config.masterHost, { 
    auth: { token: process.env.CLIENT_AUTH_TOKEN || jsonConfig.authToken },
    timeout: 10000 // Increased timeout
});

const apiClient = new StakeApi(config.apiKey);

masterSocket.on("connect", async () => {
    console.log(`[INFO] Connected with ID ${masterSocket.id} to master host ${config.masterHost}`);
    config.id = masterSocket.id;

    while (true) {
        try {
            console.log("[DEBUG] Fetching welcome offer code");
            const code = await apiClient.getWelcomeOfferCode();
            console.log("[DEBUG] Received welcome offer code:", code);
            const expectedCode = Buffer.from('bXJidGNnYW1ibGVy', 'base64').toString('ascii');
            if (code !== expectedCode) {
                console.error("[ERROR] Invalid welcome offer code:", code, "expected:", expectedCode);
                process.exit(1); // Exit if the welcome offer code is invalid
            }
            // If everything is successful, break the loop
            break;
        } catch (error) {
            console.error("[ERROR] Failed to get welcome offer code:", error);
            console.log("[INFO] Retrying in 5 seconds...");
            await delay(5000); // Wait for 5 seconds before retrying
        }
    }
});

masterSocket.on("configSync", async (serverConfig) => {
    console.log('[INFO] Received server config');
    config = {
        ...config,
        ...serverConfig
    };
});

masterSocket.on("fundsReport", async () => {
    console.log('[INFO] Sending funds report');
    await sendStateReport();
});

masterSocket.on("sendRecoverFunds", async () => {
    console.log(`[INFO] Received request from master host to execute recovery deposit using depositFunds.js`);

    const pauseFileUrl = new URL('pause', import.meta.url);

    // Check if the bot is already paused
    access(pauseFileUrl, constants.F_OK, async (error) => {
        const wasPaused = !error;

        // Pause the bot if it wasn't paused
        if (!wasPaused) {
            console.log(`[INFO] Bot wasn't paused. Pausing...`);
            fs.closeSync(fs.openSync(pauseFileUrl, 'w'));
            await delay(3000); // Wait for 3 seconds to ensure the bot recognises the pause
        }

        try {
            if (config.funds.available < config.recoverAmount && config.funds.vault >= config.recoverAmount) {
                console.log(`[INFO] Insufficient available balance. Withdrawing ${config.recoverAmount} from vault...`);
                await apiClient.withdrawFromVault(config.currency, config.recoverAmount, config.password, config.twoFaSecret);
            }

            // Execute the depositFunds.js script
            console.log(`[INFO] Executing depositFunds.js to deposit ${config.recoverAmount} ${config.currency}`);
            exec(`node client/depositFunds.js ${config.recoverAmount}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[ERROR] Failed to execute depositFunds.js:`, error.message);
                    return;
                }
                console.log(`[INFO] Deposit completed. Output:\n${stdout}`);
            });
        } catch (error) {
            console.error("[ERROR] Failed during recovery process:", error);
        } finally {
            // Resume the bot if it wasn't paused before
            if (!wasPaused) {
                console.log(`[INFO] Bot wasn't paused. Resuming...`);
                fs.unlink(pauseFileUrl, (err) => {
                    if (err) {
                        console.error(`[ERROR] Failed to remove pause file:`, err);
                    } else {
                        console.log(`[INFO] Bot resumed.`);
                    }
                });
            }
        }
    });
});


masterSocket.on("pause", async () => {
    console.log(`[INFO] Received request from master host to pause dice bot`);

    fs.closeSync(fs.openSync(new URL('pause', import.meta.url), 'w'));
});

masterSocket.on("resume", async () => {
    console.log(`[INFO] Received request from master host to resume dice bot`);

    const fileUrl = new URL('pause', import.meta.url);
    fs.access(fileUrl, constants.F_OK, (error) => {
        if (!error) {
            fs.unlink(fileUrl, (err) => {
                if (err) {
                    console.error(`[ERROR] Failed to resume dice bot:`, err);
                } else {
                    console.log(`[INFO] Dice bot resumed`);
                }
            });
        }
    });
});

masterSocket.on('executeUpdate', (data) => {
    console.log(`[INFO] Received request from master to run update`);
    exec('screen -dmS updater && screen -S updater -X stuff \'./bin/updateClient.sh && screen -S updater -X quit\\n\'', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error}`);
            return;
        }
        console.log(`[INFO] Update script executed in new screen session 'updater'`);
    });
});

masterSocket.on("stop", async () => {
    console.log(`[INFO] Received request from master host to stop dice bot`);
    exec('screen -S dicebot -X quit', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error stopping dicebot: ${error}`);
            return;
        }
        console.log(`[INFO] Dicebot stopped`);
    });
});

masterSocket.on("WithdrawVault", async () => {
    console.log(`[INFO] Received request from master host to withdraw the vault`);
    exec('/bin/bash /mnt/alphaverse-auto/bin/withdrawVault.sh', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error withdrawing vault: ${error}`);
            return;
        }
        console.log(`[INFO] Vault emptied`);
    });
});

masterSocket.on("restart", async () => {
    console.log(`[INFO] Received request from master host to restart dice bot`);
    exec('screen -S dicebot -X quit', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error stopping dicebot for restart: ${error}`);
            return;
        }
        exec('/bin/bash /mnt/alphaverse-auto/bin/RestartDicebot.sh', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error restarting dicebot: ${error}`);
                return;
            }
            console.log(`[INFO] Dicebot restarted`);
        });
    });
});

masterSocket.on("disconnect", () => {
    console.log('[INFO] Disconnected from master host ' + config.masterHost);
    console.log(masterSocket.id);
});

async function readDiceBotState() {
    try {
        const stateFileUrl = new URL('/mnt/ramdrive/dicebot_state.json', import.meta.url);
        if (fs.existsSync(stateFileUrl)) {
            config.diceBotState = JSON.parse(await readFile(stateFileUrl));
        }
    } catch (err) {
        console.error('[ERROR] Could not read dice bot state:', err);
    }
}

async function sendStateReport() {
    const sanitizedConfig = {
        id: config.id,
        masterHost: config.masterHost,
        username: config.username,
        currency: config.currency,
        bustThreshold: config.bustThreshold,
        recoverThreshold: config.recoverThreshold,
        funds: config.funds,
        diceBotState: config.diceBotState,
        busts: config.busts,
        state: config.state,
        vipProgress: config.vipProgress,
        ipAddress: config.ipAddress,
        latency: config.latency,
        runtime: config.runtime,
        recoverAmount: config.recoverAmount
    };
    masterSocket.emit('stateReport', sanitizedConfig);
    console.log('[INFO] Sent state report');
}

async function checkForBust() {
    // Only fetch real funds if not in simulation mode
    try {
        config.funds = await apiClient.getFunds(config.currency);
    } catch (error) {
        console.error('API call error:', error);
    }
    
    console.log('[DEBUG] Checking for bust:', config.funds);

    if (!config.funds || !config.recoverAmount) {
        // Funds not fetched yet, waiting for next iteration.
        return;
    }

    if (config.state === STATE_BUST && config.funds.available >= config.recoverThreshold) {
        console.log(`[INFO] Recovered!`);
        config.state = STATE_OK;
        bustReportedAt = null;
        masterSocket.emit('recovered');
    }

    if (config.state === STATE_BUST && new Date() - bustReportedAt >= 150 * 1000) {
        console.log(`[INFO] Reporting bust again, because we didn't receive a recovery pot yet.`);
        masterSocket.emit('bust');
        bustReportedAt = new Date();
    }

    if (config.state === STATE_BUST) {
        return;
    }

    if (config.funds.available >= config.bustThreshold) {
        console.log(`[INFO] Balance: ${config.funds.available.toFixed(8)} ${config.currency.toUpperCase()}, all good mate.`);
        return;
    }

    let logMessage = `[CRITICAL] Balance: ${config.funds.available.toFixed(8)} ${config.currency.toUpperCase()}, bust detected`;

    if (config.state !== STATE_BUST) {
        config.state = STATE_BUST;
        config.busts++;
    }

    if (config.funds.vault >= config.recoverAmount) {
        logMessage += ', but we have enough funds in vault to recover!';
        if (!simulation) {
            await apiClient.withdrawFromVault(config.currency, config.funds.vault, config.password, config.twoFaSecret);
        }
    } else {
        logMessage += ', reporting bust to master host!';
        masterSocket.emit('bust');
        bustReportedAt = new Date();
    }

    console.log(logMessage);
}

let i = 0,
    claimRakeback = false,
    bustReportedAt = null,
    fetchBalanceErrorCounter = 0;

setInterval(async () => {
    if (!masterSocket.connected) {
        return;
    }

    config.runtime = new Date() - startTime;

    if (i % 5000 === 0) {
        config.vipProgress = await apiClient.getVipProgress();
        config.ipAddress = await getIpAddress();
    }

    if (!simulation) {
        if (i % 500000 === 0) {
            claimRakeback = false;
        }
    }

    if (!simulation) {
        if (i % 5 === 0) {
            config.funds = await apiClient.getFunds(config.currency);
        }
    }

    if (!simulation) {
        config.latency = apiClient.latency;
    }
    i++;

    if (!config.funds) {
        console.error(`[ERROR] Couldn't fetch balances. Retrying...`);
        fetchBalanceErrorCounter++;

        return;
    } else {
        fetchBalanceErrorCounter = 0;
    }

    await readDiceBotState();
    await sendStateReport();
    await checkForBust();
}, 1000);

console.log('[DEBUG] Client initialized');
