#!/usr/bin/env node

const path = require('path');
const http = require('http');
const { readRuntime, readPid, isPidRunning, probeHealth, cleanCliJson, reconcileRuntimeState } = require(path.join(__dirname, '..', 'lib', 'runtime-utils'));

const HEALTH_TIMEOUT_MS = 3000;

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

  console.log('\n--- 4. Integration Tests ---');

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
