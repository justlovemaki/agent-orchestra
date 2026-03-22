const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { execFile, spawn } = require('child_process');
const url = require('url');
const crypto = require('crypto');
const { filterTasks, parseTaskFilters } = require('./lib/task-filters');
const { loadWorkflows, createWorkflow, getWorkflow, updateWorkflow, deleteWorkflow } = require('./lib/workflows');
const { runWorkflow, getWorkflowRun, getWorkflowRuns } = require('./lib/workflow-runner');
const { addAuditEvent, queryAuditEvents, getAuditEventTypes } = require('./lib/audit');
const agentCombinations = require('./lib/agent-combinations');
const combinationRecommendations = require('./lib/combination-recommendations');
const { register, login, logout, verifyToken, getCurrentUser, getUsers, getUserRole, isAdmin, setRole, setUserGroupId, getUserById, getUserPermissions, loadUsers, loadTokens } = require('./lib/users');
const userGroups = require('./lib/user-groups');
const scheduledBackup = require('./lib/scheduled-backup');
const taskCompletionConfig = require('./lib/task-completion-config');
const taskCompletionNotifier = require('./lib/task-completion-notifier');
const cloudStorage = require('./lib/cloud-storage');
const notificationChannels = require('./lib/notification-channels');
const notificationHistory = require('./lib/notification-history');
const notificationTemplates = require('./lib/notification-templates');

const PORT = parseInt(process.env.PORT) || 3210;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const RUNTIME_FILE = path.join(DATA_DIR, 'runtime.json');
const AGENT_GROUPS_FILE = path.join(DATA_DIR, 'agent-groups.json');
const SHARED_PRESETS_FILE = path.join(DATA_DIR, 'shared-presets.json');
const USER_PRESETS_FILE = path.join(DATA_DIR, 'user-presets.json');
const USER_TEMPLATES_FILE = path.join(DATA_DIR, 'user-templates.json');
const AGENT_COMBINATIONS_FILE = path.join(DATA_DIR, 'agent-combinations.json');
const PID_FILE = path.join(DATA_DIR, 'agent-orchestra.pid');
const LOG_DIR = path.join(DATA_DIR, 'task-logs');
const OVERVIEW_CACHE_TTL_MS = 8000;

const sseClients = new Map();
let taskWatcherInterval = null;

let overviewCache = {
  value: null,
  expiresAt: 0,
  inFlight: null
};

async function verifyTokenFromRequest(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  return await verifyToken(token);
}

let currentPort = PORT;
let serverInstance = null;

async function ensureData() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(LOG_DIR, { recursive: true });
  try { await fsp.access(TASKS_FILE); } catch { await fsp.writeFile(TASKS_FILE, '[]\n'); }
  try { await fsp.access(TEMPLATES_FILE); } catch { await fsp.writeFile(TEMPLATES_FILE, '[]\n'); }
  try { await fsp.access(AGENT_GROUPS_FILE); } catch { await fsp.writeFile(AGENT_GROUPS_FILE, '[]\n'); }
  try { await fsp.access(SHARED_PRESETS_FILE); } catch { await fsp.writeFile(SHARED_PRESETS_FILE, '[]\n'); }
  try { await fsp.access(USER_PRESETS_FILE); } catch { await fsp.writeFile(USER_PRESETS_FILE, '[]\n'); }
  try { await fsp.access(USER_TEMPLATES_FILE); } catch { await fsp.writeFile(USER_TEMPLATES_FILE, '[]\n'); }
  try { await fsp.access(AGENT_COMBINATIONS_FILE); } catch { await fsp.writeFile(AGENT_COMBINATIONS_FILE, '[]\n'); }
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

async function readTemplates() {
  await ensureData();
  return JSON.parse(await fsp.readFile(TEMPLATES_FILE, 'utf8'));
}

async function writeTemplates(templates) {
  await ensureData();
  await fsp.writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2) + '\n');
}

async function getTemplate(templateId) {
  const templates = await readTemplates();
  return templates.find(t => t.id === templateId) || null;
}

async function readAgentGroups() {
  await ensureData();
  return JSON.parse(await fsp.readFile(AGENT_GROUPS_FILE, 'utf8'));
}

async function writeAgentGroups(groups) {
  await ensureData();
  await fsp.writeFile(AGENT_GROUPS_FILE, JSON.stringify(groups, null, 2) + '\n');
}

async function getAgentGroup(groupId) {
  const groups = await readAgentGroups();
  return groups.find(g => g.id === groupId) || null;
}

async function readSharedPresets() {
  await ensureData();
  return JSON.parse(await fsp.readFile(SHARED_PRESETS_FILE, 'utf8'));
}

async function writeSharedPresets(presets) {
  await ensureData();
  await fsp.writeFile(SHARED_PRESETS_FILE, JSON.stringify(presets, null, 2) + '\n');
}

async function getSharedPreset(presetId) {
  const presets = await readSharedPresets();
  return presets.find(p => p.id === presetId) || null;
}

async function readUserPresets(userId) {
  await ensureData();
  const allUserPresets = JSON.parse(await fsp.readFile(USER_PRESETS_FILE, 'utf8'));
  return allUserPresets.filter(p => p.userId === userId);
}

async function writeUserPresets(userId, presets) {
  await ensureData();
  const allUserPresets = JSON.parse(await fsp.readFile(USER_PRESETS_FILE, 'utf8'));
  const others = allUserPresets.filter(p => p.userId !== userId);
  const updated = [...others, ...presets.map(p => ({ ...p, userId }))];
  await fsp.writeFile(USER_PRESETS_FILE, JSON.stringify(updated, null, 2) + '\n');
}

async function addUserPreset(userId, preset) {
  await ensureData();
  const allUserPresets = JSON.parse(await fsp.readFile(USER_PRESETS_FILE, 'utf8'));
  const newPreset = { ...preset, userId };
  allUserPresets.push(newPreset);
  await fsp.writeFile(USER_PRESETS_FILE, JSON.stringify(allUserPresets, null, 2) + '\n');
  return newPreset;
}

async function updateUserPreset(userId, presetId, updates) {
  await ensureData();
  const allUserPresets = JSON.parse(await fsp.readFile(USER_PRESETS_FILE, 'utf8'));
  const idx = allUserPresets.findIndex(p => p.userId === userId && p.id === presetId);
  if (idx === -1) throw new Error('预设不存在');
  allUserPresets[idx] = { ...allUserPresets[idx], ...updates, updatedAt: Date.now() };
  await fsp.writeFile(USER_PRESETS_FILE, JSON.stringify(allUserPresets, null, 2) + '\n');
  return allUserPresets[idx];
}

async function deleteUserPreset(userId, presetId) {
  await ensureData();
  const allUserPresets = JSON.parse(await fsp.readFile(USER_PRESETS_FILE, 'utf8'));
  const idx = allUserPresets.findIndex(p => p.userId === userId && p.id === presetId);
  if (idx === -1) throw new Error('预设不存在');
  allUserPresets.splice(idx, 1);
  await fsp.writeFile(USER_PRESETS_FILE, JSON.stringify(allUserPresets, null, 2) + '\n');
  return { success: true };
}

async function readUserTemplates(userId) {
  await ensureData();
  const allUserTemplates = JSON.parse(await fsp.readFile(USER_TEMPLATES_FILE, 'utf8'));
  return allUserTemplates.filter(t => t.userId === userId);
}

async function addUserTemplate(userId, template) {
  await ensureData();
  const allUserTemplates = JSON.parse(await fsp.readFile(USER_TEMPLATES_FILE, 'utf8'));
  const newTemplate = { ...template, userId };
  allUserTemplates.push(newTemplate);
  await fsp.writeFile(USER_TEMPLATES_FILE, JSON.stringify(allUserTemplates, null, 2) + '\n');
  return newTemplate;
}

async function updateUserTemplate(userId, templateId, updates) {
  await ensureData();
  const allUserTemplates = JSON.parse(await fsp.readFile(USER_TEMPLATES_FILE, 'utf8'));
  const idx = allUserTemplates.findIndex(t => t.userId === userId && t.id === templateId);
  if (idx === -1) throw new Error('模板不存在');
  allUserTemplates[idx] = { ...allUserTemplates[idx], ...updates, updatedAt: Date.now() };
  await fsp.writeFile(USER_TEMPLATES_FILE, JSON.stringify(allUserTemplates, null, 2) + '\n');
  return allUserTemplates[idx];
}

