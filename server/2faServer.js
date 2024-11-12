const express = require('express');
const twoFactor = require('node-2fa');
const app = express();
app.use(express.json());

let currentToken = null;
let nextTokenTime;
const port = 3002;

const generateToken = () => {
    currentToken = twoFactor.generateToken('YOUR_2FA_SECRET').token;
    nextTokenTime = Date.now() + 30000;
    console.log(`[INFO] Token generated: ${currentToken} at ${new Date().toISOString()}`);
};

const alignTokenGeneration = () => {
    const now = new Date();
    let delay = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) % 30000;
    setTimeout(() => {
        generateToken();
        setInterval(generateToken, 30000);
    }, delay);
};

alignTokenGeneration();

app.post('/api/get-token', (req, res) => {
    const clientName = req.body.clientName; // Assuming client sends its name
    const requestTime = new Date().toISOString();
    console.log(`[INFO] Token requested by ${clientName} at ${requestTime}`);

    const waitTime = nextTokenTime - Date.now();

    if (waitTime < 10000) {
        setTimeout(() => {
            console.log(`[INFO] Token ${currentToken} sent to ${clientName} at ${new Date().toISOString()}`);
            res.json({ token: currentToken, expiresIn: 30 });
        }, waitTime);
    } else {
        console.log(`[INFO] Token ${currentToken} sent to ${clientName} at ${requestTime}`);
        res.json({ token: currentToken, expiresIn: waitTime / 1000 });
    }
});

app.listen(port, () => console.log(`[INFO] Server running on port ${port}`));
