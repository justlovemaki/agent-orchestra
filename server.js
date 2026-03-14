const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { execFile, spawn } = require('child_process');
const url = require('url');
const crypto = require('crypto');
const { filterTasks, parseTaskFilters } = require('./lib/task-filters');

const PORT = process.env.PORT || 3210;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const RUNTIME_FILE = path.join(DATA_DIR, 'runtime.json');
const PID_FILE = path.join(DATA_DIR, 'agent-orchestra.pid');
const LOG_DIR = path.join(DATA_DIR, 'task-logs');
const OVERVIEW_CACHE_TTL_MS = 8000;

let overviewCache = {
  value: null,
  expiresAt: 0,
  inFlight: null
};

let currentPort = PORT;
let serverInstance = null;

async function ensureData() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(LOG_DIR, { recursive: true });
  try { await fsp.access(TASKS_FILE); } catch { await fsp.writeFile(TASKS_FILE, '[]\n'); }
}

async function writePidFile(pid = process.pid) {
  await fsp.writeFile(PID_FILE, `${pid}\n`);
}

async function removePidFile() {
  try {
    await fsp.unlink(PID_FILE);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function readPidFile() {
  try {
    const text = await fsp.readFile(PID_FILE, 'utf8');
    const pid = Number.parseInt(text.trim(), 10);
    return Number.isInteger(pid) ? pid : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
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

async function markRuntimeStopped(reason, runtime = null) {
  const current = runtime || await readRuntime();
  const port = current?.port || currentPort;
  const data = {
    pid: current?.pid || null,
    pidFile: current?.pidFile || path.relative(ROOT, PID_FILE),
    port,
    startedAt: current?.startedAt || null,
    url: current?.url || `http://127.0.0.1:${port}`,
    status: 'stopped',
    stoppedAt: Date.now(),
    stopReason: reason || 'unknown'
  };
  await fsp.writeFile(RUNTIME_FILE, JSON.stringify(data, null, 2) + '\n');
  return data;
}

async function cleanupStaleRuntime(reason) {
  const runtime = await readRuntime();
  await removePidFile();
  return markRuntimeStopped(reason, runtime);
}

async function ensureSingleInstance() {
  const pid = await readPidFile();
  const runtime = await readRuntime();

  if (pid && isPidRunning(pid)) {
    const runningUrl = runtime?.url || `http://127.0.0.1:${runtime?.port || PORT}`;
    throw new Error(`Agent Orchestra is already running (pid: ${pid}) at ${runningUrl}`);
  }

  if (pid || runtime?.status === 'running') {
    const reasons = [];
    if (pid && !isPidRunning(pid)) reasons.push(`stale pid ${pid}`);
    if (runtime?.status === 'running') reasons.push('stale runtime status');
    const reason = reasons.length ? reasons.join(', ') : 'stale runtime metadata';
    const cleaned = await cleanupStaleRuntime(reason);
    console.log(`Cleaned stale runtime metadata: ${reason}.`);
    if (cleaned?.url) {
      console.log(`Last known URL: ${cleaned.url}`);
    }
  }
}

async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    try {
      await new Promise((resolve, reject) => {
        const srv = http.createServer(() => {});
        srv.on('error', reject);
        srv.listen(port, () => {
          srv.close(() => resolve());
        });
      });
      return port;
    } catch (err) {
      if (err.code === 'EADDRINUSE') continue;
      throw err;
    }
  }
  throw new Error(`No available port found from ${startPort}`);
}

async function readRuntime() {
  try {
    const content = await fsp.readFile(RUNTIME_FILE, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeRuntime(status) {
  const now = Date.now();
  const data = {
    pid: process.pid,
    pidFile: path.relative(ROOT, PID_FILE),
    port: currentPort,
    startedAt: now,
    updatedAt: now,
    url: `http://127.0.0.1:${currentPort}`,
    status
  };
  if (status === 'stopped') {
    data.stoppedAt = now;
  }
  await fsp.writeFile(RUNTIME_FILE, JSON.stringify(data, null, 2) + '\n');
  return data;
}

async function updateRuntimeStatus(status, extra = {}) {
  const runtime = await readRuntime();
  const now = Date.now();
  const data = {
    pid: runtime?.pid || process.pid,
    pidFile: runtime?.pidFile || path.relative(ROOT, PID_FILE),
    port: runtime?.port || currentPort,
    startedAt: runtime?.startedAt || now,
    updatedAt: now,
    url: runtime?.url || `http://127.0.0.1:${currentPort}`,
    status,
    ...extra
  };
  if (status === 'stopped' && !data.stoppedAt) {
    data.stoppedAt = now;
  }
  await fsp.writeFile(RUNTIME_FILE, JSON.stringify(data, null, 2) + '\n');
  return data;
}

function runOpenClaw(args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    execFile('openclaw', ['--no-color', ...args], { timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
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

async function readTasks() {
  await ensureData();
  return JSON.parse(await fsp.readFile(TASKS_FILE, 'utf8'));
}

async function writeTasks(tasks) {
  await ensureData();
  await fsp.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2) + '\n');
  invalidateOverviewCache();
}

async function getTask(taskId) {
  const tasks = await readTasks();
  return tasks.find(t => t.id === taskId) || null;
}

async function updateTask(taskId, mutator) {
  const tasks = await readTasks();
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) throw new Error('Task not found');
  tasks[idx] = await mutator(tasks[idx]);
  tasks[idx].updatedAt = Date.now();
  await writeTasks(tasks);
  return tasks[idx];
}

function parseAgentsList(text) {
  const lines = String(text || '').split(/\r?\n/);
  const agents = [];
  let current = null;
  for (const raw of lines) {
    const line = raw.replace(/\u001b\[[0-9;]*m/g, '');
    const m = line.match(/^- ([^\s]+)(?: \(default\))?$/);
    if (m) {
      if (current) agents.push(current);
      current = { id: m[1], isDefault: line.includes('(default)') };
      continue;
    }
    if (!current) continue;
    const identity = line.match(/^\s*Identity:\s*(.+)$/);
    if (identity) current.identity = identity[1];
    const workspace = line.match(/^\s*Workspace:\s*(.+)$/);
    if (workspace) current.workspace = workspace[1];
    const model = line.match(/^\s*Model:\s*(.+)$/);
    if (model) current.model = model[1];
    const routing = line.match(/^\s*Routing rules:\s*(.+)$/);
    if (routing) current.routingRules = Number(routing[1]) || 0;
  }
  if (current) agents.push(current);
  return agents;
}

function humanAge(ms) {
  if (ms == null) return '未知';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  return `${day}天前`;
}

function formatTaskForUi(task) {
  return {
    ...task,
    createdAtLabel: task.createdAt ? new Date(task.createdAt).toLocaleString('zh-CN') : '—',
    startedAtLabel: task.startedAt ? new Date(task.startedAt).toLocaleString('zh-CN') : '—',
    finishedAtLabel: task.finishedAt ? new Date(task.finishedAt).toLocaleString('zh-CN') : '—'
  };
}

async function buildOverviewFresh() {
  const [statusResult, sessionsResult, agentsListResult, tasks] = await Promise.all([
    runOpenClaw(['status', '--json'], 30000),
    runOpenClaw(['sessions', '--all-agents', '--json'], 30000),
    runOpenClaw(['agents', 'list'], 30000),
    readTasks()
  ]);

  const status = JSON.parse(cleanCliJson(statusResult.stdout));
  const sessions = JSON.parse(cleanCliJson(sessionsResult.stdout));
  const agentsList = parseAgentsList(agentsListResult.stdout);
  const agentMap = new Map(agentsList.map(a => [a.id, a]));
  const sessionsByAgent = new Map();

  for (const s of (sessions.sessions || [])) {
    const list = sessionsByAgent.get(s.agentId) || [];
    list.push(s);
    sessionsByAgent.set(s.agentId, list);
  }

  const agents = (status.agents?.agents || []).map(agent => {
    const recentSessions = sessionsByAgent.get(agent.id) || [];
    const latest = recentSessions.filter(s => s.updatedAt).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    const activeWithin15m = recentSessions.some(s => (s.ageMs ?? Infinity) < 15 * 60 * 1000);
    const sessionsCount = agent.sessionsCount ?? recentSessions.length;
    const parsed = agentMap.get(agent.id) || {};
    return {
      id: agent.id,
      name: agent.name || agent.id,
      identity: parsed.identity || agent.name || agent.id,
      model: parsed.model || latest?.model || '未知',
      workspace: agent.workspaceDir,
      sessionsCount,
      lastActiveAgeMs: agent.lastActiveAgeMs,
      lastActiveLabel: humanAge(agent.lastActiveAgeMs),
      status: activeWithin15m ? 'busy' : (sessionsCount > 0 ? 'idle' : 'offline'),
      latestSession: latest ? {
        key: latest.key,
        kind: latest.kind,
        model: latest.model,
        totalTokens: latest.totalTokens,
        updatedAt: latest.updatedAt,
        ageLabel: humanAge(latest.ageMs)
      } : null
    };
  });

  const taskStats = summarizeTasks(tasks);
  return {
    generatedAt: Date.now(),
    gateway: status.gateway,
    securityAudit: status.securityAudit?.summary,
    channelSummary: status.channelSummary || [],
    heartbeat: status.heartbeat || null,
    totals: {
      agents: agents.length,
      sessions: status.agents?.totalSessions ?? sessions.count ?? 0,
      busyAgents: agents.filter(a => a.status === 'busy').length,
      taskQueued: taskStats.queued,
      taskRunning: taskStats.running,
      taskDone: taskStats.completed,
      taskFailed: taskStats.failed,
      taskCanceled: taskStats.canceled
    },
    agents
  };
}

async function buildOverview(force = false) {
  const now = Date.now();
  if (!force && overviewCache.value && overviewCache.expiresAt > now) {
    return overviewCache.value;
  }
  if (!force && overviewCache.inFlight) {
    return overviewCache.inFlight;
  }

  overviewCache.inFlight = buildOverviewFresh()
    .then(data => {
      overviewCache.value = data;
      overviewCache.expiresAt = Date.now() + OVERVIEW_CACHE_TTL_MS;
      return data;
    })
    .finally(() => {
      overviewCache.inFlight = null;
    });

  return overviewCache.inFlight;
}

function invalidateOverviewCache() {
  overviewCache.expiresAt = 0;
}

function summarizeTasks(tasks) {
  return tasks.reduce((acc, task) => {
    acc.total += 1;
    const s = task.status || 'queued';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, { total: 0, queued: 0, running: 0, completed: 0, failed: 0, canceled: 0 });
}

async function listTasks(filters = {}) {
  const tasks = await readTasks();
  return filterTasks(tasks, filters)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map(formatTaskForUi);
}

async function launchTaskRunner(task) {
  const runnerPath = path.join(ROOT, 'task-runner.js');
  const logPath = path.join(LOG_DIR, `${task.id}.log`);
  const out = fs.openSync(logPath, 'a');
  const child = spawn(process.execPath, [runnerPath, task.id], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', out, out]
  });
  child.unref();
  await updateTask(task.id, async t => ({ ...t, runnerPid: child.pid, logPath }));
  return { logPath, runnerPid: child.pid };
}

function normalizeAgents(input) {
  return [...new Set((Array.isArray(input) ? input : []).filter(Boolean))];
}

function makeRuns(agents) {
  return agents.map(agentId => ({
    id: crypto.randomUUID(),
    agentId,
    status: 'queued',
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    error: null,
    result: null
  }));
}

async function createTask(body) {
  const agents = normalizeAgents(body.agents);
  if (!agents.length) throw new Error('至少选择一个 Agent');
  if (!body.title?.trim()) throw new Error('任务标题不能为空');
  if (!body.prompt?.trim()) throw new Error('任务内容不能为空');

  const id = crypto.randomUUID();
  const now = Date.now();
  const task = {
    id,
    title: body.title.trim(),
    prompt: body.prompt.trim(),
    agents,
    mode: body.mode === 'parallel' ? 'parallel' : 'broadcast',
    priority: body.priority || 'medium',
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    createdBy: 'Master',
    cancelRequested: false,
    runnerPid: null,
    runs: makeRuns(agents)
  };
  const tasks = await readTasks();
  tasks.push(task);
  await writeTasks(tasks);
  const runner = await launchTaskRunner(task);
  return formatTaskForUi({ ...task, ...runner });
}

async function createRetryTask(taskId) {
  const source = await getTask(taskId);
  if (!source) throw new Error('原任务不存在');
  const failedAgents = source.runs.filter(r => r.status === 'failed').map(r => r.agentId);
  const agents = failedAgents.length ? failedAgents : source.agents;
  return createTask({
    title: `${source.title}（重试）`,
    prompt: source.prompt,
    agents,
    mode: source.mode,
    priority: source.priority
  });
}

async function cancelTask(taskId) {
  const task = await getTask(taskId);
  if (!task) throw new Error('任务不存在');
  if (['completed', 'failed', 'canceled'].includes(task.status)) return formatTaskForUi(task);

  await updateTask(taskId, async t => ({
    ...t,
    cancelRequested: true,
    status: 'canceled',
    finishedAt: Date.now(),
    runs: t.runs.map(r => (r.status === 'queued' || r.status === 'running')
      ? { ...r, status: 'canceled', finishedAt: Date.now(), error: r.error || '已由用户取消' }
      : r)
  }));

  if (task.runnerPid) {
    try { process.kill(-task.runnerPid, 'SIGTERM'); } catch {}
    try { process.kill(task.runnerPid, 'SIGTERM'); } catch {}
  }

  return formatTaskForUi(await getTask(taskId));
}

async function readLog(taskId) {
  const logPath = path.join(LOG_DIR, `${taskId}.log`);
  try {
    const txt = await fsp.readFile(logPath, 'utf8');
    return txt.slice(-120000);
  } catch {
    return '';
  }
}

async function requestHandler(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (pathname.startsWith('/api/')) {
    try {
      if (req.method === 'GET' && pathname === '/api/overview') {
        const force = parsed.query && (parsed.query.force === '1' || parsed.query.force === 'true');
        return json(res, 200, await buildOverview(force));
      }
      if (req.method === 'GET' && pathname === '/api/runtime') {
        const runtime = await readRuntime();
        if (runtime) {
          return json(res, 200, runtime);
        }
        return json(res, 200, {
          pid: process.pid,
          pidFile: path.relative(ROOT, PID_FILE),
          port: currentPort,
          startedAt: null,
          url: `http://127.0.0.1:${currentPort}`,
          status: 'running'
        });
      }
      if (req.method === 'GET' && pathname === '/api/health') {
        const runtime = await readRuntime();
        const startedAt = runtime?.startedAt || process.uptime() * 1000;
        const uptime = Date.now() - startedAt;
        return json(res, 200, {
          ok: true,
          pid: process.pid,
          port: currentPort,
          startedAt,
          uptime,
          status: 'healthy'
        });
      }
      if (req.method === 'GET' && pathname === '/api/tasks') {
        const filters = parseTaskFilters(parsed.query || {});
        return json(res, 200, { tasks: await listTasks(filters) });
      }
      if (req.method === 'POST' && pathname === '/api/tasks') {
        const body = await readJson(req);
        return json(res, 201, { task: await createTask(body) });
      }
      if (req.method === 'GET' && pathname.startsWith('/api/tasks/') && pathname.endsWith('/log')) {
        const taskId = pathname.split('/')[3];
        return json(res, 200, { taskId, log: await readLog(taskId) });
      }
      if (req.method === 'POST' && pathname.startsWith('/api/tasks/') && pathname.endsWith('/cancel')) {
        const taskId = pathname.split('/')[3];
        return json(res, 200, { task: await cancelTask(taskId) });
      }
      if (req.method === 'POST' && pathname.startsWith('/api/tasks/') && pathname.endsWith('/retry')) {
        const taskId = pathname.split('/')[3];
        return json(res, 201, { task: await createRetryTask(taskId) });
      }
      return json(res, 404, { error: 'Not found' });
    } catch (error) {
      return json(res, 500, { error: error.message, stderr: error.stderr, stdout: error.stdout });
    }
  }

  return serveStatic(pathname, res);
}

async function serveStatic(pathname, res) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.normalize(filePath).replace(/^\.\.(\/|\\|$)+/, '');
  const abs = path.join(PUBLIC_DIR, filePath);
  try {
    const stat = await fsp.stat(abs);
    if (stat.isDirectory()) return serveStatic(path.join(pathname, 'index.html'), res);
    const ext = path.extname(abs);
    const contentType = ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' })[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(abs).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

ensureData().then(async () => {
  await ensureSingleInstance();

  currentPort = await findAvailablePort(PORT);
  if (currentPort !== PORT) {
    console.log(`Port ${PORT} in use, auto-detected available port: ${currentPort}`);
  }

  await writePidFile();
  await writeRuntime('running');
  console.log(`PID file written to ${PID_FILE}`);
  console.log(`Runtime info written to ${RUNTIME_FILE}`);

  let cleaningUp = false;
  const cleanup = async (signal, exitCode = 0) => {
    if (cleaningUp) return;
    cleaningUp = true;
    console.log(`Received ${signal}, updating runtime status...`);
    try {
      await updateRuntimeStatus('stopped');
    } finally {
      await removePidFile();
      if (serverInstance) {
        serverInstance.close(() => {
          process.exit(exitCode);
        });
      } else {
        process.exit(exitCode);
      }
    }
  };

  process.on('SIGTERM', () => cleanup('SIGTERM'));
  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('uncaughtException', async (error) => {
    console.error(error);
    await cleanup('uncaughtException', 1);
  });
  process.on('unhandledRejection', async (error) => {
    console.error(error);
    await cleanup('unhandledRejection', 1);
  });

  serverInstance = http.createServer(requestHandler);
  serverInstance.on('error', async (error) => {
    console.error(error);
    await cleanup('server error', 1);
  });
  serverInstance.listen(currentPort, () => {
    console.log(`Agent Orchestra running at http://127.0.0.1:${currentPort}`);
  });
}).catch(async (error) => {
  console.error(error);
  try {
    await updateRuntimeStatus('stopped');
    await removePidFile();
  } catch {}
  process.exit(1);
});
