const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { execFile, spawn } = require('child_process');
const url = require('url');
const crypto = require('crypto');
const { filterTasks, parseTaskFilters } = require('./lib/task-filters');
const { loadWorkflows, createWorkflow, getWorkflow, updateWorkflow, deleteWorkflow } = require('./lib/workflows');
const { overviewCache } = require('./lib/cache');
const { runWorkflow, getWorkflowRun, getWorkflowRuns, loadWorkflowRuns } = require('./lib/workflow-runner');
const { addAuditEvent, queryAuditEvents, getAuditEventTypes } = require('./lib/audit');
const agentCombinations = require('./lib/agent-combinations');
const combinationRecommendations = require('./lib/combination-recommendations');
const { register, login, logout, verifyToken, getCurrentUser, getUsers, getUserRole, isAdmin, setRole, setUserGroupId, getUserById, getUserPermissions, loadUsers, loadTokens } = require('./lib/users');
const userGroups = require('./lib/user-groups');
const scheduledBackup = require('./lib/scheduled-backup');
const taskCompletionConfig = require('./lib/task-completion-config');
const taskCompletionNotifier = require('./lib/task-completion-notifier');
const workflowCompletionConfig = require('./lib/workflow-completion-config');
const workflowCompletionNotifier = require('./lib/workflow-completion-notifier');
const workflowRecommendations = require('./lib/workflow-recommendations');
const scheduledBackupConfig = require('./lib/scheduled-backup-config');
const scheduledBackupNotifier = require('./lib/scheduled-backup-notifier');
const cloudStorage = require('./lib/cloud-storage');
const notificationChannels = require('./lib/notification-channels');
const notificationHistory = require('./lib/notification-history');
const notificationTemplates = require('./lib/notification-templates');
const channelHealthCheck = require('./lib/channel-health-check');
const quietHours = require('./lib/quiet-hours');
const apiDocs = require('./lib/api-docs');
const notificationSenders = require('./lib/notification-senders');
const { createValidationMiddleware } = require('./lib/api-validation');
const { createPluginSystem } = require('./lib/plugin-system');
const { getFeishuConfig, sendFeishuImageMessage, getDingTalkConfig, sendDingTalkImageMessage, getWecomConfig, sendWecomImageMessage, getSlackConfig, sendSlackImageMessage } = notificationSenders;

const tasksRoutes = require('./routes/tasks');
const templatesRoutes = require('./routes/templates');
const workflowsRoutes = require('./routes/workflows');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const sessionsRoutes = require('./routes/sessions');
const presetsRoutes = require('./routes/presets');
const agentGroupsRoutes = require('./routes/agent-groups');
const agentCombinationsRoutes = require('./routes/agent-combinations');
const auditRoutes = require('./routes/audit');
const exportRoutes = require('./routes/export');
const healthRoutes = require('./routes/health');
const pluginsRoutes = require('./routes/plugins');

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
const PLUGINS_DIR = path.join(ROOT, 'plugins');
const OVERVIEW_CACHE_TTL_MS = 8000;

const sseClients = new Map();
let taskWatcherInterval = null;

const requestHandlers = [];
const serverWithEvents = {
  on: (event, handler) => {
    if (event === 'request') {
      requestHandlers.push(handler);
    }
  }
};

// 使用 lib/cache 中的 overviewCache 实例
let overviewCacheInFlight = null;

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
  
  // 使用新的缓存模块
  if (!force) {
    const cached = overviewCache.get('overview');
    if (cached) return cached;
  }
  
  if (!force && overviewCacheInFlight) {
    return overviewCacheInFlight;
  }

  overviewCacheInFlight = buildOverviewFresh()
    .then(data => {
      overviewCache.set('overview', data, OVERVIEW_CACHE_TTL_MS);
      return data;
    })
    .finally(() => {
      overviewCacheInFlight = null;
    });

  return overviewCacheInFlight;
}

