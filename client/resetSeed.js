import StakeApi from "./StakeApi.mjs";
import { readFile } from 'fs/promises';

(async () => {
    try {
        // Read configuration files
        const clientConfig = JSON.parse(await readFile(new URL('../client_config.json', import.meta.url)));
        const serverConfig = JSON.parse(await readFile(new URL('../server_config.json', import.meta.url)));

        // Initialize config
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

        // Debug: Log apiClient to verify methods
        console.log('apiClient methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(apiClient)));

        // Call the correct resetSeed method
        apiClient.resetSeed()
            .then(response => {
                console.log('Seed reset successfully:', response);
            })
            .catch(error => {
                console.error('Error resetting seed:', error);
            });
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
})();
