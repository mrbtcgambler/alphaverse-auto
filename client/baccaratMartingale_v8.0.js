//********************************************************************************************
//** Baccarat Martingale based on this video: TBD                                           **
//** Version: 8.0                                                                           ** 
//** Date: 02/11/2024                                                                       **
//** Author: MrBtcGambler                                                                   **
//** Start Balance: 85 TRX                                                                  **
//** Recovery Pot: 6370 TRX                                                                 **
//** Bust Threshold: 20.5 TRX                                                               **
//** Max Loss Streak: -24 TRX                                                               **
//**                                                                                        **
//** Details:                                                                               **
//** v 8, Resets Max Loss Streak on Seed Reset                                              **
//** v 7, Increased start balance to 85 TRX                                                 **
//** v 6, fixed Seed Reset and improved logging and error handling                          **
//** v 5, fixed error with next bet                                                         **
//** v 4, treat tied as tied and nextBet does not change                                    **
//** Experiment using qBot: https://qbot.gg/?r=mrbtcgambler                                 **
//** Set to baseBet on Banker, pays out 1.95X, previous bet on draw and Double down on loss **
//** 3.7M test bets on qBot showed a max loss streak of 18                                  **
//********************************************************************************************

import { unlink, access, constants } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import StakeApi from "./StakeApi.mjs";

// Initialize configurations
const clientConfig = JSON.parse(await readFile(new URL('../client_config.json', import.meta.url)));
const serverConfig = JSON.parse(await readFile(new URL('../server_config.json', import.meta.url)));

const config = {
    apiKey: process.env.CLIENT_API_KEY || clientConfig.apiKey,
    password: process.env.CLIENT_PASSWORD || clientConfig.password,
    twoFaSecret: process.env.CLIENT_2FA_SECRET || clientConfig.twoFaSecret || null,
    currency: process.env.CLIENT_CURRENCY || clientConfig.currency,
    recoverAmount: process.env.SERVER_RECOVER_AMOUNT || serverConfig.recoverAmount,
    recoverThreshold: process.env.CLIENT_RECOVER_THRESHOLD || clientConfig.recoverThreshold,
    funds: null
};

// Create StakeApi instance
const apiClient = new StakeApi(config.apiKey);

// Fetch initial funds
config.funds = await apiClient.getFunds(config.currency);

// Deposit to vault to set up recovery pot
await apiClient.depositToVault(config.currency, config.funds.available - clientConfig.recoverThreshold);
await new Promise(r => setTimeout(r, 2000));

// Initialize bot state variables
let balance = config.funds.available,
    version = 8,
    game = "baccarat",
    stage = 1, // not used but on the main server page
    betDelay = 40, // delay in milliseconds
    currentStreak = 0,
    profit = 0,
    vaulted = 0,
    wager = 0,
    bets = 0,
    winCount = 0,
    highestLosingStreak = 0,
    lastHourBets = [],
    seedReset = 0,
    resetSeedAfter = 5000, // Reset seed after X bets
    paused = false,
    win = false,
    tied = false,
    lost = false,
    // Baccarat Bet Settings
    baseBet = 0.0001,
    previousBet = baseBet,
    nextBet = baseBet,
    tieBet = 0, // Baccarat tie bet amount
    playerBet = 0, // Baccarat player bet amount
    bankerBet = baseBet, // Baccarat banker bet amount
    pauseLogged = false;

// Function to calculate bets per hour
function getBetsPerHour() {
    const now = Date.now();
    lastHourBets = lastHourBets.filter((timestamp) => now - timestamp <= 60 * 60 * 1000);
    return lastHourBets.length;
}

// Function to handle betting logic
async function doBet() {
    seedReset++;

    if (win) {
        winCount++;
        nextBet = baseBet;
        bankerBet = baseBet;
        playerBet = 0;
        tieBet = 0;
    } else if (lost){
        nextBet = previousBet * 2.0527; // Adds 105.27% to each loss for full recovery
        bankerBet = nextBet;
        playerBet = 0;
        tieBet = 0;
    } else {
        // No change to nextBet if it's a tie or other conditions
        bankerBet = nextBet;
        playerBet = 0;
        tieBet = 0;
    }

    // Check if balance exceeds a certain threshold to deposit back to vault
    if (balance >= 89 && profit >= 0){
        await apiClient.depositToVault(config.currency, config.funds.available - 85);
        nextBet = baseBet;
        console.log('[INFO] Deposited excess funds back to vault.');
    }

        // Check if it's time to reset the seed
    if (seedReset > resetSeedAfter && currentStreak > 0)  {
        try {
            console.log(`[INFO] Resetting seed after ${seedReset} bets and current streak of ${currentStreak}`);
            const resetResponse = await apiClient.resetSeed();

            // Optional: Parse and handle the resetResponse if needed
            // const resetData = JSON.parse(resetResponse);
            console.log('[SUCCESS] Seed reset successfully.');
 
            // Reset the seedReset counter
            seedReset = 0;
            highestLosingStreak = 1;
  
            // Optional: Reset betting parameters if necessary
            nextBet = baseBet;
            previousBet = baseBet;
            bankerBet = nextBet;
            currentStreak = 0;
            console.log('[INFO] Betting parameters have been reset after seed reset.');
        } catch (error) {
            console.error('[ERROR] Failed to reset seed:', error);
            // Optional: Implement retry logic or handle the failure accordingly
        }
    }
}

