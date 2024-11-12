import puppeteer from 'puppeteer';
import fs from 'fs';
import { readFile } from 'fs/promises';

const clientConfig = JSON.parse(await readFile(new URL('../client_config.json', import.meta.url)));
const serverConfig = JSON.parse(await readFile(new URL('../server_config.json', import.meta.url)));

const apiServer = clientConfig.apiServer;
const basicAuthUser = serverConfig.basicAuthUser;
const basicAuthPassword = serverConfig.basicAuthPassword;
const username = clientConfig.username;
const password = clientConfig.password;
const apiKey = clientConfig.apiKey;

async function extractIPs() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        page.on('console', consoleObj => console.log(consoleObj.text()));

        await page.authenticate({
            username: basicAuthUser, // Replace with actual username
            password: basicAuthPassword  // Replace with actual password
        });

        console.log ("API Server: ", apiServer);
        console.log ("username: " + basicAuthUser);
        console.log ("Password: " + basicAuthPassword);

        await page.goto(`http://${apiServer}:3000/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('table.clients-list tbody tr', { timeout: 60000 });

        // Extract the IP addresses
        const ips = await page.$$eval('table.clients-list tbody tr td:nth-child(18)', tds => tds.map(td => td.textContent.trim()));

        // Overwrite the known_ips.txt file with the new IP addresses
        fs.writeFileSync('known_ips.txt', ips.join('\n'));
        console.log('IPs extracted and saved to known_ips.txt:', ips);
    } catch (error) {
        console.error('An error occurred during IP extraction:', error);
        throw error;  // Rethrow the error to be caught by the retry logic
    } finally {
        await browser.close();
    }
}

async function startExtractionLoop() {
    while (true) {
        try {
            console.log('Starting the IP extraction process...');
            await extractIPs();
            console.log('IP extraction complete. Waiting 30 seconds before the next run...');
        } catch (error) {
            console.error('An error was caught in the extraction loop. Retrying in 30 seconds...');
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for 10 seconds before retrying
            continue;  // Continue the loop to retry the extraction
        }
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait for 3 seconds for the next regular run
    }
}

startExtractionLoop();
