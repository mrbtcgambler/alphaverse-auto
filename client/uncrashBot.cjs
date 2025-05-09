#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CONFIG_PATH = path.join('/mnt/alphaverse-auto', 'client_config.json');
const RESTART_SCRIPT = path.join('/mnt/alphaverse-auto', 'bin', 'RestartClient.sh');

async function formatAndWriteConfig(config) {
  const formatted = JSON.stringify(config, null, 2);
  await fs.promises.writeFile(CONFIG_PATH, formatted, 'utf8');
}

async function main() {
  try {
    // 1. Read and parse config
    const raw = await fs.promises.readFile(CONFIG_PATH, 'utf8');
    const config = JSON.parse(raw);

    // 2. Pretty-print and overwrite
    await formatAndWriteConfig(config);

    // 3. Update bustThreshold
    config.bustThreshold = -1;

    // 4. Pretty-print and overwrite again
    await formatAndWriteConfig(config);

    // 5. Restart the client
    const restart = spawn(RESTART_SCRIPT, [], { stdio: 'inherit' });
    restart.on('close', code => {
      if (code === 0) {
        console.log('Client restarted successfully.');
      } else {
        console.error(`Restart script exited with code ${code}`);
      }
    });
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
