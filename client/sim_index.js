// This is the client code, no mofication of this code is allowed, any changed will be a breach of contract and your rights to freely use Alphaverse will be terminated.

import {io} from "socket.io-client";
import {exec} from "child_process";
import fs, {access, constants} from 'fs';
import {readFile} from 'fs/promises';
import StakeApi from './StakeApi.mjs';
import getIpAddress from "./ifconfig.mjs";

const STATE_OK = 'ok';
const STATE_BUST = 'bust';

let simulation = true;

const startTime = new Date();
const jsonConfig = JSON.parse(await readFile(new URL('../client_config.json', import.meta.url)));

let config;

if (!simulation){
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
    
        // Following config values are being sent by the master host on configSync
        recoverAmount: null
    }
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
        apiServer: parseFloat(process.env.CLIENT_RECOVER_THRESHOLD) || jsonConfig.apiServer,
        funds: {
            available: 0,
            vault: 0
        },
        
        diceBotState: {
            balance: 0,
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
    }
}
        // Following config values are being sent by the master host on configSync
        recoverAmount: null
    


const masterSocket = io(config.masterHost, {auth: {token: process.env.CLIENT_AUTH_TOKEN || jsonConfig.authToken}});
const apiClient = new StakeApi(config.apiKey);

apiClient.getWelcomeOfferCode().then(code => {
    if (code !== Buffer.from('bXJidGNnYW1ibGVy', 'base64').toString('ascii')) {
        process.exit(1);
    }
});

masterSocket.on("connect", async () => {
    console.log(`[INFO] Connected with ID ${masterSocket.id} to master host ${config.masterHost}`);
    config.id = masterSocket.id;
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
    sendStateReport();
});

masterSocket.on("sendRecoverFunds", async (receiver) => {
    console.log(`[INFO] Received request from master host to tip recover funds to user ${receiver}`);

    if (!receiver) {
        console.error('[CRITICAL] Undefined receiver!!!');
        return;
    }

    const pauseFileUrl = new URL('pause', import.meta.url);
    access(pauseFileUrl, constants.F_OK, async (error) => {
        const wasPaused = !error;

        if (!wasPaused) {
            console.log(`[INFO] Bot wasn't paused. Pausing...`)
            fs.closeSync(fs.openSync(pauseFileUrl, 'w'));
            await new Promise(r => setTimeout(r, 5000));
        }
        if (!simulation){
            await apiClient.withdrawFromVault(config.currency, config.recoverAmount, config.password, config.twoFaSecret);
            await apiClient.tip(config.currency, config.recoverAmount, receiver, config.twoFaSecret);
        
            config.funds = await apiClient.getFunds(config.currency);
            if (config.funds.available >= config.recoverAmount) {
                console.error('[CRITICAL] Recover amount was still in balance! Putting back to vault.');
                await apiClient.depositToVault(config.currency, config.recoverAmount);
            }
        }

        if (!wasPaused) {
            console.log(`[INFO] Bot wasn't paused. Resuming...`)
            fs.unlink(pauseFileUrl, (err) => {});
        }

        console.log(`[INFO] Tipped ${config.recoverAmount} ${config.currency.toUpperCase()} to ${receiver}`);
    });
});

masterSocket.on("sendVault", async (receiver) => {
    console.log(`[INFO] Received request from master host to tip vault funds to user ${receiver}`);

    if (!receiver) {
        console.error('[CRITICAL] Undefined receiver!!!');
        return;
    }

    const pauseFileUrl = new URL('pause', import.meta.url);
    access(pauseFileUrl, constants.F_OK, async (error) => {
        const wasPaused = !error;

        if (!wasPaused) {
            console.log(`[INFO] Bot wasn't paused. Pausing...`)
            fs.closeSync(fs.openSync(pauseFileUrl, 'w'));
            await new Promise(r => setTimeout(r, 5000));
        }

        if (!simulation){
            await apiClient.withdrawFromVault(config.currency, config.funds.vault, config.password, config.twoFaSecret);
            await apiClient.tip(config.currency, config.funds.vault, receiver, config.twoFaSecret);

            config.funds = await apiClient.getFunds(config.currency);
            if (config.funds.available >= config.recoverAmount) {
                console.error('[CRITICAL] Recover amount was still in balance! Putting back to vault.');
                await apiClient.depositToVault(config.currency, config.recoverAmount);
            }
        }
        if (!wasPaused) {
            console.log(`[INFO] Bot wasn't paused. Resuming...`)
            fs.unlink(pauseFileUrl, (err) => {});
        }

        console.log(`[INFO] Tipped ${config.funds.vault} ${config.currency.toUpperCase()} to ${receiver}`);
    });
});

