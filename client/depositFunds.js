// depositFunds.js
import fs from 'fs/promises';
import { TronWeb } from 'tronweb';

// Load configuration from client_config.json
const clientConfig = JSON.parse(await fs.readFile(new URL('../client_config.json', import.meta.url)));

const config = {
    tronApiKey: process.env.CLIENT_API_KEY || clientConfig.tronApiKey,
    depositAddress: process.env.DEPOSITE_ADDRESS || clientConfig.depositeAddress,
    privateKey: process.env.PRIVATE_KEY || clientConfig.privateKey,
    currency: process.env.CLIENT_CURRENCY || clientConfig.currency,
};

// Initialise TronWeb
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: { "TRON-PRO-API-KEY": config.tronApiKey }
});

// Helper function to delay for a given number of milliseconds
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Deposit function with retry logic
async function depositFunds(amount, maxRetries = 3) {
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            console.log(`Attempt ${attempt + 1}: Depositing ${amount} ${config.currency}...`);
            
            // Log config and derived address for debugging
            console.log('Configuration:', config);
            const fromAddress = tronWeb.address.fromPrivateKey(config.privateKey);
            console.log('Derived fromAddress:', fromAddress);

            // Create deposit transaction
            const tradeObj = await tronWeb.transactionBuilder.sendTrx(
                config.depositAddress,
                amount * 1_000_000,  // Convert amount to TRX's smallest unit
                fromAddress
            );
            
            // Log transaction details
            console.log('Generated transaction object:', tradeObj);

            // Sign transaction
            const signedTxn = await tronWeb.trx.sign(tradeObj, config.privateKey);
            console.log('Signed transaction:', signedTxn);

            // Send transaction
            const receipt = await tronWeb.trx.sendRawTransaction(signedTxn);
            console.log('Transaction receipt:', receipt);

            if (receipt.result) {
                console.log(`Successfully deposited ${amount} ${config.currency}. Transaction hash: ${receipt.txid}`);
                return;  // Exit the function on success
            } else {
                throw new Error("Deposit failed. Retrying...");
            }

        } catch (error) {
            console.error("Error during deposit:", error.message);
            console.error("Error stack:", error.stack);
            
            // Increment attempt count
            attempt++;

            if (attempt < maxRetries) {
                console.log(`Retrying in 5 seconds... (${attempt}/${maxRetries})`);
                await delay(5000);  // Wait 5 seconds before the next attempt
            } else {
                console.error("Max retries reached. Deposit failed.");
            }
        }
    }
}

// Execute deposit with provided amount from command line
const depositAmount = parseInt(process.argv[2], 10);
if (!depositAmount) {
    console.error("Please provide an amount to deposit. Usage: node depositFunds.js <amount>");
    process.exit(1);
}

await depositFunds(depositAmount);