// Delete old state file if it exists
const dicebotStateFilename = new URL('/mnt/ramdrive/dicebot_state.json', import.meta.url);
access(dicebotStateFilename, constants.F_OK, (error) => {
    if (!error) {
        unlink(dicebotStateFilename, (err) => {
            if (err) console.error('[ERROR] Failed to delete old state file:', err);
            else console.log('[INFO] Old state file deleted.');
        });
    }
});

// Function to write current stats to a file
async function writeStatsFile() {
    try {
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
        }), 'utf8');
        //console.log('[INFO] Stats file updated.');
    } catch (error) {
        console.error('[ERROR] Failed to write stats file:', error);
    }
}

// Initialize additional variables
let newBalance = null,
    roundProfit = 0,
    pauseFileUrl = new URL('pause', import.meta.url);

// Main betting loop
while (true) {
    // Check if the bot is paused by checking for the existence of the pause file
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

    if (game === "baccarat") {
        try {
            let baccaratBet;

            // Place a Baccarat bet
            baccaratBet = await apiClient.baccaratBet(tieBet, playerBet, bankerBet, config.currency)
                .then(async (result) => {
                    try {
                        const data = JSON.parse(result);

                        if (data.errors) {
                            console.error('[ERROR] baccaratBet response: ', data);

                            config.funds = await apiClient.getFunds(config.currency);
                            balance = config.funds.available;

                            return null;
                        }

                        return data.data.baccaratBet;
                    } catch (e) {
                        console.error('[ERROR]', e, result);

                        config.funds = await apiClient.getFunds(config.currency);
                        balance = config.funds.available;

                        return null;
                    }
                })
                .catch(error => {
                    console.error('[ERROR] Failed to place Baccarat bet:', error);
                    return null;
                });

            if (!baccaratBet || !baccaratBet.state) {
                console.log('[WARN] Invalid baccaratBet response. Pausing for 5 seconds...');
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            // Update funds based on the bet result
            newBalance = baccaratBet.user.balances.find((balance) => balance.available.currency === config.currency);
            if (!newBalance) {
                console.error('[ERROR] Failed to find balance for currency:', config.currency);
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            config.funds = {
                available: parseFloat(newBalance.available.amount),
                vault: parseFloat(newBalance.vault.amount),
                currency: config.currency
            };

            balance = config.funds.available;

            wager += nextBet;
            profit -= nextBet;
            bets++;
            lastHourBets.push(Date.now());

            // Determine the outcome of the bet
            if (baccaratBet.payoutMultiplier >= 1.1) {
                win = true;
                tied = false;
                lost = false;
            } else if (baccaratBet.payoutMultiplier === 1) {
                tied = true;
                win = false;
                lost = false;
            } else if (baccaratBet.payoutMultiplier <= 0.9) {
                lost = true;
                win = false;
                tied = false;
            } else {
                // Handle any unexpected payoutMultiplier values
                win = false;
                tied = false;
                lost = false;
            }

            // Update profit and streaks based on the outcome
            if (win) {
                roundProfit = parseFloat(baccaratBet.payout);
                profit += roundProfit;

                if (currentStreak >= 0) {
                    currentStreak++;
                } else {
                    currentStreak = 1;
                }
            }

            if (tied) {
                roundProfit = parseFloat(baccaratBet.payout);
                profit += roundProfit;
                // Streak remains unchanged
            }

            if (lost) {
                if (currentStreak <= 0) {
                    currentStreak--;
                } else {
                    currentStreak = -1;
                }
            }

            // Log the outcome of the bet
            console.log(
                win ? '\x1b[32m%s\x1b[0m' : (tied ? '\x1b[33m%s\x1b[0m' : '\x1b[37m%s\x1b[0m'),
                [
                    'Game: ' + game,
                    'Banker Bet: ' + bankerBet.toFixed(4),
                    // 'Player: ' + playerBet.toFixed(4),
                    // 'Tie: ' + tieBet.toFixed(4),
                    'Balance: ' + balance.toFixed(6) + ' ' + config.currency.toUpperCase(),
                    'Wager: ' + wager.toFixed(4) + ' ' + config.currency.toUpperCase(),
                    'Payout Multiplier: ' + baccaratBet.payoutMultiplier,
                    'Current Streak: ' + currentStreak,
                    'Game Result: ' + (win ? 'Win' : (tied ? 'Tied' : 'Lose')) // Added game result
                ].join(' | ')
            );

            // Execute betting logic based on the outcome
            await doBet();

            // Update previous bet
            previousBet = nextBet;

            // Update the highest losing streak
            if (currentStreak < 0) {
                highestLosingStreak = Math.max(highestLosingStreak, Math.abs(currentStreak));
            }

            // Write the current stats to the file
            await writeStatsFile();

            // Delay before the next bet
            await new Promise(r => setTimeout(r, betDelay));
        } catch (e) {
            console.error('[ERROR] Exception in betting loop:', e);

            // Attempt to refresh funds in case of an error
            try {
                config.funds = await apiClient.getFunds(config.currency);
                balance = config.funds.available;
            } catch (fundError) {
                console.error('[ERROR] Failed to refresh funds:', fundError);
            }

            // Optional: Pause the bot or implement additional error handling
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}
