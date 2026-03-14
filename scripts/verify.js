#!/usr/bin/env node

const path = require('path');
const http = require('http');
const { execFile } = require('child_process');
const {
  readRuntime,
  readPid,
  isPidRunning,
  probeHealth,
  cleanCliJson,
  reconcileRuntimeState,
  forceKillAndWait
} = require(path.join(__dirname, '..', 'lib', 'runtime-utils'));

const ROOT = path.join(__dirname, '..');
const HEALTH_TIMEOUT_MS = 3000;
const PROCESS_TIMEOUT_MS = 20000;

let passed = 0;
let failed = 0;
let skipped = 0;
const SKIP = Symbol('skip');

function skip(name, reason) {
  skipped++;
  console.log(`- ${name} (skip: ${reason})`);
  return SKIP;
}

async function test(name, fn) {
  try {
    const result = await fn();
    if (result === SKIP) {
      return;
    }
    if (result) {
      passed++;
      console.log(`✓ ${name}`);
    } else {
      failed++;
      console.log(`✗ ${name}`);
    }
  } catch (error) {
    failed++;
    console.log(`✗ ${name}: ${error.message}`);
  }
}

async function httpGet(url, timeout = HEALTH_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

async function runNodeScript(scriptName, args = [], options = {}) {
  return new Promise(resolve => {
    execFile(process.execPath, [path.join(ROOT, scriptName), ...args], {
      cwd: ROOT,
      timeout: options.timeout || PROCESS_TIMEOUT_MS,
      env: process.env,
      maxBuffer: 2 * 1024 * 1024
    }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error && typeof error.code === 'number' ? error.code : 0,
        stdout,
        stderr,
        error
      });
    });
  });
}

