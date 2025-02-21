//********************************************************************************************
//** Next_Level_Wager                                                                       **
//** Version: 2                                                                             ** 
//** Date: 12/01/2025                                                                       **
//** Authour: MrBtcGambler                                                                  **
//** Training Video:                                                                        **
//**                                                                                        **
//** Overview:                                                                              **
//** This code is for wagering to the next vip level at no cost                             **
//** Wait until you are at least 85% of the way to the next VIP level                       **
//** Set the WagerTarget constant on line 33 of this code                                   **
//** playing just to wager                                                                  **
//********************************************************************************************

import { unlink, access, constants } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import StakeApi from "./StakeApi.mjs";

const clientConfig = JSON.parse(await readFile(new URL('../client_config.json', import.meta.url)));
const serverConfig = JSON.parse(await readFile(new URL('../server_config.json', import.meta.url)));
let config = {
    apiKey: process.env.CLIENT_API_KEY || clientConfig.apiKey,
    password: process.env.CLIENT_PASSWORD || clientConfig.password,
    twoFaSecret: process.env.CLIENT_2FA_SECRET || clientConfig.twoFaSecret || null,
    currency: process.env.CLIENT_CURRENCY || clientConfig.currency,
    recoverAmount: process.env.SERVER_RECOVER_AMOUNT || serverConfig.recoverAmount,
    recoverThreshold: process.env.CLIENT_RECOVER_THRESHOLD || clientConfig.recoverThreshold,
    funds: null
};

const apiClient = new StakeApi(config.apiKey);
config.funds = await apiClient.getFunds(config.currency);
const wagerTarget = 1000; // Set your wager target here

let balance = config.funds.available,
    version = 2,
    game = "dice",
    baseBet = 0.1,
    chance = 99,
    betHigh = false,
    win = false,
    betDelay = 40, // delay in milliseconds
    currentStreak = 0,
    profit = 0,
    vaulted = 0,
    wager = 0,
    bets = 0,
    winCount = 0,
    stage = 2,
    switchOverUnderLoseStreak = 0,
    switchOverUnderWinStreak = 0,
    nextBet = baseBet,
    highestLosingStreak = 0,
    lastHourBets = [],
    paused = false,
    simulation = false,
    pauseLogged = false;


function getBetsPerHour() {
    const now = +new Date();
    lastHourBets = lastHourBets.filter((timestamp) => now - timestamp <= 60 * 60 * 1000);

    return lastHourBets.length;
}

async function doBet() {

        
    if (wager >= wagerTarget){
        process.exit(1);
    }

    if (win) {
        winCount++
    }

    if (currentStreak >= switchOverUnderWinStreak) {
        betHigh = !betHigh;
    }

    if (currentStreak <= switchOverUnderLoseStreak) {
        betHigh = !betHigh;
    }


}

// Delete old state file
const dicebotStateFilename = new URL('/mnt/ramdrive/dicebot_state.json', import.meta.url);
access(dicebotStateFilename, constants.F_OK, (error) => {
    if (!error) {
        unlink(dicebotStateFilename, (err) => {
        });
    }
});

async function writeStatsFile() {
    await writeFile(dicebotStateFilename, JSON.stringify({
        bets: bets,
        stage: stage,
        wager: wager,
        vaulted: vaulted,
        profit: profit,
        betSize: nextBet,
        currentStreak: currentStreak,
        highestLosingStreak: highestLosingStreak,
        betsPerHour: getBetsPerHour(),
        lastBet: (new Date()).toISOString(),
        wins: winCount,
        losses: (bets - winCount),
        version: version,
        paused: paused
    }));
}

let diceRoll = null,
    newBalance = null,
    roundProfit = 0,
    pauseFileUrl = new URL('pause', import.meta.url);
