const fs = require('fs').promises;
const path = require('path');
const { execFile } = require('child_process');

const ROOT = __dirname;
const TASKS_FILE = path.join(ROOT, 'data', 'tasks.json');
const taskId = process.argv[2];

if (!taskId) {
  console.error('taskId required');
  process.exit(1);
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
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace !== -1) return cleaned.slice(firstBrace).trim();
  const firstBracket = cleaned.indexOf('[');
  if (firstBracket !== -1) return cleaned.slice(firstBracket).trim();
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
      const result = await runSingle(task, run);
      if (result?.canceled) break;
      if (result?.failed) failed = true;
      task = await getTask();
      if (!task || task.cancelRequested || task.status === 'canceled') break;
    }
  }

  const latest = await getTask();
  if (!latest) throw new Error('Task disappeared');
  if (latest.status === 'canceled' || latest.cancelRequested) {
    await updateTask(async t => ({ ...t, status: 'canceled', finishedAt: t.finishedAt || Date.now() }));
    console.log(`[task:${taskId}] runner canceled`);
  } else {
    await updateTask(async t => ({ ...t, status: failed ? 'failed' : 'completed', finishedAt: Date.now() }));
    console.log(`[task:${taskId}] runner finished`);
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
