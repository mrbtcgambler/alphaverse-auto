import { readFile, unlink } from 'fs/promises';
import StakeApi from './StakeApi.mjs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Load configuration from client_config.json
const jsonConfig = JSON.parse(
    await readFile(new URL('../client_config.json', import.meta.url))
);

const config = {
    apiKey: process.env.CLIENT_API_KEY || jsonConfig.apiKey,
    password: process.env.CLIENT_PASSWORD || jsonConfig.password,
    twoFaSecret: process.env.CLIENT_2FA_SECRET || jsonConfig.twoFaSecret || null,
    currency: process.env.CLIENT_CURRENCY || jsonConfig.currency,
    withdrawAddress: process.env.WITHDRAW_ADDRESS || jsonConfig.withdrawAddress,
};

// Initialise StakeApi client
const apiClient = new StakeApi(config.apiKey);

// Capture withdraw amount from command-line arguments
const withdrawAmount = parseFloat(process.argv[2]);

// Validate the withdraw amount
if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
    console.error("Please provide a valid withdraw amount as a command-line argument.");
    process.exit(1);
}

// Function to create the pause file
async function createPauseFile() {
    try {
        await execPromise('touch /mnt/alphaverse-auto/client/pause');
        console.log("Pause file created. Waiting 3 seconds for bot to recognise it...");
        await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
        console.error("Failed to create pause file:", error.message);
    }
}

// Function to delete the pause file
async function removePauseFile() {
    try {
        await unlink('/mnt/alphaverse-auto/client/pause');
        console.log("Pause file removed. Bot resumed.");
    } catch (error) {
        console.error("Failed to remove pause file:", error.message);
    }
}

async function withdrawFunds(amount) {
    await createPauseFile(); // Pause the bot

    // Fetch current funds to check available balance and vault
    config.funds = await apiClient.getFunds(config.currency);

    let balance = config.funds.available;
    let vault = config.funds.vault;

    console.log(`Available balance: ${balance} ${config.currency}, Vault balance: ${vault} ${config.currency}`);

    // If available balance is insufficient, attempt to withdraw from vault
    if (balance < amount && vault > 0) {
        console.log(`Insufficient available balance. Attempting to withdraw ${vault} ${config.currency} from vault...`);
        await apiClient.withdrawFromVault(config.currency, vault, config.password, config.twoFaSecret);

        // Update available balance after vault withdrawal
        config.funds = await apiClient.getFunds(config.currency);
        balance = config.funds.available;
        console.log(`New available balance after vault withdrawal: ${balance} ${config.currency}`);
    }

    // Check if the combined balance is now sufficient for withdrawal
    if (balance < amount) {
        console.error("Not enough funds after vault withdrawal. Aborting.");
        await removePauseFile(); // Resume the bot
        return;
    }

    // Add a delay for 2FA renewal if necessary
    console.log("Waiting for 2FA renewal...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Main withdrawal attempt with retry logic
    let attempt = 0;
    const maxRetries = 3;
    while (attempt < maxRetries) {
        try {
            console.log(`Attempt ${attempt + 1}: Withdrawing ${amount} ${config.currency} to ${config.withdrawAddress}`);
            
            const withdrawalResult = await apiClient.withdraw(
                config.currency,
                config.withdrawAddress,
                amount,
                config.twoFaSecret
            );

            if (withdrawalResult && withdrawalResult.id) {
                console.log(`Successfully withdrew ${amount} ${config.currency}. Transaction ID: ${withdrawalResult.id}`);
                await removePauseFile(); // Resume the bot after successful withdrawal
                return;
            } else {
                console.log("Withdrawal may have failed. Retrying if necessary.");
            }
        } catch (error) {
            console.error("Withdrawal error:", error.message);
            console.log("Retrying after 30 seconds...");
            await new Promise(resolve => setTimeout(resolve, 30000));
        }

        attempt++;
    }

    console.error("Max retries reached. Withdrawal failed.");
    await removePauseFile(); // Resume the bot if retries are exhausted
}

// Execute the withdrawal with the provided amount
await withdrawFunds(withdrawAmount);
