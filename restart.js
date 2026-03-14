const { spawn } = require('child_process');
const path = require('path');
const { readPid, readRuntime, isPidRunning, probeHealth } = require('./lib/runtime-utils');

const ROOT = require('./lib/runtime-utils').ROOT;
const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 500;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServiceReady() {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const pid = await readPid();
    const runtime = await readRuntime();
    const health = await probeHealth(runtime?.url);

    if (pid && isPidRunning(pid) && runtime?.status === 'running' && health.ok) {
      return {
        success: true,
        pid,
        port: runtime.port,
        url: runtime.url,
        health: health.data
      };
    }

    if (attempt < MAX_POLL_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  const pid = await readPid();
  const runtime = await readRuntime();
  const health = await probeHealth(runtime?.url);
  return { success: false, pid, runtime, health };
}

(async () => {
  console.log('Stopping Agent Orchestra...');

  const stopProcess = spawn(process.execPath, [path.join(ROOT, 'stop.js')], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  await new Promise((resolve, reject) => {
    stopProcess.on('close', code => {
      if (code === 0 || code === 1) {
        resolve();
      } else {
        reject(new Error(`stop.js exited with code ${code}`));
      }
    });
    stopProcess.on('error', reject);
  });

  console.log('Waiting for cleanup...');
  await sleep(1000);

  console.log('Starting Agent Orchestra in background...');

  const startProcess = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore']
  });

  startProcess.unref();

  console.log('Waiting for service to be ready...');
  const result = await waitForServiceReady();

  if (result.success) {
    console.log('Agent Orchestra started successfully.');
    console.log(`PID: ${result.pid}`);
    console.log(`Port: ${result.port}`);
    console.log(`URL: ${result.url}`);
    console.log('Health: ok');
    process.exit(0);
  } else {
    console.error('Failed to confirm service started.');
    if (result.pid) console.error(`PID file exists: ${result.pid}`);
    if (result.runtime) console.error(`Runtime: ${JSON.stringify(result.runtime)}`);
    if (result.health) console.error(`Health probe: ${JSON.stringify(result.health)}`);
    process.exit(1);
  }
})();
