const fs = require('fs').promises;
const path = require('path');
const http = require('http');

let ROOT = path.resolve(__dirname, '..');
if (!ROOT.endsWith('agent-orchestra')) {
  ROOT = path.resolve(process.cwd());
}
const DATA_DIR = path.join(ROOT, 'data');
const RUNTIME_FILE = path.join(DATA_DIR, 'runtime.json');
const PID_FILE = path.join(DATA_DIR, 'agent-orchestra.pid');

const HEALTH_TIMEOUT_MS = 1500;
const STOP_WAIT_TIMEOUT_MS = 5000;
const STOP_POLL_INTERVAL_MS = 200;

const PORT_DEFAULT = 3210;

function getRoot() {
  return ROOT;
}

function getDataDir() {
  return DATA_DIR;
}

function getRuntimeFile() {
  return RUNTIME_FILE;
}

function getPidFile() {
  return PID_FILE;
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

async function writePidFile(pid = process.pid) {
  await fs.writeFile(PID_FILE, `${pid}\n`);
}

async function removePidFile() {
  try {
    await fs.unlink(PID_FILE);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
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

async function writeRuntime(data) {
  await fs.writeFile(RUNTIME_FILE, JSON.stringify(data, null, 2) + '\n');
}

async function updateRuntimeStatus(status, extra = {}) {
  const runtime = await readRuntime();
  const now = Date.now();
  const data = {
    pid: runtime?.pid || process.pid,
    pidFile: runtime?.pidFile || 'data/agent-orchestra.pid',
    port: runtime?.port || PORT_DEFAULT,
    startedAt: runtime?.startedAt || now,
    updatedAt: now,
    url: runtime?.url || `http://127.0.0.1:${PORT_DEFAULT}`,
    status,
    ...extra
  };
  if (status === 'stopped' && !data.stoppedAt) {
    data.stoppedAt = now;
  }
  await writeRuntime(data);
  return data;
}

async function reconcileRuntimeState(options = {}) {
  const runtime = await readRuntime();
  const pid = await readPid();
  const processRunning = pid ? isPidRunning(pid) : false;
  const health = await probeHealth(runtime?.url);

  let runtimeChanged = false;
  let pidRemoved = false;
  let reconciled = false;
  let reason = null;

  if (pid && !processRunning) {
    await removePidFile();
    pidRemoved = true;
  }

  if (runtime?.status === 'running' && !processRunning && !health.ok) {
    reason = options.stopReason || 'stale runtime metadata';
    await updateRuntimeStatus('stopped', { stopReason: reason });
    runtimeChanged = true;
    reconciled = true;
  }

  return {
    pid: pidRemoved ? null : pid,
    runtime: runtimeChanged ? await readRuntime() : runtime,
    processRunning,
    health,
    reconciled,
    runtimeChanged,
    pidRemoved,
    reason
  };
}

function isPidRunning(pid) {
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

async function waitForPidExit(pid, timeoutMs = STOP_WAIT_TIMEOUT_MS, pollIntervalMs = STOP_POLL_INTERVAL_MS) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return { exited: true, timedOut: false };
  }
  const startTime = Date.now();
  while (true) {
    if (!isPidRunning(pid)) {
      return { exited: true, timedOut: false };
    }
    if (Date.now() - startTime >= timeoutMs) {
      return { exited: false, timedOut: true };
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
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

function cleanCliJson(text) {
  const cleaned = String(text || '').replace(/\u001b\[[0-9;]*m/g, '');
  const start = cleaned.search(/[\[{]/);
  if (start === -1) throw new Error('CLI 未返回可解析的 JSON');

  const stack = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{' || ch === '[') {
      stack.push(ch);
      continue;
    }

    if (ch === '}' || ch === ']') {
      const expected = ch === '}' ? '{' : '[';
      const actual = stack.pop();
      if (actual !== expected) {
        throw new Error('CLI 返回的 JSON 结构不完整');
      }
      if (stack.length === 0) {
        return cleaned.slice(start, i + 1).trim();
      }
    }
  }

  throw new Error('CLI 返回的 JSON 结构不完整');
}

module.exports = {
  ROOT,
  DATA_DIR,
  RUNTIME_FILE,
  PID_FILE,
  HEALTH_TIMEOUT_MS,
  STOP_WAIT_TIMEOUT_MS,
  STOP_POLL_INTERVAL_MS,
  PORT_DEFAULT,
  getRoot,
  getDataDir,
  getRuntimeFile,
  getPidFile,
  readPid,
  writePidFile,
  removePidFile,
  readRuntime,
  writeRuntime,
  updateRuntimeStatus,
  reconcileRuntimeState,
  isPidRunning,
  waitForPidExit,
  probeHealth,
  formatUptime,
  cleanCliJson
};
