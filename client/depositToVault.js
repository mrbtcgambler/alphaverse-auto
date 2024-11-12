import { readFile } from 'fs/promises';
import StakeApi from './StakeApi.mjs';

const jsonConfig = JSON.parse(await readFile(new URL('../client_config.json', import.meta.url)));
let config = {
    id: null,
    apiKey: process.env.CLIENT_API_KEY || jsonConfig.apiKey,
    currency: process.env.CLIENT_CURRENCY || jsonConfig.currency
};

const apiClient = new StakeApi(config.apiKey);

const processArguments = process.argv.slice(2);
let amount = processArguments[0];
if (amount) {
    amount = parseFloat(amount.trim());
} else {
    console.log('Fetching funds...');
    config.funds = await apiClient.getFunds(config.currency);
    amount = config.funds.available;
}

console.log(`Depositing ${amount} ${config.currency.toUpperCase()} to vault...`);
await apiClient.depositToVault(config.currency, amount);