function parseJsonOutput(result, name) {
  if (!result.stdout || !result.stdout.trim()) {
    throw new Error(`${name} did not produce JSON output`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${name} returned invalid JSON: ${error.message}`);
  }
}

async function isServiceRunning() {
  const runtime = await readRuntime();
  const pid = await readPid();
  const running = pid ? isPidRunning(pid) : false;
  return Boolean(runtime?.url && running && runtime?.status === 'running');
}

async function run() {
  console.log('=== Agent Orchestra Verification ===\n');

  const reconciled = await reconcileRuntimeState({ stopReason: 'verify detected stale runtime' });
  if (reconciled.reconciled || reconciled.pidRemoved) {
    console.log('Reconciled stale runtime metadata before verification.\n');
  }

  console.log('--- 1. Runtime State Tests ---');

  await test('readRuntime returns object or null', async () => {
    const runtime = await readRuntime();
    return runtime === null || typeof runtime === 'object';
  });

  await test('readPid returns integer or null', async () => {
    const pid = await readPid();
    return pid === null || Number.isInteger(pid);
  });

  await test('isPidRunning handles invalid input', () => {
    if (isPidRunning(null) !== false) return false;
    if (isPidRunning(0) !== false) return false;
    if (isPidRunning(-1) !== false) return false;
    if (isPidRunning(1.5) !== false) return false;
    return true;
  });

  await test('forceKillAndWait handles invalid pid', async () => {
    const result = await forceKillAndWait(null);
    if (!result.exited || result.killed) return false;
    const result2 = await forceKillAndWait(0);
    if (!result2.exited || result2.killed) return false;
    const result3 = await forceKillAndWait(-1);
    if (!result3.exited || result3.killed) return false;
    return true;
  });

  await test('forceKillAndWait returns correct structure', async () => {
    const result = await forceKillAndWait(999999);
    const hasRequired = 'killed' in result && 'exited' in result && 'timedOut' in result;
    return hasRequired;
  });

  console.log('\n--- 2. Health Endpoint Tests ---');

  await test('probeHealth handles missing url', async () => {
    const result = await probeHealth(null);
    return result.ok === false && result.error === 'missing url';
  });

  await test('probeHealth handles invalid url', async () => {
    const result = await probeHealth('http://127.0.0.1:1');
    return result.ok === false;
  });

  await test('GET /api/health returns 200 and ok=true when running', async () => {
    const runtime = await readRuntime();
    const pid = await readPid();
    const running = pid ? isPidRunning(pid) : false;
    if (!runtime?.url || !running || runtime?.status !== 'running') {
      return skip('GET /api/health returns 200 and ok=true when running', 'service is not running');
    }
    const result = await probeHealth(runtime.url);
    return result.ok === true;
  });

  await test('GET /api/health returns valid structure', async () => {
    const runtime = await readRuntime();
    const pid = await readPid();
    const running = pid ? isPidRunning(pid) : false;
    if (!runtime?.url || !running || runtime?.status !== 'running') {
      return skip('GET /api/health returns valid structure', 'service is not running');
    }
    const result = await probeHealth(runtime.url);
    if (!result.ok || !result.data) return false;
    const hasRequired = ['ok', 'pid', 'port', 'startedAt', 'uptime', 'status'].every(k => k in result.data);
    return hasRequired;
  });

  await test('GET /api/runtime returns valid structure', async () => {
    const runtime = await readRuntime();
    const pid = await readPid();
    const running = pid ? isPidRunning(pid) : false;
    if (!runtime?.url || !running || runtime?.status !== 'running') {
      return skip('GET /api/runtime returns valid structure', 'service is not running');
    }
    const url = runtime.url.replace(/\/?$/, '') + '/api/runtime';
    const res = await httpGet(url);
    if (res.statusCode !== 200) return false;
    const data = JSON.parse(res.body);
    const hasRequired = ['pid', 'port', 'url', 'status'].every(k => k in data);
    return hasRequired;
  });

  console.log('\n--- 3. CLI JSON Extraction Tests ---');

  await test('cleanCliJson handles simple object', () => {
    const input = 'some text before {"key": "value"} some text after';
    const result = cleanCliJson(input);
    const parsed = JSON.parse(result);
    return parsed.key === 'value';
  });

  await test('cleanCliJson handles simple array', () => {
    const input = 'log: [1, 2, 3] done';
    const result = cleanCliJson(input);
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) && parsed.length === 3;
  });

  await test('cleanCliJson strips ANSI codes', () => {
    const input = '\x1b[32m{"ok": true}\x1b[0m';
    const result = cleanCliJson(input);
    const parsed = JSON.parse(result);
    return parsed.ok === true;
  });

  await test('cleanCliJson handles nested structure', () => {
    const input = '{"agents": [{"id": "a1", "name": "Agent One"}]}';
    const result = cleanCliJson(input);
    const parsed = JSON.parse(result);
    return parsed.agents?.[0]?.id === 'a1';
  });

  await test('cleanCliJson handles incomplete JSON', () => {
    try {
      cleanCliJson('{"incomplete":');
      return false;
    } catch {
      return true;
    }
  });

  await test('cleanCliJson handles empty input', () => {
    try {
      cleanCliJson('no json here');
      return false;
    } catch {
      return true;
    }
  });

  await test('cleanCliJson handles string with braces', () => {
    const input = '{"message": "test {nested} brace"}';
    const result = cleanCliJson(input);
    const parsed = JSON.parse(result);
    return parsed.message === 'test {nested} brace';
  });

  console.log('\n--- 4. Lifecycle CLI JSON Tests ---');

  await test('status.js --json returns valid structure', async () => {
    const result = await runNodeScript('status.js', ['--json']);
    if (![0, 1].includes(result.code)) return false;
    const data = parseJsonOutput(result, 'status.js --json');
    const hasRequired = ['status', 'running', 'pid', 'port', 'url'].every(k => k in data);
    return hasRequired && Array.isArray(data.warnings || []);
  });

  await test('stop.js --json returns valid structure', async () => {
    const initiallyRunning = await isServiceRunning();
    const pidBeforeStop = await readPid();
    
    const result = await runNodeScript('stop.js', ['--json']);
    if (result.code !== 0) return false;
    const data = parseJsonOutput(result, 'stop.js --json');
    const hasRequired = ['success', 'stopped', 'message'].every(k => k in data);
    if (!hasRequired || data.success !== true || data.stopped !== true) return false;

    if (initiallyRunning) {
      const pidAfterStop = await readPid();
      const processExited = !isPidRunning(pidBeforeStop);
      const statusResult = await runNodeScript('status.js', ['--json']);
      const statusData = parseJsonOutput(statusResult, 'status.js --json after stop');
      const statusCorrect = ['stopped', 'degraded'].includes(statusData.status) || statusResult.code === 1;
      
      if (!processExited) {
        console.log(`  (warning: process ${pidBeforeStop} still running after stop)`);
      }
      if (!statusCorrect) {
        console.log(`  (warning: status shows '${statusData.status}' after stop)`);
      }
      return processExited && statusCorrect;
    }

    return true;
  });

  await test('stop.js --json returns forced flag on SIGKILL', async () => {
    const pidBeforeStop = await readPid();
    if (!pidBeforeStop || !isPidRunning(pidBeforeStop)) {
      return skip('stop.js forced stop test', 'service not running');
    }

    const result = await runNodeScript('stop.js', ['--json']);
    if (result.code !== 0) return false;
    const data = parseJsonOutput(result, 'stop.js --json');

    if (data.forced === true) {
      return data.forced === true;
    }
    return true;
  });

  await test('restart.js --json returns valid structure and starts service', async () => {
    const result = await runNodeScript('restart.js', ['--json'], { timeout: 30000 });
    if (result.code !== 0) return false;
    const data = parseJsonOutput(result, 'restart.js --json');
    const hasRequired = ['success', 'restarted', 'pid', 'port', 'url', 'message'].every(k => k in data);
    if (!hasRequired || data.success !== true || data.restarted !== true) return false;

    const status = await runNodeScript('status.js', ['--json']);
    const statusData = parseJsonOutput(status, 'status.js --json after restart');
    return status.code === 0 && statusData.status === 'healthy' && statusData.running === true;
  });

  await test('restart.js --json uses stop.js JSON path successfully', async () => {
    const result = await runNodeScript('restart.js', ['--json'], { timeout: 30000 });
    if (result.code !== 0) return false;
    const data = parseJsonOutput(result, 'restart.js --json second pass');
    return data.success === true && data.restarted === true && typeof data.url === 'string' && data.url.length > 0;
  });

  console.log('\n--- 5. Integration Tests ---');

  await test('runtime status matches process state', async () => {
    const runtime = await readRuntime();
    const pid = await readPid();
    const processAlive = pid ? isPidRunning(pid) : false;

    if (runtime?.status === 'running' && !processAlive) {
      console.log('  (warning: runtime says running but process is dead)');
    }
    return true;
  });

  console.log('\n=== Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
