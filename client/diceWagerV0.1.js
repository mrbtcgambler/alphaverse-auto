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

let balance = config.funds.available,
    version = 0.1,
    startBalance = balance,
    depositAmount = 1000.26,
    vauthThreshold = (startBalance * 0.2),
    game = "dice",
    chance = 99,
    baseBet = 0,
    betHigh = false,
    increaseOnLoss = 2.021,
    nextBet = baseBet,
    win = false,
    betDelay = 40, // delay in milliseconds
    currentStreak = 0,
    profit = 0,
    vaulted = 0,
    wager = 0,
    bets = 0,
    winCount = 0,
    stage = 1,
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
console.log(`[INFO] Resetting seed`);
exec ('node clinet\resetSeed.js');
console.log ("**Bet Data**");
console.log ("Start Balance: ", balance);
console.log ("Base Bet: ", baseBet);
console.log ("Chance: ", baseBet);
console.log ("** END **");
await new Promise(r => setTimeout(r, 3000));

async function doBet() {
    if (win) {
        nextBet = baseBet;
        winCount++;
    } else {
        nextBet = baseBet;
    }

    if (win && balance > 0){
        console.log(`[INFO] Received request from master host to execute recovery deposit using withdrawFunds.js`);

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
                console.log(`[INFO] Executing depositFunds.js to deposit ${config.funds.available} ${config.currency}`);
                exec(`node client/withdrawFunds.js ${config.funds.available}`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[ERROR] Failed to execute depositFunds.js:`, error.message);
                        return;
                    }
                    console.log(`[INFO] Deposit completed. Output:\n${stdout}`);

                    // Check if balance is now below recoverAmount before resuming
                    if (config.funds.available > 0) {
                        console.log(`[INFO] Available balance still above recover amount; keeping the bot paused.`);
                    } else {
                        // Resume the bot if it was paused
                        if (!wasPaused) {
                            console.log(`[INFO] Balance sufficient. Resuming bot...`);
                            console.log ("Resetting Seed");
                            exec ('node clinet\resetSeed.js');
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
            } catch (error) {
                console.error("[ERROR] Failed during recovery process:", error);
            }
        });
    }

    if (currentStreak === -2){
        nextBet = 1000;
        console.log(`[INFO] Received to execute recovery deposit using depositFunds.js`);
        // Execute the depositFunds.js script
        console.log(`[INFO] Executing depositFunds.js to deposit ${depositAmount} ${config.currency}`);
        exec(`node client/depositFunds.js ${depositAmount}`);
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
            betCycleCount++;
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

            if (win && balance >= (startBalance + vauthThreshold)){
                if (profit > 0){
                    await apiClient.depositToVault(config.currency, config.funds.available - startBalance);
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
}