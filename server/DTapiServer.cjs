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
      const hmac = createHmac('sha256', serverSeed);
      hmac.update(`${clientSeed}:${nonce}:${cursor}`);
      const buffer = hmac.digest();
      let currentRoundCursor = 0;

      while (currentRoundCursor < 32) {
          yield buffer[currentRoundCursor];
          currentRoundCursor++;
      }
  }

  function getRawRandomFloat(serverSeed, clientSeed, nonce, cursor) {
    const generator = byteGenerator(serverSeed, clientSeed, nonce, cursor);
    const bytes = [];
    for (let i = 0; i < 4; i++) {
      bytes.push(generator.next().value);
    }

    return bytes.reduce((acc, value, i) => acc + value / Math.pow(256, i + 1), 0);
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

  function getByteIntArray(serverSeed, clientSeed, nonce, cursor, amount) {
      const generator = byteGenerator(serverSeed, clientSeed, nonce, cursor);
      const bytes = [];
      for (let i = 0; i < amount; i++) {
          bytes.push(generator.next().value);
      }

      return bytes;
  }

  function chunk(arr, chunkSize = 1, cache = []) {
      const tmp = [...arr]
      if (chunkSize <= 0) {
          return cache
      }

      while (tmp.length) {
          cache.push(tmp.splice(0, chunkSize))
      }

      return cache
  }

  const DRAGON_TOWER_LEVEL_MAPPING = {
      easy: { count: 3, size: 4 },
      medium: { count: 2, size: 3 },
      hard: { count: 1, size: 2 },
      expert: { count: 1, size: 3 },
      master: { count: 1, size: 4 },
  }

  const DRAGON_TOWER_PAYOUT_MAPPING = {
      easy: {
          1: 1.31,
          2: 1.74,
          3: 2.32,
          4: 3.10,
          5: 4.13,
          6: 5.51,
          7: 7.34,
          8: 9.79,
          9: 13.05,
      },
      medium: {
          1: 1.47,
          2: 2.21,
          3: 3.31,
          4: 4.96,
          5: 7.44,
          6: 11.16,
          7: 16.74,
          8: 25.11,
          9: 37.67,
      },
      hard: {
          1: 1.96,
          2: 3.92,
          3: 7.84,
          4: 15.68,
          5: 31.36,
          6: 62.72,
          7: 125.44,
          8: 250.88,
          9: 501.76,
      },
      expert: {
          1: 2.94,
          2: 8.82,
          3: 26.46,
          4: 76.38,
          5: 238.14,
          6: 714.42,
          7: 2143.26,
          8: 6429.78,
          9: 19289.34,
      },
      master: {
          1: 3.92,
          2: 15.68,
          3: 62.72,
          4: 250.88,
          5: 1003.52,
          6: 4014.08,
          7: 16056.32,
          8: 64225.28,
          9: 256901.12,
      }
  };

  app.post('/computeDragonTowerResult', async (req, res) => {
      const { serverSeed, clientSeed, nonce, betSize, currency, difficulty, eggs } = req.body;
      try {
          let cursor = 0;
          const intsChunks = [],
              playedRounds = [],
              rounds = [];

          for (let i = 0; i < Math.ceil(DRAGON_TOWER_LEVEL_MAPPING[difficulty].count * 9 / 8); i++) {
              intsChunks.push(... chunk(getByteIntArray(serverSeed, clientSeed, nonce, cursor, 32), 4));
              cursor++;
          }

          let intChunk = 0,
              win = true;
          for (let i = 0; i < 9; i++) {
              const round = [],
                  allFields = Array.from(Array(DRAGON_TOWER_LEVEL_MAPPING[difficulty].size).keys());

              let multiplier = DRAGON_TOWER_LEVEL_MAPPING[difficulty].size;

              while (round.length < DRAGON_TOWER_LEVEL_MAPPING[difficulty].count) {
                  let i = 0,
                      result = 0;

                  for (const int of intsChunks[intChunk++]) {
                      i++;
                      result += int / (256 ** i);
                  }

                  result *= multiplier--;
                  result = Math.trunc(result);


                  round.push(allFields[result]);
                  allFields.splice(result, 1);

                  round.sort((a, b) => a - b);
              }


              if (win && eggs[i] !== undefined) {
                  if (round.includes(eggs[i])) {
                      playedRounds.push(round);
                  } else {
                      if (win) {
                          // Push last round which was a loss as well
                          playedRounds.push(round);
                      }
                      win = false;
                  }
              }

              rounds.push(round);
          }

          let payoutMultiplier = !win ? 0 : DRAGON_TOWER_PAYOUT_MAPPING[difficulty][playedRounds.length];

          res.json({
              "active": false,
              "nonce": nonce,
              "amount": betSize,
              "payoutMultiplier": payoutMultiplier,
              "payout": betSize * payoutMultiplier,
              "currency": currency,
              "state": {
                  "currentRound": playedRounds.length,
                  "playedRounds": playedRounds,
                  "difficulty": difficulty,
                  "rounds": rounds,
                  "tilesSelected": eggs.slice(0, Math.max(1, playedRounds.length)),
              }
          });
      } catch (error) {
          res.status(500).send('Error computing dragon tower bet result: ' + error.message);
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
