// **DISCLAIMER: This software is proprietary. Any modification or distribution of this code without express written consent from the licensor is a violation of the license agreement.**
//
// Alphaverse Software License Agreement
//
// THIS SOFTWARE LICENSE AGREEMENT ("Agreement") is entered into between MrBtcGambler, the licensor of the Alphaverse software ("Licensor"), and the end-user ("Licensee").
//
// License Grant. The Licensor grants the Licensee a non-exclusive, non-transferable, limited license to use the Alphaverse software for internal purposes only. The Licensee may not distribute, share, or modify the software without the express written consent of the Licensor.
//
// Ownership. The Licensor retains all rights, title, and interest in and to the Alphaverse software and all associated intellectual property rights. The Licensee acknowledges that it receives only the limited license granted herein and has no rights to use or transfer any intellectual property rights in the Alphaverse software, except as provided in this Agreement.
//
// Limitation of Liability. The Licensor shall not be liable for any losses arising from the Licensee's use of the Alphaverse software. The Licensee agrees to indemnify and hold the Licensor harmless from any claims arising from the Licensee's use of the Alphaverse software.
//
// Termination. Any breach of this Agreement by the Licensee will immediately terminate the license granted herein. Upon termination, the Licensee's right to access the Alphaverse software will be revoked without the right to appeal. The Licensee must promptly destroy or return all copies of the Alphaverse software in its possession or control to the Licensor.


import express from 'express';
import http from 'http';
import { Server } from "socket.io";
import { readFile } from "fs/promises";

const banner = `
    ____               _           __     ___    __      __         
   / __ \\_________    (_)__  _____/ /_   /   |  / /___  / /_  ____ _
  / /_/ / ___/ __ \\  / / _ \\/ ___/ __/  / /| | / / __ \\/ __ \\/ __ \`/
 / ____/ /  / /_/ / / /  __/ /__/ /_   / ___ |/ / /_/ / / / / /_/ / 
/_/   /_/   \\____/_/ /\\___/\\___/\\__/  /_/  |_/_/ .___/_/ /_/\\__,_/  
                /___/                         /_/                   
`;

const DEBUG = false;
const app = express();
const index = http.createServer(app);
const io = new Server(index);
const clients = {};
const usernames = [];
let startTime = new Date();

const jsonConfig = JSON.parse(await readFile(new URL('../server_config.json', import.meta.url)));
const config = {
    basicAuthUser:  process.env.SERVER_BASIC_AUTH_USER || jsonConfig.basicAuthUser,
    basicAuthPassword:  process.env.SERVER_BASIC_AUTH_PASSWORD || jsonConfig.basicAuthPassword,
    authToken: process.env.SERVER_AUTH_TOKEN || jsonConfig.authToken,
    recoverAmount: parseFloat(process.env.SERVER_RECOVER_AMOUNT) || jsonConfig.recoverAmount
};

io.use((socket, next) => {
    if (socket.handshake.auth.token === config.authToken) {
        next();
    } else {
        next(new Error("Forbidden"));
    }
});

io.on('connection', (socket) => {
    console.log(`[INFO] Client ${socket.id} connected`);

    socket.emit('configSync', {
        recoverAmount: config.recoverAmount
    });

    socket.on('disconnect', () => {
        console.log(`[INFO] Client ${socket.id} disconnected`);
        delete clients[socket.id];
    });

    socket.on('stateReport', (config) => {
        DEBUG && console.log(`[INFO] Received state report from ${config.username}`);
        clients[socket.id] = config;

        if (!usernames.includes(config.username)) {
            usernames.push(config.username);
        }
    });

    socket.on('bust', async () => {
        const bustedClient = clients[socket.id];
        console.log(`[INFO] Received bust report from ${bustedClient.username}`);
    
        // Emit 'sendRecoverFunds' directly to the busting client
        console.log(`[INFO] Instructing ${bustedClient.username} to initiate recovery using depositFunds.js`);
        io.to(socket.id).emit('sendRecoverFunds');
    });
    
    socket.on('recovered', () => {
        console.log(`[INFO] Received recovery report from ${clients[socket.id].username}`);
    });

    socket.on('emergencyStop', () => {
        console.log(`[INFO] Received emergency stop from ${clients[socket.id].username}`);

        socket.broadcast.emit('pause');
    });
});

app.use((req, res, next) => {
    // -----------------------------------------------------------------------
    // authentication middleware

    const auth = {login: config.basicAuthUser, password: config.basicAuthPassword}

    // parse login and password from headers
    const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':')

    // Verify login and password are set and correct
    if (login && password && login === auth.login && password === auth.password) {
        // Access granted...
        return next()
    }

    // Access denied...
    res.set('WWW-Authenticate', 'Basic realm="401"') // change this
    res.status(401).send('Authentication required.') // custom message
});

app.use(express.text());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static(process.cwd() + '/server/assets'));
app.set("views", process.cwd() + '/server/views');
app.set("view engine", "pug");

app.get('/status', (req, res) => res.send({
    clients: clients,
    usernames: usernames,
    bankroll: Object.values(clients).reduce((a, b) => a + b.funds.available, 0) + Object.values(clients).reduce((a, b) => a + b.funds.vault, 0),
    runtime: new Date() - startTime
}));

app.post('/reset-timer', (req, res, next) => {
    startTime = new Date();

    res.send({runtime: 0})
});

