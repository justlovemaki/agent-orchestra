const fs = require('fs').promises;
const path = require('path');
const http = require('http');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const RUNTIME_FILE = path.join(DATA_DIR, 'runtime.json');
const PID_FILE = path.join(DATA_DIR, 'agent-orchestra.pid');
const HEALTH_TIMEOUT_MS = 1500;

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

function formatUptime(startedAt) {
  if (!startedAt) return '—';
  const ms = Date.now() - startedAt;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}秒`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时${min % 60}分钟`;
  const day = Math.floor(hr / 24);
  return `${day}天${hr % 24}小时`;
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

(async () => {
  const pid = await readPid();
  const runtime = await readRuntime();

  if (!pid && !runtime) {
    console.log('Agent Orchestra is not running.');
    console.log('No PID file or runtime info found.');
    process.exit(1);
  }

  const processRunning = pid ? isProcessRunning(pid) : false;
  const health = await probeHealth(runtime?.url);

  let status = 'stopped';
  if (processRunning && health.ok) {
    status = 'healthy';
  } else if (processRunning || runtime?.status === 'running') {
    status = 'degraded';
  } else {
    status = runtime?.status || 'stopped';
  }

  console.log('=== Agent Orchestra Status ===');
  console.log(`Status: ${status}`);
  console.log(`PID: ${pid || '—'}`);
  console.log(`Port: ${runtime?.port || '—'}`);
  console.log(`URL: ${runtime?.url || '—'}`);

  if (runtime?.startedAt) {
    console.log(`Started: ${new Date(runtime.startedAt).toLocaleString('zh-CN')}`);
    console.log(`Uptime: ${formatUptime(runtime.startedAt)}`);
  }

  if (runtime?.stoppedAt) {
    console.log(`Stopped: ${new Date(runtime.stoppedAt).toLocaleString('zh-CN')}`);
  }

  console.log(`Process alive: ${processRunning ? 'yes' : 'no'}`);
  console.log(`Health endpoint: ${health.ok ? 'ok' : 'unreachable'}`);

  if (health.ok && health.data) {
    console.log(`Health uptime: ${formatUptime(health.data.startedAt)}`);
  }

  if (!processRunning && pid) {
    console.log(`\nWarning: PID file exists but process ${pid} is not running.`);
    console.log('The PID file may be stale.');
  }

  if (runtime?.status === 'running' && !health.ok) {
    console.log('\nWarning: runtime metadata says running, but health endpoint is not reachable.');
    if (health.error) {
      console.log(`Health probe error: ${health.error}`);
    }
  }

  process.exit(status === 'healthy' ? 0 : 1);
})();
