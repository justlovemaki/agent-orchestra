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

const PORT = process.env.PORT || 3210;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const RUNTIME_FILE = path.join(DATA_DIR, 'runtime.json');
const AGENT_GROUPS_FILE = path.join(DATA_DIR, 'agent-groups.json');
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
  try { await fsp.access(TEMPLATES_FILE); } catch { await fsp.writeFile(TEMPLATES_FILE, '[]\n'); }
  try { await fsp.access(AGENT_GROUPS_FILE); } catch { await fsp.writeFile(AGENT_GROUPS_FILE, '[]\n'); }
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
