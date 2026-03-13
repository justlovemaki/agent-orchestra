const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const RUNTIME_FILE = path.join(DATA_DIR, 'runtime.json');
const PID_FILE = path.join(DATA_DIR, 'agent-orchestra.pid');

const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 500;
const HEALTH_TIMEOUT_MS = 1500;

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

async function probeHealth(url) {
  if (!url) return { ok: false, error: 'missing url' };

  return new Promise(resolve => {
    const req = http.get(`${url}/api/health`, { timeout: HEALTH_TIMEOUT_MS }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({
            ok: res.statusCode === 200 && data?.ok === true,
            statusCode: res.statusCode,
            data
          });
        } catch (error) {
          resolve({ ok: false, statusCode: res.statusCode, error: error.message, body });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('health check timeout'));
    });

    req.on('error', error => {
      resolve({ ok: false, error: error.message });
    });
  });
}

async function waitForServiceReady() {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const pid = await readPid();
    const runtime = await readRuntime();
    const health = await probeHealth(runtime?.url);

    if (pid && isProcessRunning(pid) && runtime?.status === 'running' && health.ok) {
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
