const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const express = require('express');
const { createHmac } = require('crypto');
const app = express();
const port = 3001;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers for each CPU
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
    console.log('Forking a new process...');
    cluster.fork();
  });

} else {
  app.use(express.json());

  function* byteGenerator(serverSeed, clientSeed, nonce, cursor) {
      let currentRound = Math.floor(cursor / 32);
      let currentRoundCursor = cursor % 32;

      while (true) {
          const hmac = createHmac('sha256', serverSeed);
          hmac.update(`${clientSeed}:${nonce}:${currentRound}`);
          const buffer = hmac.digest();

          while (currentRoundCursor < 32) {
              yield buffer[currentRoundCursor];
              currentRoundCursor += 1;
          }

          currentRoundCursor = 0;
          currentRound += 1;
      }
  }

  function getRawRandomFloat(serverSeed, clientSeed, nonce, cursor) {
    const generator = byteGenerator(serverSeed, clientSeed, nonce, cursor);
    const bytes = [];
    for (let i = 0; i < 4; i++) {
      bytes.push(generator.next().value);
    }

    const floatResult = bytes.reduce((acc, value, i) => acc + value / Math.pow(256, i + 1), 0);
    return floatResult;
  }

  app.post('/computeRandomFloat', (req, res) => {
      const { serverSeed, clientSeed, nonce, cursor } = req.body;
      try {
          const rawFloat = getRawRandomFloat(serverSeed, clientSeed, nonce, cursor);
          res.json({ nonce, rawFloat });
      } catch (error) {
          res.status(500).send('Error computing raw random float: ' + error.message);
      }
  });

  const server = app.listen(port, () => {
      console.log(`Worker ${process.pid} is listening at http://localhost:${port}`);
  });

  process.on('SIGINT', () => {
      console.log(`Worker ${process.pid} received SIGINT. Shutting down gracefully.`);
      server.close(() => {
          console.log(`Worker ${process.pid} server closed`);
          process.exit(0);
      });
  });

  process.on('SIGTERM', () => {
      console.log(`Worker ${process.pid} received SIGTERM. Shutting down gracefully.`);
      server.close(() => {
          console.log(`Worker ${process.pid} server closed`);
          process.exit(0);
      });
  });
}
