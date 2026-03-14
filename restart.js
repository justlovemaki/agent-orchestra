const { spawn } = require('child_process');
const path = require('path');
const { readPid, readRuntime, isPidRunning, probeHealth } = require('./lib/runtime-utils');

const ROOT = require('./lib/runtime-utils').ROOT;
const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 500;

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');

function output(result) {
  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.message) console.log(result.message);
    if (result.messages) {
      result.messages.forEach(m => console.log(m));
    }
  }
}

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
  if (!jsonMode) {
    output({ message: 'Stopping Agent Orchestra...' });
  }

  const stopProcess = spawn(process.execPath, [path.join(ROOT, 'stop.js')], {
    cwd: ROOT,
    stdio: jsonMode ? ['ignore', 'ignore', 'pipe'] : 'inherit'
  });

  let stopStderr = '';
  if (jsonMode && stopProcess.stderr) {
    stopProcess.stderr.setEncoding('utf8');
    stopProcess.stderr.on('data', chunk => {
      stopStderr += chunk;
    });
  }

  await new Promise((resolve, reject) => {
    stopProcess.on('close', code => {
      if (code === 0 || code === 1) {
        resolve();
      } else {
        reject(new Error(`stop.js exited with code ${code}${stopStderr ? `: ${stopStderr.trim()}` : ''}`));
      }
    });
    stopProcess.on('error', reject);
  });

  if (!jsonMode) {
    output({ message: 'Waiting for cleanup...' });
  }
  await sleep(1000);

  if (!jsonMode) {
    output({ message: 'Starting Agent Orchestra in background...' });
  }

  const startProcess = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore']
  });

  startProcess.unref();

  if (!jsonMode) {
    output({ message: 'Waiting for service to be ready...' });
  }
  const result = await waitForServiceReady();

  if (result.success) {
    const outputData = {
      success: true,
      restarted: true,
      pid: result.pid,
      port: result.port,
      url: result.url,
      message: 'Agent Orchestra started successfully.'
    };
    output(outputData);
    if (!jsonMode) {
      console.log(`PID: ${result.pid}`);
      console.log(`Port: ${result.port}`);
      console.log(`URL: ${result.url}`);
      console.log('Health: ok');
    }
    process.exit(0);
  } else {
    const outputData = {
      success: false,
      restarted: false,
      pid: result.pid || null,
      runtime: result.runtime || null,
      health: result.health || null,
      message: 'Failed to confirm service started.'
    };
    if (jsonMode) {
      output(outputData);
    } else {
      output({ message: 'Failed to confirm service started.' });
      if (result.pid) console.error(`PID file exists: ${result.pid}`);
      if (result.runtime) console.error(`Runtime: ${JSON.stringify(result.runtime)}`);
      if (result.health) console.error(`Health probe: ${JSON.stringify(result.health)}`);
    }
    process.exit(1);
  }
})();
