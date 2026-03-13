const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const RUNTIME_FILE = path.join(DATA_DIR, 'runtime.json');
const PID_FILE = path.join(DATA_DIR, 'agent-orchestra.pid');

const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 500;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readPid() {
  try {
    const text = await fs.readFile(PID_FILE, 'utf8');
    const pid = Number.parseInt(text.trim(), 10);
    return Number.isInteger(pid) ? pid : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readRuntime() {
  try {
    const text = await fs.readFile(RUNTIME_FILE, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'EPERM') return true;
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

async function waitForServiceReady() {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const pid = await readPid();
    const runtime = await readRuntime();

    if (pid && isProcessRunning(pid) && runtime?.status === 'running') {
      return { success: true, pid, port: runtime.port, url: runtime.url };
    }

    if (attempt < MAX_POLL_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  const pid = await readPid();
  const runtime = await readRuntime();
  return { success: false, pid, runtime };
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
    console.log(`Agent Orchestra started successfully.`);
    console.log(`PID: ${result.pid}`);
    console.log(`Port: ${result.port}`);
    console.log(`URL: ${result.url}`);
    process.exit(0);
  } else {
    console.error('Failed to confirm service started.');
    if (result.pid) console.error(`PID file exists: ${result.pid}`);
    if (result.runtime) console.error(`Runtime: ${JSON.stringify(result.runtime)}`);
    process.exit(1);
  }
})();