while (true) {
    let dragonTowerBet; 
    access(pauseFileUrl, constants.F_OK, (error) => {
        paused = !error;
    });

    if (paused) {
        if (!pauseLogged) {
            console.log('[INFO] Paused...');
            pauseLogged = true;
        }
        await writeStatsFile();
        await new Promise(r => setTimeout(r, 1000));
        continue;
    } else {
        pauseLogged = false; // Reset the flag when not paused
    }

    if (game === "dice") {
        try {
            diceRoll = await apiClient.diceRoll(chance, betHigh, simulation ? 0 : nextBet, config.currency).then(async (result) => {
                try {
                    const data = JSON.parse(result);

                    if (data.errors) {
                        console.error('[ERROR] Dicebet response: ', data);

                        if (!simulation) {
                            config.funds = await apiClient.getFunds(config.currency);
                            balance = config.funds.available;
                        }

                        return null;
                    }

                    return data.data.diceRoll;
                } catch (e) {
                    console.error('[ERROR]', e, result);

                    if (!simulation) {
                        config.funds = await apiClient.getFunds(config.currency);
                        balance = config.funds.available;
                    }

                    return null;
                }
            }).catch(error => console.error(error));

            if (!diceRoll || !diceRoll.state) {
                console.log('[ERROR] Pausing for 5 seconds...', diceRoll);
                await new Promise(r => setTimeout(r, 5000));

                continue;
            }

            if (simulation) {
                balance -= nextBet;
                balance += nextBet * diceRoll.payoutMultiplier;
            } else {
                newBalance = diceRoll.user.balances.filter((balance) => balance.available.currency === config.currency)[0];
                config.funds = {
                    available: newBalance.available.amount,
                    vault: newBalance.vault.amount,
                    currency: config.currency
                };

                balance = config.funds.available;
            }

            wager += nextBet;
            profit -= nextBet;
            bets++;
            lastHourBets.push(+new Date());

            if (betHigh) {
                win = diceRoll.state.result > diceRoll.state.target;
            } else {
                win = diceRoll.state.result < diceRoll.state.target;
            }

            if (win) {
                roundProfit = diceRoll.payout;
                profit += roundProfit;

                if (currentStreak >= 0) {
                    currentStreak++;
                } else {
                    currentStreak = 1;
                }
            } else {
                if (currentStreak <= 0) {
                    currentStreak--;
                } else {
                    currentStreak = -1;
                }
            }

            console.log(
                win ? '\x1b[32m%s\x1b[0m' : '\x1b[37m%s\x1b[0m',
                [
                    'Game: ' + game,
                    'Stage: ' + stage,
                    'Balance: ' + balance.toFixed(8) + ' ' + config.currency.toUpperCase(),
                    'Wager: ' + wager.toFixed(8) + ' ' + config.currency.toUpperCase(),
                    'Profit: ' + profit.toFixed(8) + ' ' + config.currency.toUpperCase(),
                    'Bet size: ' + nextBet.toFixed(8) + ' ' + config.currency.toUpperCase(),
                    'Current streak: ' + currentStreak
                    //'View bet: https://stake.com/?betId=' + diceRoll.id + '&modal=bet'
                ].join(' | ')
            );

            await doBet();


            if (currentStreak < 0) {
                highestLosingStreak = Math.max(highestLosingStreak, Math.abs(currentStreak));
            }

            await writeStatsFile();
            await new Promise(r => setTimeout(r, betDelay));
        } catch (e) {
            console.error('[ERROR]', e);

            if (!simulation) {
                config.funds = await apiClient.getFunds(config.currency);
                balance = config.funds.available;
            }
        }
    }
    if (game === "dragontower"){
        try {
            dragonTowerBet = await apiClient.dragonTowerBet([0], 'hard', nextBet, config.currency).then(async (result) => {
                try {
                    const data = JSON.parse(result);
        
                    if (data.errors) {
                        console.error('[ERROR] dragonTowerBet response: ', data);
        
                        config.funds = await apiClient.getFunds(config.currency);
                        balance = config.funds.available;
        
                        return null;
                    }
        
                    return data.data.dragonTowerBet;
                } catch (e) {
                    console.error('[ERROR]', e, result);
        
                    config.funds = await apiClient.getFunds(config.currency);
                    balance = config.funds.available;
        
                    return null;
                }
            }).catch(error => console.error(error));
        
            if (!dragonTowerBet || !dragonTowerBet.state) {
                console.log('[ERROR] Pausing for 5 seconds...', dragonTowerBet);
                await new Promise(r => setTimeout(r, 5000));
        
                continue;
            }
        
            newBalance = dragonTowerBet.user.balances.filter((balance) => balance.available.currency === config.currency)[0];
            config.funds = {
                available: newBalance.available.amount,
                vault: newBalance.vault.amount,
                currency: config.currency
            };
        
            balance = config.funds.available;
        
            wager += nextBet;
            profit -= nextBet;
            bets++;
            lastHourBets.push(+new Date());
        
            win = dragonTowerBet.payoutMultiplier >= 1;
        
            if (win) {
                roundProfit = dragonTowerBet.payout;
                profit += roundProfit;
        
                if (currentStreak >= 0) {
                    currentStreak++;
                } else {
                    currentStreak = 1;
                }
            } else {
                if (currentStreak <= 0) {
                    currentStreak--;
                } else {
                    currentStreak = -1;
                }
            }
        
            console.log(
                win ? '\x1b[32m%s\x1b[0m' : '\x1b[37m%s\x1b[0m',
                [
                    'Game: ' + game,
                    'Stage: ' + stage,
                    'Balance: ' + balance.toFixed(8) + ' ' + config.currency.toUpperCase(),
                    'Wager: ' + wager.toFixed(8) + ' ' + config.currency.toUpperCase(),
                    'Profit: ' + profit.toFixed(8) + ' ' + config.currency.toUpperCase(),
                    'Bet size: ' + nextBet.toFixed(8) + ' ' + config.currency.toUpperCase(),
                    'bet: [0]', // Updated to show hard-coded egg position
                    'Current streak: ' + currentStreak
                ].join(' | ')
            );
        
            await doBet();
        

            if (currentStreak < 0) {
                highestLosingStreak = Math.max(highestLosingStreak, Math.abs(currentStreak));
            }
        
            await writeStatsFile();
            await new Promise(r => setTimeout(r, betDelay));
        } catch (e) {
            console.error('[ERROR]', e);
        
            config.funds = await apiClient.getFunds(config.currency);
            balance = config.funds.available;
        }
    }
}