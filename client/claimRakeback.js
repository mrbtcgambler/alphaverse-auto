import { readFile } from 'fs/promises';
import StakeApi from './StakeApi.mjs';

// Load configuration
const jsonConfig = JSON.parse(await readFile(new URL('../client_config.json', import.meta.url)));
const config = {
    apiKey: process.env.CLIENT_API_KEY || jsonConfig.apiKey,
    password: process.env.CLIENT_PASSWORD || jsonConfig.password,
    twoFaSecret: process.env.CLIENT_2FA_SECRET || jsonConfig.twoFaSecret || null,
    currency: process.env.CLIENT_CURRENCY || jsonConfig.currency
};

// Initialize API client
const apiClient = new StakeApi(config.apiKey);

try {
    console.log('Claiming rakeback...');
    const rakeback = await apiClient.claimRakeBack();
    if (rakeback && rakeback.amount && rakeback.currency) {
        console.log(`Successfully claimed rakeback: ${rakeback.amount} ${rakeback.currency.toUpperCase()}`);
    } else {
        console.log('No rakeback available or claim failed.');
    }
} catch (error) {
    console.error('Error claiming rakeback:', error);
}
