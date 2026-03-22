const fs = require('fs').promises;
const path = require('path');
const { execFile } = require('child_process');
const crypto = require('crypto');

const ROOT = __dirname;
const TASKS_FILE = path.join(ROOT, 'data', 'tasks.json');
const AUDIT_EVENTS_FILE = path.join(ROOT, 'data', 'audit-events.json');
const taskId = process.argv[2];

if (!taskId) {
  console.error('taskId required');
  process.exit(1);
}

async function addAuditEvent(type, details = {}, user = 'system') {
  const event = {
    id: crypto.randomUUID(),
    type,
    user,
    details,
    timestamp: Date.now()
  };
  try {
    let events = [];
    try {
      const data = await fs.readFile(AUDIT_EVENTS_FILE, 'utf8');
      events = JSON.parse(data);
    } catch {}
    events.push(event);
    await fs.writeFile(AUDIT_EVENTS_FILE, JSON.stringify(events, null, 2) + '\n');
  } catch (err) {
    console.error('[task:' + taskId + '] failed to write audit event:', err.message);
  }
}

let paused = false;
let pauseResolve = null;

process.on('SIGUSR1', async () => {
  console.log(`[task:${taskId}] received pause signal`);
  paused = true;
  await updateTask(async t => ({ ...t, paused: true, pausedAt: Date.now(), status: 'paused' }));
});

process.on('SIGUSR2', async () => {
  console.log(`[task:${taskId}] received resume signal`);
  paused = false;
  await updateTask(async t => ({ ...t, paused: false, pausedAt: null, status: 'running' }));
  if (pauseResolve) {
    pauseResolve();
    pauseResolve = null;
  }
});

function waitWhilePaused() {
  return new Promise(resolve => {
    pauseResolve = resolve;
  });
}

function runOpenClaw(args, timeout = 600000) {
  return new Promise((resolve, reject) => {
    execFile('openclaw', ['--no-color', ...args], { timeout, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function cleanCliJson(text) {
  const cleaned = String(text || '').replace(/\u001b\[[0-9;]*m/g, '');
  const start = cleaned.search(/[\[{]/);
  if (start === -1) return null;

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
      if (actual !== expected) return null;
      if (stack.length === 0) {
        return cleaned.slice(start, i + 1).trim();
      }
    }
  }

  return null;
}

async function readTasks() {
  return JSON.parse(await fs.readFile(TASKS_FILE, 'utf8'));
}

async function writeTasks(tasks) {
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2) + '\n');
}

async function getTask() {
  const tasks = await readTasks();
  return tasks.find(t => t.id === taskId) || null;
}

async function updateTask(mutator) {
  const tasks = await readTasks();
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) throw new Error('Task not found');
  tasks[idx] = await mutator(tasks[idx]);
  tasks[idx].updatedAt = Date.now();
  await writeTasks(tasks);
  return tasks[idx];
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

async function runSingle(task, run) {
  const current = await getTask();
  if (!current || current.cancelRequested || current.status === 'canceled') {
    console.log(`[task:${taskId}] skipped ${run.agentId}, task canceled before start`);
    return { canceled: true };
  }

  console.log(`[task:${task.id}] dispatch -> ${run.agentId}`);
  await updateTask(async t => ({
    ...t,
    runs: t.runs.map(r => r.id === run.id ? { ...r, status: 'running', startedAt: Date.now() } : r)
  }));

  try {
    const result = await runOpenClaw(['agent', '--agent', run.agentId, '--message', task.prompt, '--json'], 600000);
    console.log(`[task:${task.id}] ${run.agentId} completed`);
    await updateTask(async t => ({
      ...t,
      runs: t.runs.map(r => r.id === run.id ? {
        ...r,
        status: 'completed',
        finishedAt: Date.now(),
        exitCode: 0,
        result: safeJson(cleanCliJson(result.stdout) || result.stdout) || { raw: result.stdout.trim() }
      } : r)
    }));
    return { failed: false };
  } catch (error) {
    console.error(`[task:${task.id}] ${run.agentId} failed`);
    console.error(error.stderr || error.stdout || error.message);
    await updateTask(async t => ({
      ...t,
      runs: t.runs.map(r => r.id === run.id ? {
        ...r,
        status: 'failed',
        finishedAt: Date.now(),
        exitCode: error.code ?? 1,
        error: (error.stderr || error.stdout || error.message || '').slice(-12000)
      } : r)
    }));
    return { failed: true };
  }
}

(async () => {
  console.log(`[task:${taskId}] runner started`);
  let task = await updateTask(async t => ({ ...t, status: 'running', startedAt: Date.now() }));

  let failed = false;
  if (task.mode === 'parallel') {
    const results = await Promise.all(task.runs.map(run => runSingle(task, run)));
    failed = results.some(r => r?.failed);
  } else {
    for (const run of task.runs) {
      while (paused) {
        console.log(`[task:${taskId}] paused, waiting to resume...`);
        await waitWhilePaused();
        task = await getTask();
        if (!task || task.status === 'canceled' || task.cancelRequested) break;
      }
      const result = await runSingle(task, run);
      if (result?.canceled) break;
      if (result?.failed) failed = true;
      task = await getTask();
      if (!task || task.cancelRequested || task.status === 'canceled') break;
      while (task.paused) {
        console.log(`[task:${taskId}] paused, waiting to resume...`);
        await waitWhilePaused();
        task = await getTask();
        if (!task || task.status === 'canceled' || task.cancelRequested) break;
      }
    }
  }

  const latest = await getTask();
  if (!latest) throw new Error('Task disappeared');
  if (latest.status === 'canceled' || latest.cancelRequested) {
    await updateTask(async t => ({ ...t, status: 'canceled', finishedAt: t.finishedAt || Date.now() }));
    console.log(`[task:${taskId}] runner canceled`);
  } else if (latest.paused) {
    console.log(`[task:${taskId}] runner paused`);
  } else {
    const finalStatus = failed ? 'failed' : 'completed';
    await updateTask(async t => ({ ...t, status: finalStatus, finishedAt: Date.now() }));
    console.log(`[task:${taskId}] runner finished`);
    
    await addAuditEvent('task.' + finalStatus, {
      taskId: latest.id,
      title: latest.title,
      agents: latest.agents,
      runs: latest.runs
    }, 'system');
    
    // Send task completion notification
    try {
      const notifier = require('./lib/task-completion-notifier');
      const lastRun = latest.runs[latest.runs.length - 1];
      const notifyResult = await notifier.sendTaskCompletionNotification(latest, lastRun, finalStatus);
      if (!notifyResult.skipped) {
        console.log(`[task:${taskId}] notification sent: ${notifyResult.sent}/${notifyResult.sent + notifyResult.failed}`);
      }
    } catch (notifyError) {
      console.error(`[task:${taskId}] failed to send notification:`, notifyError.message);
    }
  }
})().catch(async error => {
  console.error(`[task:${taskId}] fatal`, error);
  try {
    const task = await getTask();
    if (task && task.status !== 'canceled') {
      await updateTask(async t => ({ ...t, status: 'failed', finishedAt: Date.now(), fatalError: error.message }));
    }
  } catch {}
  process.exit(1);
});
