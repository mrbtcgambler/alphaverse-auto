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
    const rakeback = await apiClient.claimReload(`${config.currency.toUpperCase()}`);
    if (rakeback && rakeback.data && rakeback.data.user && rakeback.data.user.reload) {
        const reload = rakeback.data.user.reload;
        if (reload.amount && reload.currency) {
            console.log(`Successfully claimed Reload: ${reload.amount} ${reload.currency.toUpperCase()}`);
        } else {
            console.log('No reload available or claim failed.');
        }
    } else {
        console.log('No reload available or claim failed.');
    }
} catch (error) {
    console.error('Error claiming reload:', error);
}