function invalidateOverviewCache() {
  overviewCache.delete('overview');
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

  // API Documentation routes
  if (pathname === '/api-docs' || pathname === '/api-docs/' || pathname === '/api/docs/openapi.json') {
    if (apiDocs.handleApiDocsRequest(pathname, req, res, currentPort)) return;
  }

  if (pathname.startsWith('/api/')) {
    try {
      for (const handler of requestHandlers) {
        await handler(req, res);
        if (res.writableEnded) return;
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
    const workflowRuns = await loadWorkflowRuns();
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

  await channelHealthCheck.init();
  const healthConfig = await channelHealthCheck.getConfig();
  if (healthConfig.enabled) {
    console.log(`Channel health check started (interval: ${healthConfig.intervalMinutes}min)`);
  }

  const pluginSystem = createPluginSystem(PLUGINS_DIR);
  const pluginLoadResults = await pluginSystem.initialize(DATA_DIR);
  console.log(`Plugin system initialized: ${pluginLoadResults.success.length} plugins loaded, ${pluginLoadResults.failed.length} failed`);

  const deps = {
    readTasks,
    writeTasks,
    listTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask: async function(taskId) {
      const tasks = await readTasks();
      const index = tasks.findIndex(t => t.id === taskId);
      if (index === -1) throw new Error('任务不存在');
      tasks.splice(index, 1);
      await writeTasks(tasks);
      invalidateOverviewCache();
    },
    runTask: async function(taskId) {
      const task = await getTask(taskId);
      if (!task) throw new Error('任务不存在');
      return await updateTask(taskId, t => ({
        ...t,
        status: 'queued',
        runs: [...(t.runs || []), { startedAt: Date.now(), status: 'queued' }]
      }));
    },
    cancelTask,
    pauseTask,
    resumeTask,
    readLog,
    readTemplates,
    writeTemplates,
    readAgentGroups,
    writeAgentGroups,
    readSharedPresets,
    writeSharedPresets,
    readUserPresets,
    writeUserPresets,
    readUserTemplates,
    readAgentCombinations: async () => agentCombinations.getAgentCombinations(),
    writeAgentCombinations: async (combinations) => agentCombinations.overwriteAgentCombinations(combinations),
    json,
    readJson,
    readBody,
    verifyTokenFromRequest,
    parseTaskFilters,
    filterTasks,
    formatTaskForUi,
    buildOverview,
    invalidateOverviewCache,
    readRuntime,
    addAuditEvent,
    normalizeAgents,
    DATA_DIR,
    ROOT,
    PUBLIC_DIR,
    LOG_DIR,
    fsp,
    fs,
    path,
    crypto,
    execFile,
    spawn,
    url,
    getFeishuConfig,
    sendFeishuImageMessage,
    getDingTalkConfig,
    sendDingTalkImageMessage,
    getWecomConfig,
    sendWecomImageMessage,
    getSlackConfig,
    sendSlackImageMessage,
    generateSnapshotHtml,
    generateTaskReportHtml,
    generateFullDashboardHtml,
    generateLogSummary,
    agentCombinations,
    combinationRecommendations,
    loadWorkflows,
    createWorkflow,
    getWorkflow,
    updateWorkflow,
    deleteWorkflow,
    runWorkflow,
    getWorkflowRun,
    getWorkflowRuns,
    userGroups,
    scheduledBackup,
    taskCompletionConfig,
    taskCompletionNotifier,
    workflowCompletionConfig,
    workflowCompletionNotifier,
    scheduledBackupConfig,
    scheduledBackupNotifier,
    cloudStorage,
    notificationChannels,
    notificationHistory,
    notificationTemplates,
    channelHealthCheck,
    quietHours,
    apiDocs,
    apiValidation: createValidationMiddleware(currentPort),
    workflowRecommendations,
    verifyToken,
    register,
    login,
    logout,
    getCurrentUser,
    getUsers,
    getUserRole,
    isAdmin,
    setRole,
    setUserGroupId,
    getUserById,
    getUserPermissions,
    loadUsers,
    loadTokens,
    currentPort,
    HOME: process.env.HOME,
    createBackupData,
    performRestore: async function(data, mode) {
      throw new Error('Restore functionality not yet implemented');
    },
    pluginSystem
  };

  tasksRoutes(serverWithEvents, deps);
  templatesRoutes(serverWithEvents, deps);
  workflowsRoutes(serverWithEvents, deps);
  authRoutes(serverWithEvents, deps);
  adminRoutes(serverWithEvents, deps);
  sessionsRoutes(serverWithEvents, deps);
  presetsRoutes(serverWithEvents, deps);
  agentGroupsRoutes(serverWithEvents, deps);
  agentCombinationsRoutes(serverWithEvents, deps);
  auditRoutes(serverWithEvents, deps);
  exportRoutes.register(serverWithEvents, deps);
  healthRoutes(serverWithEvents, deps);
  pluginsRoutes(serverWithEvents, deps);

  console.log(`Registered ${requestHandlers.length} route handlers`);

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
    // Start periodic channel health check if enabled
    channelHealthCheck.getConfig().then(healthConfig => {
      if (healthConfig.enabled) {
        channelHealthCheck.startPeriodicCheck(healthConfig.intervalMinutes);
        console.log(`Channel health check started (interval: ${healthConfig.intervalMinutes}min)`);
      }
    }).catch(() => {});
  });
}).catch(async (error) => {
  console.error(error);
  try {
    await updateRuntimeStatus('stopped');
    await removePidFile();
  } catch {}
  process.exit(1);
});

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
    message += `💾 大小: ${notificationSenders.formatBytes(fileSize)}\n`;
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