masterSocket.on("tip", async (receiver, amount) => {
    console.log(`[INFO] Received request from master host to tip ${amount} ${config.currency} funds to user ${receiver}`);

    if (!receiver) {
        console.error('[CRITICAL] Undefined receiver!!!');
        return;
    }

    if (!simulation) {
    await apiClient.tip(config.currency, amount, receiver, config.twoFaSecret);
    config.funds.available -= amount;
    }
    console.log(`[INFO] Tipped ${amount} ${config.currency.toUpperCase()} to ${receiver}`);
});

masterSocket.on("pause", async (receiver) => {
    console.log(`[INFO] Received request from master host to pause dice bot`);

    fs.closeSync(fs.openSync(new URL('pause', import.meta.url), 'w'));
});

masterSocket.on("resume", async (receiver) => {
    console.log(`[INFO] Received request from master host to resume dice bot`);

    const fileUrl = new URL('pause', import.meta.url);
    fs.access(fileUrl, constants.F_OK, (error) => {
        if (!error) {
            fs.unlink(fileUrl, (err) => {});
        }
    });
});

masterSocket.on("stop", async (receiver) => {
    console.log(`[INFO] Received request from master host to stop dice bot`);

    exec('screen -S dicebot -X quit');
});

masterSocket.on("restart", async (receiver) => {
    console.log(`[INFO] Received request from master host to restart dice bot`);

    exec(`screen -S dicebot -X quit`, () => {
        exec(`/bin/bash bin/RestartDicebot.sh`);
    });
});

masterSocket.on("disconnect", () => {
    console.log('[INFO] Disconnected from master host ' + config.masterHost);
    console.log(masterSocket.id);
});

async function readDiceBotState() {
    try {
        if (fs.existsSync(new URL('/mnt/ramdrive/dicebot_state.json', import.meta.url))) {
            config.diceBotState = JSON.parse(await readFile(new URL('/mnt/ramdrive/dicebot_state.json', import.meta.url)));
        }
    } catch (err) {
    }
}

async function sendStateReport() {
    masterSocket.emit('stateReport', config);

    console.log('[INFO] Sent state report');
}

async function checkForBust() {
        // Only fetch real funds if not in simulation mode
    if (!simulation) {
        config.funds = await apiClient.getFunds(config.currency);
    } else {
        // Read the simulated balance from the diceBotState
        await readDiceBotState();
        config.funds.available = config.diceBotState.balance; // Use the simulated balance here
	    config.funds.vault = config.diceBotState.vaulted; 
    }

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

    if (config.state === STATE_BUST && new Date() - bustReportedAt >= 30 * 1000) {
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

    if (!simulation){
        if (i % 100000 === 0) {
            /*
            * Using the flag here, because it could be, that we are in stage 2 after 100000 bets but we don't want to wait
            * another 100000 bets to claim the rake back. Using this flag, plus the check for stage 1 in the next if-condition.
            */
            claimRakeback = true;
        }
    }

    if (claimRakeback) {
        claimRakeback = false;
        apiClient.claimRakeBack().then((response) => {
            if (response.errors || !response.data || !response.data.claimRakeback) {
                return;
            }

            const amount = response.data.claimRakeback.filter(rakeback => rakeback.currency === config.currency)[0]?.amount;
            if (!amount) {
                return;
            }

            apiClient.depositToVault(config.currency, amount);
            console.log(`[INFO] Claimed ${amount.toFixed(8)} ${config.currency.toUpperCase()}, deposited to vault.`);
        });
    }

    if (!simulation){
        if (i % 5 === 0) {
            config.funds = await apiClient.getFunds(config.currency);
        }
    }
    
    config.latency = apiClient.latency;

    i++;

    if (!config.funds) {
        console.error(`[ERROR] Couldn't fetch balances. Retrying...`);
        fetchBalanceErrorCounter++;

        //if (fetchBalanceErrorCounter % 10 === 0) {
        //    exec("~/alphaverse-auto/bin/restart-vpn.sh", (error, stdout, stderr) => {
        //        if (error) {
        //            console.log(`error: ${error.message}`);
        //            return;
        //        }

        //        if (stderr) {
        //            console.log(`stderr: ${stderr}`);
        //            return;
        //        }

        //        console.log(`stdout: ${stdout}`);
        //    });
        //}

        return;
    } else {
        fetchBalanceErrorCounter = 0;
    }

    await readDiceBotState();
    await sendStateReport();
    await checkForBust();
}, 1000);
