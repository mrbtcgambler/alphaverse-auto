import { readFile } from 'fs/promises';
import StakeApi from './StakeApi.mjs';

const jsonConfig = JSON.parse(await readFile(new URL('../client_config.json', import.meta.url)));
let config = {
    id: null,
    apiKey: process.env.CLIENT_API_KEY || jsonConfig.apiKey,
    password: process.env.CLIENT_PASSWORD || jsonConfig.password,
    twoFaSecret: process.env.CLIENT_2FA_SECRET || jsonConfig.twoFaSecret || null,
    currency: process.env.CLIENT_CURRENCY || jsonConfig.currency
};

const apiClient = new StakeApi(config.apiKey);
const processArguments = process.argv.slice(2);
let amount = processArguments[0];
if (!amount) {
    console.log('Fetching funds...');
    config.funds = await apiClient.getFunds(config.currency);
    amount = config.funds.vault;
} else {
    amount = parseFloat(amount.trim());
}

console.log(`Withdrawing ${amount} ${config.currency.toUpperCase()} from vault...`);
await apiClient.withdrawFromVault(config.currency, amount, config.password, config.twoFaSecret);