app.post('/tip', (req, res, next) => {
    const body = JSON.parse(req.body);

    if (!body.receiver || !body.origin) {
        res.send(JSON.stringify({success: false, message: `Missing origin and/or receiver.`}));

        return;
    }

    const originSocketId = Object.keys(clients).find(key => clients[key].username === body.origin);
    if (!originSocketId) {
        res.send(JSON.stringify({success: false, message: `Could not find socket id for ${body.origin}.`}));

        return;
    }

    io.sockets.to(originSocketId).emit('sendVault', body.receiver);

    res.send(JSON.stringify({success: true}));
});

app.post('/client/WithdrawVault', (req, res, next) => {
    const body = req.body; // This should already be a parsed object

    if (!body.username) {
        res.status(400).send(JSON.stringify({success: false, message: `Missing username.`}));
        return;
    }

    const clientSocketId = Object.keys(clients).find(key => clients[key].username === body.username);
    if (!clientSocketId) {
        res.status(404).send(JSON.stringify({success: false, message: `Could not find socket id for ${body.username}.`}));
        return;
    }

    // Emit an 'executeUpdate' event to the specific client
    io.sockets.to(clientSocketId).emit('WithdrawVault');

    res.send(JSON.stringify({success: true, message: `Update command sent to ${body.username}.`}));
});

app.post('/client/update', (req, res, next) => {
    const body = req.body; // This should already be a parsed object

    if (!body.username) {
        res.status(400).send(JSON.stringify({success: false, message: `Missing username.`}));
        return;
    }

    const clientSocketId = Object.keys(clients).find(key => clients[key].username === body.username);
    if (!clientSocketId) {
        res.status(404).send(JSON.stringify({success: false, message: `Could not find socket id for ${body.username}.`}));
        return;
    }

    // Emit an 'executeUpdate' event to the specific client
    io.sockets.to(clientSocketId).emit('executeUpdate');

    res.send(JSON.stringify({success: true, message: `Update command sent to ${body.username}.`}));
});


app.post('/dicebot/pause', (req, res, next) => {
    const body = JSON.parse(req.body);

    if (!body.username) {
        res.send(JSON.stringify({success: false, message: `Missing username.`}));

        return;
    }

    const originSocketId = Object.keys(clients).find(key => clients[key].username === body.username);
    if (!originSocketId) {
        res.send(JSON.stringify({success: false, message: `Could not find socket id for ${body.origin}.`}));

        return;
    }

    io.sockets.to(originSocketId).emit('pause', body.receiver);

    res.send(JSON.stringify({success: true}));
});

app.post('/dicebot/resume', (req, res, next) => {
    const body = JSON.parse(req.body);

    if (!body.username) {
        res.send(JSON.stringify({success: false, message: `Missing username.`}));

        return;
    }

    const originSocketId = Object.keys(clients).find(key => clients[key].username === body.username);
    if (!originSocketId) {
        res.send(JSON.stringify({success: false, message: `Could not find socket id for ${body.origin}.`}));

        return;
    }

    io.sockets.to(originSocketId).emit('resume', body.receiver);

    res.send(JSON.stringify({success: true}));
});

app.post('/dicebot/stop', (req, res, next) => {
    const body = JSON.parse(req.body);

    if (!body.username) {
        res.send(JSON.stringify({success: false, message: `Missing username.`}));

        return;
    }

    const originSocketId = Object.keys(clients).find(key => clients[key].username === body.username);
    if (!originSocketId) {
        res.send(JSON.stringify({success: false, message: `Could not find socket id for ${body.origin}.`}));

        return;
    }

    io.sockets.to(originSocketId).emit('stop', body.receiver);

    res.send(JSON.stringify({success: true}));
});

app.post('/dicebot/restart', (req, res, next) => {
    const body = JSON.parse(req.body);

    if (!body.username) {
        res.send(JSON.stringify({success: false, message: `Missing username.`}));

        return;
    }

    const originSocketId = Object.keys(clients).find(key => clients[key].username === body.username);
    if (!originSocketId) {
        res.send(JSON.stringify({success: false, message: `Could not find socket id for ${body.origin}.`}));

        return;
    }

    io.sockets.to(originSocketId).emit('restart', body.receiver);

    res.send(JSON.stringify({success: true}));
});

app.get('/', (req, res) => {
    let i = 0;
    res.render("index");
});

index.listen(3000, () => {
    console.log(banner);
    console.log('listening on *:3000');
});

setInterval(() => {
    const tableData = [];
    for (const [key, client] of Object.entries(clients)) {
        // Check if client.funds is defined
        if (client.funds) {
            tableData.push({
                username: client.username,
                balance: client.funds.available ? client.funds.available.toFixed(8) + ' ' + client.currency.toUpperCase() : null,
                vault: client.funds.vault ? client.funds.vault.toFixed(8) + ' ' + client.currency.toUpperCase() : null,
                busts: client.busts,
                state: client.state
            });
        } else {
            tableData.push({
                username: client.username,
                balance: null,
                vault: null,
                busts: client.busts,
                state: client.state
            });
        }
    }

    if (tableData.length) {
        console.table(tableData);
    }
}, 1000);

// Check for duplicate IP addresses every second
setInterval(() => {
    const knownIpAddresses = [];

    for (const socketId in clients) {
        const client = clients[socketId];
        if (client.ipAddress && knownIpAddresses.includes(client.ipAddress)) {
            console.log(`[CRITICAL] Found duplicate IP address for ${client.username}`);
            io.sockets.to(socketId).emit('duplicateip');
        }

        knownIpAddresses.push(client.ipAddress);
    }
}, 1000)