async function deleteUserTemplate(userId, templateId) {
  await ensureData();
  const allUserTemplates = JSON.parse(await fsp.readFile(USER_TEMPLATES_FILE, 'utf8'));
  const idx = allUserTemplates.findIndex(t => t.userId === userId && t.id === templateId);
  if (idx === -1) throw new Error('模板不存在');
  allUserTemplates.splice(idx, 1);
  await fsp.writeFile(USER_TEMPLATES_FILE, JSON.stringify(allUserTemplates, null, 2) + '\n');
  return { success: true };
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

async function listAgents() {
  const result = await runOpenClaw(['agents', 'list'], 30000);
  const agentsList = parseAgentsList(result.stdout);
  return agentsList;
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
  await addAuditEvent('task.created', {
    taskId: task.id,
    title: task.title,
    agents: task.agents,
    mode: task.mode,
    priority: task.priority
  }, task.createdBy);
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

async function retryRun(taskId, runId) {
  const task = await getTask(taskId);
  if (!task) throw new Error('任务不存在');
  
  const run = task.runs.find(r => r.id === runId);
  if (!run) throw new Error('Run 不存在');
  if (!['failed', 'error'].includes(run.status)) {
    throw new Error('只能重试状态为 failed 或 error 的 Run');
  }

  await updateTask(taskId, async t => {
    const updatedRuns = t.runs.map(r => {
      if (r.id === runId) {
        return {
          ...r,
          status: 'queued',
          startedAt: null,
          finishedAt: null,
          exitCode: null,
          error: null,
          result: null
        };
      }
      return r;
    });
    
    return {
      ...t,
      runs: updatedRuns,
      status: t.status === 'failed' ? 'running' : t.status,
      updatedAt: Date.now()
    };
  });

  const updatedTask = await getTask(taskId);
  if (updatedTask.runnerPid) {
    try { process.kill(updatedTask.runnerPid, 'SIGUSR2'); } catch {}
  }

  await addAuditEvent('task.retried', {
    taskId: task.id,
    runId: runId,
    title: task.title,
    agents: task.agents
  }, 'Master');
  
  return formatTaskForUi(updatedTask);
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

  await addAuditEvent('task.cancelled', {
    taskId: task.id,
    title: task.title,
    agents: task.agents
  }, 'Master');

  return formatTaskForUi(await getTask(taskId));
}

async function pauseTask(taskId) {
  const task = await getTask(taskId);
  if (!task) throw new Error('任务不存在');
  if (task.status !== 'running') throw new Error('只有运行中的任务才能暂停');

  await updateTask(taskId, async t => ({
    ...t,
    paused: true,
    pausedAt: Date.now(),
    status: 'paused'
  }));

  if (task.runnerPid) {
    try { process.kill(task.runnerPid, 'SIGUSR1'); } catch {}
  }

  await addAuditEvent('task.paused', {
    taskId: task.id,
    title: task.title,
    agents: task.agents
  }, 'Master');

  return formatTaskForUi(await getTask(taskId));
}

async function resumeTask(taskId) {
  const task = await getTask(taskId);
  if (!task) throw new Error('任务不存在');
  if (!task.paused) throw new Error('任务未暂停');

  await updateTask(taskId, async t => ({
    ...t,
    paused: false,
    pausedAt: null,
    status: 'running'
  }));

  if (task.runnerPid) {
    try { process.kill(task.runnerPid, 'SIGUSR2'); } catch {}
  }

  await addAuditEvent('task.resumed', {
    taskId: task.id,
    title: task.title,
    agents: task.agents
  }, 'Master');

  return formatTaskForUi(await getTask(taskId));
}

async function reassignTask(taskId, newAgents) {
  const task = await getTask(taskId);
  if (!task) throw new Error('任务不存在');
  if (!['queued', 'paused'].includes(task.status)) {
    throw new Error('仅允许对排队中或已暂停的任务进行重新指派');
  }
  const agents = normalizeAgents(newAgents);
  if (!agents.length) throw new Error('至少需要选择一个 Agent');

  const oldAgents = task.agents || [];
  await updateTask(taskId, async t => ({
    ...t,
    agents,
    runs: makeRuns(agents),
    reassignedAt: Date.now(),
    reassignedBy: 'Master'
  }));

  await addAuditEvent('task.reassigned', {
    taskId: task.id,
    title: task.title,
    oldAgents,
    newAgents: agents
  }, 'Master');

  return formatTaskForUi(await getTask(taskId));
}

async function batchCancelTasks(taskIds) {
  const results = { success: [], failed: [] };
  for (const taskId of taskIds) {
    try {
      await cancelTask(taskId);
      results.success.push(taskId);
    } catch (err) {
      results.failed.push({ taskId, error: err.message });
    }
  }
  return results;
}

async function batchRetryTasks(taskIds) {
  const results = { success: [], failed: [] };
  for (const taskId of taskIds) {
    try {
      const newTask = await createRetryTask(taskId);
      results.success.push({ originalTaskId: taskId, newTaskId: newTask.id });
    } catch (err) {
      results.failed.push({ taskId, error: err.message });
    }
  }
  return results;
}

async function batchUpdatePriority(taskIds, priority) {
  const results = { success: [], failed: [] };
  for (const taskId of taskIds) {
    try {
      await updateTask(taskId, t => ({ ...t, priority }));
      results.success.push(taskId);
    } catch (err) {
      results.failed.push({ taskId, error: err.message });
    }
  }
  return results;
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

function handleSse(taskId, req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const clientId = crypto.randomUUID();
  const client = { id: clientId, res, taskId, lastLogSize: 0 };
  
  if (!sseClients.has(taskId)) {
    sseClients.set(taskId, new Set());
  }
  sseClients.get(taskId).add(client);

  res.write(`event: task-start\ndata: ${JSON.stringify({ taskId })}\n\n`);

  res.on('close', () => {
    const clients = sseClients.get(taskId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        sseClients.delete(taskId);
      }
    }
  });

  if (!taskWatcherInterval) {
    startTaskWatcher();
  }

  res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
}

function startTaskWatcher() {
  if (taskWatcherInterval) return;
  
  taskWatcherInterval = setInterval(async () => {
    for (const [taskId, clients] of sseClients) {
      if (clients.size === 0) continue;
      
      const task = await getTask(taskId);
      const logPath = path.join(LOG_DIR, `${taskId}.log`);
      
      try {
        const stats = await fsp.stat(logPath);
        const currentSize = stats.size;
        
        for (const client of clients) {
          if (currentSize > client.lastLogSize) {
            const fd = await fsp.open(logPath, 'r');
            const buffer = Buffer.alloc(currentSize - client.lastLogSize);
            await fd.read(buffer, 0, buffer.length, client.lastLogSize);
            await fd.close();
            
            const newContent = buffer.toString('utf8');
            client.lastLogSize = currentSize;
            
            if (newContent) {
              client.res.write(`event: log-new\ndata: ${JSON.stringify({ content: newContent })}\n\n`);
            }
          }
          
          if (task && task.status !== 'running' && task.status !== 'queued') {
            if (task.status === 'completed') {
              client.res.write(`event: task-complete\ndata: ${JSON.stringify({ taskId, status: task.status })}\n\n`);
            } else if (task.status === 'failed' || task.status === 'canceled') {
              client.res.write(`event: task-error\ndata: ${JSON.stringify({ taskId, status: task.status, error: task.error || task.runs?.[0]?.error })}\n\n`);
            }
            clients.delete(client);
          }
        }
        
        for (const client of clients) {
          client.res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
        }
      } catch {
      }
    }
    
    if (sseClients.size === 0 && taskWatcherInterval) {
      clearInterval(taskWatcherInterval);
      taskWatcherInterval = null;
    }
  }, 2000);
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
      if (req.method === 'GET' && pathname === '/api/stats') {
        const tasks = await listTasks({});
        const now = Date.now();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const todayTasks = tasks.filter(t => t.createdAt >= todayStart.getTime());
        const weekTasks = tasks.filter(t => t.createdAt >= weekStart.getTime());
        const agents = await listAgents();
        const activeAgents = agents.filter(a => a.status === 'active' || a.status === 'running');
        return json(res, 200, {
          ok: true,
          stats: {
            totalTasks: tasks.length,
            todayTasks: todayTasks.length,
            weekTasks: weekTasks.length,
            activeAgents: activeAgents.length,
            totalAgents: agents.length
          }
        });
      }
      if (req.method === 'GET' && pathname === '/api/stats/trends') {
        const days = parseInt(parsed.query?.days) || 14;
        const tasks = await listTasks({});
        const agentsList = await listAgents();
        const agentNameMap = new Map(agentsList.map(a => [a.id, a.identity || a.id]));
        
        const trendsMap = new Map();
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < days; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          trendsMap.set(d.toISOString().split('T')[0], { total: 0, completed: 0, failed: 0 });
        }
        
        const cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - days + 1);
        
        const agentStats = new Map();
        const statusCounts = { queued: 0, running: 0, completed: 0, failed: 0, paused: 0, canceled: 0 };
        const agentWorkloadMap = new Map();

        for (const task of tasks) {
          // Status distribution
          const s = task.status || 'queued';
          if (statusCounts.hasOwnProperty(s)) {
            statusCounts[s]++;
          }

          // Trends calculation
          const createdAt = new Date(task.createdAt);
          const dateKey = createdAt.toISOString().split('T')[0];
          if (trendsMap.has(dateKey)) {
            const trend = trendsMap.get(dateKey);
            trend.total++;
            if (task.status === 'completed') trend.completed++;
            else if (task.status === 'failed') trend.failed++;
          }

          // Agent Usage & Workload
          if (createdAt >= cutoffDate || task.status === 'running' || task.status === 'queued') {
            const runs = task.runs || [];
            for (const run of runs) {
              if (!run.agentId) continue;
              
              // Recent usage (within days)
              if (createdAt >= cutoffDate) {
                if (!agentStats.has(run.agentId)) {
                  agentStats.set(run.agentId, {
                    agentId: run.agentId,
                    agentName: agentNameMap.get(run.agentId) || run.agentId,
                    taskCount: 0,
                    successCount: 0,
                    failCount: 0
                  });
                }
                const stats = agentStats.get(run.agentId);
                stats.taskCount++;
                if (run.status === 'completed') stats.successCount++;
                else if (run.status === 'failed' || run.status === 'error') stats.failCount++;
              }

              // Workload (running or queued)
              if (task.status === 'running' || task.status === 'queued') {
                if (run.status === 'running' || run.status === 'queued') {
                  const current = agentWorkloadMap.get(run.agentId) || { agentId: run.agentId, workloadCount: 0 };
                  current.workloadCount += 1;
                  agentWorkloadMap.set(run.agentId, current);
                }
              }
            }
          }
        }
        
        const trends = Array.from(trendsMap.entries())
          .map(([date, data]) => ({ date, ...data }))
          .reverse();
        
        const agentUsage = Array.from(agentStats.values()).sort((a, b) => b.taskCount - a.taskCount);
        
        const totalTasks = tasks.length;
        const taskStatusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
          status,
          count,
          percentage: totalTasks > 0 ? parseFloat(((count / totalTasks) * 100).toFixed(1)) : 0
        }));

        for (const [agentId, data] of agentWorkloadMap) {
          data.agentName = agentNameMap.get(agentId) || agentId;
        }

        const activeWorkload = Array.from(agentWorkloadMap.values())
          .filter(d => d.workloadCount > 0)
          .sort((a, b) => b.workloadCount - a.workloadCount);

        const totalWorkload = activeWorkload.reduce((sum, d) => sum + d.workloadCount, 0);
        const agentWorkloadDistribution = activeWorkload.map(d => ({
          agentId: d.agentId,
          agentName: d.agentName,
          workloadCount: d.workloadCount,
          percentage: totalWorkload > 0 ? parseFloat(((d.workloadCount / totalWorkload) * 100).toFixed(1)) : 0
        }));
        
        return json(res, 200, { ok: true, trends, days, agentUsage, taskStatusDistribution, agentWorkloadDistribution });
      }
      if (req.method === 'GET' && pathname === '/api/tasks') {
        const filters = parseTaskFilters(parsed.query || {});
        return json(res, 200, { tasks: await listTasks(filters) });
      }
      if (req.method === 'POST' && pathname === '/api/tasks') {
        const body = await readJson(req);
        if (body.combinationId) {
          await agentCombinations.incrementUsage(body.combinationId);
        }
        return json(res, 201, { task: await createTask(body) });
      }
      if (req.method === 'GET' && pathname.startsWith('/api/tasks/') && pathname.endsWith('/log')) {
        const taskId = pathname.split('/')[3];
        return json(res, 200, { taskId, log: await readLog(taskId) });
      }
      if (req.method === 'GET' && pathname.match(/^\/api\/tasks\/[^/]+\/logs\/stream$/)) {
        const taskId = pathname.split('/')[3];
        return handleSse(taskId, req, res);
      }
      if (req.method === 'POST' && pathname.startsWith('/api/tasks/') && pathname.endsWith('/cancel')) {
        const taskId = pathname.split('/')[3];
        return json(res, 200, { task: await cancelTask(taskId) });
      }
      if (req.method === 'POST' && pathname.startsWith('/api/tasks/') && pathname.endsWith('/pause')) {
        const taskId = pathname.split('/')[3];
        return json(res, 200, { task: await pauseTask(taskId) });
      }
      if (req.method === 'POST' && pathname.startsWith('/api/tasks/') && pathname.endsWith('/resume')) {
        const taskId = pathname.split('/')[3];
        return json(res, 200, { task: await resumeTask(taskId) });
      }
      if (req.method === 'POST' && pathname.startsWith('/api/tasks/') && pathname.endsWith('/retry')) {
        const taskId = pathname.split('/')[3];
        return json(res, 201, { task: await createRetryTask(taskId) });
      }
      if (req.method === 'POST' && pathname.match(/^\/api\/tasks\/[^/]+\/runs\/[^/]+\/retry$/)) {
        const parts = pathname.split('/');
        const taskId = parts[3];
        const runId = parts[5];
        return json(res, 200, { task: await retryRun(taskId, runId) });
      }
      if (req.method === 'PATCH' && pathname.match(/^\/api\/tasks\/[^/]+\/reassign$/)) {
        const taskId = pathname.split('/')[3];
        const body = await readJson(req);
        if (!Array.isArray(body.agents) || body.agents.length === 0) {
          throw new Error('请提供有效的 Agent 数组');
        }
        return json(res, 200, { task: await reassignTask(taskId, body.agents) });
      }
      if (req.method === 'POST' && pathname === '/api/tasks/batch-cancel') {
        const body = await readJson(req);
        if (!Array.isArray(body.taskIds) || body.taskIds.length === 0) {
          throw new Error('请提供有效的任务 ID 数组');
        }
        const results = await batchCancelTasks(body.taskIds);
        return json(res, 200, { results });
      }
      if (req.method === 'POST' && pathname === '/api/tasks/batch-retry') {
        const body = await readJson(req);
        if (!Array.isArray(body.taskIds) || body.taskIds.length === 0) {
          throw new Error('请提供有效的任务 ID 数组');
        }
        const results = await batchRetryTasks(body.taskIds);
        return json(res, 200, { results });
      }
      if (req.method === 'PATCH' && pathname === '/api/tasks/batch-priority') {
        const body = await readJson(req);
        if (!Array.isArray(body.taskIds) || body.taskIds.length === 0) {
          throw new Error('请提供有效的任务 ID 数组');
        }
        if (!['low', 'medium', 'high'].includes(body.priority)) {
          throw new Error('无效的优先级值');
        }
        const results = await batchUpdatePriority(body.taskIds, body.priority);
        return json(res, 200, { results });
      }
      if (req.method === 'GET' && pathname === '/api/templates') {
        return json(res, 200, { templates: await readTemplates() });
      }
      if (req.method === 'POST' && pathname === '/api/templates') {
        const body = await readJson(req);
        if (!body.name?.trim()) throw new Error('模板名称不能为空');
        const templates = await readTemplates();
        const newTemplate = {
          id: crypto.randomUUID(),
          name: body.name.trim(),
          description: body.description?.trim() || '',
          defaultAgents: normalizeAgents(body.defaultAgents),
          defaultPriority: body.defaultPriority || 'medium',
          defaultMode: body.defaultMode || 'broadcast',
          defaultContent: body.defaultContent?.trim() || '',
          createdAt: Date.now()
        };
        templates.push(newTemplate);
        await writeTemplates(templates);
        return json(res, 201, { template: newTemplate });
      }
      if (req.method === 'DELETE' && pathname.startsWith('/api/templates/')) {
        const templateId = pathname.split('/')[3];
        const templates = await readTemplates();
        const idx = templates.findIndex(t => t.id === templateId);
        if (idx === -1) throw new Error('模板不存在');
        templates.splice(idx, 1);
        await writeTemplates(templates);
        return json(res, 200, { success: true });
      }
      if (req.method === 'PUT' && pathname.startsWith('/api/templates/')) {
        const templateId = pathname.split('/')[3];
        const body = await readJson(req);
        const templates = await readTemplates();
        const idx = templates.findIndex(t => t.id === templateId);
        if (idx === -1) throw new Error('模板不存在');
        if (body.name != null) templates[idx].name = body.name.trim();
        if (body.description != null) templates[idx].description = body.description.trim();
        if (body.defaultAgents != null) templates[idx].defaultAgents = normalizeAgents(body.defaultAgents);
        if (body.defaultPriority != null) templates[idx].defaultPriority = body.defaultPriority;
        if (body.defaultMode != null) templates[idx].defaultMode = body.defaultMode;
        if (body.defaultContent != null) templates[idx].defaultContent = body.defaultContent.trim();
        await writeTemplates(templates);
        return json(res, 200, { template: templates[idx] });
      }
      if (req.method === 'POST' && pathname.startsWith('/api/tasks/from-template/')) {
        const templateId = pathname.split('/')[4];
        const template = await getTemplate(templateId);
        if (!template) throw new Error('模板不存在');
        const body = await readJson(req);
        return json(res, 201, {
          task: await createTask({
            title: body.title || template.name,
            prompt: body.prompt || template.defaultContent,
            agents: body.agents || template.defaultAgents,
            priority: body.priority || template.defaultPriority,
            mode: body.mode || template.defaultMode
          })
        });
      }
      if (req.method === 'GET' && pathname === '/api/agent-groups') {
        return json(res, 200, { groups: await readAgentGroups() });
      }
      if (req.method === 'POST' && pathname === '/api/agent-groups') {
        const body = await readJson(req);
        if (!body.name?.trim()) throw new Error('分组名称不能为空');
        const groups = await readAgentGroups();
        const newGroup = {
          id: crypto.randomUUID(),
          name: body.name.trim(),
          color: body.color || '#6b7280',
          description: body.description?.trim() || '',
          agentIds: [],
          createdAt: Date.now()
        };
        groups.push(newGroup);
        await writeAgentGroups(groups);
        return json(res, 201, { group: newGroup });
      }
      if (req.method === 'PUT' && pathname.startsWith('/api/agent-groups/')) {
        const groupId = pathname.split('/')[3];
        const body = await readJson(req);
        const groups = await readAgentGroups();
        const idx = groups.findIndex(g => g.id === groupId);
        if (idx === -1) throw new Error('分组不存在');
        if (body.name != null) groups[idx].name = body.name.trim();
        if (body.color != null) groups[idx].color = body.color;
        if (body.description != null) groups[idx].description = body.description.trim();
        await writeAgentGroups(groups);
        return json(res, 200, { group: groups[idx] });
      }
      if (req.method === 'DELETE' && pathname.startsWith('/api/agent-groups/')) {
        const groupId = pathname.split('/')[3];
        const groups = await readAgentGroups();
        const idx = groups.findIndex(g => g.id === groupId);
        if (idx === -1) throw new Error('分组不存在');
        groups.splice(idx, 1);
        await writeAgentGroups(groups);
        return json(res, 200, { success: true });
      }
      if (req.method === 'GET' && pathname === '/api/agent-combinations') {
        const scope = parsed.query?.scope;
        let combinations = await agentCombinations.getAgentCombinations();
        if (scope === 'all') {
          combinations = combinations.filter(c => c.sharedWithTeam === true);
        }
        return json(res, 200, { combinations });
      }
      if (req.method === 'POST' && pathname === '/api/agent-combinations') {
        const body = await readJson(req);
        if (!body.name?.trim()) throw new Error('组合名称不能为空');
        const currentUser = await verifyTokenFromRequest(req);
        const userName = currentUser?.name || 'Master';
        const newCombination = await agentCombinations.createAgentCombination({
          name: body.name.trim(),
          description: body.description?.trim() || '',
          color: body.color || '#6b7280',
          agentIds: body.agentIds || [],
          sharedWithTeam: body.sharedWithTeam || false,
          createdBy: currentUser?.id || null
        });
        await addAuditEvent('agent_combination.created', {
          combinationId: newCombination.id,
          combinationName: newCombination.name,
          agentCount: newCombination.agentIds.length,
          sharedWithTeam: newCombination.sharedWithTeam
        }, userName, currentUser?.id);
        return json(res, 201, { combination: newCombination });
      }
      if (req.method === 'GET' && pathname.startsWith('/api/agent-combinations/')) {
        const combinationId = pathname.split('/')[3];
        const combination = await agentCombinations.getAgentCombination(combinationId);
        if (!combination) throw new Error('组合不存在');
        return json(res, 200, { combination });
      }
      if (req.method === 'PUT' && pathname.startsWith('/api/agent-combinations/') && pathname.match(/\/share$/)) {
        const combinationId = pathname.split('/')[3];
        const currentUser = await verifyTokenFromRequest(req);
        const userName = currentUser?.name || 'Master';
        const combination = await agentCombinations.getAgentCombination(combinationId);
        if (!combination) throw new Error('组合不存在');
        const isAdmin = currentUser?.role === 'admin';
        const isOwner = combination.createdBy === currentUser?.id;
        if (!isOwner && !isAdmin) throw new Error('仅创建者或管理员可切换共享状态');
        const updated = await agentCombinations.toggleShare(combinationId);
        if (!updated) throw new Error('组合不存在');
        const auditEventType = updated.sharedWithTeam ? 'agent_combination.shared' : 'agent_combination.unshared';
        await addAuditEvent(auditEventType, {
          combinationId: updated.id,
          combinationName: updated.name,
          sharedWithTeam: updated.sharedWithTeam
        }, userName, currentUser?.id);
        return json(res, 200, { combination: updated });
      }
      if (req.method === 'PUT' && pathname.startsWith('/api/agent-combinations/') && !pathname.match(/\/share$/)) {
        const combinationId = pathname.split('/')[3];
        const body = await readJson(req);
        const currentUser = await verifyTokenFromRequest(req);
        const userName = currentUser?.name || 'Master';
        const updated = await agentCombinations.updateAgentCombination(combinationId, {
          name: body.name?.trim(),
          description: body.description?.trim(),
          color: body.color,
          agentIds: body.agentIds,
          sharedWithTeam: body.sharedWithTeam
        });
        if (!updated) throw new Error('组合不存在');
        await addAuditEvent('agent_combination.updated', {
          combinationId: updated.id,
          combinationName: updated.name,
          agentCount: updated.agentIds.length,
          sharedWithTeam: updated.sharedWithTeam
        }, userName, currentUser?.id);
        return json(res, 200, { combination: updated });
      }
      if (req.method === 'DELETE' && pathname.startsWith('/api/agent-combinations/')) {
        const combinationId = pathname.split('/')[3];
        const combination = await agentCombinations.getAgentCombination(combinationId);
        if (!combination) throw new Error('组合不存在');
        const currentUser = await verifyTokenFromRequest(req);
        const userName = currentUser?.name || 'Master';
        await agentCombinations.deleteAgentCombination(combinationId);
        await addAuditEvent('agent_combination.deleted', {
          combinationId: combination.id,
          combinationName: combination.name,
          agentCount: combination.agentIds.length
        }, userName, currentUser?.id);
        return json(res, 200, { success: true });
      }
      if (req.method === 'GET' && pathname === '/api/agent-combinations/popular') {
        const limit = parseInt(parsed.query?.limit) || 10;
        const popular = await agentCombinations.getPopularCombinations(limit);
        return json(res, 200, { combinations: popular });
      }
      if (req.method === 'GET' && pathname === '/api/agent-combinations/export') {
        const combinations = await agentCombinations.getAgentCombinations();
        const currentUser = await verifyTokenFromRequest(req);
        const userName = currentUser?.name || 'Master';
        const exportData = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          combinations: combinations
        };
        await addAuditEvent('agent_combination.exported', {
          combinationCount: combinations.length
        }, userName, currentUser?.id);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="agent-combinations.json"'
        });
        return res.end(JSON.stringify(exportData, null, 2));
      }
      if (req.method === 'POST' && pathname === '/api/agent-combinations/import') {
        const body = await readJson(req);
        if (!body.data || !body.data.version || !Array.isArray(body.data.combinations)) {
          throw new Error('无效的导入文件格式');
        }
        const { data } = body;
        const mode = body.mode || 'merge';
        const currentUser = await verifyTokenFromRequest(req);
        const userName = currentUser?.name || 'Master';
        const results = { imported: 0, skipped: 0, errors: [] };

        if (mode === 'overwrite') {
          const importedCombinations = data.combinations.map(c => ({
            id: crypto.randomUUID(),
            name: c.name,
            description: c.description || '',
            color: c.color || '#6b7280',
            agentIds: c.agentIds || [],
            createdAt: Date.now()
          }));
          await agentCombinations.overwriteAgentCombinations(importedCombinations);
          results.imported = importedCombinations.length;
        } else {
          const existingCombinations = await agentCombinations.getAgentCombinations();
          for (const combo of data.combinations) {
            if (!combo.name) {
              results.skipped++;
              continue;
            }
            const existingByName = existingCombinations.find(c => c.name === combo.name);
            if (existingByName) {
              results.skipped++;
              continue;
            }
            existingCombinations.push({
              id: crypto.randomUUID(),
              name: combo.name,
              description: combo.description || '',
              color: combo.color || '#6b7280',
              agentIds: combo.agentIds || [],
              createdAt: Date.now()
            });
            results.imported++;
          }
          await agentCombinations.overwriteAgentCombinations(existingCombinations);
        }
        await addAuditEvent('agent_combination.imported', {
          mode,
          imported: results.imported,
          skipped: results.skipped
        }, userName, currentUser?.id);
        return json(res, 200, results);
      }
      if (req.method === 'GET' && pathname.match(/^\/api\/agent-combinations\/[^/]+\/usage-trends$/)) {
        const combinationId = pathname.split('/')[3];
        const combination = await agentCombinations.getAgentCombination(combinationId);
        if (!combination) throw new Error('组合不存在');
        const days = parseInt(parsed.query?.days) || 14;
        const trends = await agentCombinations.getUsageTrends(combinationId, days);
        return json(res, 200, { combination, trends });
      }
      if (req.method === 'GET' && pathname === '/api/agent-combinations/recommendations') {
        const forceRefresh = parsed.query?.refresh === 'true';
        const result = await combinationRecommendations.getRecommendations(forceRefresh);
        return json(res, 200, result);
      }
      if (req.method === 'GET' && pathname === '/api/agent-combinations/recommendations/types') {
        const types = combinationRecommendations.getRecommendationTypes();
        return json(res, 200, { types });
      }
      if (req.method === 'POST' && pathname.match(/^\/api\/agent-combinations\/recommendations\/[^/]+\/apply$/)) {
        const recommendationId = pathname.split('/')[4];
        const currentUser = await verifyTokenFromRequest(req);
        const userName = currentUser?.name || 'System';
        
        const result = await combinationRecommendations.getRecommendations();
        const recommendation = result.recommendations.find(r => r.id === recommendationId);
        
        if (!recommendation) {
          return json(res, 404, { error: '推荐不存在或已过期' });
        }
        
        const newCombination = await agentCombinations.createAgentCombination({
          name: `推荐组合 ${new Date().toLocaleDateString('zh-CN')}`,
          description: recommendation.reason,
          agentIds: recommendation.agentIds,
          color: '#8b5cf6'
        });
        
        await combinationRecommendations.dismissRecommendation(recommendationId);
        await combinationRecommendations.recordApplication(recommendationId);
        
        await addAuditEvent('combination.recommended_applied', {
          recommendationId,
          recommendationType: recommendation.type,
          agentIds: recommendation.agentIds,
          combinationId: newCombination.id,
          combinationName: newCombination.name
        }, userName, currentUser?.id);
        
        return json(res, 201, { combination: newCombination });
      }
      if (req.method === 'POST' && pathname.match(/^\/api\/agent-combinations\/recommendations\/[^/]+\/dismiss$/)) {
        const recommendationId = pathname.split('/')[4];
        const dismissed = await combinationRecommendations.dismissRecommendation(recommendationId);
        
        if (!dismissed) {
          return json(res, 404, { error: '推荐不存在或已过期' });
        }
        
        return json(res, 200, { success: true, dismissed });
      }
      // Feedback endpoints for recommendation learning
      if (req.method === 'POST' && pathname.match(/^\/api\/agent-combinations\/recommendations\/[^/]+\/feedback$/)) {
        const recommendationId = pathname.split('/')[4];
        const body = await readJson(req);
        const { feedbackType, comment } = body;
        
        if (!feedbackType || !['helpful', 'not_helpful'].includes(feedbackType)) {
          return json(res, 400, { error: '无效的反馈类型，必须是 helpful 或 not_helpful' });
        }
        
        const feedback = await combinationRecommendations.recordFeedback(recommendationId, feedbackType, comment || null);
        
        const currentUser = await verifyTokenFromRequest(req);
        await addAuditEvent('recommendation.feedback_submitted', {
          recommendationId,
          feedbackType,
          comment: comment || null
        }, currentUser?.name || 'System', currentUser?.id);
        
        return json(res, 201, { feedback });
      }
      if (req.method === 'GET' && pathname.match(/^\/api\/agent-combinations\/recommendations\/[^/]+\/feedback$/)) {
        const recommendationId = pathname.split('/')[4];
        const feedback = await combinationRecommendations.getFeedbackForRecommendation(recommendationId);
        const stats = await combinationRecommendations.getFeedbackStats();
        
        return json(res, 200, { 
          feedback,
          stats: stats[recommendationId] || { helpful: 0, notHelpful: 0 }
        });
      }
      if (req.method === 'GET' && pathname === '/api/presets') {
        return json(res, 200, { presets: await readSharedPresets() });
      }
      if (req.method === 'POST' && pathname === '/api/presets') {
        const body = await readJson(req);
        if (!body.name?.trim()) throw new Error('预设名称不能为空');
        if (!body.filters || typeof body.filters !== 'object') throw new Error('筛选条件不能为空');
        const presets = await readSharedPresets();
        const createdBy = body.createdBy || 'Master';
        const newPreset = {
          id: crypto.randomUUID(),
          name: body.name.trim(),
          filters: body.filters,
          createdBy: createdBy,
          createdAt: Date.now(),
          permissions: {
            canEdit: [createdBy],
            canDelete: [createdBy]
          }
        };
        presets.push(newPreset);
        await writeSharedPresets(presets);
        return json(res, 201, { preset: newPreset });
      }
      if (req.method === 'PUT' && pathname.startsWith('/api/presets/')) {
        const presetId = pathname.split('/')[3];
        const body = await readJson(req);
        const currentUser = await verifyTokenFromRequest(req);
        const presets = await readSharedPresets();
        const idx = presets.findIndex(p => p.id === presetId);
        if (idx === -1) throw new Error('预设不存在');
        const preset = presets[idx];
        const permissions = preset.permissions || { canEdit: [preset.createdBy], canDelete: [preset.createdBy] };
        const requestUser = body.userId || 'Master';
        const requestUserId = currentUser?.id;
        const isRequesterAdmin = requestUserId ? await isAdmin(requestUserId) : false;
        const isCreator = preset.createdBy === requestUser || preset.createdBy === requestUserId;
        const isAuthorized = isCreator || permissions.canEdit.includes(requestUser) || permissions.canEdit.includes(requestUserId);
        if (!isAuthorized && !isRequesterAdmin && requestUser !== 'Master') {
          throw new Error('您没有编辑此预设的权限');
        }
        if (body.name != null) preset.name = body.name.trim();
        if (body.filters != null) preset.filters = body.filters;
        preset.updatedAt = Date.now();
        await writeSharedPresets(presets);
        return json(res, 200, { preset });
      }
      if (req.method === 'DELETE' && pathname.startsWith('/api/presets/')) {
        const presetId = pathname.split('/')[3];
        const currentUser = await verifyTokenFromRequest(req);
        const presets = await readSharedPresets();
        const idx = presets.findIndex(p => p.id === presetId);
        if (idx === -1) throw new Error('预设不存在');
        const preset = presets[idx];
        const permissions = preset.permissions || { canEdit: [preset.createdBy], canDelete: [preset.createdBy] };
        const requestUserId = currentUser?.id;
        const isRequesterAdmin = requestUserId ? await isAdmin(requestUserId) : false;
        const isCreator = preset.createdBy === requestUserId;
        const isAuthorized = isCreator || permissions.canDelete.includes(requestUserId);
        if (!isAuthorized && !isRequesterAdmin && preset.createdBy !== 'Master') {
          throw new Error('您没有删除此预设的权限');
        }
        presets.splice(idx, 1);
        await writeSharedPresets(presets);
        return json(res, 200, { success: true });
      }
      if ((req.method === 'GET' || req.method === 'PUT') && pathname.match(/^\/api\/presets\/[\w-]+\/permissions$/)) {
        const presetId = pathname.split('/')[3];
        const currentUser = await verifyTokenFromRequest(req);
        const presets = await readSharedPresets();
        const preset = presets.find(p => p.id === presetId);
        if (!preset) throw new Error('预设不存在');
        if (req.method === 'GET') {
          return json(res, 200, {
            presetId: preset.id,
            presetName: preset.name,
            createdBy: preset.createdBy,
            permissions: preset.permissions || { canEdit: [preset.createdBy], canDelete: [preset.createdBy] }
          });
        }
        if (req.method === 'PUT') {
          const body = await readJson(req);
          const requestUserId = currentUser?.id;
          const isRequesterAdmin = requestUserId ? await isAdmin(requestUserId) : false;
          const isCreator = preset.createdBy === requestUserId;
          if (!isCreator && !isRequesterAdmin && body.userId !== 'Master') {
            throw new Error('只有创建者或管理员可以修改权限');
          }
          const newPermissions = body.permissions;
          if (!newPermissions || typeof newPermissions !== 'object') {
            throw new Error('无效的权限配置');
          }
          const idx = presets.findIndex(p => p.id === presetId);
          presets[idx].permissions = {
            canEdit: Array.isArray(newPermissions.canEdit) ? newPermissions.canEdit : [preset.createdBy],
            canDelete: Array.isArray(newPermissions.canDelete) ? newPermissions.canDelete : [preset.createdBy]
          };
          if (!presets[idx].permissions.canEdit.includes(preset.createdBy)) {
            presets[idx].permissions.canEdit.push(preset.createdBy);
          }
          if (!presets[idx].permissions.canDelete.includes(preset.createdBy)) {
            presets[idx].permissions.canDelete.push(preset.createdBy);
          }
          await writeSharedPresets(presets);
          await addAuditEvent('preset.permissions_changed', {
            presetId: preset.id,
            presetName: preset.name,
            changedBy: currentUser?.name || 'Master',
            permissions: presets[idx].permissions
          }, currentUser?.name || 'Master', requestUserId);
          return json(res, 200, {
            presetId: preset.id,
            presetName: preset.name,
            createdBy: preset.createdBy,
            permissions: presets[idx].permissions
          });
        }
      }
      if (req.method === 'GET' && pathname === '/api/presets/export') {
        const presets = await readSharedPresets();
        const exportData = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          presets: presets
        };
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="presets.json"'
        });
        return res.end(JSON.stringify(exportData, null, 2));
      }
      if (req.method === 'POST' && pathname === '/api/presets/import') {
        const body = await readJson(req);
        if (!body.data || !Array.isArray(body.data.presets)) {
          throw new Error('无效的导入文件格式');
        }
        const { data } = body;
        const mode = body.mode || 'merge';
        const existingPresets = await readSharedPresets();
        let imported = 0;
        let skipped = 0;
        let results = { imported: 0, skipped: 0, errors: [] };

        if (mode === 'overwrite') {
          const importedPresets = data.presets.map(p => {
            const createdBy = p.createdBy || 'import';
            return {
              id: crypto.randomUUID(),
              name: p.name,
              filters: p.filters,
              createdBy: createdBy,
              createdAt: Date.now(),
              permissions: {
                canEdit: [createdBy],
                canDelete: [createdBy]
              }
            };
          });
          await writeSharedPresets(importedPresets);
          results.imported = importedPresets.length;
        } else {
          for (const preset of data.presets) {
            if (!preset.name || !preset.filters) {
              results.skipped++;
              continue;
            }
            const existingByName = existingPresets.find(p => p.name === preset.name);
            if (existingByName) {
              results.skipped++;
              continue;
            }
            const createdBy = preset.createdBy || 'import';
            existingPresets.push({
              id: crypto.randomUUID(),
              name: preset.name,
              filters: preset.filters,
              createdBy: createdBy,
              createdAt: Date.now(),
              permissions: {
                canEdit: [createdBy],
                canDelete: [createdBy]
              }
            });
            results.imported++;
          }
          await writeSharedPresets(existingPresets);
        }
        return json(res, 200, results);
      }
      if (req.method === 'GET' && pathname === '/api/sync/presets') {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能同步预设' });
        }
        const sharedPresets = await readSharedPresets();
        const userPresets = await readUserPresets(currentUser.id);
        return json(res, 200, {
          presets: [...sharedPresets, ...userPresets.map(p => ({ ...p, isUserPreset: true }))]
        });
      }
      if (req.method === 'POST' && pathname === '/api/sync/presets') {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能保存预设' });
        }
        const body = await readJson(req);
        if (!body.name?.trim()) throw new Error('预设名称不能为空');
        if (!body.filters || typeof body.filters !== 'object') throw new Error('筛选条件不能为空');
        const newPreset = {
          id: body.id || crypto.randomUUID(),
          name: body.name.trim(),
          filters: body.filters,
          createdAt: body.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        const savedPreset = await addUserPreset(currentUser.id, newPreset);
        return json(res, 201, { preset: savedPreset });
      }
      if (req.method === 'PUT' && pathname.startsWith('/api/sync/presets/')) {
        const presetId = pathname.split('/')[3];
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能更新预设' });
        }
        const body = await readJson(req);
        const updatedPreset = await updateUserPreset(currentUser.id, presetId, body);
        return json(res, 200, { preset: updatedPreset });
      }
      if (req.method === 'DELETE' && pathname.startsWith('/api/sync/presets/')) {
        const presetId = pathname.split('/')[3];
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能删除预设' });
        }
        await deleteUserPreset(currentUser.id, presetId);
        return json(res, 200, { success: true });
      }
      if (req.method === 'GET' && pathname === '/api/sync/templates') {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能同步模板' });
        }
        const templates = await readUserTemplates(currentUser.id);
        return json(res, 200, { templates });
      }
      if (req.method === 'POST' && pathname === '/api/sync/templates') {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能保存模板' });
        }
        const body = await readJson(req);
        if (!body.name?.trim()) throw new Error('模板名称不能为空');
        const newTemplate = {
          id: body.id || crypto.randomUUID(),
          name: body.name.trim(),
          description: body.description || '',
          defaultAgents: body.defaultAgents || [],
          defaultPriority: body.defaultPriority || 'medium',
          defaultMode: body.defaultMode || 'broadcast',
          defaultContent: body.defaultContent || '',
          createdAt: body.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        const savedTemplate = await addUserTemplate(currentUser.id, newTemplate);
        return json(res, 201, { template: savedTemplate });
      }
      if (req.method === 'PUT' && pathname.startsWith('/api/sync/templates/')) {
        const templateId = pathname.split('/')[3];
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能更新模板' });
        }
        const body = await readJson(req);
        const updatedTemplate = await updateUserTemplate(currentUser.id, templateId, body);
        return json(res, 200, { template: updatedTemplate });
      }
      if (req.method === 'DELETE' && pathname.startsWith('/api/sync/templates/')) {
        const templateId = pathname.split('/')[3];
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能删除模板' });
        }
        await deleteUserTemplate(currentUser.id, templateId);
        return json(res, 200, { success: true });
      }
      if (req.method === 'GET' && pathname === '/api/workflows') {
        return json(res, 200, { workflows: await loadWorkflows() });
      }
      if (req.method === 'POST' && pathname === '/api/workflows') {
        const body = await readJson(req);
        return json(res, 201, { workflow: await createWorkflow(body) });
      }
      if (req.method === 'GET' && pathname.startsWith('/api/workflows/')) {
        const workflowId = pathname.split('/')[3];
        const workflow = await getWorkflow(workflowId);
        if (!workflow) throw new Error('工作流不存在');
        return json(res, 200, { workflow });
      }
      if (req.method === 'PUT' && pathname.startsWith('/api/workflows/')) {
        const workflowId = pathname.split('/')[3];
        const body = await readJson(req);
        return json(res, 200, { workflow: await updateWorkflow(workflowId, body) });
      }
      if (req.method === 'DELETE' && pathname.startsWith('/api/workflows/')) {
        const workflowId = pathname.split('/')[3];
        return json(res, 200, await deleteWorkflow(workflowId));
      }
      if (req.method === 'POST' && pathname.startsWith('/api/workflows/') && pathname.endsWith('/run')) {
        const workflowId = pathname.split('/')[3];
        const body = await readJson(req);
        const run = await runWorkflow(workflowId, { stopOnFailure: body.stopOnFailure });
        await addAuditEvent('workflow.executed', {
          workflowId,
          workflowName: run.workflowName,
          runId: run.id,
          status: run.status,
          stopOnFailure: body.stopOnFailure
        }, 'Master');
        return json(res, 201, { run });
      }
      if (req.method === 'GET' && pathname.startsWith('/api/workflow-runs/')) {
        const runId = pathname.split('/')[3];
        const run = await getWorkflowRun(runId);
        if (!run) throw new Error('执行记录不存在');
        return json(res, 200, { run });
      }
      if (req.method === 'GET' && pathname.startsWith('/api/workflows/') && pathname.endsWith('/runs')) {
        const workflowId = pathname.split('/')[3];
        const runs = await getWorkflowRuns(workflowId);
        return json(res, 200, { runs });
      }
      if (req.method === 'PUT' && pathname.startsWith('/api/agents/') && pathname.endsWith('/groups')) {
        const agentId = pathname.split('/')[3];
        const body = await readJson(req);
        const groupIds = normalizeAgents(body.groupIds);
        const groups = await readAgentGroups();
        for (const group of groups) {
          if (group.agentIds.includes(agentId)) {
            group.agentIds = group.agentIds.filter(id => id !== agentId);
          }
        }
        for (const groupId of groupIds) {
          const group = groups.find(g => g.id === groupId);
          if (group && !group.agentIds.includes(agentId)) {
            group.agentIds.push(agentId);
          }
        }
        await writeAgentGroups(groups);
        return json(res, 200, { success: true });
      }
      if (req.method === 'GET' && pathname === '/api/sessions') {
        const sessionsResult = await runOpenClaw(['sessions', '--all-agents', '--json'], 30000);
        const sessions = JSON.parse(cleanCliJson(sessionsResult.stdout));
        return json(res, 200, sessions);
      }
      if (req.method === 'GET' && pathname.match(/^\/api\/sessions\/[^/]+\/messages$/)) {
        const sessionKey = pathname.split('/')[3];
        // Get session info from sessions store
        const sessionsResult = await runOpenClaw(['sessions', '--all-agents', '--json'], 30000);
        const sessionsData = JSON.parse(cleanCliJson(sessionsResult.stdout));
        const session = sessionsData.sessions?.find(s => s.key === sessionKey);
        if (!session) {
          return json(res, 404, { error: 'Session not found' });
        }
        // Read messages from session transcript file
        const sessionId = session.sessionId;
        const agentId = session.agentId;
        const transcriptPath = path.join(HOME_DIR, '.openclaw', 'agents', agentId, 'sessions', `${sessionId}.jsonl`);
        try {
          const content = await fsp.readFile(transcriptPath, 'utf-8');
          const lines = content.trim().split('\n').filter(line => line.trim());
          const messages = lines.map(line => {
            try {
              const msg = JSON.parse(line);
              return {
                role: msg.role || (msg.user ? 'user' : 'assistant'),
                content: msg.content || msg.text || '',
                timestamp: msg.timestamp || msg.createdAt
              };
            } catch {
              return null;
            }
          }).filter(m => m);
          return json(res, 200, { session, messages });
        } catch (err) {
          return json(res, 200, { session, messages: [], error: 'Transcript file not found' });
        }
      }
      if (req.method === 'POST' && pathname === '/api/sessions/spawn') {
        const body = await readBody(req);
        const { agentId, task } = body;
        if (!agentId || !task) {
          return json(res, 400, { error: 'Missing agentId or task' });
        }
        // Spawn a subagent session
        const result = await runOpenClaw([
          'sessions', 'spawn',
          '--agent', agentId,
          '--task', task,
          '--json'
        ], 60000);
        const spawnResult = JSON.parse(cleanCliJson(result.stdout));
        await addAuditEvent('session.spawned', {
          agentId,
          task,
          result: spawnResult
        }, 'Master');
        return json(res, 200, spawnResult);
      }
      if (req.method === 'POST' && pathname.match(/^\/api\/sessions\/[^/]+\/messages$/)) {
        const sessionKey = pathname.split('/')[3];
        const body = await readBody(req);
        const { message } = body;
        if (!message) {
          return json(res, 400, { error: 'Missing message' });
        }
        // Send message to session
        const result = await runOpenClaw([
          'sessions', 'send',
          '--session', sessionKey,
          '--message', message,
          '--json'
        ], 30000);
        const sendResult = JSON.parse(cleanCliJson(result.stdout));
        await addAuditEvent('session.message_sent', {
          sessionKey,
          message
        }, 'Master');
        return json(res, 200, sendResult);
      }
      if (req.method === 'POST' && pathname === '/api/auth/register') {
        const body = await readJson(req);
        const { name, password } = body;
        const result = await register(name, password);
        await addAuditEvent('user.registered', {
          userId: result.user.id,
          userName: result.user.name
        }, result.user.name);
        return json(res, 201, result);
      }
      if (req.method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJson(req);
        const { name, password } = body;
        const result = await login(name, password);
        await addAuditEvent('user.logged_in', {
          userId: result.user.id,
          userName: result.user.name
        }, result.user.name);
        return json(res, 200, result);
      }
      if (req.method === 'POST' && pathname === '/api/auth/logout') {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const currentUser = token ? await verifyToken(token) : null;
        await logout(token);
        if (currentUser) {
          await addAuditEvent('user.logged_out', {
            userId: currentUser.id,
            userName: currentUser.name
          }, currentUser.name);
        }
        return json(res, 200, { success: true });
      }
      if (req.method === 'GET' && pathname === '/api/auth/me') {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '未登录' });
        }
        return json(res, 200, { user: currentUser });
      }
      if (req.method === 'GET' && pathname === '/api/users') {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能访问' });
        }
        const users = await getUsers();
        return json(res, 200, { users });
      }
      if (req.method === 'GET' && pathname.match(/^\/api\/users\/[^/]+\/role$/)) {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能访问' });
        }
        const userId = pathname.split('/')[3];
        const role = await getUserRole(userId);
        if (!role) {
          return json(res, 404, { error: '用户不存在' });
        }
        return json(res, 200, { userId, role });
      }
      if (req.method === 'PUT' && pathname.match(/^\/api\/users\/[^/]+\/role$/)) {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能访问' });
        }
        const isCurrentAdmin = await isAdmin(currentUser.id);
        if (!isCurrentAdmin) {
          return json(res, 403, { error: '只有管理员可以修改用户角色' });
        }
        const userId = pathname.split('/')[3];
        const body = await readJson(req);
        const { role } = body;
        if (!role || !['admin', 'user'].includes(role)) {
          return json(res, 400, { error: '无效的角色，可选值: admin, user' });
        }
        try {
          const updatedUser = await setRole(userId, role, currentUser.id);
          await addAuditEvent('user.role_changed', {
            targetUserId: userId,
            targetUserName: updatedUser.name,
            oldRole: null,
            newRole: role
          }, currentUser.name, currentUser.id);
          return json(res, 200, { user: updatedUser });
        } catch (err) {
          return json(res, 400, { error: err.message });
        }
      }
      if (req.method === 'PUT' && pathname.match(/^\/api\/admin\/users\/[\w-]+\/group$/)) {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能访问' });
        }
        const isCurrentAdmin = await isAdmin(currentUser.id);
        if (!isCurrentAdmin) {
          return json(res, 403, { error: '只有管理员可以修改用户组' });
        }
        const userId = pathname.split('/')[3];
        const body = await readJson(req);
        const { groupId } = body;
        try {
          const updatedUser = await setUserGroupId(userId, groupId, currentUser.id);
          await addAuditEvent('user.group_changed', {
            targetUserId: userId,
            targetUserName: updatedUser.name,
            oldGroupId: null,
            newGroupId: groupId
          }, currentUser.name, currentUser.id);
          return json(res, 200, { user: updatedUser });
        } catch (err) {
          return json(res, 400, { error: err.message });
        }
      }
      if (req.method === 'GET' && pathname === '/api/users/me/permissions') {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能访问' });
        }
        const permissions = getUserPermissions(currentUser.role || 'user');
        return json(res, 200, {
          userId: currentUser.id,
          role: currentUser.role || 'user',
          permissions
        });
      }
      if (req.method === 'GET' && pathname.match(/^\/api\/users\/[\w-]+\/groups$/)) {
        const userId = pathname.split('/')[3];
        const userGroupsList = await userGroups.getUserGroupsByUserId(userId);
        return json(res, 200, { groups: userGroupsList });
      }
      if (pathname.startsWith('/api/admin/')) {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '需要登录才能访问' });
        }
        const isCurrentAdmin = await isAdmin(currentUser.id);
        if (!isCurrentAdmin) {
          return json(res, 403, { error: '需要管理员权限才能访问此接口' });
        }
        const adminPath = pathname.slice('/api/admin/'.length);
        
        if (req.method === 'GET' && adminPath === 'users') {
          const users = await getUsers();
          return json(res, 200, { users });
        }
        
        if (req.method === 'GET' && adminPath === 'stats') {
          const users = await getUsers();
          const presets = await readSharedPresets();
          const tasks = await readTasks();
          return json(res, 200, {
            totalUsers: users.length,
            adminCount: users.filter(u => u.role === 'admin').length,
            userCount: users.filter(u => u.role === 'user').length,
            totalPresets: presets.length,
            totalTasks: tasks.length,
            recentUsers: users.slice(-5).reverse()
          });
        }
        
        if (req.method === 'DELETE' && adminPath.match(/^presets\/[\w-]+$/)) {
          const presetId = adminPath.split('/')[1];
          const presets = await readSharedPresets();
          const idx = presets.findIndex(p => p.id === presetId);
          if (idx === -1) {
            return json(res, 404, { error: '预设不存在' });
          }
          const preset = presets[idx];
          presets.splice(idx, 1);
          await writeSharedPresets(presets);
          await addAuditEvent('preset.admin_deleted', {
            presetId,
            presetName: preset.name,
            createdBy: preset.createdBy
          }, currentUser.name, currentUser.id);
          return json(res, 200, { success: true });
        }
        
        if (req.method === 'PUT' && adminPath.match(/^presets\/[\w-]+\/permissions$/)) {
          const presetId = adminPath.split('/')[1];
          const presets = await readSharedPresets();
          const idx = presets.findIndex(p => p.id === presetId);
          if (idx === -1) {
            return json(res, 404, { error: '预设不存在' });
          }
          const body = await readJson(req);
          const newPermissions = body.permissions;
          if (!newPermissions || typeof newPermissions !== 'object') {
            return json(res, 400, { error: '无效的权限配置' });
          }
          presets[idx].permissions = {
            canEdit: Array.isArray(newPermissions.canEdit) ? newPermissions.canEdit : [presets[idx].createdBy],
            canDelete: Array.isArray(newPermissions.canDelete) ? newPermissions.canDelete : [presets[idx].createdBy]
          };
          if (!presets[idx].permissions.canEdit.includes(presets[idx].createdBy)) {
            presets[idx].permissions.canEdit.push(presets[idx].createdBy);
          }
          if (!presets[idx].permissions.canDelete.includes(presets[idx].createdBy)) {
            presets[idx].permissions.canDelete.push(presets[idx].createdBy);
          }
          await writeSharedPresets(presets);
          await addAuditEvent('preset.permissions_changed', {
            presetId,
            presetName: presets[idx].name,
            permissions: presets[idx].permissions
          }, currentUser.name, currentUser.id);
          return json(res, 200, {
            presetId: presets[idx].id,
            createdBy: presets[idx].createdBy,
            permissions: presets[idx].permissions
          });
        }

        // User Group Management APIs
        if (req.method === 'GET' && adminPath === 'user-groups') {
          const groups = await userGroups.getUserGroups();
          const users = await getUsers();
          const groupsWithMembers = groups.map(g => ({
            ...g,
            memberCount: g.memberIds.length,
            members: g.memberIds.map(id => users.find(u => u.id === id)).filter(Boolean)
          }));
          return json(res, 200, { groups: groupsWithMembers });
        }

        if (req.method === 'POST' && adminPath === 'user-groups') {
          const body = await readJson(req);
          const { name, description } = body;
          try {
            const group = await userGroups.createUserGroup(name, description, currentUser.id);
            await addAuditEvent('user_group.created', {
              groupId: group.id,
              groupName: group.name,
              description: group.description
            }, currentUser.name, currentUser.id);
            return json(res, 201, group);
          } catch (err) {
            return json(res, 400, { error: err.message });
          }
        }

        if (req.method === 'PUT' && adminPath.match(/^user-groups\/[\w-]+$/)) {
          const groupId = adminPath.split('/')[1];
          const body = await readJson(req);
          try {
            const group = await userGroups.updateUserGroup(groupId, body);
            await addAuditEvent('user_group.updated', {
              groupId: group.id,
              groupName: group.name,
              changes: body
            }, currentUser.name, currentUser.id);
            return json(res, 200, group);
          } catch (err) {
            return json(res, 400, { error: err.message });
          }
        }

        if (req.method === 'DELETE' && adminPath.match(/^user-groups\/[\w-]+$/)) {
          const groupId = adminPath.split('/')[1];
          try {
            const group = await userGroups.deleteUserGroup(groupId);
            await addAuditEvent('user_group.deleted', {
              groupId: group.id,
              groupName: group.name
            }, currentUser.name, currentUser.id);
            return json(res, 200, { success: true, groupId });
          } catch (err) {
            return json(res, 400, { error: err.message });
          }
        }

        if (req.method === 'POST' && adminPath.match(/^user-groups\/[\w-]+\/members$/)) {
          const groupId = adminPath.split('/')[1];
          const body = await readJson(req);
          const { userId } = body;
          if (!userId) {
            return json(res, 400, { error: 'userId 是必需的' });
          }
          try {
            const group = await userGroups.addMember(groupId, userId);
            await addAuditEvent('user_group.member_added', {
              groupId: group.id,
              groupName: group.name,
              userId
            }, currentUser.name, currentUser.id);
            return json(res, 200, group);
          } catch (err) {
            return json(res, 400, { error: err.message });
          }
        }

        if (req.method === 'DELETE' && adminPath.match(/^user-groups\/[\w-]+\/members\/[\w-]+$/)) {
          const parts = adminPath.split('/');
          const groupId = parts[1];
          const userId = parts[3];
          try {
            const group = await userGroups.removeMember(groupId, userId);
            await addAuditEvent('user_group.member_removed', {
              groupId: group.id,
              groupName: group.name,
              userId
            }, currentUser.name, currentUser.id);
            return json(res, 200, group);
          } catch (err) {
            return json(res, 400, { error: err.message });
          }
        }

        const BACKUP_METADATA_FILE = path.join(DATA_DIR, 'backup-metadata.json');
        const BACKUP_VERSIONS_FILE = path.join(DATA_DIR, 'backup-versions.json');
        const BACKUP_DIR = path.join(DATA_DIR, 'backups');

        async function getBackupMetadata() {
          try {
            const data = await fsp.readFile(BACKUP_METADATA_FILE, 'utf8');
            return JSON.parse(data);
          } catch {
            return { lastBackupAt: null, lastBackupSize: null, backupCount: 0 };
          }
        }

        async function saveBackupMetadata(meta) {
          await fsp.writeFile(BACKUP_METADATA_FILE, JSON.stringify(meta, null, 2) + '\n');
        }

        async function getBackupVersions() {
          try {
            const data = await fsp.readFile(BACKUP_VERSIONS_FILE, 'utf8');
            return JSON.parse(data);
          } catch {
            return { backups: [] };
          }
        }

        async function saveBackupVersions(versions) {
          await fsp.writeFile(BACKUP_VERSIONS_FILE, JSON.stringify(versions, null, 2) + '\n');
        }

        async function getBackupVersion(backupId) {
          const versions = await getBackupVersions();
          return versions.backups.find(b => b.id === backupId);
        }

        async function updateBackupVersion(backupId, updates) {
          const versions = await getBackupVersions();
          const idx = versions.backups.findIndex(b => b.id === backupId);
          if (idx >= 0) {
            versions.backups[idx] = { ...versions.backups[idx], ...updates, updatedAt: Date.now() };
          } else {
            versions.backups.push({
              id: backupId,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              ...updates
            });
          }
          await saveBackupVersions(versions);
          return versions.backups[idx];
        }

        async function registerBackupVersion(backupId, metadata) {
          const versions = await getBackupVersions();
          const existingIdx = versions.backups.findIndex(b => b.id === backupId);
          const entry = {
            id: backupId,
            backupAt: metadata.backupAt,
            backupMode: metadata.backupMode,
            versionName: metadata.versionName || null,
            versionTags: metadata.versionTags || [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          if (existingIdx >= 0) {
            versions.backups[existingIdx] = entry;
          } else {
            versions.backups.unshift(entry);
          }
          if (versions.backups.length > 100) {
            versions.backups = versions.backups.slice(0, 100);
          }
          await saveBackupVersions(versions);
          return entry;
        }

        // Helper function to create backup data
        async function createBackupData(mode, user, options = {}) {
          const now = Date.now();
          const timestamp = new Date(now).toISOString().replace(/[:.]/g, '-');
          
          const users = await loadUsers();
          const tasks = await readTasks();
          const templates = await readTemplates();
          const agentGroups = await readAgentGroups();
          const sharedPresets = await readSharedPresets();
          const userPresets = await readUserPresets();
          const userTemplates = await readUserTemplates();
          const workflows = await loadWorkflows();
          const workflowRuns = await readWorkflowRuns();
          const auditEvents = await queryAuditEvents({});

          const dataToBackup = {
            users: users.map(u => ({ id: u.id, name: u.name, role: u.role, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt })),
            tokens: {},
            tasks: tasks.filter(t => !t.id.startsWith('temp-')),
            templates,
            'agent-groups': agentGroups,
            'shared-presets': sharedPresets,
            'user-presets': userPresets,
            'user-templates': userTemplates,
            workflows,
            'workflow-runs': workflowRuns,
            'audit-events': auditEvents
          };

          const backupData = {
            version: '1.0',
            backupAt: now,
            backupMode: mode,
            versionName: options.versionName || null,
            versionTags: options.versionTags || [],
            data: dataToBackup
          };

          const backupId = `backup-${timestamp}`;
          await registerBackupVersion(backupId, backupData);
          backupData.id = backupId;

          return backupData;
        }

        // Helper function to perform restore
        async function performRestore(data, restoreMode) {
          const restoreResult = {
            restored: {},
            skipped: {},
            errors: {}
          };

          if (data.users) {
            const currentUsers = await loadUsers();
            if (restoreMode === 'overwrite') {
              currentUsers.length = 0;
            }
            for (const u of data.users) {
              const idx = currentUsers.findIndex(cu => cu.id === u.id);
              if (idx >= 0) {
                if (restoreMode === 'merge') {
                  restoreResult.skipped.users = (restoreResult.skipped.users || 0) + 1;
                  continue;
                }
                currentUsers[idx] = { ...currentUsers[idx], ...u };
              } else {
                currentUsers.push({ ...u });
              }
              restoreResult.restored.users = (restoreResult.restored.users || 0) + 1;
            }
            await require('./lib/users').saveUsers(currentUsers);
          }

          if (data.tasks) {
            const currentTasks = await readTasks();
            if (restoreMode === 'overwrite') {
              currentTasks.length = 0;
            }
            for (const t of data.tasks) {
              const idx = currentTasks.findIndex(ct => ct.id === t.id);
              if (idx >= 0) {
                currentTasks[idx] = { ...currentTasks[idx], ...t };
              } else {
                currentTasks.push({ ...t });
              }
              restoreResult.restored.tasks = (restoreResult.restored.tasks || 0) + 1;
            }
            await writeTasks(currentTasks);
          }

          // Similar logic for other data types (simplified for brevity)
          if (data.templates) {
            await writeTemplates(data.templates);
            restoreResult.restored.templates = data.templates.length;
          }
          if (data['agent-groups']) {
            await writeAgentGroups(data['agent-groups']);
            restoreResult.restored['agent-groups'] = data['agent-groups'].length;
          }
          if (data['shared-presets']) {
            await writeSharedPresets(data['shared-presets']);
            restoreResult.restored['shared-presets'] = data['shared-presets'].length;
          }
          if (data['user-presets']) {
            await writeUserPresets(data['user-presets']);
            restoreResult.restored['user-presets'] = data['user-presets'].length;
          }
          if (data['user-templates']) {
            await writeUserTemplates(data['user-templates']);
            restoreResult.restored['user-templates'] = data['user-templates'].length;
          }
          if (data.workflows) {
            const currentWorkflows = await loadWorkflows();
            if (restoreMode === 'overwrite') currentWorkflows.length = 0;
            for (const w of data.workflows) {
              const idx = currentWorkflows.findIndex(cw => cw.id === w.id);
              if (idx >= 0) currentWorkflows[idx] = { ...currentWorkflows[idx], ...w };
              else currentWorkflows.push({ ...w });
            }
            await require('./lib/workflows').saveWorkflows(currentWorkflows);
            restoreResult.restored.workflows = currentWorkflows.length;
          }
          if (data['workflow-runs']) {
            await writeWorkflowRuns(data['workflow-runs']);
            restoreResult.restored['workflow-runs'] = data['workflow-runs'].length;
          }
          if (data['audit-events']) {
            const currentEvents = await queryAuditEvents({});
            for (const e of data['audit-events']) {
              currentEvents.push(e);
            }
            await require('./lib/audit').saveAuditEvents(currentEvents);
            restoreResult.restored['audit-events'] = data['audit-events'].length;
          }

          return restoreResult;
        }

        if (req.method === 'GET' && adminPath === 'backup/status') {
          const meta = await getBackupMetadata();
          const tasks = await readTasks();
          const filteredTasks = tasks.filter(t => !t.id.startsWith('temp-'));
          return json(res, 200, {
            lastBackupAt: meta.lastBackupAt,
            lastBackupSize: meta.lastBackupSize,
            backupCount: meta.backupCount || 0,
            totalTasks: filteredTasks.length,
            totalTasksIncludingTemp: tasks.length
          });
        }

        if (req.method === 'GET' && adminPath === 'backup') {
          const mode = parsed.query.mode || 'full';
          const versionName = parsed.query.name || null;
          const backupData = await createBackupData(mode, currentUser, { versionName });

          const backupJson = JSON.stringify(backupData, null, 2);
          const backupSize = Buffer.byteLength(backupJson, 'utf8');
          const meta = await getBackupMetadata();
          meta.lastBackupAt = backupData.backupAt;
          meta.lastBackupSize = backupSize;
          meta.backupCount = (meta.backupCount || 0) + 1;
          await saveBackupMetadata(meta);

          await addAuditEvent('backup.created', {
            mode,
            size: backupSize,
            timestamp: new Date(backupData.backupAt).toISOString().replace(/[:.]/g, '-'),
            taskCount: backupData.data.tasks.length,
            userCount: backupData.data.users.length,
            versionName,
            backupId: backupData.id
          }, currentUser.name, currentUser.id);

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="agent-orchestra-backup-${new Date(backupData.backupAt).toISOString().slice(0, 10)}.json"`
          });
          return res.end(backupJson);
        }

        if (req.method === 'POST' && adminPath === 'restore') {
          const contentType = req.headers['content-type'] || '';
          let backupData;

          if (contentType.includes('application/json')) {
            backupData = await readJson(req);
          } else {
            const boundary = contentType.match(/boundary=(.+)/)?.[1];
            if (!boundary) {
              return json(res, 400, { error: '不支持的内容类型，请上传 JSON 文件' });
            }
            const body = await readBody(req);
            const match = body.match(new RegExp(`--${boundary}[\\s\\S]*?filename="([^"]+)"[\\s\\S]*?\\r\\n\\r\\n([\\s\\S]*?)(?=\\r\\n--|--$)`));
            if (!match) {
              return json(res, 400, { error: '无法解析上传的文件' });
            }
            try {
              backupData = JSON.parse(match[2]);
            } catch {
              return json(res, 400, { error: '备份文件格式错误，请上传有效的 JSON 文件' });
            }
          }

          if (!backupData.version || !backupData.data) {
            return json(res, 400, { error: '无效的备份文件格式，缺少必要字段' });
          }

          if (!['1.0'].includes(backupData.version)) {
            return json(res, 400, { error: `不支持的备份版本: ${backupData.version}` });
          }

          const body = await readJson(req);
          const restoreMode = body.mode || 'merge';
          const { autoSnapshot = true } = body;

          if (!['merge', 'overwrite'].includes(restoreMode)) {
            return json(res, 400, { error: '无效的恢复模式，可选值: merge, overwrite' });
          }

          if (autoSnapshot) {
            const autoNow = Date.now();
            const autoTimestamp = new Date(autoNow).toISOString().replace(/[:.]/g, '-');
            const autoUsers = await loadUsers();
            const autoTasks = await readTasks();
            const autoTemplates = await readTemplates();
            const autoAgentGroups = await readAgentGroups();
            const autoSharedPresets = await readSharedPresets();
            const autoUserPresets = await readUserPresets();
            const autoUserTemplates = await readUserTemplates();
            const autoWorkflows = await loadWorkflows();
            const autoWorkflowRuns = await readWorkflowRuns();
            const autoAuditEvents = await queryAuditEvents({});

            const autoSnapshotData = {
              version: '1.0',
              backupAt: autoNow,
              backupMode: 'auto-snapshot',
              data: {
                users: autoUsers.map(u => ({ id: u.id, name: u.name, role: u.role, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt })),
                tokens: {},
                tasks: autoTasks.filter(t => !t.id.startsWith('temp-')),
                templates: autoTemplates,
                'agent-groups': autoAgentGroups,
                'shared-presets': autoSharedPresets,
                'user-presets': autoUserPresets,
                'user-templates': autoUserTemplates,
                workflows: autoWorkflows,
                'workflow-runs': autoWorkflowRuns,
                'audit-events': autoAuditEvents
              }
            };
            const snapshotFilename = `auto-snapshot-${autoTimestamp}.json`;
            const snapshotPath = path.join(DATA_DIR, 'snapshots');
            await fsp.mkdir(snapshotPath, { recursive: true });
            await fsp.writeFile(path.join(snapshotPath, snapshotFilename), JSON.stringify(autoSnapshotData, null, 2) + '\n');
            await addAuditEvent('backup.auto_snapshot_created', {
              filename: snapshotFilename,
              taskCount: autoSnapshotData.data.tasks.length
            }, currentUser.name, currentUser.id);
          }

          const { data } = backupData;
          const restoreResult = { restored: {}, skipped: {} };

          if (restoreMode === 'overwrite') {
            if (data.users) {
              const usersToSave = await loadUsers();
              const newUsers = data.users.filter(u => !usersToSave.find(existing => existing.id === u.id));
              const updatedUsers = usersToSave.map(u => {
                const backupUser = data.users.find(bu => bu.id === u.id);
                return backupUser ? { ...u, role: backupUser.role, name: backupUser.name } : u;
              }).concat(newUsers);
              await saveUsers(updatedUsers);
              restoreResult.restored.users = data.users.length;
            }
            if (data.tasks) {
              await writeTasks(data.tasks);
              restoreResult.restored.tasks = data.tasks.length;
            }
            if (data.templates) {
              await writeTemplates(data.templates);
              restoreResult.restored.templates = data.templates.length;
            }
            if (data['agent-groups']) {
              await writeAgentGroups(data['agent-groups']);
              restoreResult.restored['agent-groups'] = data['agent-groups'].length;
            }
            if (data['shared-presets']) {
              await writeSharedPresets(data['shared-presets']);
              restoreResult.restored['shared-presets'] = data['shared-presets'].length;
            }
            if (data['user-presets']) {
              await writeUserPresets(data['user-presets']);
              restoreResult.restored['user-presets'] = data['user-presets'].length;
            }
            if (data['user-templates']) {
              await writeUserTemplates(data['user-templates']);
              restoreResult.restored['user-templates'] = data['user-templates'].length;
            }
            if (data.workflows) {
              await saveWorkflows(data.workflows);
              restoreResult.restored.workflows = data.workflows.length;
            }
            if (data['workflow-runs']) {
              await writeWorkflowRuns(data['workflow-runs']);
              restoreResult.restored['workflow-runs'] = data['workflow-runs'].length;
            }
          } else {
            if (data.users) {
              const existingUsers = await loadUsers();
              let addedCount = 0;
              for (const bu of data.users) {
                if (!existingUsers.find(u => u.id === bu.id)) {
                  const newUser = {
                    id: bu.id,
                    name: bu.name,
                    passwordHash: crypto.createHash('sha256').update(bu.id + '-default-password').digest('hex'),
                    role: bu.role || 'user',
                    createdAt: bu.createdAt || Date.now(),
                    lastLoginAt: bu.lastLoginAt
                  };
                  existingUsers.push(newUser);
                  addedCount++;
                }
              }
              await saveUsers(existingUsers);
              restoreResult.restored.users = addedCount;
            }
            if (data.tasks) {
              const existingTasks = await readTasks();
              const existingIds = new Set(existingTasks.map(t => t.id));
              const newTasks = data.tasks.filter(t => !existingIds.has(t.id));
              await writeTasks([...existingTasks, ...newTasks]);
              restoreResult.restored.tasks = newTasks.length;
              restoreResult.skipped.tasks = existingTasks.length;
            }
            if (data.templates) {
              const existingTemplates = await readTemplates();
              const existingIds = new Set(existingTemplates.map(t => t.id));
              const newTemplates = data.templates.filter(t => !existingIds.has(t.id));
              await writeTemplates([...existingTemplates, ...newTemplates]);
              restoreResult.restored.templates = newTemplates.length;
            }
            if (data['agent-groups']) {
              const existingGroups = await readAgentGroups();
              const existingIds = new Set(existingGroups.map(g => g.id));
              const newGroups = data['agent-groups'].filter(g => !existingIds.has(g.id));
              await writeAgentGroups([...existingGroups, ...newGroups]);
              restoreResult.restored['agent-groups'] = newGroups.length;
            }
            if (data['shared-presets']) {
              const existingPresets = await readSharedPresets();
              const existingIds = new Set(existingPresets.map(p => p.id));
              const newPresets = data['shared-presets'].filter(p => !existingIds.has(p.id));
              await writeSharedPresets([...existingPresets, ...newPresets]);
              restoreResult.restored['shared-presets'] = newPresets.length;
            }
            if (data['user-presets']) {
              const existingPresets = await readUserPresets();
              const existingIds = new Set(existingPresets.map(p => p.id));
              const newPresets = data['user-presets'].filter(p => !existingIds.has(p.id));
              await writeUserPresets([...existingPresets, ...newPresets]);
              restoreResult.restored['user-presets'] = newPresets.length;
            }
            if (data['user-templates']) {
              const existingTemplates = await readUserTemplates();
              const existingIds = new Set(existingTemplates.map(t => t.id));
              const newTemplates = data['user-templates'].filter(t => !existingIds.has(t.id));
              await writeUserTemplates([...existingTemplates, ...newTemplates]);
              restoreResult.restored['user-templates'] = newTemplates.length;
            }
            if (data.workflows) {
              const existingWorkflows = await loadWorkflows();
              const existingIds = new Set(existingWorkflows.map(w => w.id));
              const newWorkflows = data.workflows.filter(w => !existingIds.has(w.id));
              await saveWorkflows([...existingWorkflows, ...newWorkflows]);
              restoreResult.restored.workflows = newWorkflows.length;
            }
            if (data['workflow-runs']) {
              const existingRuns = await readWorkflowRuns();
              const existingIds = new Set(existingRuns.map(r => r.id));
              const newRuns = data['workflow-runs'].filter(r => !existingIds.has(r.id));
              await writeWorkflowRuns([...existingRuns, ...newRuns]);
              restoreResult.restored['workflow-runs'] = newRuns.length;
            }
          }

          await addAuditEvent('backup.restored', {
            mode: restoreMode,
            backupAt: backupData.backupAt,
            result: restoreResult,
            autoSnapshotCreated: autoSnapshot
          }, currentUser.name, currentUser.id);

          invalidateOverviewCache();
          return json(res, 200, {
            success: true,
            mode: restoreMode,
            autoSnapshotCreated: autoSnapshot,
            result: restoreResult
          });
        }

        // Version Tag API - Add/update version tag
        if (req.method === 'POST' && adminPath.startsWith('backup/') && adminPath.endsWith('/tag')) {
          const backupId = adminPath.replace(/^\/api\/admin\/backup\//, '').replace('/tag', '');
          if (!backupId) {
            throw new Error('缺少备份 ID 参数');
          }
          const body = await readJson(req);
          const { versionName, versionTags, action = 'set' } = body;

          const existing = await getBackupVersion(backupId);
          if (!existing) {
            throw new Error(`备份版本 ${backupId} 不存在`);
          }

          let updates = { ...existing };
          if (action === 'remove-tag' && versionTags) {
            updates.versionTags = (existing.versionTags || []).filter(t => t !== versionTags);
          } else if (action === 'clear-name') {
            updates.versionName = null;
          } else {
            if (versionName !== undefined) {
              updates.versionName = versionName;
            }
            if (versionTags !== undefined) {
              if (Array.isArray(versionTags)) {
                updates.versionTags = versionTags;
              } else if (typeof versionTags === 'string') {
                const currentTags = existing.versionTags || [];
                if (!currentTags.includes(versionTags)) {
                  updates.versionTags = [...currentTags, versionTags];
                }
              }
            }
          }

          await updateBackupVersion(backupId, updates);

          await addAuditEvent('backup.version_tagged', {
            backupId,
            action,
            versionName: updates.versionName,
            versionTags: updates.versionTags,
            taggedBy: currentUser.name
          }, currentUser.name, currentUser.id);

          return json(res, 200, {
            success: true,
            backupId,
            versionName: updates.versionName,
            versionTags: updates.versionTags
          });
        }

        // Backup Compare API - Compare two backup versions
        if (req.method === 'GET' && adminPath === 'backup/compare') {
          const fromId = parsed.query.from;
          const toId = parsed.query.to;

          if (!fromId || !toId) {
            throw new Error('缺少 from 或 to 参数');
          }

          if (fromId === toId) {
            throw new Error('不能比较相同的备份版本');
          }

          const fromBackup = await getBackupVersion(fromId);
          const toBackup = await getBackupVersion(toId);

          if (!fromBackup) {
            throw new Error(`源备份版本 ${fromId} 不存在`);
          }
          if (!toBackup) {
            throw new Error(`目标备份版本 ${toId} 不存在`);
          }

          const compareResult = {
            from: {
              id: fromBackup.id,
              backupAt: fromBackup.backupAt,
              backupMode: fromBackup.backupMode,
              versionName: fromBackup.versionName,
              versionTags: fromBackup.versionTags
            },
            to: {
              id: toBackup.id,
              backupAt: toBackup.backupAt,
              backupMode: toBackup.backupMode,
              versionName: toBackup.versionName,
              versionTags: toBackup.versionTags
            },
            diff: {}
          };

          const DATA_TYPES = ['users', 'tasks', 'templates', 'agent-groups', 'shared-presets', 'user-presets', 'user-templates', 'workflows', 'workflow-runs'];

          for (const dataType of DATA_TYPES) {
            compareResult.diff[dataType] = {
              from: 0,
              to: 0,
              added: 0,
              removed: 0,
              modified: 0
            };
          }

          compareResult.diff.users.from = fromBackup.usersCount || 0;
          compareResult.diff.users.to = toBackup.usersCount || 0;
          compareResult.diff.tasks.from = fromBackup.tasksCount || 0;
          compareResult.diff.tasks.to = toBackup.tasksCount || 0;
          compareResult.diff.templates.from = fromBackup.templatesCount || 0;
          compareResult.diff.templates.to = toBackup.templatesCount || 0;
          compareResult.diff['agent-groups'].from = fromBackup.agentGroupsCount || 0;
          compareResult.diff['agent-groups'].to = toBackup.agentGroupsCount || 0;
          compareResult.diff['shared-presets'].from = fromBackup.sharedPresetsCount || 0;
          compareResult.diff['shared-presets'].to = toBackup.sharedPresetsCount || 0;
          compareResult.diff['user-presets'].from = fromBackup.userPresetsCount || 0;
          compareResult.diff['user-presets'].to = toBackup.userPresetsCount || 0;
          compareResult.diff['user-templates'].from = fromBackup.userTemplatesCount || 0;
          compareResult.diff['user-templates'].to = toBackup.userTemplatesCount || 0;
          compareResult.diff.workflows.from = fromBackup.workflowsCount || 0;
          compareResult.diff.workflows.to = toBackup.workflowsCount || 0;
          compareResult.diff['workflow-runs'].from = fromBackup.workflowRunsCount || 0;
          compareResult.diff['workflow-runs'].to = toBackup.workflowRunsCount || 0;

          for (const dataType of DATA_TYPES) {
            compareResult.diff[dataType].added = Math.max(0, compareResult.diff[dataType].to - compareResult.diff[dataType].from);
            compareResult.diff[dataType].removed = Math.max(0, compareResult.diff[dataType].from - compareResult.diff[dataType].to);
          }

          return json(res, 200, compareResult);
        }

        // Selective Restore API - Restore specific data types
        if (req.method === 'POST' && adminPath === 'restore/selective') {
          const contentType = req.headers['content-type'] || '';
          let backupData;

          if (contentType.includes('application/json')) {
            backupData = await readJson(req);
          } else {
            const boundary = contentType.match(/boundary=(.+)/)?.[1];
            if (!boundary) {
              return json(res, 400, { error: '不支持的内容类型，请上传 JSON 文件' });
            }
            const body = await readBody(req);
            const match = body.match(new RegExp(`--${boundary}[\\s\\S]*?filename="([^"]+)"[\\s\\S]*?\\r\\n\\r\\n([\\s\\S]*?)(?=\\r\\n--|--$)`));
            if (!match) {
              return json(res, 400, { error: '无法解析上传的文件' });
            }
            try {
              backupData = JSON.parse(match[2]);
            } catch {
              return json(res, 400, { error: '备份文件格式错误，请上传有效的 JSON 文件' });
            }
          }

          if (!backupData.version || !backupData.data) {
            return json(res, 400, { error: '无效的备份文件格式，缺少必要字段' });
          }

          if (!['1.0'].includes(backupData.version)) {
            return json(res, 400, { error: `不支持的备份版本: ${backupData.version}` });
          }

          const body = await readJson(req);
          const { dataTypes = [], restoreMode = 'merge', autoSnapshot = true } = body;

          const VALID_DATA_TYPES = ['users', 'tasks', 'templates', 'agent-groups', 'shared-presets', 'user-presets', 'user-templates', 'workflows', 'workflow-runs'];
          const selectedTypes = Array.isArray(dataTypes) ? dataTypes.filter(t => VALID_DATA_TYPES.includes(t)) : [];

          if (selectedTypes.length === 0) {
            return json(res, 400, { error: '请至少选择一个数据类型进行恢复', validTypes: VALID_DATA_TYPES });
          }

          if (!['merge', 'overwrite'].includes(restoreMode)) {
            return json(res, 400, { error: '无效的恢复模式，可选值: merge, overwrite' });
          }

          if (autoSnapshot) {
            const autoNow = Date.now();
            const autoTimestamp = new Date(autoNow).toISOString().replace(/[:.]/g, '-');
            const autoUsers = await loadUsers();
            const autoTasks = await readTasks();
            const autoTemplates = await readTemplates();
            const autoAgentGroups = await readAgentGroups();
            const autoSharedPresets = await readSharedPresets();
            const autoUserPresets = await readUserPresets();
            const autoUserTemplates = await readUserTemplates();
            const autoWorkflows = await loadWorkflows();
            const autoWorkflowRuns = await readWorkflowRuns();

            const autoSnapshotData = {
              version: '1.0',
              backupAt: autoNow,
              backupMode: 'auto-snapshot',
              data: {
                users: autoUsers.map(u => ({ id: u.id, name: u.name, role: u.role, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt })),
                tokens: {},
                tasks: autoTasks.filter(t => !t.id.startsWith('temp-')),
                templates: autoTemplates,
                'agent-groups': autoAgentGroups,
                'shared-presets': autoSharedPresets,
                'user-presets': autoUserPresets,
                'user-templates': autoUserTemplates,
                workflows: autoWorkflows,
                'workflow-runs': autoWorkflowRuns
              }
            };
            const snapshotFilename = `auto-snapshot-${autoTimestamp}.json`;
            const snapshotPath = path.join(DATA_DIR, 'snapshots');
            await fsp.mkdir(snapshotPath, { recursive: true });
            await fsp.writeFile(path.join(snapshotPath, snapshotFilename), JSON.stringify(autoSnapshotData, null, 2) + '\n');
            await addAuditEvent('backup.auto_snapshot_created', {
              filename: snapshotFilename,
              taskCount: autoSnapshotData.data.tasks.length,
              reason: 'before-selective-restore'
            }, currentUser.name, currentUser.id);
          }

          const { data } = backupData;
          const restoreResult = { restored: {}, skipped: {} };

          for (const dataType of selectedTypes) {
            if (!data[dataType]) continue;

            try {
              if (restoreMode === 'overwrite') {
                switch (dataType) {
                  case 'users': {
                    const usersToSave = await loadUsers();
                    const newUsers = data.users.filter(u => !usersToSave.find(existing => existing.id === u.id));
                    const updatedUsers = usersToSave.map(u => {
                      const backupUser = data.users.find(bu => bu.id === u.id);
                      return backupUser ? { ...u, role: backupUser.role, name: backupUser.name } : u;
                    }).concat(newUsers);
                    await saveUsers(updatedUsers);
                    restoreResult.restored[dataType] = data.users.length;
                    break;
                  }
                  case 'tasks': {
                    await writeTasks(data.tasks);
                    restoreResult.restored[dataType] = data.tasks.length;
                    break;
                  }
                  case 'templates': {
                    await writeTemplates(data.templates);
                    restoreResult.restored[dataType] = data.templates.length;
                    break;
                  }
                  case 'agent-groups': {
                    await writeAgentGroups(data['agent-groups']);
                    restoreResult.restored[dataType] = data['agent-groups'].length;
                    break;
                  }
                  case 'shared-presets': {
                    await writeSharedPresets(data['shared-presets']);
                    restoreResult.restored[dataType] = data['shared-presets'].length;
                    break;
                  }
                  case 'user-presets': {
                    await writeUserPresets(data['user-presets']);
                    restoreResult.restored[dataType] = data['user-presets'].length;
                    break;
                  }
                  case 'user-templates': {
                    await writeUserTemplates(data['user-templates']);
                    restoreResult.restored[dataType] = data['user-templates'].length;
                    break;
                  }
                  case 'workflows': {
                    await saveWorkflows(data.workflows);
                    restoreResult.restored[dataType] = data.workflows.length;
                    break;
                  }
                  case 'workflow-runs': {
                    await writeWorkflowRuns(data['workflow-runs']);
                    restoreResult.restored[dataType] = data['workflow-runs'].length;
                    break;
                  }
                }
              } else {
                switch (dataType) {
                  case 'users': {
                    const existingUsers = await loadUsers();
                    let addedCount = 0;
                    for (const bu of data.users) {
                      if (!existingUsers.find(u => u.id === bu.id)) {
                        const newUser = {
                          id: bu.id,
                          name: bu.name,
                          passwordHash: crypto.createHash('sha256').update(bu.id + '-default-password').digest('hex'),
                          role: bu.role || 'user',
                          createdAt: bu.createdAt || Date.now(),
                          lastLoginAt: bu.lastLoginAt
                        };
                        existingUsers.push(newUser);
                        addedCount++;
                      }
                    }
                    await saveUsers(existingUsers);
                    restoreResult.restored[dataType] = addedCount;
                    break;
                  }
                  case 'tasks': {
                    const existingTasks = await readTasks();
                    const existingIds = new Set(existingTasks.map(t => t.id));
                    const newTasks = data.tasks.filter(t => !existingIds.has(t.id));
                    await writeTasks([...existingTasks, ...newTasks]);
                    restoreResult.restored[dataType] = newTasks.length;
                    break;
                  }
                  case 'templates': {
                    const existingTemplates = await readTemplates();
                    const existingIds = new Set(existingTemplates.map(t => t.id));
                    const newTemplates = data.templates.filter(t => !existingIds.has(t.id));
                    await writeTemplates([...existingTemplates, ...newTemplates]);
                    restoreResult.restored[dataType] = newTemplates.length;
                    break;
                  }
                  case 'agent-groups': {
                    const existingGroups = await readAgentGroups();
                    const existingIds = new Set(existingGroups.map(g => g.id));
                    const newGroups = data['agent-groups'].filter(g => !existingIds.has(g.id));
                    await writeAgentGroups([...existingGroups, ...newGroups]);
                    restoreResult.restored[dataType] = newGroups.length;
                    break;
                  }
                  case 'shared-presets': {
                    const existingPresets = await readSharedPresets();
                    const existingIds = new Set(existingPresets.map(p => p.id));
                    const newPresets = data['shared-presets'].filter(p => !existingIds.has(p.id));
                    await writeSharedPresets([...existingPresets, ...newPresets]);
                    restoreResult.restored[dataType] = newPresets.length;
                    break;
                  }
                  case 'user-presets': {
                    const existingPresets = await readUserPresets();
                    const existingIds = new Set(existingPresets.map(p => p.id));
                    const newPresets = data['user-presets'].filter(p => !existingIds.has(p.id));
                    await writeUserPresets([...existingPresets, ...newPresets]);
                    restoreResult.restored[dataType] = newPresets.length;
                    break;
                  }
                  case 'user-templates': {
                    const existingTemplates = await readUserTemplates();
                    const existingIds = new Set(existingTemplates.map(t => t.id));
                    const newTemplates = data['user-templates'].filter(t => !existingIds.has(t.id));
                    await writeUserTemplates([...existingTemplates, ...newTemplates]);
                    restoreResult.restored[dataType] = newTemplates.length;
                    break;
                  }
                  case 'workflows': {
                    const existingWorkflows = await loadWorkflows();
                    const existingIds = new Set(existingWorkflows.map(w => w.id));
                    const newWorkflows = data.workflows.filter(w => !existingIds.has(w.id));
                    await saveWorkflows([...existingWorkflows, ...newWorkflows]);
                    restoreResult.restored[dataType] = newWorkflows.length;
                    break;
                  }
                  case 'workflow-runs': {
                    const existingRuns = await readWorkflowRuns();
                    const existingIds = new Set(existingRuns.map(r => r.id));
                    const newRuns = data['workflow-runs'].filter(r => !existingIds.has(r.id));
                    await writeWorkflowRuns([...existingRuns, ...newRuns]);
                    restoreResult.restored[dataType] = newRuns.length;
                    break;
                  }
                }
              }
            } catch (err) {
              restoreResult.errors = restoreResult.errors || {};
              restoreResult.errors[dataType] = err.message;
            }
          }

          await addAuditEvent('backup.selective_restored', {
            restoreMode,
            dataTypes: selectedTypes,
            backupAt: backupData.backupAt,
            result: restoreResult,
            autoSnapshotCreated: autoSnapshot
          }, currentUser.name, currentUser.id);

          invalidateOverviewCache();
          return json(res, 200, {
            success: true,
            mode: restoreMode,
            dataTypes: selectedTypes,
            autoSnapshotCreated: autoSnapshot,
            result: restoreResult
          });
        }

        // Get backup versions list
        if (req.method === 'GET' && adminPath === 'backup/versions') {
          const versions = await getBackupVersions();
          return json(res, 200, versions);
        }

        // Workload Alerts APIs
        if (req.method === 'GET' && adminPath === 'workload-alerts/config') {
          const config = await getWorkloadAlertsConfig();
          return json(res, 200, config);
        }

        if (req.method === 'PUT' && adminPath === 'workload-alerts/config') {
          const body = await readJson(req);
          const { enabled, threshold, warningThreshold, criticalThreshold, notifyChannels, messageTemplate, silencePeriodMinutes } = body;
          
          if (enabled !== undefined && typeof enabled !== 'boolean') {
            throw new Error('enabled 必须是布尔值');
          }
          if (threshold !== undefined) {
            if (!Number.isInteger(threshold) || threshold < 1 || threshold > 20) {
              throw new Error('threshold 必须在 1-20 之间');
            }
          }
          if (warningThreshold !== undefined) {
            if (typeof warningThreshold !== 'number' || warningThreshold < 0.1 || warningThreshold > 1) {
              throw new Error('warningThreshold 必须在 0.1-1 之间');
            }
          }
          if (criticalThreshold !== undefined) {
            if (typeof criticalThreshold !== 'number' || criticalThreshold < 0.1 || criticalThreshold > 1) {
              throw new Error('criticalThreshold 必须在 0.1-1 之间');
            }
          }
          if (notifyChannels !== undefined) {
            if (!Array.isArray(notifyChannels)) {
              throw new Error('notifyChannels 必须是数组');
            }
            const legacyChannelTypes = ['feishu', 'dingtalk', 'wecom', 'slack'];
            const allChannels = await notificationChannels.getChannels();
            for (const channel of notifyChannels) {
              const isUuid = channel.includes('-') && channel.length > 20;
              const isLegacyType = legacyChannelTypes.includes(channel);
              const isValidChannelId = allChannels.some(c => c.id === channel);
              if (!isUuid && !isLegacyType && !isValidChannelId) {
                throw new Error(`无效的通知渠道: ${channel}，请使用渠道 ID 或有效的渠道类型`);
              }
            }
          }
          if (messageTemplate !== undefined) {
            if (typeof messageTemplate !== 'object' || messageTemplate === null) {
              throw new Error('messageTemplate 必须是对象');
            }
            if (messageTemplate.warning !== undefined && typeof messageTemplate.warning !== 'string') {
              throw new Error('messageTemplate.warning 必须是字符串');
            }
            if (messageTemplate.critical !== undefined && typeof messageTemplate.critical !== 'string') {
              throw new Error('messageTemplate.critical 必须是字符串');
            }
          }
          if (silencePeriodMinutes !== undefined) {
            if (!Number.isInteger(silencePeriodMinutes) || silencePeriodMinutes < 1 || silencePeriodMinutes > 1440) {
              throw new Error('silencePeriodMinutes 必须在 1-1440 之间');
            }
          }
          
          const config = await saveWorkloadAlertsConfig({ 
            enabled, 
            threshold, 
            warningThreshold, 
            criticalThreshold, 
            notifyChannels, 
            messageTemplate, 
            silencePeriodMinutes 
          });
          await addAuditEvent('workload_alert.config_changed', {
            enabled: config.enabled,
            threshold: config.threshold,
            warningThreshold: config.warningThreshold,
            criticalThreshold: config.criticalThreshold,
            notifyChannels: config.notifyChannels,
            messageTemplate: config.messageTemplate,
            silencePeriodMinutes: config.silencePeriodMinutes,
            changedBy: currentUser.name
          }, currentUser.name, currentUser.id);
          
          return json(res, 200, config);
        }

        if (req.method === 'POST' && adminPath === 'workload-alerts/check') {
          const result = await performWorkloadCheck();
          return json(res, 200, result);
        }

        if (req.method === 'GET' && adminPath === 'workload-alerts/history') {
          const limit = parseInt(parsed.query?.limit) || 20;
          const alerts = await queryAuditEvents({
            eventType: 'workload_alert.triggered',
            limit
          });
          return json(res, 200, { alerts });
        }

        // Task Completion Notification APIs
        if (req.method === 'GET' && adminPath === 'task-completion/config') {
          const config = await taskCompletionConfig.getConfig();
          return json(res, 200, config);
        }

        if (req.method === 'PUT' && adminPath === 'task-completion/config') {
          const body = await readJson(req);
          const currentUser = await verifyTokenFromRequest(req);
          const userName = currentUser?.name || 'Master';
          
          const { enabled, notifyOnComplete, notifyOnFailed, notifyChannels } = body;
          
          if (enabled !== undefined && typeof enabled !== 'boolean') {
            throw new Error('enabled 必须是布尔值');
          }
          if (notifyOnComplete !== undefined && typeof notifyOnComplete !== 'boolean') {
            throw new Error('notifyOnComplete 必须是布尔值');
          }
          if (notifyOnFailed !== undefined && typeof notifyOnFailed !== 'boolean') {
            throw new Error('notifyOnFailed 必须是布尔值');
          }
          if (notifyChannels !== undefined) {
            if (!Array.isArray(notifyChannels)) {
              throw new Error('notifyChannels 必须是数组');
            }
            const legacyChannelTypes = ['feishu', 'dingtalk', 'wecom', 'slack'];
            const allChannels = await notificationChannels.getChannels();
            for (const channel of notifyChannels) {
              const isUuid = channel.includes('-') && channel.length > 20;
              const isLegacyType = legacyChannelTypes.includes(channel);
              const isValidChannelId = allChannels.some(c => c.id === channel);
              if (!isUuid && !isLegacyType && !isValidChannelId) {
                throw new Error(`无效的通知渠道：${channel}，请使用渠道 ID 或有效的渠道类型`);
              }
            }
          }
          
          const config = await taskCompletionConfig.updateConfig({
            enabled,
            notifyOnComplete,
            notifyOnFailed,
            notifyChannels
          });
          
          await addAuditEvent('task_completion.config_changed', {
            enabled: config.enabled,
            notifyOnComplete: config.notifyOnComplete,
            notifyOnFailed: config.notifyOnFailed,
            notifyChannels: config.notifyChannels,
            changedBy: userName
          }, userName, currentUser?.id);
          
          return json(res, 200, config);
        }

        if (req.method === 'GET' && adminPath === 'notification-channels') {
          const channels = await notificationChannels.getChannels();
          return json(res, 200, { channels });
        }

        if (req.method === 'POST' && adminPath === 'notification-channels') {
          const body = await readJson(req);
          const currentUser = await verifyTokenFromRequest(req);
          const userName = currentUser?.name || 'Master';
          const channel = await notificationChannels.createChannel(body);
          await addAuditEvent('notification_channel.created', {
            channelId: channel.id,
            channelName: channel.name,
            channelType: channel.type
          }, userName, currentUser?.id);
          return json(res, 201, { channel });
        }

        if (req.method === 'PUT' && adminPath.match(/^notification-channels\/[\w-]+$/)) {
          const channelId = adminPath.split('/')[1];
          const body = await readJson(req);
          const currentUser = await verifyTokenFromRequest(req);
          const userName = currentUser?.name || 'Master';
          const channel = await notificationChannels.updateChannel(channelId, body);
          await addAuditEvent('notification_channel.updated', {
            channelId: channel.id,
            channelName: channel.name,
            channelType: channel.type
          }, userName, currentUser?.id);
          return json(res, 200, { channel });
        }

        if (req.method === 'DELETE' && adminPath.match(/^notification-channels\/[\w-]+$/)) {
          const channelId = adminPath.split('/')[1];
          const currentUser = await verifyTokenFromRequest(req);
          const userName = currentUser?.name || 'Master';
          const channel = await notificationChannels.deleteChannel(channelId);
          await addAuditEvent('notification_channel.deleted', {
            channelId: channel.id,
            channelName: channel.name,
            channelType: channel.type
          }, userName, currentUser?.id);
          return json(res, 200, { success: true });
        }

        if (req.method === 'POST' && adminPath.match(/^notification-channels\/[\w-]+\/test$/)) {
          const channelId = adminPath.split('/')[1];
          const currentUser = await verifyTokenFromRequest(req);
          const userName = currentUser?.name || 'Master';
          const channel = await notificationChannels.getChannel(channelId);
          if (!channel) {
            return json(res, 404, { error: '渠道不存在' });
          }
          const testMessage = '🔔 Agent Orchestra 测试消息\n这是一条测试通知，用于验证渠道配置是否正确。';
          try {
            const result = await notificationChannels.sendTestMessage(channelId);
            await notificationHistory.recordNotification({
              channelId: channel.id,
              channelName: channel.name,
              channelType: channel.type,
              message: testMessage,
              status: 'sent'
            });
            await addAuditEvent('notification.sent', {
              channelId: channel.id,
              channelName: channel.name,
              channelType: channel.type,
              source: 'channel_test'
            }, userName, currentUser?.id);
            await addAuditEvent('notification_channel.tested', {
              channelId: channel.id,
              channelName: channel.name,
              channelType: channel.type,
              success: true
            }, userName, currentUser?.id);
            return json(res, 200, { success: true, message: '测试消息发送成功', details: result });
          } catch (err) {
            await notificationHistory.recordNotification({
              channelId: channel.id,
              channelName: channel.name,
              channelType: channel.type,
              message: testMessage,
              status: 'failed',
              error: err.message
            });
            await addAuditEvent('notification.failed', {
              channelId: channel.id,
              channelName: channel.name,
              channelType: channel.type,
              source: 'channel_test',
              error: err.message
            }, userName, currentUser?.id);
            await addAuditEvent('notification_channel.tested', {
              channelId: channel.id,
              channelName: channel.name,
              channelType: channel.type,
              success: false,
              error: err.message
            }, userName, currentUser?.id);
            return json(res, 400, { success: false, error: err.message });
          }
        }

        if (req.method === 'PUT' && adminPath.match(/^notification-channels\/[\w-]+\/toggle$/)) {
          const channelId = adminPath.split('/')[1];
          const currentUser = await verifyTokenFromRequest(req);
          const userName = currentUser?.name || 'Master';
          const channel = await notificationChannels.toggleChannel(channelId);
          await addAuditEvent('notification_channel.toggled', {
            channelId: channel.id,
            channelName: channel.name,
            channelType: channel.type,
            isEnabled: channel.isEnabled
          }, userName, currentUser?.id);
          return json(res, 200, { channel });
        }

        if (req.method === 'GET' && adminPath === 'notification-history') {
          const filters = {
            status: parsed.query?.status,
            channelType: parsed.query?.channelType,
            channelId: parsed.query?.channelId,
            timeFrom: parsed.query?.timeFrom,
            timeTo: parsed.query?.timeTo,
            keyword: parsed.query?.keyword,
            page: parsed.query?.page,
            pageSize: parsed.query?.pageSize
          };
          const result = await notificationHistory.getHistory(filters);
          return json(res, 200, result);
        }

        if (req.method === 'POST' && adminPath.match(/^notification-history\/[\w-]+\/retry$/)) {
          const notificationId = adminPath.split('/')[1];
          const currentUser = await verifyTokenFromRequest(req);
          const userName = currentUser?.name || 'Master';
          try {
            const notification = await notificationHistory.retryNotification(notificationId);
            await addAuditEvent('notification.retry', {
              notificationId: notification.id,
              channelId: notification.channelId,
              channelName: notification.channelName,
              channelType: notification.channelType,
              retryCount: notification.retryCount
            }, userName, currentUser?.id);
            return json(res, 200, { notification });
          } catch (err) {
            return json(res, 400, { error: err.message });
          }
        }

        if (req.method === 'GET' && adminPath === 'notification-history/stats') {
          const stats = await notificationHistory.getStatistics();
          return json(res, 200, { stats });
        }

        if (req.method === 'GET' && adminPath === 'notification-templates') {
          const templates = await notificationTemplates.getTemplates();
          const variables = notificationTemplates.TEMPLATE_VARIABLES;
          return json(res, 200, { templates, variables });
        }

        if (req.method === 'PUT' && adminPath === 'notification-templates') {
          const body = await readJson(req);
          const currentUser = await verifyTokenFromRequest(req);
          const userName = currentUser?.name || 'Master';
          const templates = await notificationTemplates.updateTemplates(body.templates || {});
          await addAuditEvent('notification_template.updated', {
            updatedTypes: Object.keys(body.templates || {})
          }, userName, currentUser?.id);
          return json(res, 200, { templates });
        }

        if (req.method === 'POST' && adminPath.match(/^notification-templates\/[\w_]+\/reset$/)) {
          const templateType = adminPath.split('/')[2];
          const currentUser = await verifyTokenFromRequest(req);
          const userName = currentUser?.name || 'Master';
          try {
            const template = await notificationTemplates.resetTemplate(templateType);
            await addAuditEvent('notification_template.reset', {
              templateType
            }, userName, currentUser?.id);
            return json(res, 200, { template });
          } catch (err) {
            return json(res, 400, { error: err.message });
          }
        }

        if (req.method === 'POST' && adminPath === 'notification-templates/reset-all') {
          const currentUser = await verifyTokenFromRequest(req);
          const userName = currentUser?.name || 'Master';
          const templates = await notificationTemplates.resetAllTemplates();
          await addAuditEvent('notification_template.reset_all', {}, userName, currentUser?.id);
          return json(res, 200, { templates });
        }

        if (req.method === 'GET' && adminPath === 'scheduled-backup/config') {
          const config = await scheduledBackup.getConfig();
          return json(res, 200, config);
        }

        if (req.method === 'PUT' && adminPath === 'scheduled-backup/config') {
          const body = await readJson(req);
          const { enabled, frequency, time, dayOfWeek, retentionCount, mode, notification } = body;
          
          if (enabled !== undefined && typeof enabled !== 'boolean') {
            throw new Error('enabled 必须是布尔值');
          }
          if (frequency !== undefined && !['daily', 'weekly'].includes(frequency)) {
            throw new Error('frequency 必须是 daily 或 weekly');
          }
          if (time !== undefined) {
            const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);
            if (!timeMatch) {
              throw new Error('time 格式必须是 HH:MM');
            }
            const hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
              throw new Error('time 时间无效');
            }
          }
          if (dayOfWeek !== undefined && (dayOfWeek < 0 || dayOfWeek > 6)) {
            throw new Error('dayOfWeek 必须是 0-6 之间的数字');
          }
          if (retentionCount !== undefined && (retentionCount < 1 || retentionCount > 100)) {
            throw new Error('retentionCount 必须在 1-100 之间');
          }
          if (mode !== undefined && !['full', 'incremental'].includes(mode)) {
            throw new Error('mode 必须是 full 或 incremental');
          }
          if (notification !== undefined) {
            if (typeof notification !== 'object' || notification === null) {
              throw new Error('notification 必须是对象');
            }
            if (notification.enabled !== undefined && typeof notification.enabled !== 'boolean') {
              throw new Error('notification.enabled 必须是布尔值');
            }
            if (notification.channels !== undefined) {
              if (!Array.isArray(notification.channels)) {
                throw new Error('notification.channels 必须是数组');
              }
              const legacyChannelTypes = ['feishu', 'dingtalk', 'wecom', 'slack'];
              const allChannels = await notificationChannels.getChannels();
              for (const ch of notification.channels) {
                const isUuid = ch.includes('-') && ch.length > 20;
                const isLegacyType = legacyChannelTypes.includes(ch);
                const isValidChannelId = allChannels.some(c => c.id === ch);
                if (!isUuid && !isLegacyType && !isValidChannelId) {
                  throw new Error(`无效的通知渠道: ${ch}，请使用渠道 ID 或有效的渠道类型`);
                }
              }
            }
          }
          
          const configUpdate = {
            enabled,
            frequency,
            time,
            dayOfWeek,
            retentionCount,
            mode
          };
          
          if (notification !== undefined) {
            configUpdate.notification = notification;
          }
          
          const result = await scheduledBackup.updateConfig(configUpdate);
          
          await addAuditEvent('scheduled_backup.config_changed', {
            changedBy: currentUser.name,
            config: result.config
          }, currentUser.name, currentUser.id);
          
          return json(res, 200, result);
        }

        if (req.method === 'GET' && adminPath === 'scheduled-backup/history') {
          const history = await scheduledBackup.getHistory(50);
          return json(res, 200, { history });
        }

        if (req.method === 'POST' && adminPath === 'scheduled-backup/run') {
          const result = await scheduledBackup.executeScheduledBackup();
          
          if (result.success) {
            await addAuditEvent('scheduled_backup.created', {
              fileName: result.fileName,
              fileSize: result.fileSize,
              triggeredBy: 'manual'
            }, currentUser.name, currentUser.id);
          } else {
            await addAuditEvent('scheduled_backup.failed', {
              error: result.error,
              triggeredBy: 'manual'
            }, currentUser.name, currentUser.id);
          }
          
          return json(res, 200, result);
        }

        // Cloud Storage Configuration
        if (req.method === 'GET' && adminPath === 'cloud-storage/config') {
          const config = cloudStorage.getCloudConfig();
          // Don't return sensitive information
          const safeConfig = { ...config };
          if (safeConfig.accessKeySecret) {
            safeConfig.accessKeySecret = safeConfig.accessKeySecret.substring(0, 3) + '***';
          }
          return json(res, 200, safeConfig);
        }

        if (req.method === 'POST' && adminPath === 'cloud-storage/config') {
          const body = await readJson(req);
          const { provider, bucket, region, endpoint, accessKeyId, accessKeySecret, enabled, retentionDays } = body;
          
          if (provider !== undefined && !['oss', 's3', 'minio'].includes(provider)) {
            throw new Error('provider 必须是 oss、s3 或 minio');
          }
          if (bucket !== undefined && typeof bucket !== 'string') {
            throw new Error('bucket 必须是字符串');
          }
          if (region !== undefined && typeof region !== 'string') {
            throw new Error('region 必须是字符串');
          }
          if (endpoint !== undefined && typeof endpoint !== 'string') {
            throw new Error('endpoint 必须是字符串');
          }
          if (accessKeyId !== undefined && typeof accessKeyId !== 'string') {
            throw new Error('accessKeyId 必须是字符串');
          }
          if (accessKeySecret !== undefined && typeof accessKeySecret !== 'string') {
            throw new Error('accessKeySecret 必须是字符串');
          }
          if (enabled !== undefined && typeof enabled !== 'boolean') {
            throw new Error('enabled 必须是布尔值');
          }
          if (retentionDays !== undefined && (typeof retentionDays !== 'number' || retentionDays < 1 || retentionDays > 365)) {
            throw new Error('retentionDays 必须是 1-365 之间的数字');
          }

          const currentConfig = cloudStorage.getCloudConfig();
          const newConfig = {
            ...currentConfig,
            provider: provider !== undefined ? provider : currentConfig.provider,
            bucket: bucket !== undefined ? bucket : currentConfig.bucket,
            region: region !== undefined ? region : currentConfig.region,
            endpoint: endpoint !== undefined ? endpoint : currentConfig.endpoint,
            accessKeyId: accessKeyId !== undefined ? accessKeyId : currentConfig.accessKeyId,
            accessKeySecret: accessKeySecret !== undefined ? accessKeySecret : currentConfig.accessKeySecret,
            enabled: enabled !== undefined ? enabled : currentConfig.enabled,
            retentionDays: retentionDays !== undefined ? retentionDays : (currentConfig.retentionDays || 30)
          };

          cloudStorage.saveCloudConfig(newConfig);
          cloudStorage.resetClient();
          
          await addAuditEvent('cloud_storage.config_changed', {
            changedBy: currentUser.name,
            provider: newConfig.provider,
            bucket: newConfig.bucket,
            enabled: newConfig.enabled,
            retentionDays: newConfig.retentionDays
          }, currentUser.name, currentUser.id);
          
          return json(res, 200, { success: true, config: newConfig });
        }

        // Cloud Backup Lifecycle Management
        if (req.method === 'GET' && adminPath === 'backup/cloud/lifecycle') {
          const stats = await scheduledBackup.getLifecycleStats();
          return json(res, 200, stats);
        }

        if (req.method === 'POST' && adminPath === 'backup/cloud/cleanup') {
          const result = await scheduledBackup.executeCloudBackupCleanup();
          
          if (result && result.success) {
            await addAuditEvent('cloud_backup.cleanup', {
              scannedCount: result.scannedCount,
              deletedCount: result.deletedCount,
              deletedSize: result.deletedSize,
              retentionDays: result.retentionDays,
              triggeredBy: 'manual'
            }, currentUser.name, currentUser.id);
          } else if (result && !result.success) {
            await addAuditEvent('cloud_backup.cleanup_failed', {
              error: result.error,
              triggeredBy: 'manual'
            }, currentUser.name, currentUser.id);
          }
          
          return json(res, 200, result || { success: false, error: 'Cleanup function not available' });
        }

        // Cloud Backup Operations
        if (req.method === 'POST' && adminPath === 'backup/cloud') {
          const { mode = 'full' } = req.query;
          
          // Create backup
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupData = await createBackupData(mode, currentUser);
          const backupJson = JSON.stringify(backupData, null, 2);
          const backupFileName = `cloud-backup-${timestamp}.json`;
          const tempBackupPath = path.join(DATA_DIR, 'backups', backupFileName);
          
          // Save to local temp file
          await fsp.writeFile(tempBackupPath, backupJson);
          
          // Upload to cloud
          const cloudKey = `backups/${backupFileName}`;
          const uploadResult = await cloudStorage.uploadFile(tempBackupPath, cloudKey);
          
          // Clean up temp file
          try {
            await fsp.unlink(tempBackupPath);
          } catch (e) {
            // Ignore cleanup errors
          }
          
          if (!uploadResult.success) {
            await addAuditEvent('cloud_backup.uploaded', {
              fileName: backupFileName,
              mode,
              success: false,
              error: uploadResult.error
            }, currentUser.name, currentUser.id);
            return json(res, 500, { success: false, error: uploadResult.error });
          }
          
          await addAuditEvent('cloud_backup.uploaded', {
            fileName: backupFileName,
            mode,
            cloudKey,
            success: true
          }, currentUser.name, currentUser.id);
          
          return json(res, 200, {
            success: true,
            fileName: backupFileName,
            cloudKey
          });
        }

        if (req.method === 'GET' && adminPath === 'backup/cloud/list') {
          const listResult = await cloudStorage.listFiles('backups/');
          
          if (!listResult.success) {
            return json(res, 500, { success: false, error: listResult.error });
          }
          
          return json(res, 200, {
            success: true,
            files: listResult.files.map(f => ({
              key: f.key,
              size: f.size,
              lastModified: f.lastModified
            }))
          });
        }

        if (req.method === 'POST' && adminPath === 'backup/cloud/restore') {
          const body = await readJson(req);
          const { cloudKey, restoreMode = 'merge' } = body;
          
          if (!cloudKey) {
            throw new Error('cloudKey 是必需的');
          }
          
          // Download from cloud
          const tempPath = path.join(DATA_DIR, 'backups', `temp-restore-${Date.now()}.json`);
          const downloadResult = await cloudStorage.downloadFile(cloudKey, tempPath);
          
          if (!downloadResult.success) {
            return json(res, 500, { success: false, error: downloadResult.error });
          }
          
          try {
            // Read and restore
            const backupData = JSON.parse(await fsp.readFile(tempPath, 'utf8'));
            
            if (!backupData.version || !backupData.data) {
              throw new Error('无效的备份文件格式');
            }
            
            // Create auto snapshot before restore
            const autoSnapshot = true;
            if (autoSnapshot) {
              const autoNow = new Date().toISOString();
              const autoSnapshotData = await createBackupData('full', currentUser);
              const autoSnapshotJson = JSON.stringify(autoSnapshotData, null, 2);
              const autoSnapshotFileName = `auto-snapshot-${autoNow.replace(/[:.]/g, '-')}.json`;
              const autoSnapshotPath = path.join(DATA_DIR, 'backups', autoSnapshotFileName);
              await fsp.writeFile(autoSnapshotPath, autoSnapshotJson);
              
              await addAuditEvent('backup.auto_snapshot_created', {
                reason: 'before-cloud-restore',
                fileName: autoSnapshotFileName,
                restoreMode
              }, currentUser.name, currentUser.id);
            }
            
            // Perform restore (same logic as local restore)
            const restoreResult = await performRestore(backupData.data, restoreMode);
            
            await addAuditEvent('cloud_backup.restored', {
              cloudKey,
              mode: restoreMode,
              result: restoreResult
            }, currentUser.name, currentUser.id);
            
            invalidateOverviewCache();
            
            return json(res, 200, {
              success: true,
              mode: restoreMode,
              result: restoreResult
            });
          } finally {
            // Clean up temp file
            try {
              await fsp.unlink(tempPath);
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        }

        if (req.method === 'POST' && adminPath === 'backup/cloud/test') {
          const testResult = await cloudStorage.testConnection();
          return json(res, 200, testResult);
        }

        return json(res, 404, { error: '管理员接口不存在' });
      }
      if (req.method === 'POST' && pathname === '/api/audit') {
        const body = await readJson(req);
        if (!body.type) {
          throw new Error('Audit event type is required');
        }
        const event = await addAuditEvent(body.type, body.details || {}, body.user || 'system');
        return json(res, 201, { event });
      }
      if (req.method === 'GET' && pathname === '/api/audit') {
        const filters = {
          eventType: parsed.query.eventType || null,
          user: parsed.query.user || null,
          timeFrom: parsed.query.timeFrom || null,
          timeTo: parsed.query.timeTo || null,
          keyword: parsed.query.keyword || null,
          limit: parsed.query.limit ? parseInt(parsed.query.limit, 10) : null,
          offset: parsed.query.offset ? parseInt(parsed.query.offset, 10) : null
        };
        const events = await queryAuditEvents(filters);
        return json(res, 200, { events });
      }
      if (req.method === 'GET' && pathname === '/api/audit/types') {
        return json(res, 200, { types: getAuditEventTypes() });
      }
      if (req.method === 'GET' && pathname === '/api/feishu/config') {
        const config = getFeishuConfig();
        if (config) {
          return json(res, 200, { 
            configured: true, 
            appId: config.appId ? config.appId.slice(0, 4) + '****' : '',
            hasAppSecret: !!config.appSecret
          });
        }
        return json(res, 200, { configured: false });
      }
      if (req.method === 'POST' && pathname === '/api/feishu/config') {
        const body = await readJson(req);
        const { appId, appSecret } = body;
        if (!appId || !appSecret) {
          throw new Error('缺少 appId 或 appSecret 参数');
        }
        const configPath = path.join(DATA_DIR, 'feishu-config.json');
        await fsp.writeFile(configPath, JSON.stringify({ appId, appSecret }, null, 2));
        return json(res, 200, { success: true, message: '飞书配置已保存' });
      }
      if (req.method === 'GET' && pathname === '/api/export/snapshot') {
        const overview = await buildOverview(true);
        const exportData = {
          type: 'dashboard-snapshot',
          exportedAt: new Date().toISOString(),
          overview
        };
        const format = parsed.query.format || 'json';
        if (format === 'html') {
          const html = generateSnapshotHtml(exportData);
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': 'attachment; filename="dashboard-snapshot.html"'
          });
          return res.end(html);
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="dashboard-snapshot.json"'
        });
        return res.end(JSON.stringify(exportData, null, 2));
      }
      if (req.method === 'POST' && pathname === '/api/export/task-report') {
        const body = await readJson(req);
        const taskId = body.taskId;
        if (!taskId) throw new Error('缺少 taskId 参数');
        const task = await getTask(taskId);
        if (!task) throw new Error('任务不存在');
        const log = await readLog(taskId);
        const logSummary = generateLogSummary(log);
        const exportData = {
          type: 'task-report',
          exportedAt: new Date().toISOString(),
          task,
          logSummary
        };
        const format = body.format || 'json';
        if (format === 'html') {
          const html = generateTaskReportHtml(exportData);
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': 'attachment; filename="task-report.html"'
          });
          return res.end(html);
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="task-report.json"'
        });
        return res.end(JSON.stringify(exportData, null, 2));
      }
      if (req.method === 'GET' && pathname === '/api/export/dashboard') {
        const overview = await buildOverview(true);
        const tasks = await readTasks();
        const runtime = await readRuntime();
        const exportData = {
          type: 'full-dashboard',
          exportedAt: new Date().toISOString(),
          overview,
          tasks: tasks.map(formatTaskForUi),
          runtime
        };
        const format = parsed.query.format || 'json';
        if (format === 'html') {
          const html = generateFullDashboardHtml(exportData);
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': 'attachment; filename="full-dashboard.html"'
          });
          return res.end(html);
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="full-dashboard.json"'
        });
        return res.end(JSON.stringify(exportData, null, 2));
      }
      if (req.method === 'POST' && pathname === '/api/export/screenshot') {
        const body = await readJson(req);
        const { type, taskId, format } = body;
        
        if (!type || !['dashboard', 'task-report'].includes(type)) {
          throw new Error('无效的导出类型，请指定 dashboard 或 task-report');
        }
        
        if (format !== 'png') {
          throw new Error('仅支持 PNG 格式导出');
        }
        
        let htmlContent = '';
        let filename = '';
        
        if (type === 'dashboard') {
          const overview = await buildOverview(true);
          const exportData = {
            type: 'dashboard-snapshot',
            exportedAt: new Date().toISOString(),
            overview
          };
          htmlContent = generateSnapshotHtml(exportData);
          filename = 'dashboard-snapshot.png';
        } else if (type === 'task-report') {
          if (!taskId) {
            throw new Error('导出任务汇报需要提供 taskId 参数');
          }
          const task = await getTask(taskId);
          if (!task) throw new Error('任务不存在');
          const log = await readLog(taskId);
          const logSummary = generateLogSummary(log);
          const exportData = {
            type: 'task-report',
            exportedAt: new Date().toISOString(),
            task,
            logSummary
          };
          htmlContent = generateTaskReportHtml(exportData);
          filename = 'task-report.png';
        }
        
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename.replace('.png', '.html')}"`
        });
        return res.end(htmlContent);
      }

      if (req.method === 'POST' && pathname === '/api/share/feishu') {
        const body = await readJson(req);
        const { type, taskId, channelId, imageBase64 } = body;

        if (!channelId) {
          throw new Error('缺少 channelId 参数');
        }

        if (!type || !['dashboard', 'task-report'].includes(type)) {
          throw new Error('无效的分享类型，请指定 dashboard 或 task-report');
        }

        if (!imageBase64) {
          throw new Error('缺少图片数据');
        }

        const feishuConfig = getFeishuConfig();
        if (!feishuConfig || !feishuConfig.appId || !feishuConfig.appSecret) {
          throw new Error('飞书配置未完成，请先配置飞书机器人');
        }

        let title = type === 'dashboard' ? '仪表板快照' : '任务汇报';
        if (type === 'task-report' && taskId) {
          const task = await getTask(taskId);
          if (task) title = `任务汇报 - ${task.name || task.id}`;
        }

        const result = await sendFeishuImageMessage(feishuConfig, channelId, imageBase64, title);
        return json(res, 200, { success: true, message: '分享成功', messageId: result.message_id });
      }
      if (req.method === 'GET' && pathname === '/api/dingtalk/config') {
        const config = getDingTalkConfig();
        if (config) {
          return json(res, 200, { 
            configured: true, 
            appKey: config.appKey ? config.appKey.slice(0, 4) + '****' : '',
            hasAppSecret: !!config.appSecret,
            hasWebhook: !!config.webhook
          });
        }
        return json(res, 200, { configured: false });
      }
      if (req.method === 'POST' && pathname === '/api/dingtalk/config') {
        const body = await readJson(req);
        const { appKey, appSecret, webhook } = body;
        if (!appKey || !appSecret || !webhook) {
          throw new Error('缺少 appKey、appSecret 或 webhook 参数');
        }
        await saveDingTalkConfig({ appKey, appSecret, webhook });
        return json(res, 200, { success: true, message: '钉钉配置已保存' });
      }
      if (req.method === 'POST' && pathname === '/api/share/dingtalk') {
        const body = await readJson(req);
        const { type, taskId, webhook, imageBase64 } = body;

        if (!webhook) {
          throw new Error('缺少 webhook 参数');
        }

        if (!type || !['dashboard', 'task-report'].includes(type)) {
          throw new Error('无效的分享类型，请指定 dashboard 或 task-report');
        }

        if (!imageBase64) {
          throw new Error('缺少图片数据');
        }

        let title = type === 'dashboard' ? '仪表板快照' : '任务汇报';
        if (type === 'task-report' && taskId) {
          const task = await getTask(taskId);
          if (task) title = `任务汇报 - ${task.name || task.id}`;
        }

        const result = await sendDingTalkImageMessage(webhook, imageBase64, title);
        return json(res, 200, { success: true, message: '分享成功', messageId: result.messageId });

      }
      if (req.method === 'GET' && pathname === '/api/wecom/config') {
        const config = getWecomConfig();
        if (config) {
          return json(res, 200, {
            configured: true,
            corpId: config.corpId ? config.corpId.slice(0, 4) + '****' : '',
            hasAgentId: !!config.agentId,
            hasSecret: !!config.secret,
            hasWebhook: !!config.webhook
          });
        }
        return json(res, 200, { configured: false });
      }
      if (req.method === 'POST' && pathname === '/api/wecom/config') {
        const body = await readJson(req);
        const { corpId, agentId, secret, webhook } = body;
        if (!corpId || !agentId || !secret || !webhook) {
          throw new Error('缺少 corpId、agentId、secret 或 webhook 参数');
        }
        await saveWecomConfig({ corpId, agentId, secret, webhook });
        return json(res, 200, { success: true, message: '企业微信配置已保存' });
      }
      if (req.method === 'POST' && pathname === '/api/share/wecom') {
        const body = await readJson(req);
        const { type, taskId, webhook, imageBase64 } = body;

        if (!webhook) {
          throw new Error('缺少 webhook 参数');
        }

        if (!type || !['dashboard', 'task-report'].includes(type)) {
          throw new Error('无效的分享类型，请指定 dashboard 或 task-report');
        }

        if (!imageBase64) {
          throw new Error('缺少图片数据');
        }

        let title = type === 'dashboard' ? 'Agent Orchestra 仪表板快照' : '任务汇报';
        if (type === 'task-report' && taskId) {
          const task = await getTask(taskId);
          if (task) title = `任务汇报 - ${task.title || task.id}`;
        }

        const result = await sendWecomImageMessage(webhook, imageBase64, title);
        return json(res, 200, { success: true, message: '分享成功', messageId: result.messageId });
      }
      if (req.method === 'GET' && pathname === '/api/slack/config') {
        const config = getSlackConfig();
        if (config) {
          return json(res, 200, { 
            configured: true, 
            botToken: config.botToken ? config.botToken.slice(0, 8) + '****' : ''
          });
        }
        return json(res, 200, { configured: false });
      }
      if (req.method === 'POST' && pathname === '/api/slack/config') {
        const body = await readJson(req);
        const { botToken } = body;
        if (!botToken) {
          throw new Error('缺少 botToken 参数');
        }
        await saveSlackConfig({ botToken });
        return json(res, 200, { success: true, message: 'Slack 配置已保存' });
      }
      if (req.method === 'POST' && pathname === '/api/share/slack') {
        const body = await readJson(req);
        const { type, taskId, channelId, imageBase64 } = body;

        if (!channelId) {
          throw new Error('缺少 channelId 参数');
        }

        if (!type || !['dashboard', 'task-report'].includes(type)) {
          throw new Error('无效的分享类型，请指定 dashboard 或 task-report');
        }

        if (!imageBase64) {
          throw new Error('缺少图片数据');
        }

        const slackConfig = getSlackConfig();
        if (!slackConfig || !slackConfig.botToken) {
          throw new Error('Slack 配置未完成，请先配置 Slack Bot Token');
        }

        let title = type === 'dashboard' ? 'Agent Orchestra 仪表板快照' : '任务汇报';
        if (type === 'task-report' && taskId) {
          const task = await getTask(taskId);
          if (task) title = `任务汇报 - ${task.title || task.id}`;
        }

        const result = await sendSlackImageMessage(slackConfig, channelId, imageBase64, title);
        return json(res, 200, { success: true, message: '分享成功', messageId: result.messageId });
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function generateLogSummary(log) {
  if (!log) return { totalLines: 0, summary: '暂无日志' };
  const lines = log.split('\n').filter(l => l.trim());
  const totalLines = lines.length;
  const errorLines = lines.filter(l => l.toLowerCase().includes('error') || l.toLowerCase().includes('fail') || l.toLowerCase().includes('exception'));
  const warnLines = lines.filter(l => l.toLowerCase().includes('warn') || l.toLowerCase().includes('warning'));
  const lastLines = lines.slice(-20);
  return {
    totalLines,
    errorCount: errorLines.length,
    warnCount: warnLines.length,
    lastLines: lastLines.join('\n'),
    fullLog: log.slice(-50000)
  };
}

function escapeHtmlForExport(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateSnapshotHtml(data) {
  const o = data.overview;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Orchestra - 仪表板快照</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { margin: 0 0 8px 0; font-size: 28px; }
    .header .meta { opacity: 0.8; font-size: 14px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-card .label { color: #64748b; font-size: 14px; margin-bottom: 4px; }
    .stat-card .value { font-size: 24px; font-weight: 700; color: #1e293b; }
    .section { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
    .section h2 { margin: 0 0 16px 0; font-size: 18px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
    .agents-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .agent-card { background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 3px solid #3b82f6; }
    .agent-card .name { font-weight: 600; color: #1e293b; }
    .agent-card .info { font-size: 13px; color: #64748b; margin-top: 4px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .badge.busy { background: #fef3c7; color: #92400e; }
    .badge.idle { background: #d1fae5; color: #065f46; }
    .badge.offline { background: #f1f5f9; color: #64748b; }
    .system-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .kv { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .kv .label { color: #64748b; font-size: 13px; }
    .kv .value { color: #1e293b; font-weight: 500; }
    @media print { body { background: white; } .section, .header { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Agent Orchestra - 仪表板快照</h1>
    <div class="meta">导出时间：${new Date(data.exportedAt).toLocaleString('zh-CN')}</div>
  </div>
  
  <div class="stats-grid">
    <div class="stat-card"><div class="label">Agent 总数</div><div class="value">${o.totals.agents}</div></div>
    <div class="stat-card"><div class="label">会话数</div><div class="value">${o.totals.sessions}</div></div>
    <div class="stat-card"><div class="label">忙碌 Agent</div><div class="value">${o.totals.busyAgents}</div></div>
    <div class="stat-card"><div class="label">排队任务</div><div class="value">${o.totals.taskQueued}</div></div>
    <div class="stat-card"><div class="label">运行中</div><div class="value">${o.totals.taskRunning}</div></div>
    <div class="stat-card"><div class="label">已完成/失败</div><div class="value">${o.totals.taskDone}/${o.totals.taskFailed}</div></div>
  </div>
  
  <div class="section">
    <h2>Agent 列表</h2>
    <div class="agents-grid">
      ${o.agents.map(a => `
        <div class="agent-card">
          <div class="name">${escapeHtmlForExport(a.name)}</div>
          <div class="info">
            <span class="badge ${a.status}">${a.status === 'busy' ? '忙碌' : a.status === 'idle' ? '空闲' : '离线'}</span>
            · ${escapeHtmlForExport(a.model)} · ${a.sessionsCount} 会话
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  
  <div class="section">
    <h2>系统状态</h2>
    <div class="system-info">
      <div class="kv"><div class="label">Gateway</div><div class="value">${o.gateway?.reachable ? '可达' : '不可达'}</div></div>
      <div class="kv"><div class="label">延迟</div><div class="value">${o.gateway?.connectLatencyMs ?? '—'} ms</div></div>
      <div class="kv"><div class="label">高危告警</div><div class="value">${o.securityAudit?.critical ?? 0}</div></div>
      <div class="kv"><div class="label">警告</div><div class="value">${o.securityAudit?.warn ?? 0}</div></div>
    </div>
  </div>
</body>
</html>`;
}

function generateTaskReportHtml(data) {
  const task = data.task;
  const logSummary = data.logSummary;
  const statusLabel = { queued: '待执行', running: '执行中', paused: '已暂停', completed: '已完成', failed: '失败', canceled: '已取消' };
  const priorityLabel = { low: '低', medium: '中', high: '高' };
  const runStatusLabel = { queued: '待命', running: '执行中', completed: '完成', failed: '失败', canceled: '已取消' };
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Orchestra - 任务汇报</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 1000px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; }
    .header .meta { opacity: 0.8; font-size: 14px; }
    .section { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
    .section h2 { margin: 0 0 16px 0; font-size: 18px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .info-item { padding: 12px; background: #f8fafc; border-radius: 6px; }
    .info-item .label { color: #64748b; font-size: 13px; }
    .info-item .value { font-weight: 600; color: #1e293b; margin-top: 4px; }
    .prompt-box { background: #f8fafc; padding: 16px; border-radius: 6px; margin: 16px 0; white-space: pre-wrap; word-break: break-word; }
    .runs-list { display: flex; flex-direction: column; gap: 12px; }
    .run-item { padding: 16px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #3b82f6; }
    .run-item.failed { border-left-color: #ef4444; }
    .run-item.completed { border-left-color: #22c55e; }
    .run-item .agent { font-weight: 600; color: #1e293b; }
    .run-item .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; margin-left: 8px; }
    .run-item .status.completed { background: #d1fae5; color: #065f46; }
    .run-item .status.failed { background: #fee2e2; color: #991b1b; }
    .run-item .status.running { background: #dbeafe; color: #1e40af; }
    .run-item .error { color: #dc2626; font-size: 13px; margin-top: 8px; padding: 8px; background: #fef2f2; border-radius: 4px; }
    .log-summary { font-size: 13px; }
    .log-summary .stats { display: flex; gap: 16px; margin-bottom: 12px; }
    .log-summary .stat { padding: 4px 12px; background: #f1f5f9; border-radius: 4px; }
    .log-summary .stat.error { background: #fee2e2; color: #991b1b; }
    .log-summary .stat.warn { background: #fef3c7; color: #92400e; }
    .log-box { background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 12px; white-space: pre; max-height: 400px; overflow-y: auto; }
    @media print { body { background: white; } .section { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtmlForExport(task.title)}</h1>
    <div class="meta">导出时间：${new Date(data.exportedAt).toLocaleString('zh-CN')}</div>
  </div>
  
  <div class="section">
    <h2>任务信息</h2>
    <div class="info-grid">
      <div class="info-item"><div class="label">状态</div><div class="value">${statusLabel[task.status] || task.status}</div></div>
      <div class="info-item"><div class="label">优先级</div><div class="value">${priorityLabel[task.priority] || task.priority}</div></div>
      <div class="info-item"><div class="label">执行模式</div><div class="value">${task.mode === 'parallel' ? '并行' : '串行广播'}</div></div>
      <div class="info-item"><div class="label">创建时间</div><div class="value">${task.createdAt ? new Date(task.createdAt).toLocaleString('zh-CN') : '—'}</div></div>
      <div class="info-item"><div class="label">开始时间</div><div class="value">${task.startedAt ? new Date(task.startedAt).toLocaleString('zh-CN') : '—'}</div></div>
      <div class="info-item"><div class="label">完成时间</div><div class="value">${task.finishedAt ? new Date(task.finishedAt).toLocaleString('zh-CN') : '—'}</div></div>
    </div>
    <div class="prompt-box"><div class="label" style="color:#64748b;font-size:13px;margin-bottom:8px;">任务内容</div>${escapeHtmlForExport(task.prompt)}</div>
    <div class="info-item"><div class="label">分配的 Agent</div><div class="value">${(task.agents || []).join('、') || '—'}</div></div>
  </div>
  
  <div class="section">
    <h2>执行结果</h2>
    <div class="runs-list">
      ${(task.runs || []).map(run => `
        <div class="run-item ${run.status}">
          <div>
            <span class="agent">${escapeHtmlForExport(run.agentId)}</span>
            <span class="status ${run.status}">${runStatusLabel[run.status] || run.status}${run.exitCode != null ? ` (exit ${run.exitCode})` : ''}</span>
          </div>
          ${run.error ? `<div class="error">${escapeHtmlForExport(run.error)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  </div>
  
  <div class="section">
    <h2>日志摘要</h2>
    <div class="log-summary">
      <div class="stats">
        <span class="stat">总行数: ${logSummary.totalLines}</span>
        ${logSummary.errorCount > 0 ? `<span class="stat error">错误: ${logSummary.errorCount}</span>` : ''}
        ${logSummary.warnCount > 0 ? `<span class="stat warn">警告: ${logSummary.warnCount}</span>` : ''}
      </div>
      <div class="label" style="color:#64748b;font-size:13px;margin-bottom:8px;">最近日志</div>
      <div class="log-box">${escapeHtmlForExport(logSummary.lastLines) || '暂无日志'}</div>
    </div>
  </div>
</body>
</html>`;
}

function generateFullDashboardHtml(data) {
  const o = data.overview;
  const tasks = data.tasks;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Orchestra - 完整仪表板导出</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 1400px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { margin: 0 0 8px 0; font-size: 28px; }
    .header .meta { opacity: 0.8; font-size: 14px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-card .label { color: #64748b; font-size: 14px; margin-bottom: 4px; }
    .stat-card .value { font-size: 24px; font-weight: 700; color: #1e293b; }
    .section { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
    .section h2 { margin: 0 0 16px 0; font-size: 18px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
    .agents-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .agent-card { background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 3px solid #3b82f6; }
    .agent-card .name { font-weight: 600; color: #1e293b; }
    .agent-card .info { font-size: 13px; color: #64748b; margin-top: 4px; }
    .task-board { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
    .column { background: #f8fafc; padding: 16px; border-radius: 8px; }
    .column h3 { margin: 0 0 12px 0; font-size: 14px; color: #64748b; text-transform: uppercase; }
    .task-card { background: white; padding: 12px; border-radius: 6px; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .task-card .title { font-weight: 600; color: #1e293b; margin-bottom: 4px; }
    .task-card .meta { font-size: 12px; color: #64748b; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .badge.busy { background: #fef3c7; color: #92400e; }
    .badge.idle { background: #d1fae5; color: #065f46; }
    .badge.offline { background: #f1f5f9; color: #64748b; }
    .badge.completed { background: #d1fae5; color: #065f46; }
    .badge.failed { background: #fee2e2; color: #991b1b; }
    .badge.running { background: #dbeafe; color: #1e40af; }
    .badge.queued { background: #f1f5f9; color: #64748b; }
    @media print { body { background: white; } .section, .header { box-shadow: none; } }
    @media (max-width: 768px) { .task-board { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Agent Orchestra - 完整仪表板</h1>
    <div class="meta">导出时间：${new Date(data.exportedAt).toLocaleString('zh-CN')}</div>
  </div>
  
  <div class="stats-grid">
    <div class="stat-card"><div class="label">Agent 总数</div><div class="value">${o.totals.agents}</div></div>
    <div class="stat-card"><div class="label">会话数</div><div class="value">${o.totals.sessions}</div></div>
    <div class="stat-card"><div class="label">忙碌 Agent</div><div class="value">${o.totals.busyAgents}</div></div>
    <div class="stat-card"><div class="label">排队任务</div><div class="value">${o.totals.taskQueued}</div></div>
    <div class="stat-card"><div class="label">运行中</div><div class="value">${o.totals.taskRunning}</div></div>
    <div class="stat-card"><div class="label">已完成</div><div class="value">${o.totals.taskDone}</div></div>
    <div class="stat-card"><div class="label">失败</div><div class="value">${o.totals.taskFailed}</div></div>
  </div>
  
  <div class="section">
    <h2>Agent 列表 (${o.agents.length})</h2>
    <div class="agents-grid">
      ${o.agents.map(a => `
        <div class="agent-card">
          <div class="name">${escapeHtmlForExport(a.name)}</div>
          <div class="info">
            <span class="badge ${a.status}">${a.status === 'busy' ? '忙碌' : a.status === 'idle' ? '空闲' : '离线'}</span>
            · ${escapeHtmlForExport(a.model)} · ${a.sessionsCount} 会话
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  
  <div class="section">
    <h2>任务看板 (${tasks.length} 个任务)</h2>
    <div class="task-board">
      <div class="column">
        <h3>待执行 (${tasks.filter(t => t.status === 'queued').length})</h3>
        ${tasks.filter(t => t.status === 'queued').map(t => `
          <div class="task-card">
            <div class="title">${escapeHtmlForExport(t.title)}</div>
            <div class="meta">${escapeHtmlForExport(t.agents?.join(', ') || '')}</div>
          </div>
        `).join('')}
      </div>
      <div class="column">
        <h3>执行中 (${tasks.filter(t => t.status === 'running').length})</h3>
        ${tasks.filter(t => t.status === 'running').map(t => `
          <div class="task-card">
            <div class="title">${escapeHtmlForExport(t.title)}</div>
            <div class="meta">${escapeHtmlForExport(t.agents?.join(', ') || '')}</div>
          </div>
        `).join('')}
      </div>
      <div class="column">
        <h3>已完成 (${tasks.filter(t => t.status === 'completed').length})</h3>
        ${tasks.filter(t => t.status === 'completed').map(t => `
          <div class="task-card">
            <div class="title">${escapeHtmlForExport(t.title)}</div>
            <div class="meta">${escapeHtmlForExport(t.agents?.join(', ') || '')}</div>
          </div>
        `).join('')}
      </div>
      <div class="column">
        <h3>失败 (${tasks.filter(t => t.status === 'failed').length})</h3>
        ${tasks.filter(t => t.status === 'failed').map(t => `
          <div class="task-card">
            <div class="title">${escapeHtmlForExport(t.title)}</div>
            <div class="meta">${escapeHtmlForExport(t.agents?.join(', ') || '')}</div>
          </div>
        `).join('')}
      </div>
      <div class="column">
        <h3>已取消 (${tasks.filter(t => t.status === 'canceled').length})</h3>
        ${tasks.filter(t => t.status === 'canceled').map(t => `
          <div class="task-card">
            <div class="title">${escapeHtmlForExport(t.title)}</div>
            <div class="meta">${escapeHtmlForExport(t.agents?.join(', ') || '')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>
</body>
</html>`;
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

  const createBackupData = async (mode = 'full') => {
    const now = Date.now();
    const users = await loadUsers();
    const tasks = await readTasks();
    const templates = await readTemplates();
    const agentGroups = await readAgentGroups();
    const sharedPresets = await readSharedPresets();
    const allUserPresets = JSON.parse(await fsp.readFile(USER_PRESETS_FILE, 'utf8'));
    const allUserTemplates = JSON.parse(await fsp.readFile(USER_TEMPLATES_FILE, 'utf8'));
    const workflows = await loadWorkflows();
    const workflowRuns = await readWorkflowRuns();
    const auditEvents = await queryAuditEvents({});

    let dataToBackup;
    if (mode === 'incremental') {
      const recentTasks = tasks.filter(t => !t.id.startsWith('temp-') && t.createdAt > now - 7 * 24 * 60 * 60 * 1000);
      const recentAuditEvents = auditEvents.filter(e => e.timestamp > now - 7 * 24 * 60 * 60 * 1000);
      dataToBackup = {
        users: users.map(u => ({ id: u.id, name: u.name, role: u.role, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt })),
        tokens: {},
        tasks: recentTasks,
        templates,
        'agent-groups': agentGroups,
        'shared-presets': sharedPresets,
        'user-presets': allUserPresets,
        'user-templates': allUserTemplates,
        workflows,
        'workflow-runs': workflowRuns,
        'audit-events': recentAuditEvents
      };
    } else {
      dataToBackup = {
        users: users.map(u => ({ id: u.id, name: u.name, role: u.role, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt })),
        tokens: {},
        tasks: tasks.filter(t => !t.id.startsWith('temp-')),
        templates,
        'agent-groups': agentGroups,
        'shared-presets': sharedPresets,
        'user-presets': allUserPresets,
        'user-templates': allUserTemplates,
        workflows,
        'workflow-runs': workflowRuns,
        'audit-events': auditEvents
      };
    }

    return {
      version: '1.0',
      backupAt: now,
      backupMode: mode,
      data: dataToBackup
    };
  };

  scheduledBackup.setBackupCreateFunction(createBackupData);
  scheduledBackup.setCloudUploadFunction(cloudStorage.uploadFile);
  scheduledBackup.setCloudDeleteFunction(cloudStorage.deleteFile);
  scheduledBackup.setCloudListFunction(cloudStorage.listFiles);
  scheduledBackup.setCloudGetConfigFunction(cloudStorage.getCloudConfig);
  await scheduledBackup.init();
  console.log('Scheduled backup initialized');

  startWorkloadAlertScheduler();
  const workloadConfig = await getWorkloadAlertsConfig();
  if (workloadConfig.enabled) {
    console.log('Workload alert scheduler started (enabled)');
  }

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

function getFeishuConfig() {
  const configPath = path.join(DATA_DIR, 'feishu-config.json');
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    return null;
  }
}

async function getFeishuAccessToken(config) {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret
    })
  });
  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`获取飞书 access_token 失败: ${data.msg}`);
  }
  return data.tenant_access_token;
}

async function uploadFeishuImage(config, accessToken, imageBase64, imageType = 'png') {
  const buffer = Buffer.from(imageBase64, 'base64');
  const formData = new FormData();
  formData.append('image_type', 'message');
  formData.append('image', new Blob([buffer], `image/${imageType}`), `screenshot.${imageType}`);

  const response = await fetch('https://open.feishu.cn/open-apis/im/v1/images', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: formData
  });
  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`上传图片到飞书失败: ${data.msg}`);
  }
  return data.data.image_key;
}

async function sendFeishuImageMessage(config, channelId, imageBase64, title) {
  const accessToken = await getFeishuAccessToken(config);
  const imageKey = await uploadFeishuImage(config, accessToken, imageBase64);

  const receiveIdType = channelId.startsWith('oc_') ? 'open_id' : 'chat_id';
  const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      receive_id: channelId,
      receive_id_type: receiveIdType,
      msg_type: 'image',
      content: JSON.stringify({ image_key: imageKey })
    })
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`发送飞书消息失败: ${data.msg}`);
  }
  return data.data;
}

// ==================== DingTalk Sharing Functions ====================

function getDingTalkConfig() {
  const configPath = path.join(DATA_DIR, 'dingtalk-config.json');
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    return null;
  }
}

async function saveDingTalkConfig(config) {
  const configPath = path.join(DATA_DIR, 'dingtalk-config.json');
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  return config;
}

async function getDingTalkAccessToken(config) {
  const response = await fetch(`https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(config.appKey)}&appsecret=${encodeURIComponent(config.appSecret)}`);
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`获取钉钉 access_token 失败：${data.errmsg}`);
  }
  return data.access_token;
}

async function uploadDingTalkImage(accessToken, imageBase64, imageType = 'png') {
  const buffer = Buffer.from(imageBase64, 'base64');
  const formData = new FormData();
  formData.append('media', new Blob([buffer], `image/${imageType}`), `screenshot.${imageType}`);
  formData.append('type', 'image');

  const response = await fetch('https://oapi.dingtalk.com/media/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: formData
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`上传图片到钉钉失败：${data.errmsg}`);
  }
  return data.media_id;
}

async function sendDingTalkImageMessage(webhook, imageBase64, title) {
  const imageType = 'png';
  const buffer = Buffer.from(imageBase64, 'base64');
  const formData = new FormData();
  formData.append('media', new Blob([buffer], `image/${imageType}`), `screenshot.${imageType}`);
  formData.append('type', 'image');

  const uploadResponse = await fetch('https://oapi.dingtalk.com/media/upload', {
    method: 'POST',
    body: formData
  });
  const uploadData = await uploadResponse.json();
  if (uploadData.errcode !== 0) {
    throw new Error(`上传图片到钉钉失败：${uploadData.errmsg}`);
  }
  const mediaId = uploadData.media_id;

  const messagePayload = {
    msgtype: 'markdown',
    markdown: {
      title: title || 'Agent Orchestra 面板截图',
      text: `![screenshot](@${mediaId})\n\n**${title || 'Agent Orchestra 面板截图'}**`
    }
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(messagePayload)
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`发送钉钉消息失败：${data.errmsg}`);
  }
  return { messageId: mediaId };
}

// ==================== WeChat Work Sharing Functions ====================

function getWecomConfig() {
  const configPath = path.join(DATA_DIR, 'wecom-config.json');
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    return null;
  }
}

async function saveWecomConfig(config) {
  const configPath = path.join(DATA_DIR, 'wecom-config.json');
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  return config;
}

async function getWecomAccessToken(config) {
  const response = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(config.corpId)}&corpsecret=${encodeURIComponent(config.secret)}`);
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`获取企业微信 access_token 失败：${data.errmsg}`);
  }
  return data.access_token;
}

async function uploadWecomImage(accessToken, imageBase64, imageType = 'png') {
  const buffer = Buffer.from(imageBase64, 'base64');
  const formData = new FormData();
  formData.append('media', new Blob([buffer], `image/${imageType}`), `screenshot.${imageType}`);

  const response = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${accessToken}&type=image`, {
    method: 'POST',
    body: formData
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`上传图片到企业微信失败：${data.errmsg}`);
  }
  return data.media_id;
}

async function sendWecomImageMessage(webhook, imageBase64, title) {
  const imageType = 'png';
  const buffer = Buffer.from(imageBase64, 'base64');
  const formData = new FormData();
  formData.append('media', new Blob([buffer], `image/${imageType}`), `screenshot.${imageType}`);

  const uploadResponse = await fetch(`${webhook}&type=image`, {
    method: 'POST',
    body: formData
  });
  const uploadData = await uploadResponse.json();
  if (uploadData.errcode !== 0) {
    throw new Error(`上传图片到企业微信失败：${uploadData.errmsg}`);
  }
  const mediaId = uploadData.media_id;

  const messagePayload = {
    msgtype: 'image',
    image: {
      media_id: mediaId
    }
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(messagePayload)
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`发送企业微信消息失败：${data.errmsg}`);
  }
  return { messageId: mediaId };
}

// ==================== Slack Sharing Functions ====================

function getSlackConfig() {
  const configPath = path.join(DATA_DIR, 'slack-config.json');
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    return null;
  }
}

async function saveSlackConfig(config) {
  const configPath = path.join(DATA_DIR, 'slack-config.json');
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  return config;
}

async function sendSlackImageMessage(config, channelId, imageBase64, title) {
  const buffer = Buffer.from(imageBase64, 'base64');
  const formData = new FormData();
  formData.append('file', new Blob([buffer], 'image/png'), 'screenshot.png');
  formData.append('channels', channelId);
  formData.append('title', title || 'Agent Orchestra 面板截图');

  const uploadResponse = await fetch('https://slack.com/api/files.upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.botToken}`
    },
    body: formData
  });
  const uploadData = await uploadResponse.json();
  if (!uploadData.ok) {
    throw new Error(`上传图片到 Slack 失败：${uploadData.error}`);
  }

  return { messageId: uploadData.file?.id || 'uploaded' };
}

async function sendFeishuTextMessage(config, channelId, text) {
  const accessToken = await getFeishuAccessToken(config);
  const receiveIdType = channelId.startsWith('oc_') ? 'open_id' : 'chat_id';
  
  const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      receive_id: channelId,
      receive_id_type: receiveIdType,
      msg_type: 'text',
      content: JSON.stringify({ text })
    })
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`发送飞书文本消息失败: ${data.msg}`);
  }
  return data.data;
}

async function sendDingTalkTextMessage(webhook, text) {
  const messagePayload = {
    msgtype: 'text',
    text: { content: text }
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(messagePayload)
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`发送钉钉文本消息失败: ${data.errmsg}`);
  }
  return { messageId: data.errcode };
}

async function sendWecomTextMessage(webhook, text) {
  const messagePayload = {
    msgtype: 'text',
    text: { content: text }
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(messagePayload)
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`发送企业微信文本消息失败: ${data.errmsg}`);
  }
  return { messageId: data.msgid };
}

async function sendSlackTextMessage(config, channelId, text) {
  const payload = {
    channel: channelId,
    text: text
  };

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.botToken}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(`发送 Slack 文本消息失败: ${data.error}`);
  }
  return { messageId: data.ts };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function handleScheduledBackupNotification(params) {
  const { success, type, fileName, fileSize, duration, error, channels } = params;
  const modeText = type === 'incremental' ? '增量备份' : '完整备份';
  const statusText = success ? '成功' : '失败';
  const timeText = new Date().toLocaleString('zh-CN');
  
  let message = `📦 Agent Orchestra 定时备份通知\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `⏰ 时间: ${timeText}\n`;
  message += `📋 类型: ${modeText}\n`;
  message += `📊 状态: ${statusText}\n`;
  
  if (success) {
    message += `📁 文件: ${fileName}\n`;
    message += `💾 大小: ${formatBytes(fileSize)}\n`;
    if (duration) {
      message += `⏱️ 耗时: ${(duration / 1000).toFixed(1)}秒\n`;
    }
  } else {
    message += `❌ 错误: ${error}\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━`;

  const results = { sent: [], failed: [] };
  const channelsList = await notificationChannels.getChannels();
  
  for (const channelId of channels) {
    const channel = channelsList.find(c => c.id === channelId || c.type === channelId);
    try {
      await notificationChannels.sendToChannel(channelId, message);
      await notificationHistory.recordNotification({
        channelId: channel?.id || channelId,
        channelName: channel?.name || channelId,
        channelType: channel?.type || 'unknown',
        message: message,
        status: 'sent'
      });
      await addAuditEvent('notification.sent', {
        channelId: channel?.id,
        channelName: channel?.name,
        channelType: channel?.type,
        source: 'scheduled_backup',
        backupType: type
      }, 'system');
      results.sent.push(channelId);
    } catch (err) {
      console.error(`[ScheduledBackup] 发送通知到渠道 ${channelId} 失败:`, err.message);
      await notificationHistory.recordNotification({
        channelId: channel?.id || channelId,
        channelName: channel?.name || channelId,
        channelType: channel?.type || 'unknown',
        message: message,
        status: 'failed',
        error: err.message
      });
      await addAuditEvent('notification.failed', {
        channelId: channel?.id,
        channelName: channel?.name,
        channelType: channel?.type,
        source: 'scheduled_backup',
        backupType: type,
        error: err.message
      }, 'system');
      results.failed.push({ channel: channelId, error: err.message });
    }
  }

  await addAuditEvent('scheduled_backup.notified', {
    success,
    channels: results.sent,
    failed: results.failed,
    backupType: type,
    fileName,
    fileSize,
    error
  }, 'system');

  return results;
}

scheduledBackup.setNotificationFunction(handleScheduledBackupNotification);

const WORKLOAD_ALERTS_CONFIG_FILE = path.join(DATA_DIR, 'workload-alerts-config.json');
const WORKLOAD_ALERTS_STATE_FILE = path.join(DATA_DIR, 'workload-alerts-state.json');
let workloadAlertTimer = null;
let nextWorkloadCheckTime = null;

const DEFAULT_WORKLOAD_CONFIG = {
  enabled: false,
  threshold: 5,
  warningThreshold: 0.8,
  criticalThreshold: 1.0,
  notifyChannels: [],
  messageTemplate: {
    warning: '🚨 [{level}] Agent 负载预警\n━━━━━━━━━━━━━━━━━━━━\n⏰ 时间: {time}\n📊 阈值: {threshold}\n⚠️ 级别: {level}\n⚠️ Agent: {agentName}\n📈 负载: {workload} 个任务 ({percentage}%)\n━━━━━━━━━━━━━━━━━━━━',
    critical: '🚨 [{level}] Agent 负载告警\n━━━━━━━━━━━━━━━━━━━━\n⏰ 时间: {time}\n📊 阈值: {threshold}\n🔴 级别: {level}\n🔴 Agent: {agentName}\n📈 负载: {workload} 个任务 ({percentage}%)\n━━━━━━━━━━━━━━━━━━━━'
  },
  silencePeriodMinutes: 30
};

async function getWorkloadAlertsState() {
  await ensureData();
  try {
    const data = await fsp.readFile(WORKLOAD_ALERTS_STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveWorkloadAlertsState(state) {
  await ensureData();
  await fsp.writeFile(WORKLOAD_ALERTS_STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

async function shouldSendAlert(agentId, level, silencePeriodMinutes) {
  const state = await getWorkloadAlertsState();
  const key = `${agentId}:${level}`;
  const lastAlert = state[key];
  
  if (!lastAlert) {
    return true;
  }
  
  const silenceMs = silencePeriodMinutes * 60 * 1000;
  const elapsed = Date.now() - lastAlert;
  
  return elapsed >= silenceMs;
}

async function recordAlertSent(agentId, level) {
  const state = await getWorkloadAlertsState();
  const key = `${agentId}:${level}`;
  state[key] = Date.now();
  await saveWorkloadAlertsState(state);
}

async function getWorkloadAlertsConfig() {
  await ensureData();
  try {
    const data = await fsp.readFile(WORKLOAD_ALERTS_CONFIG_FILE, 'utf8');
    const config = JSON.parse(data);
    return {
      ...DEFAULT_WORKLOAD_CONFIG,
      ...config
    };
  } catch {
    return { ...DEFAULT_WORKLOAD_CONFIG };
  }
}

async function saveWorkloadAlertsConfig(updates) {
  await ensureData();
  const current = await getWorkloadAlertsConfig();
  const config = {
    ...current,
    ...updates
  };
  await fsp.writeFile(WORKLOAD_ALERTS_CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
  return config;
}

async function getAgentWorkload() {
  const tasks = await readTasks();
  const agentWorkloadMap = new Map();
  
  for (const task of tasks) {
    if (task.status !== 'running' && task.status !== 'queued') continue;
    const runs = task.runs || [];
    for (const run of runs) {
      if (!run.agentId) continue;
      if (run.status !== 'running' && run.status !== 'queued') continue;
      const current = agentWorkloadMap.get(run.agentId) || { agentId: run.agentId, workloadCount: 0 };
      current.workloadCount += 1;
      agentWorkloadMap.set(run.agentId, current);
    }
  }
  
  return Array.from(agentWorkloadMap.values());
}

async function performWorkloadCheck() {
  const config = await getWorkloadAlertsConfig();
  const agentWorkloads = await getAgentWorkload();
  const agentsList = await listAgents();
  const agentNameMap = new Map(agentsList.map(a => [a.id, a.identity || a.id]));
  
  for (const workload of agentWorkloads) {
    workload.agentName = agentNameMap.get(workload.agentId) || workload.agentId;
  }
  
  const warningThresholdValue = config.threshold * (config.warningThreshold || 0.8);
  const criticalThresholdValue = config.threshold * (config.criticalThreshold || 1.0);
  const silencePeriod = config.silencePeriodMinutes || 30;
  
  const warningAgents = agentWorkloads.filter(a => a.workloadCount >= warningThresholdValue && a.workloadCount < criticalThresholdValue);
  const criticalAgents = agentWorkloads.filter(a => a.workloadCount >= criticalThresholdValue);
  const triggeredAt = Date.now();
  
  for (const agent of agentWorkloads) {
    agent.warningLevel = 'normal';
    if (agent.workloadCount >= criticalThresholdValue) {
      agent.warningLevel = 'critical';
    } else if (agent.workloadCount >= warningThresholdValue) {
      agent.warningLevel = 'warning';
    }
    agent.percentage = Math.round((agent.workloadCount / config.threshold) * 100);
  }
  
  const result = {
    checkedAt: triggeredAt,
    threshold: config.threshold,
    warningThreshold: warningThresholdValue,
    criticalThreshold: criticalThresholdValue,
    totalAgents: agentWorkloads.length,
    warningAgents,
    criticalAgents,
    notified: false,
    notifications: []
  };
  
  if (config.enabled && config.notifyChannels.length > 0) {
    const sentAlerts = [];
    
    for (const agent of [...criticalAgents, ...warningAgents]) {
      const level = agent.warningLevel;
      const shouldSend = await shouldSendAlert(agent.agentId, level, silencePeriod);
      
      if (shouldSend) {
        const notifyResult = await sendWorkloadAlertNotification([agent], config.threshold, level);
        await recordAlertSent(agent.agentId, level);
        
        sentAlerts.push({
          agentId: agent.agentId,
          agentName: agent.agentName,
          level,
          workloadCount: agent.workloadCount,
          notifyResult
        });
        
        result.notifications.push(notifyResult);
        result.notified = true;
      }
    }
    
    if (sentAlerts.length > 0) {
      await addAuditEvent('workload_alert.triggered', {
        agents: sentAlerts.map(a => ({
          agentId: a.agentId,
          agentName: a.agentName,
          workloadCount: a.workloadCount,
          level: a.level
        })),
        threshold: config.threshold,
        warningThreshold: warningThresholdValue,
        criticalThreshold: criticalThresholdValue,
        notifyChannels: config.notifyChannels,
        notified: sentAlerts.some(a => a.notifyResult.sent.length > 0),
        notifyResults: sentAlerts.map(a => a.notifyResult),
        silencePeriodMinutes: silencePeriod
      }, 'system');
    }
  }
  
  return result;
}

function renderMessageTemplate(template, data) {
  return template
    .replace(/{agentName}/g, data.agentName)
    .replace(/{workload}/g, data.workload)
    .replace(/{threshold}/g, data.threshold)
    .replace(/{level}/g, data.level)
    .replace(/{time}/g, data.time)
    .replace(/{percentage}/g, data.percentage);
}

async function sendWorkloadAlertNotification(agents, threshold, level = 'warning') {
  const config = await getWorkloadAlertsConfig();
  const timeText = new Date().toLocaleString('zh-CN');
  
  const template = config.messageTemplate?.[level] || config.messageTemplate?.warning || 
    `🚨 [{level}] Agent 负载预警\nAgent: {agentName}\n负载: {workload} 个任务 ({percentage}%)\n阈值: {threshold}`;
  
  const messages = [];
  for (const agent of agents) {
    const percentage = Math.round((agent.workloadCount / threshold) * 100);
    const message = renderMessageTemplate(template, {
      agentName: agent.agentName,
      workload: agent.workloadCount,
      threshold: threshold,
      level: level === 'critical' ? '严重' : '警告',
      time: timeText,
      percentage: percentage
    });
    messages.push(message);
  }
  
  const combinedMessage = messages.join('\n\n');
  
  const results = { sent: [], failed: [], level, agentCount: agents.length };
  const channelsList = await notificationChannels.getChannels();
  
  for (const channelId of config.notifyChannels) {
    const channel = channelsList.find(c => c.id === channelId || c.type === channelId);
    try {
      await notificationChannels.sendToChannel(channelId, combinedMessage);
      await notificationHistory.recordNotification({
        channelId: channel?.id || channelId,
        channelName: channel?.name || channelId,
        channelType: channel?.type || 'unknown',
        message: combinedMessage,
        status: 'sent'
      });
      await addAuditEvent('notification.sent', {
        channelId: channel?.id,
        channelName: channel?.name,
        channelType: channel?.type,
        source: 'workload_alert',
        level
      }, 'system');
      results.sent.push(channelId);
    } catch (err) {
      console.error(`[WorkloadAlert] 发送通知到渠道 ${channelId} 失败:`, err.message);
      await notificationHistory.recordNotification({
        channelId: channel?.id || channelId,
        channelName: channel?.name || channelId,
        channelType: channel?.type || 'unknown',
        message: combinedMessage,
        status: 'failed',
        error: err.message
      });
      await addAuditEvent('notification.failed', {
        channelId: channel?.id,
        channelName: channel?.name,
        channelType: channel?.type,
        source: 'workload_alert',
        level,
        error: err.message
      }, 'system');
      results.failed.push({ channel: channelId, error: err.message });
    }
  }
  
  return results;
}

function startWorkloadAlertScheduler() {
  if (workloadAlertTimer) {
    clearTimeout(workloadAlertTimer);
    workloadAlertTimer = null;
  }
  
  scheduleNextWorkloadCheck();
}

function scheduleNextWorkloadCheck() {
  const INTERVAL_MS = 5 * 60 * 1000;
  nextWorkloadCheckTime = Date.now() + INTERVAL_MS;
  
  workloadAlertTimer = setTimeout(async () => {
    const config = await getWorkloadAlertsConfig();
    if (config.enabled) {
      try {
        await performWorkloadCheck();
      } catch (err) {
        console.error('[WorkloadAlert] 自动检查失败:', err.message);
      }
    }
    scheduleNextWorkloadCheck();
  }, INTERVAL_MS);
}

function getWorkloadAlertStatus() {
  return {
    nextCheckTime: nextWorkloadCheckTime,
    isRunning: workloadAlertTimer !== null
  };
}
