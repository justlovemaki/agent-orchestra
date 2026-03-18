const state = {
  overview: null,
  tasks: [],
  selectedTaskId: null,
  selectedTaskIds: new Set(),
  runtime: null,
  filters: {},
  savedPresets: [],
  sharedPresets: [],
  templates: [],
  editingTemplateId: null,
  groups: [],
  editingGroupId: null,
  selectedAgentId: null,
  groupFilter: '',
  workflows: [],
  editingWorkflowId: null,
  selectedWorkflowRunId: null,
  runningWorkflowId: null,
  logEventSource: null,
  logStreamActive: false,
  sessions: [],
  selectedSessionKey: null,
  auditEvents: [],
  auditFilters: {},
  currentUser: null,
  authToken: localStorage.getItem('authToken')
};

const AUTH_TOKEN_KEY = 'authToken';

const statsEl = document.getElementById('stats');
const agentsGridEl = document.getElementById('agentsGrid');
const systemInfoEl = document.getElementById('systemInfo');
const taskBoardEl = document.getElementById('taskBoard');
const agentCheckboxesEl = document.getElementById('agentCheckboxes');
const form = document.getElementById('taskForm');
const formMsg = document.getElementById('formMsg');
const refreshBtn = document.getElementById('refreshBtn');
const lastUpdatedEl = document.getElementById('lastUpdated');
const logEmptyEl = document.getElementById('logEmpty');
const detailBodyEl = document.getElementById('detailBody');
const taskMetaEl = document.getElementById('taskMeta');
const logBoxEl = document.getElementById('logBox');
const retryBtn = document.getElementById('retryBtn');
const cancelBtn = document.getElementById('cancelBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const filterKeywordEl = document.getElementById('filterKeyword');
const filterStatusEl = document.getElementById('filterStatus');
const filterAgentEl = document.getElementById('filterAgent');
const filterPriorityEl = document.getElementById('filterPriority');
const filterModeEl = document.getElementById('filterMode');
const filterTimeFromEl = document.getElementById('filterTimeFrom');
const filterTimeToEl = document.getElementById('filterTimeTo');
const applyFilterBtn = document.getElementById('applyFilterBtn');
const clearFilterBtn = document.getElementById('clearFilterBtn');
const filterResultCountEl = document.getElementById('filterResultCount');
const filterChipsEl = document.getElementById('filterChips');
const defaultPresetChipsEl = document.getElementById('defaultPresetChips');
const savedPresetListEl = document.getElementById('savedPresetList');
const sharedPresetListEl = document.getElementById('sharedPresetList');
const presetNameInputEl = document.getElementById('presetNameInput');
const savePresetBtn = document.getElementById('savePresetBtn');
const presetShareCheckEl = document.getElementById('presetShareCheck');
const batchToolbarEl = document.getElementById('batchToolbar');
const selectedCountEl = document.getElementById('selectedCount');
const batchPrioritySelect = document.getElementById('batchPrioritySelect');
const batchRetryBtn = document.getElementById('batchRetryBtn');
const batchCancelBtn = document.getElementById('batchCancelBtn');
const batchClearBtn = document.getElementById('batchClearBtn');

const showTemplateFormBtn = document.getElementById('showTemplateFormBtn');
const templateForm = document.getElementById('templateForm');
const templateNameInput = document.getElementById('templateNameInput');
const templateDescInput = document.getElementById('templateDescInput');
const templateAgentCheckboxesEl = document.getElementById('templateAgentCheckboxes');
const templatePriorityInput = document.getElementById('templatePriorityInput');
const templateModeInput = document.getElementById('templateModeInput');
const templateContentInput = document.getElementById('templateContentInput');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');
const cancelTemplateBtn = document.getElementById('cancelTemplateBtn');
const templateListEl = document.getElementById('templateList');
const templateSelectEl = document.getElementById('templateSelect');

const showGroupFormBtn = document.getElementById('showGroupFormBtn');
const groupPanel = document.getElementById('groupPanel');
const hideGroupPanelBtn = document.getElementById('hideGroupPanelBtn');
const groupForm = document.getElementById('groupForm');
const groupNameInput = document.getElementById('groupNameInput');
const groupColorInput = document.getElementById('groupColorInput');
const groupDescInput = document.getElementById('groupDescInput');
const saveGroupBtn = document.getElementById('saveGroupBtn');
const cancelGroupBtn = document.getElementById('cancelGroupBtn');
const groupListEl = document.getElementById('groupList');
const filterGroupEl = document.getElementById('filterGroup');

const showSpawnFormBtn = document.getElementById('showSpawnFormBtn');
const spawnForm = document.getElementById('spawnForm');
const spawnAgentSelect = document.getElementById('spawnAgentSelect');
const spawnTaskInput = document.getElementById('spawnTaskInput');
const confirmSpawnBtn = document.getElementById('confirmSpawnBtn');
const cancelSpawnBtn = document.getElementById('cancelSpawnBtn');
const spawnMsg = document.getElementById('spawnMsg');
const sessionListEl = document.getElementById('sessionList');

const sessionMessagesModal = document.getElementById('sessionMessagesModal');
const closeSessionMessagesModal = document.getElementById('closeSessionMessagesModal');
const sessionMessagesInfo = document.getElementById('sessionMessagesInfo');
const sessionMessagesList = document.getElementById('sessionMessagesList');
const sessionMessageInput = document.getElementById('sessionMessageInput');
const sendSessionMessageBtn = document.getElementById('sendSessionMessageBtn');
const sessionMessageMsg = document.getElementById('sessionMessageMsg');

const reassignTaskModal = document.getElementById('reassignTaskModal');
const closeReassignModal = document.getElementById('closeReassignModal');
const reassignTaskInfo = document.getElementById('reassignTaskInfo');
const currentAgentsList = document.getElementById('currentAgentsList');
const reassignAgentCheckboxes = document.getElementById('reassignAgentCheckboxes');
const reassignMsg = document.getElementById('reassignMsg');
const confirmReassignBtn = document.getElementById('confirmReassignBtn');
const cancelReassignBtn = document.getElementById('cancelReassignBtn');

let reassignTaskId = null;

const auditFilterKeywordEl = document.getElementById('auditFilterKeyword');
const auditEventTypeEl = document.getElementById('auditEventType');
const auditTimeFromEl = document.getElementById('auditTimeFrom');
const auditTimeToEl = document.getElementById('auditTimeTo');
const applyAuditFilterBtn = document.getElementById('applyAuditFilterBtn');
const clearAuditFilterBtn = document.getElementById('clearAuditFilterBtn');
const auditFilterChipsEl = document.getElementById('auditFilterChips');
const auditEventsListEl = document.getElementById('auditEventsList');
const auditResultCountEl = document.getElementById('auditResultCount');

const auditDetailModal = document.getElementById('auditDetailModal');
const closeAuditDetailModal = document.getElementById('closeAuditDetailModal');
const auditDetailBodyEl = document.getElementById('auditDetailBody');

const authModal = document.getElementById('authModal');
const closeAuthModal = document.getElementById('closeAuthModal');
const authModalTitle = document.getElementById('authModalTitle');
const authNameInput = document.getElementById('authNameInput');
const authPasswordInput = document.getElementById('authPasswordInput');
const authConfirmPasswordInput = document.getElementById('authConfirmPasswordInput');
const passwordLabel = document.getElementById('passwordLabel');
const confirmPasswordLabel = document.getElementById('confirmPasswordLabel');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authSwitchBtn = document.getElementById('authSwitchBtn');
const cancelAuthBtn = document.getElementById('cancelAuthBtn');
const authMsg = document.getElementById('authMsg');
const userInfo = document.getElementById('userInfo');
const currentUserName = document.getElementById('currentUserName');
const loginBtn = document.getElementById('loginBtn');
const loginBtnContainer = document.getElementById('loginBtnContainer');
const logoutBtn = document.getElementById('logoutBtn');

const FILTER_STORAGE_KEY = 'agentOrchestraFilters';
const FILTER_PRESET_STORAGE_KEY = 'agentOrchestraFilterPresets';
const DEFAULT_PRESETS = [
  { key: 'running', name: '运行中任务', filters: { status: 'running' } },
  { key: 'high-failed', name: '高优先级失败任务', filters: { status: 'failed', priority: 'high' } },
  { key: 'today', name: '今天创建的任务', filters: { timeFrom: 'dynamic:todayStart', timeTo: 'dynamic:todayEnd' } }
];

async function fetchJson(url, options = {}) {
  const headers = { ...options.headers };
  if (state.authToken) {
    headers['Authorization'] = `Bearer ${state.authToken}`;
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

function getFilters() {
  const filters = {};
  const keyword = filterKeywordEl.value.trim();
  const status = filterStatusEl.value;
  const agent = filterAgentEl.value;
  const priority = filterPriorityEl.value;
  const mode = filterModeEl.value;
  const timeFrom = filterTimeFromEl.value;
  const timeTo = filterTimeToEl.value;

  if (keyword) filters.keyword = keyword;
  if (status) filters.status = status;
  if (agent) filters.agent = agent;
  if (priority) filters.priority = priority;
  if (mode) filters.mode = mode;
  if (timeFrom) filters.timeFrom = new Date(timeFrom).toISOString();
  if (timeTo) filters.timeTo = new Date(timeTo).toISOString();

  return filters;
}

function hasActiveFilters(filters = {}) {
  return Object.values(filters).some(value => value != null && value !== '');
}

function parseFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const filters = {};
  const keyword = params.get('keyword');
  const status = params.get('status');
  const agent = params.get('agent');
  const priority = params.get('priority');
  const mode = params.get('mode');
  const timeFrom = params.get('timeFrom');
  const timeTo = params.get('timeTo');

  if (keyword) filters.keyword = keyword;
  if (status) filters.status = status;
  if (agent) filters.agent = agent;
  if (priority) filters.priority = priority;
  if (mode) filters.mode = mode;
  if (timeFrom) filters.timeFrom = timeFrom;
  if (timeTo) filters.timeTo = timeTo;

  return filters;
}

function loadFiltersFromStorage() {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function loadPresetsFromStorage() {
  try {
    const stored = localStorage.getItem(FILTER_PRESET_STORAGE_KEY);
    const presets = stored ? JSON.parse(stored) : [];
    return Array.isArray(presets) ? presets.filter(isValidPreset) : [];
  } catch {
    return [];
  }
}

function saveFiltersToStorage(filters) {
  try {
    if (hasActiveFilters(filters)) {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } else {
      localStorage.removeItem(FILTER_STORAGE_KEY);
    }
  } catch {}
}

function savePresetsToStorage(presets) {
  try {
    if (Array.isArray(presets) && presets.length > 0) {
      localStorage.setItem(FILTER_PRESET_STORAGE_KEY, JSON.stringify(presets));
    } else {
      localStorage.removeItem(FILTER_PRESET_STORAGE_KEY);
    }
  } catch {}
}

function syncFiltersToUrl(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, value);
  });
  const query = params.toString();
  const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
}

function clearFilterUrl() {
  window.history.replaceState({}, '', window.location.pathname);
}

function normalizePresetName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
}

function isValidPreset(preset) {
  return Boolean(preset && typeof preset.name === 'string' && preset.name.trim() && preset.filters && typeof preset.filters === 'object');
}

function getTodayBounds() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function resolveDynamicPresetFilters(filters = {}) {
  const next = { ...filters };
  const today = getTodayBounds();
  if (next.timeFrom === 'dynamic:todayStart') next.timeFrom = today.start;
  if (next.timeTo === 'dynamic:todayEnd') next.timeTo = today.end;
  return next;
}

function areFiltersEqual(a = {}, b = {}) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

function getResolvedDefaultPresets() {
  return DEFAULT_PRESETS.map(preset => ({
    ...preset,
    filters: resolveDynamicPresetFilters(preset.filters)
  }));
}

function buildTaskQuery(filters = {}, force = false) {
  const params = new URLSearchParams();
  if (force) params.set('force', '1');
  Object.entries(filters).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

let authMode = 'login';

function showAuthModal(mode = 'login') {
  authMode = mode;
  authModal.classList.remove('hidden');
  authNameInput.value = '';
  authPasswordInput.value = '';
  authConfirmPasswordInput.value = '';
  authMsg.textContent = '';
  if (mode === 'login') {
    authModalTitle.textContent = '登录';
    authSubmitBtn.textContent = '登录';
    authSwitchBtn.textContent = '注册新账号';
    confirmPasswordLabel.classList.add('hidden');
  } else {
    authModalTitle.textContent = '注册';
    authSubmitBtn.textContent = '注册';
    authSwitchBtn.textContent = '已有账号？登录';
    confirmPasswordLabel.classList.remove('hidden');
  }
  authNameInput.focus();
}

function hideAuthModal() {
  authModal.classList.add('hidden');
}

function renderAuthUI() {
  if (state.currentUser) {
    userInfo.classList.remove('hidden');
    loginBtnContainer.classList.add('hidden');
    currentUserName.textContent = state.currentUser.name;
  } else {
    userInfo.classList.add('hidden');
    loginBtnContainer.classList.remove('hidden');
  }
}

async function checkAuthStatus() {
  if (!state.authToken) {
    state.currentUser = null;
    renderAuthUI();
    return;
  }
  try {
    const res = await fetchJson('/api/auth/me');
    state.currentUser = res.user;
  } catch (err) {
    state.currentUser = null;
    state.authToken = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
  renderAuthUI();
}

async function handleAuthSubmit() {
  const name = authNameInput.value.trim();
  const password = authPasswordInput.value;
  const confirmPassword = authConfirmPasswordInput.value;

  if (!name) {
    authMsg.textContent = '请输入用户名';
    return;
  }
  if (!password) {
    authMsg.textContent = '请输入密码';
    return;
  }

  authMsg.textContent = '处理中...';
  authSubmitBtn.disabled = true;

  try {
    if (authMode === 'login') {
      const res = await fetchJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ name, password })
      });
      state.authToken = res.token;
      state.currentUser = res.user;
      localStorage.setItem(AUTH_TOKEN_KEY, res.token);
      authMsg.textContent = '登录成功';
      setTimeout(() => {
        hideAuthModal();
        renderAuthUI();
      }, 500);
    } else {
      if (password.length < 4) {
        authMsg.textContent = '密码至少需要 4 个字符';
        authSubmitBtn.disabled = false;
        return;
      }
      if (password !== confirmPassword) {
        authMsg.textContent = '两次输入的密码不一致';
        authSubmitBtn.disabled = false;
        return;
      }
      const res = await fetchJson('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, password })
      });
      state.authToken = res.token;
      state.currentUser = res.user;
      localStorage.setItem(AUTH_TOKEN_KEY, res.token);
      authMsg.textContent = '注册成功';
      setTimeout(() => {
        hideAuthModal();
        renderAuthUI();
      }, 500);
    }
  } catch (err) {
    authMsg.textContent = err.message;
  } finally {
    authSubmitBtn.disabled = false;
  }
}

async function handleLogout() {
  try {
    await fetchJson('/api/auth/logout', { method: 'POST' });
  } catch {}
  state.currentUser = null;
  state.authToken = null;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  renderAuthUI();
}

loginBtn.addEventListener('click', () => showAuthModal('login'));
authSubmitBtn.addEventListener('click', () => handleAuthSubmit());
authSwitchBtn.addEventListener('click', () => {
  showAuthModal(authMode === 'login' ? 'register' : 'login');
});
cancelAuthBtn.addEventListener('click', () => hideAuthModal());
closeAuthModal.addEventListener('click', () => hideAuthModal());
logoutBtn.addEventListener('click', () => handleLogout());
authModal.querySelector('.modal-backdrop').addEventListener('click', () => hideAuthModal());

async function loadTasks(force = false) {
  const query = buildTaskQuery(state.filters, force);
  const tasksRes = await fetchJson(`/api/tasks${query}`);
  state.tasks = tasksRes.tasks;
}

async function refreshAll(force = false) {
  const [overview, runtimeRes] = await Promise.all([
    fetchJson(`/api/overview${force ? '?force=1' : ''}`),
    fetchJson('/api/runtime').catch(() => null),
    checkAuthStatus(),
    loadTasks(force),
    loadTemplates(),
    loadGroups(),
    loadSharedPresets(),
    loadWorkflows(),
    loadSessions(),
    loadAuditEvents(force)
  ]);
  state.overview = overview;
  state.runtime = runtimeRes;
  render();
  if (state.selectedTaskId && state.tasks.some(task => task.id === state.selectedTaskId)) {
    await loadTaskDetail(state.selectedTaskId);
  } else if (state.selectedTaskId) {
    state.selectedTaskId = null;
    logEmptyEl.classList.remove('hidden');
    detailBodyEl.classList.add('hidden');
  }
}

function render() {
  renderStats();
  renderAgents();
  renderSystemInfo();
  renderTaskBoard();
  renderAgentCheckboxes();
  renderFilterAgents();
  renderFilterPresets();
  renderFilterSummary();
  renderTemplates();
  renderTemplateSelect();
  renderGroupFilter();
  renderGroupList();
  renderWorkflows();
  renderSessionList();
  renderSpawnAgentSelect();
  renderAuditEvents();
  renderAuditFilterChips();
  renderAuditResultCount();
  lastUpdatedEl.textContent = `最近刷新：${new Date().toLocaleString('zh-CN')}`;
}

function renderStats() {
  const t = state.overview.totals;
  const items = [
    ['Agent 数', t.agents],
    ['会话数', t.sessions],
    ['忙碌 Agent', t.busyAgents],
    ['排队任务', t.taskQueued],
    ['运行中', t.taskRunning],
    ['完成/失败', `${t.taskDone}/${t.taskFailed}`]
  ];
  statsEl.innerHTML = items.map(([k, v]) => `<div class="stat"><div class="muted">${k}</div><div class="v">${v}</div></div>`).join('');
}

function renderAgents() {
  let agentsToShow = state.overview.agents;
  if (state.groupFilter) {
    const group = state.groups.find(g => g.id === state.groupFilter);
    if (group) {
      agentsToShow = agentsToShow.filter(agent => group.agentIds.includes(agent.id));
    }
  }
  agentsGridEl.innerHTML = agentsToShow.map(agent => {
    const agentGroups = state.groups.filter(g => g.agentIds.includes(agent.id));
    const groupTags = agentGroups.map(g => `
      <span class="group-tag" style="background:${hexToRgba(g.color, 0.2)};color:${g.color};border:1px solid ${hexToRgba(g.color, 0.4)}">
        <span class="group-tag-dot" style="background:${g.color}"></span>
        ${escapeHtml(g.name)}
      </span>
    `).join('');
    return `
      <div class="agent-card">
        <div class="agent-card-header">
          <div class="agent-info">
            <div style="font-weight:700">${escapeHtml(agent.name)}</div>
            <div class="muted small">${escapeHtml(agent.id)}</div>
          </div>
          <div class="agent-actions">
            <button class="agent-assign-group-btn" data-agent-id="${agent.id}">分组</button>
          </div>
        </div>
        ${groupTags ? `<div class="agent-groups">${groupTags}</div>` : ''}
        <span class="badge ${agent.status}" style="margin-top:8px">${labelStatus(agent.status)}</span>
        <div class="row"><span class="muted">模型</span><span>${escapeHtml(agent.model)}</span></div>
        <div class="row"><span class="muted">会话</span><span>${agent.sessionsCount}</span></div>
        <div class="row"><span class="muted">最近活跃</span><span>${escapeHtml(agent.lastActiveLabel)}</span></div>
        <div class="row"><span class="muted">最新会话</span><span class="small">${agent.latestSession ? escapeHtml(agent.latestSession.ageLabel) : '—'}</span></div>
      </div>
    `;
  }).join('');

  agentsGridEl.querySelectorAll('.agent-assign-group-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const agentId = btn.dataset.agentId;
      showGroupDropdown(btn, agentId);
    });
  });
}

function renderSystemInfo() {
  const gateway = state.overview.gateway || {};
  const sec = state.overview.securityAudit || {};
  const rt = state.runtime || {};
  const startedAtLabel = rt.startedAt ? new Date(rt.startedAt).toLocaleString('zh-CN') : '—';
  const statusLabel = rt.status === 'running' ? '运行中' : (rt.status === 'stopped' ? '已停止' : '未知');
  systemInfoEl.innerHTML = `
    <div class="kv"><div class="muted">服务地址</div><div>${escapeHtml(rt.url || '—')}</div></div>
    <div class="kv"><div class="muted">端口</div><div>${rt.port || '—'}</div></div>
    <div class="kv"><div class="muted">PID</div><div>${rt.pid || '—'}</div></div>
    <div class="kv"><div class="muted">启动时间</div><div>${startedAtLabel}</div></div>
    <div class="kv"><div class="muted">运行状态</div><div>${statusLabel}</div></div>
    <div class="kv"><div class="muted">Gateway</div><div>${gateway.reachable ? '可达' : '不可达'}</div></div>
    <div class="kv"><div class="muted">延迟</div><div>${gateway.connectLatencyMs ?? '—'} ms</div></div>
    <div class="kv"><div class="muted">高危告警</div><div>${sec.critical ?? 0}</div></div>
    <div class="kv"><div class="muted">警告</div><div>${sec.warn ?? 0}</div></div>
    <div class="kv"><div class="muted">渠道</div><div>${(state.overview.channelSummary || []).map(escapeHtml).join('<br/>') || '—'}</div></div>
  `;
}

function renderTaskBoard() {
  const groups = {
    queued: state.tasks.filter(t => t.status === 'queued'),
    running: state.tasks.filter(t => t.status === 'running'),
    completed: state.tasks.filter(t => t.status === 'completed'),
    failed: state.tasks.filter(t => t.status === 'failed'),
    canceled: state.tasks.filter(t => t.status === 'canceled')
  };
  taskBoardEl.innerHTML = Object.entries(groups).map(([key, tasks]) => `
    <div class="column">
      <h4>${columnTitle(key)} <span class="muted">(${tasks.length})</span></h4>
      ${tasks.map(renderTaskCard).join('') || '<div class="muted small">暂无任务</div>'}
    </div>
  `).join('');
  taskBoardEl.querySelectorAll('.task-card').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('task-checkbox')) return;
      state.selectedTaskId = el.dataset.taskId;
      loadTaskDetail(state.selectedTaskId);
    });
  });
  taskBoardEl.querySelectorAll('.task-checkbox').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = el.dataset.taskId;
      if (el.checked) {
        state.selectedTaskIds.add(taskId);
      } else {
        state.selectedTaskIds.delete(taskId);
      }
      renderBatchToolbar();
      renderTaskBoard();
    });
  });
  taskBoardEl.querySelectorAll('.task-card-reassign-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = el.dataset.taskId;
      openReassignModal(taskId);
    });
  });
}

function renderTaskCard(task) {
  const runs = task.runs.map(r => `${r.agentId}:${runStatusLabel(r.status)}`).join(' · ');
  const isSelected = state.selectedTaskIds.has(task.id);
  const canReassign = task.status === 'queued' || task.status === 'paused';
  return `
    <div class="task-card ${state.selectedTaskId === task.id ? 'selected' : ''} ${isSelected ? 'batch-selected' : ''}" data-task-id="${task.id}">
      <div class="task-card-checkbox">
        <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" ${isSelected ? 'checked' : ''} />
      </div>
      <div class="task-card-content">
        <div class="title">${escapeHtml(task.title)}</div>
        <div class="meta">
          <div>优先级：${priorityLabel(task.priority)} · 模式：${task.mode === 'parallel' ? '并行' : '串行'}</div>
          <div>状态：${statusLabel(task.status)}</div>
          <div>Agent：${escapeHtml((task.agents || []).join('、') || '—')}</div>
          <div>执行：${escapeHtml(runs)}</div>
          <div>创建：${escapeHtml(task.createdAtLabel)}</div>
        </div>
        ${canReassign ? `<button class="task-card-reassign-btn" data-task-id="${task.id}">重新指派</button>` : ''}
      </div>
    </div>
  `;
}

function renderAgentCheckboxes() {
  const prev = new Set([...agentCheckboxesEl.querySelectorAll('input:checked')].map(x => x.value));
  agentCheckboxesEl.innerHTML = state.overview.agents.map(agent => `
    <label class="checkbox-item">
      <input type="checkbox" name="agents" value="${agent.id}" ${prev.has(agent.id) ? 'checked' : ''} />
      <span><strong>${escapeHtml(agent.name)}</strong><br/><span class="muted small">${escapeHtml(agent.model)}</span></span>
    </label>
  `).join('');
}

function renderFilterAgents() {
  const previousValue = filterAgentEl.dataset.currentValue || filterAgentEl.value || '';
  const options = ['<option value="">全部 Agent</option>']
    .concat(state.overview.agents.map(agent => `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.name)} · ${escapeHtml(agent.id)}</option>`));
  filterAgentEl.innerHTML = options.join('');
  filterAgentEl.value = state.filters.agent || previousValue || '';
  filterAgentEl.dataset.currentValue = filterAgentEl.value;
}

function renderFilterSummary() {
  renderFilterChips();
  const total = state.tasks.length;
  if (!hasActiveFilters(state.filters)) {
    filterResultCountEl.textContent = `当前展示全部任务 · ${total} 条`;
    return;
  }
  filterResultCountEl.textContent = `筛选结果：${total} 条`;
}

function renderBatchToolbar() {
  const count = state.selectedTaskIds.size;
  if (count === 0) {
    batchToolbarEl.classList.add('hidden');
    return;
  }
  batchToolbarEl.classList.remove('hidden');
  selectedCountEl.textContent = count;
}

async function handleBatchCancel() {
  const taskIds = [...state.selectedTaskIds];
  if (taskIds.length === 0) return;
  
  const confirmed = confirm(`确定要取消选中的 ${taskIds.length} 个任务吗？`);
  if (!confirmed) return;

  try {
    const { results } = await fetchJson('/api/tasks/batch-cancel', {
      method: 'POST',
      body: JSON.stringify({ taskIds })
    });
    
    const successCount = results.success.length;
    const failedCount = results.failed.length;
    
    alert(`批量取消完成：成功 ${successCount} 个${failedCount > 0 ? `，失败 ${failedCount} 个` : ''}`);
    
    state.selectedTaskIds.clear();
    await loadTasks();
  } catch (err) {
    alert('批量取消失败：' + err.message);
  }
}

async function handleBatchRetry() {
  const taskIds = [...state.selectedTaskIds];
  if (taskIds.length === 0) return;
  
  const confirmed = confirm(`确定要重试选中的 ${taskIds.length} 个失败任务吗？`);
  if (!confirmed) return;

  try {
    const { results } = await fetchJson('/api/tasks/batch-retry', {
      method: 'POST',
      body: JSON.stringify({ taskIds })
    });
    
    const successCount = results.success.length;
    const failedCount = results.failed.length;
    
    alert(`批量重试完成：成功创建 ${successCount} 个新任务${failedCount > 0 ? `，失败 ${failedCount} 个` : ''}`);
    
    state.selectedTaskIds.clear();
    await loadTasks();
  } catch (err) {
    alert('批量重试失败：' + err.message);
  }
}

async function handleBatchPriority() {
  const priority = batchPrioritySelect.value;
  if (!priority) return;
  
  const taskIds = [...state.selectedTaskIds];
  if (taskIds.length === 0) return;

  try {
    const { results } = await fetchJson('/api/tasks/batch-priority', {
      method: 'PATCH',
      body: JSON.stringify({ taskIds, priority })
    });
    
    const successCount = results.success.length;
    const failedCount = results.failed.length;
    
    alert(`批量修改优先级完成：成功 ${successCount} 个${failedCount > 0 ? `，失败 ${failedCount} 个` : ''}`);
    
    state.selectedTaskIds.clear();
    batchPrioritySelect.value = '';
    await loadTasks();
  } catch (err) {
    alert('批量修改优先级失败：' + err.message);
  }
}

function handleBatchClear() {
  state.selectedTaskIds.clear();
  renderBatchToolbar();
  renderTaskBoard();
}

function renderFilterPresets() {
  const defaultPresets = getResolvedDefaultPresets();
  defaultPresetChipsEl.innerHTML = defaultPresets.map(preset => {
    const active = areFiltersEqual(state.filters, preset.filters);
    return `
      <span class="preset-chip preset-chip-default ${active ? 'is-active' : ''}" data-default-preset-key="${preset.key}">
        <button type="button" data-default-preset-key="${preset.key}">${escapeHtml(preset.name)}</button>
      </span>
    `;
  }).join('');

  if (state.savedPresets.length === 0) {
    savedPresetListEl.innerHTML = '<span class="preset-chip preset-chip-empty">还没有保存的视图</span>';
  } else {
    savedPresetListEl.innerHTML = state.savedPresets.map((preset, index) => {
      const active = areFiltersEqual(state.filters, preset.filters);
      const disableMoveUp = index === 0;
      const disableMoveDown = index === state.savedPresets.length - 1;
      return `
        <span class="preset-chip preset-chip-saved ${active ? 'is-active' : ''}" data-saved-preset-index="${index}">
          <button type="button" class="preset-chip-name" data-action="apply" data-saved-preset-index="${index}">${escapeHtml(preset.name)}</button>
          <span class="preset-chip-actions">
            <button type="button" data-action="rename" data-saved-preset-index="${index}" title="重命名该预设">重命名</button>
            <button type="button" data-action="move-up" data-saved-preset-index="${index}" ${disableMoveUp ? 'disabled' : ''} title="上移">↑</button>
            <button type="button" data-action="move-down" data-saved-preset-index="${index}" ${disableMoveDown ? 'disabled' : ''} title="下移">↓</button>
            <button type="button" data-action="delete" data-saved-preset-index="${index}" title="删除该预设">删除</button>
          </span>
        </span>
      `;
    }).join('');
  }

  defaultPresetChipsEl.querySelectorAll('[data-default-preset-key]').forEach(el => {
    el.addEventListener('click', async event => {
      event.preventDefault();
      const key = el.dataset.defaultPresetKey || event.target.dataset.defaultPresetKey;
      const preset = defaultPresets.find(item => item.key === key);
      if (preset) await applyPreset(preset.filters);
    });
  });

  savedPresetListEl.querySelectorAll('[data-saved-preset-index]').forEach(el => {
    el.addEventListener('click', async event => {
      event.preventDefault();
      const index = Number(event.target.dataset.savedPresetIndex || el.dataset.savedPresetIndex);
      const action = event.target.dataset.action || 'apply';
      if (!Number.isInteger(index) || !state.savedPresets[index]) return;
      if (action === 'delete') {
        deletePreset(index);
        return;
      }
      if (action === 'rename') {
        renamePreset(index);
        return;
      }
      if (action === 'move-up') {
        movePreset(index, -1);
        return;
      }
      if (action === 'move-down') {
        movePreset(index, 1);
        return;
      }
      await applyPreset(state.savedPresets[index].filters);
    });
  });

  renderSharedPresets();
}

function renderSharedPresets() {
  if (!sharedPresetListEl) return;
  
  if (state.sharedPresets.length === 0) {
    sharedPresetListEl.innerHTML = '<span class="preset-chip preset-chip-empty">还没有共享预设</span>';
  } else {
    sharedPresetListEl.innerHTML = state.sharedPresets.map((preset) => {
      const active = areFiltersEqual(state.filters, preset.filters);
      const permissions = preset.permissions || { canEdit: [preset.createdBy], canDelete: [preset.createdBy] };
      const canEdit = permissions.canEdit.includes('Master') || permissions.canEdit.includes('*') || permissions.canEdit.includes(preset.createdBy);
      const canDelete = permissions.canDelete.includes('Master') || permissions.canDelete.includes(preset.createdBy);
      const isOwner = preset.createdBy === 'Master';
      return `
        <span class="preset-chip preset-chip-shared ${active ? 'is-active' : ''}" data-shared-preset-id="${preset.id}">
          <button type="button" class="preset-chip-name" data-action="apply" data-shared-preset-id="${preset.id}">${escapeHtml(preset.name)}</button>
          <span class="preset-chip-meta muted small">by ${escapeHtml(preset.createdBy)}</span>
          <span class="preset-chip-actions">
            <button type="button" data-action="permissions" data-shared-preset-id="${preset.id}" title="管理权限" ${!isOwner ? '' : ''}>权限</button>
            <button type="button" data-action="edit" data-shared-preset-id="${preset.id}" title="编辑共享预设" ${canEdit ? '' : 'disabled'}>编辑</button>
            <button type="button" data-action="delete" data-shared-preset-id="${preset.id}" title="删除共享预设" ${canDelete ? '' : 'disabled'}>删除</button>
          </span>
        </span>
      `;
    }).join('');
  }

  sharedPresetListEl.querySelectorAll('[data-shared-preset-id]').forEach(el => {
    el.addEventListener('click', async event => {
      event.preventDefault();
      const presetId = event.target.dataset.sharedPresetId || el.dataset.sharedPresetId;
      const action = event.target.dataset.action || 'apply';
      const preset = state.sharedPresets.find(p => p.id === presetId);
      if (!preset) return;
      if (action === 'permissions') {
        showPresetPermissionsModal(presetId);
        return;
      }
      if (action === 'delete') {
        if (event.target.disabled) {
          alert('您没有删除此预设的权限');
          return;
        }
        if (!confirm('确定要删除此共享预设吗？')) return;
        try {
          await fetchJson(`/api/presets/${presetId}`, { method: 'DELETE' });
          await loadSharedPresets();
          renderSharedPresets();
        } catch (err) {
          alert(err.message);
        }
        return;
      }
      if (action === 'edit') {
        if (event.target.disabled) {
          alert('您没有编辑此预设的权限');
          return;
        }
        const newName = window.prompt('请输入新的预设名称', preset.name);
        if (!newName || newName.trim() === preset.name) return;
        try {
          await fetchJson(`/api/presets/${presetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim(), userId: 'Master' })
          });
          await loadSharedPresets();
          renderSharedPresets();
        } catch (err) {
          alert(err.message);
        }
        return;
      }
      await applyPreset(preset.filters);
    });
  });
}

function renderFilterChips() {
  const filters = state.filters;
  const labels = {
    keyword: { label: '关键词', getValue: f => f.keyword },
    status: { label: '状态', getValue: f => f.status ? statusLabel(f.status) : null },
    agent: { label: 'Agent', getValue: f => f.agent ? f.agent : null },
    priority: { label: '优先级', getValue: f => f.priority ? priorityLabel(f.priority) : null },
    mode: { label: '模式', getValue: f => f.mode ? (f.mode === 'parallel' ? '并行' : '串行广播') : null },
    timeFrom: { label: '开始时间', getValue: f => f.timeFrom ? new Date(f.timeFrom).toLocaleString('zh-CN') : null },
    timeTo: { label: '结束时间', getValue: f => f.timeTo ? new Date(f.timeTo).toLocaleString('zh-CN') : null }
  };

  const chips = [];
  Object.entries(labels).forEach(([key, { label, getValue }]) => {
    const value = getValue(filters);
    if (value) {
      chips.push({ key, label, value });
    }
  });

  if (chips.length === 0) {
    filterChipsEl.innerHTML = '';
    return;
  }

  filterChipsEl.innerHTML = chips.map(chip => `
    <span class="filter-chip" data-key="${chip.key}">
      ${chip.label}: ${escapeHtml(chip.value)}
      <span class="filter-chip-remove">×</span>
    </span>
  `).join('');

  filterChipsEl.querySelectorAll('.filter-chip').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      removeFilterChip(key);
    });
  });
}

async function removeFilterChip(key) {
  const newFilters = { ...state.filters };
  delete newFilters[key];
  state.filters = newFilters;
  populateFilterInputs(newFilters);
  saveFiltersToStorage(newFilters);
  syncFiltersToUrl(newFilters);
  await loadTasks();
  renderTaskBoard();
  renderFilterSummary();
  if (state.selectedTaskId && state.tasks.some(task => task.id === state.selectedTaskId)) {
    await loadTaskDetail(state.selectedTaskId);
  } else if (state.selectedTaskId) {
    state.selectedTaskId = null;
    logEmptyEl.classList.remove('hidden');
    detailBodyEl.classList.add('hidden');
  }
}

function formatDateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function populateFilterInputs(filters) {
  filterKeywordEl.value = filters.keyword || '';
  filterStatusEl.value = filters.status || '';
  filterAgentEl.value = filters.agent || '';
  filterPriorityEl.value = filters.priority || '';
  filterModeEl.value = filters.mode || '';
  filterTimeFromEl.value = formatDateTimeLocalValue(filters.timeFrom);
  filterTimeToEl.value = formatDateTimeLocalValue(filters.timeTo);
}

function closeLogStream() {
  if (state.logEventSource) {
    state.logEventSource.close();
    state.logEventSource = null;
  }
  state.logStreamActive = false;
}

async function loadTaskDetail(taskId) {
  closeLogStream();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  const { log } = await fetchJson(`/api/tasks/${taskId}/log`);
  logEmptyEl.classList.add('hidden');
  detailBodyEl.classList.remove('hidden');
  taskMetaEl.innerHTML = `
    <div class="detail-card">
      <div class="detail-title">${escapeHtml(task.title)}</div>
      <div class="detail-grid">
        <div><span class="muted">状态</span><strong>${statusLabel(task.status)}</strong></div>
        <div><span class="muted">优先级</span><strong>${priorityLabel(task.priority)}</strong></div>
        <div><span class="muted">模式</span><strong>${task.mode === 'parallel' ? '并行' : '串行'}</strong></div>
        <div><span class="muted">创建时间</span><strong>${escapeHtml(task.createdAtLabel)}</strong></div>
        <div><span class="muted">开始时间</span><strong>${escapeHtml(task.startedAtLabel || '—')}</strong></div>
        <div><span class="muted">完成时间</span><strong>${escapeHtml(task.finishedAtLabel || '—')}</strong></div>
      </div>
      <div class="prompt-box"><span class="muted small">任务内容</span><br/>${escapeHtml(task.prompt)}</div>
      <div class="run-list">${task.runs.map(renderRunItem).join('')}</div>
    </div>
  `;
  logBoxEl.textContent = log || '暂无日志';
  retryBtn.disabled = false;
  cancelBtn.disabled = ['completed', 'failed', 'canceled', 'paused'].includes(task.status);

  if (task.status === 'running') {
    pauseBtn.classList.remove('hidden');
    resumeBtn.classList.add('hidden');
  } else if (task.status === 'paused') {
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.remove('hidden');
  } else {
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.add('hidden');
  }
  
  if (['running', 'queued'].includes(task.status)) {
    startLogStream(taskId, log);
  }
  
  taskMetaEl.querySelectorAll('.run-retry-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const runId = btn.dataset.runId;
      const taskId = btn.dataset.taskId;
      try {
        await fetchJson(`/api/tasks/${taskId}/runs/${runId}/retry`, { method: 'POST' });
        alert('Run 已重新加入队列');
        await loadTaskDetail(taskId);
        await loadTasks();
      } catch (err) {
        alert('重试失败：' + err.message);
      }
    });
  });
}

function startLogStream(taskId, initialLog) {
  const eventSource = new EventSource(`/api/tasks/${taskId}/logs/stream`);
  state.logEventSource = eventSource;
  state.logStreamActive = true;
  let currentLog = initialLog || '';
  
  eventSource.addEventListener('log-new', (e) => {
    try {
      const { content } = JSON.parse(e.data);
      currentLog += content;
      logBoxEl.textContent = currentLog;
      logBoxEl.scrollTop = logBoxEl.scrollHeight;
    } catch {}
  });
  
  eventSource.addEventListener('task-complete', (e) => {
    try {
      const data = JSON.parse(e.data);
      updateTaskStatusInList(data.taskId, 'completed');
      state.logStreamActive = false;
    } catch {}
  });
  
  eventSource.addEventListener('task-error', (e) => {
    try {
      const data = JSON.parse(e.data);
      updateTaskStatusInList(data.taskId, data.status);
      state.logStreamActive = false;
    } catch {}
  });
  
  eventSource.addEventListener('heartbeat', () => {});
  
  eventSource.onerror = () => {
    state.logStreamActive = false;
  };
}

function updateTaskStatusInList(taskId, status) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = status;
  }
}

function renderRunItem(run) {
  const canRetry = run.status === 'failed' || run.status === 'error';
  return `
    <div class="run-item">
      <div><strong>${escapeHtml(run.agentId)}</strong></div>
      <div class="muted small">${runStatusLabel(run.status)}${run.exitCode != null ? ` · exit ${run.exitCode}` : ''}</div>
      ${run.error ? `<div class="run-error">${escapeHtml(run.error)}</div>` : ''}
      ${canRetry ? `<button class="run-retry-btn" data-run-id="${run.id}" data-task-id="${state.selectedTaskId}">重试此 Run</button>` : ''}
    </div>
  `;
}

async function syncFilterStateAfterChange() {
  saveFiltersToStorage(state.filters);
  syncFiltersToUrl(state.filters);
  await loadTasks();
  renderTaskBoard();
  renderFilterPresets();
  renderFilterSummary();
  if (state.selectedTaskId && state.tasks.some(task => task.id === state.selectedTaskId)) {
    await loadTaskDetail(state.selectedTaskId);
  } else if (state.selectedTaskId) {
    state.selectedTaskId = null;
    logEmptyEl.classList.remove('hidden');
    detailBodyEl.classList.add('hidden');
  }
}

async function applyFilters() {
  state.filters = getFilters();
  await syncFilterStateAfterChange();
}

async function applyPreset(filters) {
  state.filters = { ...(filters || {}) };
  populateFilterInputs(state.filters);
  await syncFilterStateAfterChange();
}

function movePreset(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= state.savedPresets.length) return;
  const presets = [...state.savedPresets];
  const [preset] = presets.splice(index, 1);
  presets.splice(targetIndex, 0, preset);
  state.savedPresets = presets;
  savePresetsToStorage(state.savedPresets);
  renderFilterPresets();
}

function renamePreset(index) {
  const preset = state.savedPresets[index];
  if (!preset) return;
  const nextName = normalizePresetName(window.prompt('请输入新的预设名称', preset.name));
  if (!nextName) return;

  const existingIndex = state.savedPresets.findIndex((item, itemIndex) => itemIndex !== index && item.name === nextName);
  if (existingIndex >= 0) {
    alert('已存在同名预设，请换一个名称');
    return;
  }

  state.savedPresets[index] = { ...preset, name: nextName };
  savePresetsToStorage(state.savedPresets);
  renderFilterPresets();
}

function deletePreset(index) {
  state.savedPresets.splice(index, 1);
  savePresetsToStorage(state.savedPresets);
  renderFilterPresets();
}

async function saveCurrentPreset() {
  const name = normalizePresetName(presetNameInputEl.value);
  const filters = getFilters();
  const isShared = presetShareCheckEl?.checked || false;

  if (!name) {
    alert('请先输入预设名称');
    presetNameInputEl.focus();
    return;
  }

  if (!hasActiveFilters(filters)) {
    alert('当前没有可保存的筛选条件');
    return;
  }

  if (isShared) {
    try {
      await fetchJson('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters, createdBy: 'Master' })
      });
      await loadSharedPresets();
      renderSharedPresets();
      presetNameInputEl.value = '';
      if (presetShareCheckEl) presetShareCheckEl.checked = false;
      alert('共享预设已保存');
    } catch (err) {
      alert('保存共享预设失败：' + err.message);
    }
    return;
  }

  const existingIndex = state.savedPresets.findIndex(preset => preset.name === name);
  const nextPreset = { name, filters };
  if (existingIndex >= 0) {
    state.savedPresets.splice(existingIndex, 1, nextPreset);
  } else {
    state.savedPresets.unshift(nextPreset);
  }
  state.savedPresets = state.savedPresets.slice(0, 8);
  savePresetsToStorage(state.savedPresets);
  presetNameInputEl.value = '';
  renderFilterPresets();
}

async function clearFilters() {
  filterKeywordEl.value = '';
  filterStatusEl.value = '';
  filterAgentEl.value = '';
  filterPriorityEl.value = '';
  filterModeEl.value = '';
  filterTimeFromEl.value = '';
  filterTimeToEl.value = '';
  state.filters = {};
  await syncFilterStateAfterChange();
  renderFilterAgents();
}

async function loadTemplates() {
  const res = await fetchJson('/api/templates');
  state.templates = res.templates;
}

async function loadGroups() {
  const res = await fetchJson('/api/agent-groups');
  state.groups = res.groups;
}

async function loadSharedPresets() {
  try {
    const res = await fetchJson('/api/presets');
    state.sharedPresets = res.presets || [];
  } catch (err) {
    state.sharedPresets = [];
  }
}

async function loadWorkflows() {
  const res = await fetchJson('/api/workflows');
  state.workflows = res.workflows;
}

async function loadSessions() {
  try {
    const res = await fetchJson('/api/sessions');
    state.sessions = res.sessions || [];
  } catch (err) {
    state.sessions = [];
  }
}

function renderTemplateAgentCheckboxes(selectedAgents = []) {
  const prev = new Set([...templateAgentCheckboxesEl.querySelectorAll('input:checked')].map(x => x.value));
  const selected = new Set(selectedAgents);
  if (!templateAgentCheckboxesEl.querySelector('input') && state.overview?.agents?.length > 0) {
    templateAgentCheckboxesEl.innerHTML = state.overview.agents.map(agent => `
      <label class="checkbox-item compact">
        <input type="checkbox" name="templateAgents" value="${agent.id}" ${selected.has(agent.id) ? 'checked' : ''} />
        <span>${escapeHtml(agent.name)}</span>
      </label>
    `).join('');
  }
}

function renderTemplates() {
  if (!state.templates || state.templates.length === 0) {
    templateListEl.innerHTML = '<div class="muted small">还没有创建任何模板</div>';
    return;
  }
  templateListEl.innerHTML = state.templates.map(template => `
    <div class="template-item" data-template-id="${template.id}">
      <div class="template-header">
        <div class="template-name">${escapeHtml(template.name)}</div>
        <div class="template-actions">
          <button class="ghost tiny use-template-btn" data-template-id="${template.id}" title="使用此模板创建任务">使用</button>
          <button class="ghost tiny edit-template-btn" data-template-id="${template.id}" title="编辑模板">编辑</button>
          <button class="ghost tiny danger delete-template-btn" data-template-id="${template.id}" title="删除模板">删除</button>
        </div>
      </div>
      <div class="template-desc muted small">${escapeHtml(template.description || '暂无描述')}</div>
      <div class="template-meta muted tiny">
        <span>默认 Agent: ${(template.defaultAgents || []).join(', ') || '未设置'}</span>
        <span>优先级: ${priorityLabel(template.defaultPriority)}</span>
        <span>模式: ${template.defaultMode === 'parallel' ? '并行' : '串行'}</span>
      </div>
    </div>
  `).join('');

  templateListEl.querySelectorAll('.use-template-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const templateId = btn.dataset.templateId;
      const template = state.templates.find(t => t.id === templateId);
      if (template) {
        templateSelectEl.value = templateId;
        applyTemplateToForm(template);
      }
    });
  });

  templateListEl.querySelectorAll('.edit-template-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const templateId = btn.dataset.templateId;
      const template = state.templates.find(t => t.id === templateId);
      if (template) {
        state.editingTemplateId = templateId;
        showTemplateForm(template);
      }
    });
  });

  templateListEl.querySelectorAll('.delete-template-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('确定要删除此模板吗？')) return;
      const templateId = btn.dataset.templateId;
      try {
        await fetchJson(`/api/templates/${templateId}`, { method: 'DELETE' });
        await loadTemplates();
        renderTemplates();
        renderTemplateSelect();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

function renderTemplateSelect() {
  const currentValue = templateSelectEl.value;
  templateSelectEl.innerHTML = '<option value="">不使用模板</option>' +
    state.templates.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  templateSelectEl.value = currentValue;
}

function showTemplateForm(template = null) {
  templateForm.classList.remove('hidden');
  if (template) {
    templateNameInput.value = template.name;
    templateDescInput.value = template.description || '';
    templatePriorityInput.value = template.defaultPriority || 'medium';
    templateModeInput.value = template.defaultMode || 'broadcast';
    templateContentInput.value = template.defaultContent || '';
    renderTemplateAgentCheckboxes(template.defaultAgents || []);
  } else {
    templateNameInput.value = '';
    templateDescInput.value = '';
    templatePriorityInput.value = 'medium';
    templateModeInput.value = 'broadcast';
    templateContentInput.value = '';
    renderTemplateAgentCheckboxes([]);
  }
  templateNameInput.focus();
}

function hideTemplateForm() {
  templateForm.classList.add('hidden');
  state.editingTemplateId = null;
}

async function saveTemplate() {
  const name = templateNameInput.value.trim();
  if (!name) {
    alert('请输入模板名称');
    templateNameInput.focus();
    return;
  }
  const agents = [...templateAgentCheckboxesEl.querySelectorAll('input:checked')].map(x => x.value);
  const payload = {
    name,
    description: templateDescInput.value.trim(),
    defaultAgents: agents,
    defaultPriority: templatePriorityInput.value,
    defaultMode: templateModeInput.value,
    defaultContent: templateContentInput.value.trim()
  };

  try {
    if (state.editingTemplateId) {
      await fetchJson(`/api/templates/${state.editingTemplateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetchJson('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    hideTemplateForm();
    await loadTemplates();
    renderTemplates();
    renderTemplateSelect();
  } catch (err) {
    alert(err.message);
  }
}

function applyTemplateToForm(template) {
  const titleInput = form.querySelector('input[name="title"]');
  const promptInput = form.querySelector('textarea[name="prompt"]');
  const prioritySelect = form.querySelector('select[name="priority"]');
  const modeSelect = form.querySelector('select[name="mode"]');

  if (template.defaultContent) {
    promptInput.value = template.defaultContent;
  }
  if (template.defaultPriority) {
    prioritySelect.value = template.defaultPriority;
  }
  if (template.defaultMode) {
    modeSelect.value = template.defaultMode;
  }
  if (template.defaultAgents && template.defaultAgents.length > 0) {
    agentCheckboxesEl.querySelectorAll('input').forEach(cb => {
      cb.checked = template.defaultAgents.includes(cb.value);
    });
  }
}

showTemplateFormBtn.addEventListener('click', () => showTemplateForm());
saveTemplateBtn.addEventListener('click', () => saveTemplate());
cancelTemplateBtn.addEventListener('click', () => hideTemplateForm());
templateSelectEl.addEventListener('change', () => {
  const templateId = templateSelectEl.value;
  if (!templateId) return;
  const template = state.templates.find(t => t.id === templateId);
  if (template) {
    applyTemplateToForm(template);
  }
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  formMsg.textContent = '正在派发任务…';
  const fd = new FormData(form);
  const payload = {
    title: fd.get('title'),
    prompt: fd.get('prompt'),
    priority: fd.get('priority'),
    mode: fd.get('mode'),
    agents: fd.getAll('agents')
  };
  try {
    const { task } = await fetchJson('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    formMsg.textContent = `任务已创建：${task.title}`;
    form.reset();
    state.selectedTaskId = task.id;
    await refreshAll();
  } catch (err) {
    formMsg.textContent = err.message;
  }
});

refreshBtn.addEventListener('click', () => refreshAll(true));
retryBtn.addEventListener('click', async () => {
  if (!state.selectedTaskId) return;
  try {
    await fetchJson(`/api/tasks/${state.selectedTaskId}/retry`, { method: 'POST' });
    await refreshAll();
  } catch (err) {
    alert(err.message);
  }
});
cancelBtn.addEventListener('click', async () => {
  if (!state.selectedTaskId) return;
  try {
    await fetchJson(`/api/tasks/${state.selectedTaskId}/cancel`, { method: 'POST' });
    await refreshAll();
  } catch (err) {
    alert(err.message);
  }
});
pauseBtn.addEventListener('click', async () => {
  if (!state.selectedTaskId) return;
  try {
    await fetchJson(`/api/tasks/${state.selectedTaskId}/pause`, { method: 'POST' });
    await refreshAll();
  } catch (err) {
    alert(err.message);
  }
});
resumeBtn.addEventListener('click', async () => {
  if (!state.selectedTaskId) return;
  try {
    await fetchJson(`/api/tasks/${state.selectedTaskId}/resume`, { method: 'POST' });
    await refreshAll();
  } catch (err) {
    alert(err.message);
  }
});
applyFilterBtn.addEventListener('click', () => applyFilters());
clearFilterBtn.addEventListener('click', () => clearFilters());
savePresetBtn.addEventListener('click', () => saveCurrentPreset());
presetNameInputEl.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveCurrentPreset();
  }
});
filterKeywordEl.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    applyFilters();
  }
});
[filterStatusEl, filterAgentEl, filterPriorityEl, filterModeEl].forEach(el => {
  el.addEventListener('change', () => applyFilters());
});

batchCancelBtn.addEventListener('click', handleBatchCancel);
batchRetryBtn.addEventListener('click', handleBatchRetry);
batchPrioritySelect.addEventListener('change', handleBatchPriority);
batchClearBtn.addEventListener('click', handleBatchClear);

function initFilters() {
  state.savedPresets = loadPresetsFromStorage();
  const urlFilters = parseFiltersFromUrl();
  if (hasActiveFilters(urlFilters)) {
    state.filters = urlFilters;
    populateFilterInputs(urlFilters);
    return;
  }
  const storedFilters = loadFiltersFromStorage();
  if (hasActiveFilters(storedFilters)) {
    state.filters = storedFilters;
    populateFilterInputs(storedFilters);
    syncFiltersToUrl(storedFilters);
  }
}

setInterval(refreshAll, 10000);
initFilters();
refreshAll();

function columnTitle(key) { return ({ queued: '待执行', running: '执行中', completed: '已完成', failed: '失败', canceled: '已取消' })[key] || key; }
function priorityLabel(v) { return ({ low: '低', medium: '中', high: '高' })[v] || v; }
function runStatusLabel(v) { return ({ queued: '待命', running: '执行中', completed: '完成', failed: '失败', canceled: '已取消' })[v] || v; }
function labelStatus(v) { return ({ busy: '忙碌', idle: '空闲', offline: '离线' })[v] || v; }
function statusLabel(v) { return ({ queued: '待执行', running: '执行中', paused: '已暂停', completed: '已完成', failed: '失败', canceled: '已取消' })[v] || v; }
function escapeHtml(str) { return String(str ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s])); }

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderGroupFilter() {
  const previousValue = filterGroupEl.value;
  const options = ['<option value="">全部分组</option>']
    .concat(state.groups.map(group => `<option value="${group.id}">${escapeHtml(group.name)}</option>`));
  filterGroupEl.innerHTML = options.join('');
  filterGroupEl.value = state.groupFilter || previousValue || '';
}

function renderGroupList() {
  if (!state.groups || state.groups.length === 0) {
    groupListEl.innerHTML = '<div class="muted small">还没有创建任何分组</div>';
    return;
  }
  groupListEl.innerHTML = state.groups.map(group => `
    <div class="group-item" data-group-id="${group.id}">
      <div class="group-color" style="background:${group.color}"></div>
      <div class="group-info">
        <div class="group-name">${escapeHtml(group.name)}</div>
        <div class="group-desc">${escapeHtml(group.description || '暂无描述')}</div>
        <div class="group-agents-count">包含 ${group.agentIds.length} 个 Agent</div>
      </div>
      <div class="group-actions">
        <button class="ghost tiny edit-group-btn" data-group-id="${group.id}" title="编辑分组">编辑</button>
        <button class="ghost tiny danger delete-group-btn" data-group-id="${group.id}" title="删除分组">删除</button>
      </div>
    </div>
  `).join('');

  groupListEl.querySelectorAll('.edit-group-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const groupId = btn.dataset.groupId;
      const group = state.groups.find(g => g.id === groupId);
      if (group) {
        state.editingGroupId = groupId;
        showGroupForm(group);
      }
    });
  });

  groupListEl.querySelectorAll('.delete-group-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('确定要删除此分组吗？')) return;
      const groupId = btn.dataset.groupId;
      try {
        await fetchJson(`/api/agent-groups/${groupId}`, { method: 'DELETE' });
        await loadGroups();
        renderGroupList();
        renderGroupFilter();
        renderAgents();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

function showGroupForm(group = null) {
  groupForm.classList.remove('hidden');
  if (group) {
    groupNameInput.value = group.name;
    groupColorInput.value = group.color;
    groupDescInput.value = group.description || '';
  } else {
    groupNameInput.value = '';
    groupColorInput.value = '#6b7280';
    groupDescInput.value = '';
  }
  groupNameInput.focus();
}

function hideGroupForm() {
  groupForm.classList.add('hidden');
  state.editingGroupId = null;
}

async function saveGroup() {
  const name = groupNameInput.value.trim();
  if (!name) {
    alert('请输入分组名称');
    groupNameInput.focus();
    return;
  }
  const payload = {
    name,
    color: groupColorInput.value,
    description: groupDescInput.value.trim()
  };

  try {
    if (state.editingGroupId) {
      await fetchJson(`/api/agent-groups/${state.editingGroupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetchJson('/api/agent-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    hideGroupForm();
    await loadGroups();
    renderGroupList();
    renderGroupFilter();
    renderAgents();
  } catch (err) {
    alert(err.message);
  }
}

async function showGroupDropdown(btn, agentId) {
  document.querySelectorAll('.group-dropdown').forEach(d => d.remove());
  state.selectedAgentId = agentId;
  
  const agentGroups = state.groups.filter(g => g.agentIds.includes(agentId));
  const dropdown = document.createElement('div');
  dropdown.className = 'group-dropdown';
  
  dropdown.innerHTML = state.groups.map(group => {
    const isInGroup = agentGroups.some(g => g.id === group.id);
    return `
      <label class="group-dropdown-item">
        <input type="checkbox" data-group-id="${group.id}" ${isInGroup ? 'checked' : ''} />
        <span class="group-color" style="background:${group.color}"></span>
        <span>${escapeHtml(group.name)}</span>
      </label>
    `;
  }).join('');
  
  if (state.groups.length === 0) {
    dropdown.innerHTML = '<div class="group-dropdown-item muted">暂无分组</div>';
  }
  
  btn.parentElement.appendChild(dropdown);
  
  dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', async () => {
      const groupId = cb.dataset.groupId;
      const allGroupIds = [...dropdown.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.dataset.groupId);
      try {
        await fetchJson(`/api/agents/${agentId}/groups`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupIds: allGroupIds })
        });
        await loadGroups();
        renderAgents();
      } catch (err) {
        alert(err.message);
      }
    });
  });
  
  document.addEventListener('click', function closeDropdown(e) {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    }
  });
}

showGroupFormBtn.addEventListener('click', () => {
  groupPanel.classList.remove('hidden');
  state.editingGroupId = null;
  showGroupForm();
});

hideGroupPanelBtn.addEventListener('click', () => {
  groupPanel.classList.add('hidden');
  hideGroupForm();
});

saveGroupBtn.addEventListener('click', () => saveGroup());
cancelGroupBtn.addEventListener('click', () => hideGroupForm());

filterGroupEl.addEventListener('change', () => {
  state.groupFilter = filterGroupEl.value;
  renderAgents();
});

function renderWorkflows() {
  if (!state.workflows || state.workflows.length === 0) {
    workflowListEl.innerHTML = '<div class="muted small">还没有创建任何工作流</div>';
    return;
  }
  workflowListEl.innerHTML = state.workflows.map(workflow => `
    <div class="workflow-item" data-workflow-id="${workflow.id}">
      <div class="workflow-header">
        <div>
          <div class="workflow-name">${escapeHtml(workflow.name)}</div>
          <div class="workflow-desc">${escapeHtml(workflow.description || '暂无描述')}</div>
          <div class="workflow-meta">
            <span>步骤: ${workflow.steps?.length || 0}</span>
            <span>创建于: ${new Date(workflow.createdAt).toLocaleDateString('zh-CN')}</span>
          </div>
        </div>
        <div class="workflow-actions">
          <button class="ghost tiny run-workflow-btn" data-workflow-id="${workflow.id}" title="执行工作流">执行</button>
          <button class="ghost tiny view-runs-btn" data-workflow-id="${workflow.id}" title="查看执行记录">记录</button>
          <button class="ghost tiny edit-workflow-btn" data-workflow-id="${workflow.id}" title="编辑工作流">编辑</button>
          <button class="ghost tiny danger delete-workflow-btn" data-workflow-id="${workflow.id}" title="删除工作流">删除</button>
        </div>
      </div>
      <div class="workflow-steps-summary">
        ${(workflow.steps || []).map((step, i) => `
          <span class="workflow-step-tag">${i + 1}. ${escapeHtml(step.agentId || '未设置Agent')}</span>
        `).join('')}
      </div>
    </div>
  `).join('');

  workflowListEl.querySelectorAll('.run-workflow-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const workflowId = btn.dataset.workflowId;
      showRunWorkflowModal(workflowId);
    });
  });

  workflowListEl.querySelectorAll('.view-runs-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const workflowId = btn.dataset.workflowId;
      showWorkflowRunModal(workflowId);
    });
  });

  workflowListEl.querySelectorAll('.edit-workflow-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const workflowId = btn.dataset.workflowId;
      const workflow = state.workflows.find(w => w.id === workflowId);
      if (workflow) {
        state.editingWorkflowId = workflowId;
        showWorkflowForm(workflow);
      }
    });
  });

  workflowListEl.querySelectorAll('.delete-workflow-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('确定要删除此工作流吗？')) return;
      const workflowId = btn.dataset.workflowId;
      try {
        await fetchJson(`/api/workflows/${workflowId}`, { method: 'DELETE' });
        await loadWorkflows();
        renderWorkflows();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

function showWorkflowForm(workflow = null) {
  workflowForm.classList.remove('hidden');
  if (workflow) {
    workflowNameInput.value = workflow.name;
    workflowDescInput.value = workflow.description || '';
    renderWorkflowSteps(workflow.steps || []);
  } else {
    workflowNameInput.value = '';
    workflowDescInput.value = '';
    renderWorkflowSteps([]);
  }
  workflowNameInput.focus();
}

function hideWorkflowForm() {
  workflowForm.classList.add('hidden');
  state.editingWorkflowId = null;
}

function renderWorkflowSteps(steps = []) {
  workflowStepsList.innerHTML = steps.map((step, index) => `
    <div class="workflow-step-item" data-step-index="${index}">
      <div class="workflow-step-header">
        <span class="workflow-step-number">步骤 ${index + 1}</span>
        <button type="button" class="workflow-step-remove" data-step-index="${index}">删除</button>
      </div>
      <label>
        <span class="field-label">Agent</span>
        <select class="step-agent-select" data-step-index="${index}">
          <option value="">选择 Agent</option>
          ${(state.overview?.agents || []).map(agent => `
            <option value="${agent.id}" ${step.agentId === agent.id ? 'selected' : ''}>${escapeHtml(agent.name)}</option>
          `).join('')}
        </select>
      </label>
      <label>
        <span class="field-label">任务描述</span>
        <textarea class="step-prompt-input" data-step-index="${index}" rows="3" placeholder="描述此步骤要执行的任务">${escapeHtml(step.prompt || '')}</textarea>
      </label>
    </div>
  `).join('');

  workflowStepsList.querySelectorAll('.workflow-step-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.stepIndex);
      const items = workflowStepsList.querySelectorAll('.workflow-step-item');
      if (items[index]) {
        items[index].remove();
        reindexWorkflowSteps();
      }
    });
  });
}

function reindexWorkflowSteps() {
  workflowStepsList.querySelectorAll('.workflow-step-item').forEach((item, index) => {
    item.dataset.stepIndex = index;
    item.querySelector('.workflow-step-number').textContent = `步骤 ${index + 1}`;
    item.querySelector('.workflow-step-remove').dataset.stepIndex = index;
    item.querySelector('.step-agent-select').dataset.stepIndex = index;
    item.querySelector('.step-prompt-input').dataset.stepIndex = index;
  });
}

function addWorkflowStep() {
  const steps = getWorkflowStepsFromForm();
  steps.push({ agentId: '', prompt: '' });
  renderWorkflowSteps(steps);
}

function getWorkflowStepsFromForm() {
  const steps = [];
  workflowStepsList.querySelectorAll('.workflow-step-item').forEach(item => {
    const index = item.dataset.stepIndex;
    const agentId = item.querySelector('.step-agent-select')?.value || '';
    const prompt = item.querySelector('.step-prompt-input')?.value || '';
    if (agentId || prompt) {
      steps.push({ agentId, prompt });
    }
  });
  return steps;
}

async function saveWorkflow() {
  const name = workflowNameInput.value.trim();
  if (!name) {
    alert('请输入工作流名称');
    workflowNameInput.focus();
    return;
  }
  const steps = getWorkflowStepsFromForm();
  if (steps.length === 0) {
    alert('请至少添加一个步骤');
    return;
  }
  const payload = {
    name,
    description: workflowDescInput.value.trim(),
    steps
  };

  try {
    if (state.editingWorkflowId) {
      await fetchJson(`/api/workflows/${state.editingWorkflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetchJson('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    hideWorkflowForm();
    await loadWorkflows();
    renderWorkflows();
  } catch (err) {
    alert(err.message);
  }
}

function showRunWorkflowModal(workflowId) {
  const workflow = state.workflows.find(w => w.id === workflowId);
  if (!workflow) return;
  state.runningWorkflowId = workflowId;
  runWorkflowNameEl.textContent = workflow.name;
  stopOnFailureInput.checked = true;
  runWorkflowMsg.textContent = '';
  runWorkflowModal.classList.remove('hidden');
}

function hideRunWorkflowModal() {
  runWorkflowModal.classList.add('hidden');
  state.runningWorkflowId = null;
}

async function runWorkflow() {
  if (!state.runningWorkflowId) return;
  runWorkflowMsg.textContent = '正在执行工作流...';
  confirmRunWorkflowBtn.disabled = true;

  try {
    const { run } = await fetchJson(`/api/workflows/${state.runningWorkflowId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stopOnFailure: stopOnFailureInput.checked })
    });
    runWorkflowMsg.textContent = `工作流已开始执行 (ID: ${run.id})`;
    setTimeout(() => {
      hideRunWorkflowModal();
      showWorkflowRunModal(state.runningWorkflowId);
    }, 500);
  } catch (err) {
    runWorkflowMsg.textContent = err.message;
    confirmRunWorkflowBtn.disabled = false;
  }
}

async function showWorkflowRunModal(workflowId) {
  try {
    const { runs } = await fetchJson(`/api/workflows/${workflowId}/runs`);
    workflowRunModalBody.innerHTML = renderWorkflowRunsList(runs);
    workflowRunModal.classList.remove('hidden');

    workflowRunModalBody.querySelectorAll('.workflow-run-item').forEach(item => {
      item.addEventListener('click', () => {
        const runId = item.dataset.runId;
        loadWorkflowRunDetail(runId);
      });
    });
  } catch (err) {
    alert(err.message);
  }
}

function renderWorkflowRunsList(runs) {
  if (!runs || runs.length === 0) {
    return '<div class="workflow-run-empty">暂无执行记录</div>';
  }
  return `
    <div class="workflow-run-list">
      ${runs.map(run => `
        <div class="workflow-run-item" data-run-id="${run.id}">
          <div class="workflow-run-header">
            <span class="workflow-run-id">${run.id.slice(0, 8)}...</span>
            <span class="workflow-run-status ${run.status}">${run.status === 'completed' ? '完成' : run.status === 'failed' ? '失败' : '运行中'}</span>
          </div>
          <div class="workflow-run-meta">
            <span>开始: ${run.startedAt ? new Date(run.startedAt).toLocaleString('zh-CN') : '—'}</span>
            <span>结束: ${run.finishedAt ? new Date(run.finishedAt).toLocaleString('zh-CN') : '—'}</span>
          </div>
          <div class="workflow-run-steps">
            ${(run.steps || []).map(step => `
              <span class="workflow-run-step-tag ${step.status}">${step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : step.status === 'running' ? '⟳' : '○'} ${escapeHtml(step.agentId || '')}</span>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadWorkflowRunDetail(runId) {
  try {
    const { run } = await fetchJson(`/api/workflow-runs/${runId}`);
    workflowRunModalBody.innerHTML = renderWorkflowRunDetail(run);
  } catch (err) {
    alert(err.message);
  }
}

function renderWorkflowRunDetail(run) {
  const statusText = run.status === 'completed' ? '完成' : run.status === 'failed' ? '失败' : '运行中';
  return `
    <button class="ghost small" id="backToRunListBtn" style="margin-bottom: 16px;">← 返回列表</button>
    <div class="workflow-run-detail">
      <div class="workflow-run-detail-header">
        <div class="workflow-run-detail-status ${run.status}">${statusText}</div>
        <div class="workflow-run-meta">
          <span>ID: ${run.id}</span>
          <span>开始: ${run.startedAt ? new Date(run.startedAt).toLocaleString('zh-CN') : '—'}</span>
          <span>结束: ${run.finishedAt ? new Date(run.finishedAt).toLocaleString('zh-CN') : '—'}</span>
        </div>
        ${run.error ? `<div class="workflow-run-detail-error">${escapeHtml(run.error)}</div>` : ''}
      </div>
      <div class="workflow-run-detail-steps">
        ${(run.steps || []).map((step, index) => `
          <div class="workflow-run-detail-step">
            <div class="workflow-run-detail-step-header">
              <span class="workflow-run-detail-step-title">步骤 ${index + 1}</span>
              <span class="workflow-run-step-tag ${step.status}">${step.status === 'completed' ? '完成' : step.status === 'failed' ? '失败' : step.status === 'running' ? '运行中' : '待执行'}</span>
            </div>
            <div class="workflow-run-detail-step-agent">Agent: ${escapeHtml(step.agentId || '—')}</div>
            ${step.prompt ? `<div class="workflow-run-detail-step-prompt">${escapeHtml(step.prompt)}</div>` : ''}
            ${step.error ? `<div class="workflow-run-detail-step-error">${escapeHtml(step.error)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('backToRunListBtn').addEventListener('click', async () => {
    const workflowId = run.workflowId;
    const { runs } = await fetchJson(`/api/workflows/${workflowId}/runs`);
    workflowRunModalBody.innerHTML = renderWorkflowRunsList(runs);
    workflowRunModalBody.querySelectorAll('.workflow-run-item').forEach(item => {
      item.addEventListener('click', () => {
        const runId = item.dataset.runId;
        loadWorkflowRunDetail(runId);
      });
    });
  });
}

function hideWorkflowRunModal() {
  workflowRunModal.classList.add('hidden');
}

showWorkflowFormBtn.addEventListener('click', () => {
  state.editingWorkflowId = null;
  showWorkflowForm();
});
saveWorkflowBtn.addEventListener('click', () => saveWorkflow());
cancelWorkflowBtn.addEventListener('click', () => hideWorkflowForm());
addStepBtn.addEventListener('click', () => addWorkflowStep());

closeRunWorkflowModal.addEventListener('click', () => hideRunWorkflowModal());
cancelRunWorkflowBtn.addEventListener('click', () => hideRunWorkflowModal());
confirmRunWorkflowBtn.addEventListener('click', () => runWorkflow());
runWorkflowModal.querySelector('.modal-backdrop').addEventListener('click', () => hideRunWorkflowModal());

closeWorkflowRunModal.addEventListener('click', () => hideWorkflowRunModal());
workflowRunModal.querySelector('.modal-backdrop').addEventListener('click', () => hideWorkflowRunModal());

function renderSessionList() {
  if (!state.sessions || state.sessions.length === 0) {
    sessionListEl.innerHTML = '<div class="muted small">暂无活跃会话</div>';
    return;
  }
  sessionListEl.innerHTML = state.sessions.map(session => `
    <div class="session-item" data-session-key="${escapeHtml(session.key)}">
      <div class="session-item-info">
        <div class="session-item-key">${escapeHtml(session.key)}</div>
        <div class="session-item-meta">
          <span>${escapeHtml(session.label || session.kind || '—')}</span>
          <span>${escapeHtml(session.kind || '')}</span>
          <span class="session-item-badge ${session.active ? 'active' : 'idle'}">${session.active ? '活跃' : '空闲'}</span>
        </div>
      </div>
      <div class="session-item-actions">
        <button class="ghost tiny view-messages-btn" data-session-key="${escapeHtml(session.key)}">查看消息</button>
      </div>
    </div>
  `).join('');

  sessionListEl.querySelectorAll('.view-messages-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sessionKey = btn.dataset.sessionKey;
      showSessionMessagesModal(sessionKey);
    });
  });
}

function renderSpawnAgentSelect() {
  const agents = state.overview?.agents || [];
  const currentValue = spawnAgentSelect.value;
  spawnAgentSelect.innerHTML = '<option value="">选择 Agent</option>' +
    agents.map(agent => `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.name)}</option>`).join('');
  spawnAgentSelect.value = currentValue;
}

async function showSessionMessagesModal(sessionKey) {
  state.selectedSessionKey = sessionKey;
  const session = state.sessions.find(s => s.key === sessionKey);
  sessionMessagesInfo.innerHTML = `
    <div><span class="muted">会话 Key:</span> <strong>${escapeHtml(sessionKey)}</strong></div>
    <div><span class="muted">标签:</span> ${escapeHtml(session?.label || '—')}</div>
    <div><span class="muted">类型:</span> ${escapeHtml(session?.kind || '—')}</div>
    <div><span class="muted">状态:</span> <span class="session-item-badge ${session?.active ? 'active' : 'idle'}">${session?.active ? '活跃' : '空闲'}</span></div>
  `;
  sessionMessageMsg.textContent = '';
  sessionMessageInput.value = '';
  await loadSessionMessages();
  sessionMessagesModal.classList.remove('hidden');
}

async function loadSessionMessages() {
  if (!state.selectedSessionKey) return;
  try {
    const res = await fetchJson(`/api/sessions/${state.selectedSessionKey}/messages`);
    if (res.error) {
      sessionMessagesList.innerHTML = `<div class="muted small">${escapeHtml(res.error)}</div>`;
    } else {
      renderSessionMessages(res.messages || []);
    }
  } catch (err) {
    sessionMessagesList.innerHTML = `<div class="muted small">加载消息失败: ${escapeHtml(err.message)}</div>`;
  }
}

function renderSessionMessages(messages) {
  if (!messages || messages.length === 0) {
    sessionMessagesList.innerHTML = '<div class="muted small">暂无消息</div>';
    return;
  }
  sessionMessagesList.innerHTML = messages.map(msg => `
    <div class="session-message ${msg.role === 'user' ? 'user' : 'agent'}">
      <div class="session-message-role">${msg.role === 'user' ? '用户' : 'Agent'}</div>
      <div class="session-message-content">${escapeHtml(msg.content || msg.message || '')}</div>
      ${msg.timestamp ? `<div class="session-message-time">${new Date(msg.timestamp).toLocaleString('zh-CN')}</div>` : ''}
    </div>
  `).join('');
  sessionMessagesList.scrollTop = sessionMessagesList.scrollHeight;
}

function hideSessionMessagesModal() {
  sessionMessagesModal.classList.add('hidden');
  state.selectedSessionKey = null;
}

async function sendSessionMessage() {
  const message = sessionMessageInput.value.trim();
  if (!message) {
    sessionMessageMsg.textContent = '请输入消息内容';
    return;
  }
  if (!state.selectedSessionKey) {
    sessionMessageMsg.textContent = '未选择会话';
    return;
  }
  sessionMessageMsg.textContent = '发送中...';
  sendSessionMessageBtn.disabled = true;
  try {
    await fetchJson(`/api/sessions/${state.selectedSessionKey}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    sessionMessageInput.value = '';
    sessionMessageMsg.textContent = '消息已发送';
    await loadSessionMessages();
  } catch (err) {
    sessionMessageMsg.textContent = err.message;
  } finally {
    sendSessionMessageBtn.disabled = false;
  }
}

function showSpawnForm() {
  spawnForm.classList.remove('hidden');
  spawnTaskInput.value = '';
  spawnMsg.textContent = '';
}

function hideSpawnForm() {
  spawnForm.classList.add('hidden');
}

async function spawnSubagent() {
  const agentId = spawnAgentSelect.value;
  const task = spawnTaskInput.value.trim();
  if (!agentId) {
    spawnMsg.textContent = '请选择 Agent';
    return;
  }
  if (!task) {
    spawnMsg.textContent = '请输入任务描述';
    return;
  }
  spawnMsg.textContent = '正在启动...';
  confirmSpawnBtn.disabled = true;
  try {
    const result = await fetchJson('/api/sessions/spawn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, task })
    });
    spawnMsg.textContent = `Subagent 已启动 (Key: ${escapeHtml(result.sessionKey || result.key || '成功')})`;
    hideSpawnForm();
    await refreshAll(true);
  } catch (err) {
    spawnMsg.textContent = err.message;
  } finally {
    confirmSpawnBtn.disabled = false;
  }
}

showSpawnFormBtn.addEventListener('click', () => showSpawnForm());
cancelSpawnBtn.addEventListener('click', () => hideSpawnForm());
confirmSpawnBtn.addEventListener('click', () => spawnSubagent());

function openReassignModal(taskId) {
  reassignTaskId = taskId;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  reassignTaskInfo.innerHTML = `<strong>${escapeHtml(task.title)}</strong>`;
  currentAgentsList.innerHTML = (task.agents || []).map(a => `<span class="badge">${escapeHtml(a)}</span>`).join(' ') || '—';
  
  reassignAgentCheckboxes.innerHTML = state.overview.agents.map(agent => `
    <label class="checkbox-item">
      <input type="checkbox" name="reassignAgents" value="${agent.id}" />
      <span><strong>${escapeHtml(agent.name)}</strong><br/><span class="muted small">${escapeHtml(agent.model)}</span></span>
    </label>
  `).join('');
  
  const currentAgentsSet = new Set(task.agents || []);
  reassignAgentCheckboxes.querySelectorAll('input').forEach(cb => {
    cb.checked = currentAgentsSet.has(cb.value);
  });
  
  reassignMsg.textContent = '';
  reassignTaskModal.classList.remove('hidden');
}

function hideReassignModal() {
  reassignTaskModal.classList.add('hidden');
  reassignTaskId = null;
}

async function handleReassign() {
  if (!reassignTaskId) return;
  
  const selectedAgents = [...reassignAgentCheckboxes.querySelectorAll('input:checked')].map(x => x.value);
  if (selectedAgents.length === 0) {
    reassignMsg.textContent = '请至少选择一个 Agent';
    return;
  }
  
  reassignMsg.textContent = '正在重新指派...';
  confirmReassignBtn.disabled = true;
  try {
    await fetchJson(`/api/tasks/${reassignTaskId}/reassign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agents: selectedAgents })
    });
    reassignMsg.textContent = '重新指派成功';
    setTimeout(() => {
      hideReassignModal();
      refreshAll(true);
    }, 500);
  } catch (err) {
    reassignMsg.textContent = err.message;
  } finally {
    confirmReassignBtn.disabled = false;
  }
}

closeReassignModal.addEventListener('click', () => hideReassignModal());
reassignTaskModal.querySelector('.modal-backdrop').addEventListener('click', () => hideReassignModal());
confirmReassignBtn.addEventListener('click', () => handleReassign());
cancelReassignBtn.addEventListener('click', () => hideReassignModal());

closeSessionMessagesModal.addEventListener('click', () => hideSessionMessagesModal());
sessionMessagesModal.querySelector('.modal-backdrop').addEventListener('click', () => hideSessionMessagesModal());
sendSessionMessageBtn.addEventListener('click', () => sendSessionMessage());
sessionMessageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    sendSessionMessage();
  }
});

async function loadAuditEvents(force = false) {
  try {
    const query = buildAuditQuery(state.auditFilters, force);
    const res = await fetchJson(`/api/audit${query}`);
    state.auditEvents = res.events || [];
  } catch (err) {
    state.auditEvents = [];
  }
}

function buildAuditQuery(filters = {}, force = false) {
  const params = new URLSearchParams();
  if (force) params.set('force', '1');
  Object.entries(filters).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

function getAuditFilters() {
  const filters = {};
  const keyword = auditFilterKeywordEl.value.trim();
  const eventType = auditEventTypeEl.value;
  const timeFrom = auditTimeFromEl.value;
  const timeTo = auditTimeToEl.value;

  if (keyword) filters.keyword = keyword;
  if (eventType) filters.eventType = eventType;
  if (timeFrom) filters.timeFrom = new Date(timeFrom).toISOString();
  if (timeTo) filters.timeTo = new Date(timeTo).toISOString();

  return filters;
}

function hasActiveAuditFilters(filters = {}) {
  return Object.values(filters).some(value => value != null && value !== '');
}

function renderAuditEvents() {
  const events = state.auditEvents;
  if (!events || events.length === 0) {
    auditEventsListEl.innerHTML = '<div class="empty-state">暂无审计事件</div>';
    return;
  }
  auditEventsListEl.innerHTML = events.map(event => `
    <div class="audit-event-item" data-event-id="${event.id}">
      <div class="audit-event-header">
        <span class="audit-event-type audit-event-type-${event.eventType}">${auditEventTypeLabel(event.eventType)}</span>
        <span class="audit-event-time">${event.timestamp ? new Date(event.timestamp).toLocaleString('zh-CN') : '—'}</span>
      </div>
      <div class="audit-event-content">${escapeHtml(event.message || event.description || '—')}</div>
      <div class="audit-event-meta">
        ${event.agentId ? `<span>Agent: ${escapeHtml(event.agentId)}</span>` : ''}
        ${event.taskId ? `<span>Task: ${escapeHtml(event.taskId)}</span>` : ''}
        ${event.sessionKey ? `<span>Session: ${escapeHtml(event.sessionKey)}</span>` : ''}
      </div>
    </div>
  `).join('');

  auditEventsListEl.querySelectorAll('.audit-event-item').forEach(el => {
    el.addEventListener('click', () => {
      const eventId = el.dataset.eventId;
      showAuditDetailModal(eventId);
    });
  });
}

function auditEventTypeLabel(type) {
  const labels = {
    'task_created': '任务创建',
    'task_started': '任务开始',
    'task_completed': '任务完成',
    'task_failed': '任务失败',
    'task_canceled': '任务取消',
    'agent_start': 'Agent启动',
    'agent_stop': 'Agent停止',
    'agent_error': 'Agent错误',
    'session_start': '会话开始',
    'session_end': '会话结束',
    'workflow_run': '工作流执行',
    'system': '系统事件'
  };
  return labels[type] || type;
}

function renderAuditFilterChips() {
  const filters = state.auditFilters;
  const labels = {
    keyword: { label: '关键词', getValue: f => f.keyword },
    eventType: { label: '事件类型', getValue: f => f.eventType ? auditEventTypeLabel(f.eventType) : null },
    timeFrom: { label: '开始时间', getValue: f => f.timeFrom ? new Date(f.timeFrom).toLocaleString('zh-CN') : null },
    timeTo: { label: '结束时间', getValue: f => f.timeTo ? new Date(f.timeTo).toLocaleString('zh-CN') : null }
  };

  const chips = [];
  Object.entries(labels).forEach(([key, { label, getValue }]) => {
    const value = getValue(filters);
    if (value) {
      chips.push({ key, label, value });
    }
  });

  if (chips.length === 0) {
    auditFilterChipsEl.innerHTML = '';
    return;
  }

  auditFilterChipsEl.innerHTML = chips.map(chip => `
    <span class="filter-chip" data-key="${chip.key}">
      ${chip.label}: ${escapeHtml(chip.value)}
      <span class="filter-chip-remove">×</span>
    </span>
  `).join('');

  auditFilterChipsEl.querySelectorAll('.filter-chip').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      removeAuditFilterChip(key);
    });
  });
}

async function removeAuditFilterChip(key) {
  const newFilters = { ...state.auditFilters };
  delete newFilters[key];
  state.auditFilters = newFilters;
  populateAuditFilterInputs(newFilters);
  await loadAuditEvents();
  renderAuditEvents();
  renderAuditFilterChips();
  renderAuditResultCount();
}

function populateAuditFilterInputs(filters) {
  auditFilterKeywordEl.value = filters.keyword || '';
  auditEventTypeEl.value = filters.eventType || '';
  auditTimeFromEl.value = formatDateTimeLocalValue(filters.timeFrom);
  auditTimeToEl.value = formatDateTimeLocalValue(filters.timeTo);
}

function renderAuditResultCount() {
  const total = state.auditEvents.length;
  if (!hasActiveAuditFilters(state.auditFilters)) {
    auditResultCountEl.textContent = `当前展示全部审计事件 · ${total} 条`;
    return;
  }
  auditResultCountEl.textContent = `筛选结果：${total} 条`;
}

async function applyAuditFilters() {
  state.auditFilters = getAuditFilters();
  await loadAuditEvents();
  renderAuditEvents();
  renderAuditFilterChips();
  renderAuditResultCount();
}

async function clearAuditFilters() {
  auditFilterKeywordEl.value = '';
  auditEventTypeEl.value = '';
  auditTimeFromEl.value = '';
  auditTimeToEl.value = '';
  state.auditFilters = {};
  await loadAuditEvents();
  renderAuditEvents();
  renderAuditFilterChips();
  renderAuditResultCount();
}

function showAuditDetailModal(eventId) {
  const event = state.auditEvents.find(e => e.id === eventId);
  if (!event) return;

  auditDetailBodyEl.innerHTML = `
    <div class="audit-detail">
      <div class="detail-grid">
        <div><span class="muted">事件 ID</span><strong>${escapeHtml(event.id || '—')}</strong></div>
        <div><span class="muted">事件类型</span><strong>${auditEventTypeLabel(event.eventType)}</strong></div>
        <div><span class="muted">时间</span><strong>${event.timestamp ? new Date(event.timestamp).toLocaleString('zh-CN') : '—'}</strong></div>
        ${event.agentId ? `<div><span class="muted">Agent</span><strong>${escapeHtml(event.agentId)}</strong></div>` : ''}
        ${event.taskId ? `<div><span class="muted">Task</span><strong>${escapeHtml(event.taskId)}</strong></div>` : ''}
        ${event.sessionKey ? `<div><span class="muted">Session</span><strong>${escapeHtml(event.sessionKey)}</strong></div>` : ''}
        ${event.userId ? `<div><span class="muted">用户</span><strong>${escapeHtml(event.userId)}</strong></div>` : ''}
      </div>
      ${event.message ? `<div class="prompt-box" style="margin-top: 16px;"><span class="muted small">事件描述</span><br/>${escapeHtml(event.message)}</div>` : ''}
      ${event.details ? `<div class="prompt-box" style="margin-top: 12px;"><span class="muted small">详细信息</span><br/>${escapeHtml(JSON.stringify(event.details, null, 2))}</div>` : ''}
      ${event.data ? `<div class="prompt-box" style="margin-top: 12px;"><span class="muted small">附加数据</span><br/>${escapeHtml(typeof event.data === 'object' ? JSON.stringify(event.data, null, 2) : event.data)}</div>` : ''}
    </div>
  `;

  auditDetailModal.classList.remove('hidden');
}

function hideAuditDetailModal() {
  auditDetailModal.classList.add('hidden');
}

applyAuditFilterBtn.addEventListener('click', () => applyAuditFilters());
clearAuditFilterBtn.addEventListener('click', () => clearAuditFilters());
auditFilterKeywordEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    applyAuditFilters();
  }
});
[auditEventTypeEl].forEach(el => {
  el.addEventListener('change', () => applyAuditFilters());
});
closeAuditDetailModal.addEventListener('click', () => hideAuditDetailModal());
auditDetailModal.querySelector('.modal-backdrop').addEventListener('click', () => hideAuditDetailModal());

const importPresetsModal = document.getElementById('importPresetsModal');
const closeImportPresetsModal = document.getElementById('closeImportPresetsModal');
const presetFileInput = document.getElementById('presetFileInput');
const importPresetInfo = document.getElementById('importPresetInfo');
const importPresetMsg = document.getElementById('importPresetMsg');
const confirmImportPresetsBtn = document.getElementById('confirmImportPresetsBtn');
const cancelImportPresetsBtn = document.getElementById('cancelImportPresetsBtn');
const exportPresetsBtn = document.getElementById('exportPresetsBtn');
const importPresetsBtn = document.getElementById('importPresetsBtn');

let importedPresetData = null;

function showImportPresetsModal() {
  importedPresetData = null;
  presetFileInput.value = '';
  importPresetInfo.textContent = '';
  importPresetMsg.textContent = '';
  confirmImportPresetsBtn.disabled = true;
  importPresetsModal.classList.remove('hidden');
}

function hideImportPresetsModal() {
  importPresetsModal.classList.add('hidden');
  importedPresetData = null;
  presetFileInput.value = '';
}

async function handleExportPresets() {
  try {
    const response = await fetch('/api/presets/export');
    if (!response.ok) throw new Error('导出失败');
    const data = await response.blob();
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presets.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('导出失败：' + err.message);
  }
}

function handlePresetFileSelect(event) {
  const file = event.target.files[0];
  if (!file) {
    importedPresetData = null;
    importPresetInfo.textContent = '';
    confirmImportPresetsBtn.disabled = true;
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.version || !data.presets || !Array.isArray(data.presets)) {
        importPresetInfo.textContent = '无效的文件格式';
        importPresetMsg.textContent = '文件格式不正确，应包含 version 和 presets 字段';
        confirmImportPresetsBtn.disabled = true;
        return;
      }
      importedPresetData = data;
      importPresetInfo.textContent = `发现 ${data.presets.length} 个预设`;
      importPresetMsg.textContent = '';
      confirmImportPresetsBtn.disabled = false;
    } catch (err) {
      importPresetInfo.textContent = '解析失败';
      importPresetMsg.textContent = '无法解析 JSON 文件';
      confirmImportPresetsBtn.disabled = true;
    }
  };
  reader.readAsText(file);
}

async function handleImportPresets() {
  if (!importedPresetData) return;
  const mode = document.querySelector('input[name="importMode"]:checked').value;
  importPresetMsg.textContent = '正在导入...';
  confirmImportPresetsBtn.disabled = true;
  try {
    const res = await fetchJson('/api/presets/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: importedPresetData, mode })
    });
    const message = `导入完成：成功 ${res.imported} 个${res.skipped > 0 ? `，跳过 ${res.skipped} 个` : ''}`;
    importPresetMsg.textContent = message;
    setTimeout(() => {
      hideImportPresetsModal();
      loadSharedPresets();
      renderSharedPresets();
    }, 1000);
  } catch (err) {
    importPresetMsg.textContent = '导入失败：' + err.message;
    confirmImportPresetsBtn.disabled = false;
  }
}

exportPresetsBtn.addEventListener('click', handleExportPresets);
importPresetsBtn.addEventListener('click', showImportPresetsModal);
closeImportPresetsModal.addEventListener('click', hideImportPresetsModal);
cancelImportPresetsBtn.addEventListener('click', hideImportPresetsModal);
importPresetsModal.querySelector('.modal-backdrop').addEventListener('click', hideImportPresetsModal);
presetFileInput.addEventListener('change', handlePresetFileSelect);
confirmImportPresetsBtn.addEventListener('click', handleImportPresets);

const presetPermissionsModal = document.getElementById('presetPermissionsModal');
const closePresetPermissionsModal = document.getElementById('closePresetPermissionsModal');
const presetPermissionsInfo = document.getElementById('presetPermissionsInfo');
const canEditUsersList = document.getElementById('canEditUsersList');
const canDeleteUsersList = document.getElementById('canDeleteUsersList');
const addCanEditUser = document.getElementById('addCanEditUser');
const addCanDeleteUser = document.getElementById('addCanDeleteUser');
const addCanEditUserBtn = document.getElementById('addCanEditUserBtn');
const addCanDeleteUserBtn = document.getElementById('addCanDeleteUserBtn');
const savePresetPermissionsBtn = document.getElementById('savePresetPermissionsBtn');
const cancelPresetPermissionsBtn = document.getElementById('cancelPresetPermissionsBtn');
const presetPermissionsMsg = document.getElementById('presetPermissionsMsg');

let currentEditingPresetId = null;
let currentPresetPermissions = null;
let currentPresetCreatedBy = null;

function showPresetPermissionsModal(presetId) {
  currentEditingPresetId = presetId;
  presetPermissionsMsg.textContent = '';
  addCanEditUser.value = '';
  addCanDeleteUser.value = '';
  const preset = state.sharedPresets.find(p => p.id === presetId);
  if (!preset) {
    presetPermissionsMsg.textContent = '预设不存在';
    return;
  }
  currentPresetCreatedBy = preset.createdBy;
  presetPermissionsInfo.innerHTML = `
    <div class="preset-name">${escapeHtml(preset.name)}</div>
    <div class="preset-created-by">创建者: ${escapeHtml(preset.createdBy)}</div>
  `;
  fetchJson(`/api/presets/${presetId}/permissions`)
    .then(data => {
      currentPresetPermissions = data.permissions;
      renderPermissionsLists();
      presetPermissionsModal.classList.remove('hidden');
    })
    .catch(err => {
      presetPermissionsMsg.textContent = err.message;
    });
}

function hidePresetPermissionsModal() {
  presetPermissionsModal.classList.add('hidden');
  currentEditingPresetId = null;
  currentPresetPermissions = null;
  currentPresetCreatedBy = null;
}

function renderPermissionsLists() {
  if (!currentPresetPermissions) return;
  canEditUsersList.innerHTML = currentPresetPermissions.canEdit.map(user => `
    <span class="permission-user-chip ${user === currentPresetCreatedBy ? 'is-creator' : ''}" data-user="${escapeHtml(user)}">
      ${escapeHtml(user)}
      ${user !== currentPresetCreatedBy ? '<span class="remove-user" data-action="remove-edit" data-user="' + escapeHtml(user) + '">×</span>' : ''}
    </span>
  `).join('');
  canDeleteUsersList.innerHTML = currentPresetPermissions.canDelete.map(user => `
    <span class="permission-user-chip ${user === currentPresetCreatedBy ? 'is-creator' : ''}" data-user="${escapeHtml(user)}">
      ${escapeHtml(user)}
      ${user !== currentPresetCreatedBy ? '<span class="remove-user" data-action="remove-delete" data-user="' + escapeHtml(user) + '">×</span>' : ''}
    </span>
  `).join('');
  canEditUsersList.querySelectorAll('.remove-user').forEach(el => {
    el.addEventListener('click', () => {
      const user = el.dataset.user;
      currentPresetPermissions.canEdit = currentPresetPermissions.canEdit.filter(u => u !== user);
      renderPermissionsLists();
    });
  });
  canDeleteUsersList.querySelectorAll('.remove-user').forEach(el => {
    el.addEventListener('click', () => {
      const user = el.dataset.user;
      currentPresetPermissions.canDelete = currentPresetPermissions.canDelete.filter(u => u !== user);
      renderPermissionsLists();
    });
  });
}

addCanEditUserBtn.addEventListener('click', () => {
  const user = addCanEditUser.value.trim();
  if (!user) return;
  if (currentPresetPermissions.canEdit.includes(user)) {
    presetPermissionsMsg.textContent = '用户已在编辑权限列表中';
    return;
  }
  currentPresetPermissions.canEdit.push(user);
  addCanEditUser.value = '';
  renderPermissionsLists();
});

addCanDeleteUserBtn.addEventListener('click', () => {
  const user = addCanDeleteUser.value.trim();
  if (!user) return;
  if (currentPresetPermissions.canDelete.includes(user)) {
    presetPermissionsMsg.textContent = '用户已在删除权限列表中';
    return;
  }
  currentPresetPermissions.canDelete.push(user);
  addCanDeleteUser.value = '';
  renderPermissionsLists();
});

savePresetPermissionsBtn.addEventListener('click', async () => {
  if (!currentEditingPresetId || !currentPresetPermissions) return;
  try {
    await fetchJson(`/api/presets/${currentEditingPresetId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: currentPresetPermissions })
    });
    hidePresetPermissionsModal();
    await loadSharedPresets();
    renderSharedPresets();
  } catch (err) {
    presetPermissionsMsg.textContent = err.message;
  }
});

closePresetPermissionsModal.addEventListener('click', hidePresetPermissionsModal);
cancelPresetPermissionsBtn.addEventListener('click', hidePresetPermissionsModal);
presetPermissionsModal.querySelector('.modal-backdrop').addEventListener('click', hidePresetPermissionsModal);

document.querySelectorAll('[data-permission-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!currentPresetPermissions) return;
    const mode = btn.dataset.permissionMode;
    if (mode === 'owner') {
      currentPresetPermissions = {
        canEdit: [currentPresetCreatedBy],
        canDelete: [currentPresetCreatedBy]
      };
    } else if (mode === 'team') {
      currentPresetPermissions = {
        canEdit: [currentPresetCreatedBy],
        canDelete: [currentPresetCreatedBy]
      };
    } else if (mode === 'public') {
      currentPresetPermissions = {
        canEdit: ['*'],
        canDelete: [currentPresetCreatedBy]
      };
    }
    renderPermissionsLists();
  });
});

const exportModal = document.getElementById('exportModal');
const closeExportModal = document.getElementById('closeExportModal');
const exportBtn = document.getElementById('exportBtn');
const confirmExportBtn = document.getElementById('confirmExportBtn');
const cancelExportBtn = document.getElementById('cancelExportBtn');
const exportMsg = document.getElementById('exportMsg');
const exportTaskSelectEl = document.getElementById('exportTaskSelectEl');
const exportTaskSelect = document.getElementById('exportTaskSelect');
const shareToFeishuCheckbox = document.getElementById('shareToFeishu');
const feishuChannelInput = document.getElementById('feishuChannelInput');
const feishuChannelId = document.getElementById('feishuChannelId');
const shareToFeishuBtn = document.getElementById('shareToFeishuBtn');
const feishuShareSection = document.getElementById('feishuShareSection');
const shareToDingTalkBtn = document.getElementById('shareToDingTalkBtn');
const shareToDingTalkCheckbox = document.getElementById('shareToDingTalk');
const dingtalkWebhookInput = document.getElementById('dingtalkWebhookInput');
const dingtalkWebhook = document.getElementById('dingtalkWebhook');
const dingtalkShareSection = document.getElementById('dingtalkShareSection');

function showExportModal() {
  exportMsg.textContent = '';
  renderExportTaskSelect();
  updateExportTaskSelectVisibility();
  updateFeishuShareVisibility();
  updateDingTalkShareVisibility();
  updateWecomShareVisibility();
  checkFeishuConfig();
  checkDingTalkConfig();
  checkWecomConfig();
  exportModal.classList.remove('hidden');
}

function hideExportModal() {
  exportModal.classList.add('hidden');
}

function updateExportTaskSelectVisibility() {
  const exportType = document.querySelector('input[name="exportType"]:checked').value;
  if (exportType === 'task-report') {
    exportTaskSelect.classList.remove('hidden');
  } else {
    exportTaskSelect.classList.add('hidden');
  }
}

function updateFeishuShareVisibility() {
  const format = document.querySelector('input[name="exportFormat"]:checked').value;
  const isPngFormat = format === 'png';
  
  if (isPngFormat) {
    feishuShareSection.classList.remove('hidden');
  } else {
    feishuShareSection.classList.add('hidden');
    shareToFeishuCheckbox.checked = false;
    feishuChannelInput.classList.add('hidden');
    confirmExportBtn.classList.remove('hidden');
    shareToFeishuBtn.classList.add('hidden');
  }
}

function updateDingTalkShareVisibility() {
  const format = document.querySelector('input[name="exportFormat"]:checked').value;
  const isPngFormat = format === 'png';
  
  if (isPngFormat) {
    dingtalkShareSection.classList.remove('hidden');
  } else {
    dingtalkShareSection.classList.add('hidden');
    shareToDingTalkCheckbox.checked = false;
    dingtalkWebhookInput.classList.add('hidden');
    confirmExportBtn.classList.remove('hidden');
    shareToDingTalkBtn.classList.add('hidden');
  }
}

async function checkFeishuConfig() {
  try {
    const response = await fetch('/api/feishu/config');
    const data = await response.json();
    if (!data.configured) {
      feishuShareSection.querySelector('.field-label').textContent = '分享到飞书 (需配置)';
      shareToFeishuCheckbox.disabled = true;
    } else {
      feishuShareSection.querySelector('.field-label').textContent = '分享到飞书';
      shareToFeishuCheckbox.disabled = false;
    }
  } catch (err) {
    shareToFeishuCheckbox.disabled = true;
  }
}

function updateFeishuButtonVisibility() {
  if (shareToFeishuCheckbox.checked) {
    confirmExportBtn.classList.add('hidden');
    shareToFeishuBtn.classList.remove('hidden');
    feishuChannelInput.classList.remove('hidden');
  } else {
    confirmExportBtn.classList.remove('hidden');
    shareToFeishuBtn.classList.add('hidden');
    feishuChannelInput.classList.add('hidden');
  }
}

async function checkDingTalkConfig() {
  try {
    const response = await fetch('/api/dingtalk/config');
    const data = await response.json();
    if (!data.configured) {
      dingtalkShareSection.querySelector('.field-label').textContent = '分享到钉钉 (需配置)';
      shareToDingTalkCheckbox.disabled = true;
    } else {
      dingtalkShareSection.querySelector('.field-label').textContent = '分享到钉钉';
      shareToDingTalkCheckbox.disabled = false;
    }
  } catch (err) {
    shareToDingTalkCheckbox.disabled = true;
  }
}

function updateDingTalkButtonVisibility() {
  if (shareToDingTalkCheckbox.checked) {
    confirmExportBtn.classList.add('hidden');
    shareToDingTalkBtn.classList.remove('hidden');
    dingtalkWebhookInput.classList.remove('hidden');
  } else {
    confirmExportBtn.classList.remove('hidden');
    shareToDingTalkBtn.classList.add('hidden');
    dingtalkWebhookInput.classList.add('hidden');
  }
}

async function handleShareToFeishu() {
  const exportType = document.querySelector('input[name="exportType"]:checked').value;
  const taskId = exportTaskSelectEl.value;
  const channelId = feishuChannelId.value.trim();
  
  if (!channelId) {
    exportMsg.textContent = '请输入飞书群 ID';
    return;
  }
  
  let screenshotType = 'dashboard';
  if (exportType === 'task-report') {
    if (!taskId) {
      exportMsg.textContent = '请选择任务';
      return;
    }
    screenshotType = 'task-report';
  }

  exportMsg.textContent = '正在生成截图...';
  shareToFeishuBtn.disabled = true;
  confirmExportBtn.disabled = true;
  
  try {
    const response = await fetch('/api/export/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: screenshotType, taskId, format: 'png' })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || '生成截图失败');
    }
    
    const htmlContent = await response.text();
    const imageBase64 = await convertHtmlToBase64Png(htmlContent);
    
    exportMsg.textContent = '正在发送到飞书...';
    
    const shareResponse = await fetch('/api/share/feishu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        type: screenshotType, 
        taskId: taskId || undefined,
        channelId,
        imageBase64
      })
    });
    
    if (!shareResponse.ok) {
      const err = await shareResponse.json();
      throw new Error(err.error || '分享到飞书失败');
    }
    
    const result = await shareResponse.json();
    exportMsg.textContent = '分享成功!';
    setTimeout(() => hideExportModal(), 1000);
  } catch (err) {
    exportMsg.textContent = err.message;
  } finally {
    shareToFeishuBtn.disabled = false;
    confirmExportBtn.disabled = false;
  }
}

async function handleShareToDingTalk() {
  const exportType = document.querySelector('input[name="exportType"]:checked').value;
  const taskId = exportTaskSelectEl.value;
  const webhook = dingtalkWebhook.value.trim();
  
  if (!webhook) {
    exportMsg.textContent = '请输入钉钉群 webhook 地址';
    return;
  }
  
  let screenshotType = 'dashboard';
  if (exportType === 'task-report') {
    if (!taskId) {
      exportMsg.textContent = '请选择任务';
      return;
    }
    screenshotType = 'task-report';
  }

  exportMsg.textContent = '正在生成截图...';
  shareToDingTalkBtn.disabled = true;
  confirmExportBtn.disabled = true;
  
  try {
    const response = await fetch('/api/export/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: screenshotType, taskId, format: 'png' })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || '生成截图失败');
    }
    
    const htmlContent = await response.text();
    const imageBase64 = await convertHtmlToBase64Png(htmlContent);
    
    exportMsg.textContent = '正在发送到钉钉...';
    
    const shareResponse = await fetch('/api/share/dingtalk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        type: screenshotType, 
        taskId: taskId || undefined,
        webhook,
        imageBase64
      })
    });
    
    if (!shareResponse.ok) {
      const err = await shareResponse.json();
      throw new Error(err.error || '分享到钉钉失败');
    }
    
    const result = await shareResponse.json();
    exportMsg.textContent = '分享成功!';
    setTimeout(() => hideExportModal(), 1000);
  } catch (err) {
    exportMsg.textContent = err.message;
  } finally {
    shareToDingTalkBtn.disabled = false;
    confirmExportBtn.disabled = false;
  }
}

function convertHtmlToBase64Png(htmlContent) {
  return new Promise((resolve, reject) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '1200px';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    const element = container;
    
    if (typeof htmlToImage === 'undefined') {
      document.body.removeChild(container);
      reject(new Error('html-to-image 库未加载'));
      return;
    }

    htmlToImage.toPng(element, {
      backgroundColor: '#ffffff',
      quality: 1,
      pixelRatio: 2,
      width: 1200,
      height: element.offsetHeight || 800
    })
    .then((dataUrl) => {
      document.body.removeChild(container);
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    })
    .catch((error) => {
      document.body.removeChild(container);
      reject(error);
    });
  });
}

function renderExportTaskSelect() {
  const tasks = state.tasks;
  exportTaskSelectEl.innerHTML = '<option value="">选择任务...</option>' +
    tasks.map(t => `<option value="${t.id}">${escapeHtml(t.title)} (${statusLabel(t.status)})</option>`).join('');
}

async function handleExport() {
  const exportType = document.querySelector('input[name="exportType"]:checked').value;
  const format = document.querySelector('input[name="exportFormat"]:checked').value;
  
  if (format === 'png') {
    if (exportType === 'task-report') {
      const taskId = exportTaskSelectEl.value;
      if (!taskId) {
        exportMsg.textContent = '请选择任务';
        return;
      }
      exportMsg.textContent = '正在生成 PNG 图片...';
      confirmExportBtn.disabled = true;
      try {
        const response = await fetch('/api/export/screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'task-report', taskId, format: 'png' })
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || '导出失败');
        }
        const htmlContent = await response.text();
        await convertHtmlToPngAndDownload(htmlContent, 'task-report.png');
        exportMsg.textContent = '导出成功';
        setTimeout(() => hideExportModal(), 500);
      } catch (err) {
        exportMsg.textContent = err.message;
      } finally {
        confirmExportBtn.disabled = false;
      }
      return;
    }

    let screenshotType = 'dashboard';
    if (exportType === 'snapshot') {
      screenshotType = 'dashboard';
    } else if (exportType === 'dashboard') {
      screenshotType = 'dashboard';
    }

    exportMsg.textContent = '正在生成 PNG 图片...';
    confirmExportBtn.disabled = true;
    try {
      const response = await fetch('/api/export/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: screenshotType, format: 'png' })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '导出失败');
      }
      const htmlContent = await response.text();
      const filename = exportType === 'snapshot' ? 'dashboard-snapshot.png' : 'full-dashboard.png';
      await convertHtmlToPngAndDownload(htmlContent, filename);
      exportMsg.textContent = '导出成功';
      setTimeout(() => hideExportModal(), 500);
    } catch (err) {
      exportMsg.textContent = err.message;
    } finally {
      confirmExportBtn.disabled = false;
    }
    return;
  }
  
  if (exportType === 'task-report') {
    const taskId = exportTaskSelectEl.value;
    if (!taskId) {
      exportMsg.textContent = '请选择任务';
      return;
    }
    exportMsg.textContent = '正在导出...';
    confirmExportBtn.disabled = true;
    try {
      const response = await fetch('/api/export/task-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, format })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '导出失败');
      }
      const blob = await response.blob();
      downloadBlob(blob, `task-report.${format}`);
      exportMsg.textContent = '导出成功';
      setTimeout(() => hideExportModal(), 500);
    } catch (err) {
      exportMsg.textContent = err.message;
    } finally {
      confirmExportBtn.disabled = false;
    }
    return;
  }

  let url = '';
  if (exportType === 'snapshot') {
    url = `/api/export/snapshot?format=${format}`;
  } else if (exportType === 'dashboard') {
    url = `/api/export/dashboard?format=${format}`;
  }

  exportMsg.textContent = '正在导出...';
  confirmExportBtn.disabled = true;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || '导出失败');
    }
    const blob = await response.blob();
    const filename = exportType === 'snapshot' ? 'dashboard-snapshot' : 'full-dashboard';
    downloadBlob(blob, `${filename}.${format}`);
    exportMsg.textContent = '导出成功';
    setTimeout(() => hideExportModal(), 500);
  } catch (err) {
    exportMsg.textContent = err.message;
  } finally {
    confirmExportBtn.disabled = false;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function convertHtmlToPngAndDownload(htmlContent, filename) {
  return new Promise((resolve, reject) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '1200px';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    const element = container;
    
    if (typeof htmlToImage === 'undefined') {
      document.body.removeChild(container);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      downloadBlob(blob, filename.replace('.png', '.html'));
      resolve();
      return;
    }

    htmlToImage.toPng(element, {
      backgroundColor: '#ffffff',
      quality: 1,
      pixelRatio: 2,
      width: 1200,
      height: element.offsetHeight || 800
    })
    .then((dataUrl) => {
      document.body.removeChild(container);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      resolve();
    })
    .catch((error) => {
      document.body.removeChild(container);
      downloadBlob(new Blob([htmlContent], { type: 'text/html' }), filename.replace('.png', '.html'));
      resolve();
    });
  });
}

exportBtn.addEventListener('click', showExportModal);
closeExportModal.addEventListener('click', hideExportModal);
cancelExportBtn.addEventListener('click', hideExportModal);
exportModal.querySelector('.modal-backdrop').addEventListener('click', hideExportModal);
confirmExportBtn.addEventListener('click', handleExport);
shareToFeishuBtn.addEventListener('click', handleShareToFeishu);
shareToDingTalkBtn.addEventListener('click', handleShareToDingTalk);

document.querySelectorAll('input[name="exportType"]').forEach(radio => {
  radio.addEventListener('change', updateExportTaskSelectVisibility);
});

document.querySelectorAll('input[name="exportFormat"]').forEach(radio => {
  radio.addEventListener('change', () => {
    updateFeishuShareVisibility();
    updateDingTalkShareVisibility();
    updateWecomShareVisibility();
  });
});

shareToFeishuCheckbox.addEventListener('change', updateFeishuButtonVisibility);
shareToDingTalkCheckbox.addEventListener('change', updateDingTalkButtonVisibility);

const shareToWecomBtn = document.getElementById('shareToWecomBtn');
const shareToWecomCheckbox = document.getElementById('shareToWecom');
const wecomWebhookInput = document.getElementById('wecomWebhookInput');
const wecomWebhook = document.getElementById('wecomWebhook');
const wecomShareSection = document.getElementById('wecomShareSection');

function updateWecomShareVisibility() {
  const format = document.querySelector('input[name="exportFormat"]:checked').value;
  const isPngFormat = format === 'png';
  
  if (isPngFormat) {
    wecomShareSection.classList.remove('hidden');
  } else {
    wecomShareSection.classList.add('hidden');
    shareToWecomCheckbox.checked = false;
    wecomWebhookInput.classList.add('hidden');
    confirmExportBtn.classList.remove('hidden');
    shareToWecomBtn.classList.add('hidden');
  }
}

async function checkWecomConfig() {
  try {
    const response = await fetch('/api/wecom/config');
    const data = await response.json();
    if (!data.configured) {
      wecomShareSection.querySelector('.field-label').textContent = '分享到企业微信 (需配置)';
      shareToWecomCheckbox.disabled = true;
    } else {
      wecomShareSection.querySelector('.field-label').textContent = '分享到企业微信';
      shareToWecomCheckbox.disabled = false;
    }
  } catch (err) {
    shareToWecomCheckbox.disabled = true;
  }
}

function updateWecomButtonVisibility() {
  if (shareToWecomCheckbox.checked) {
    confirmExportBtn.classList.add('hidden');
    shareToWecomBtn.classList.remove('hidden');
    wecomWebhookInput.classList.remove('hidden');
  } else {
    confirmExportBtn.classList.remove('hidden');
    shareToWecomBtn.classList.add('hidden');
    wecomWebhookInput.classList.add('hidden');
  }
}

async function handleShareToWecom() {
  const exportType = document.querySelector('input[name="exportType"]:checked').value;
  const taskId = exportTaskSelectEl.value;
  const webhook = wecomWebhook.value.trim();
  
  if (!webhook) {
    exportMsg.textContent = '请输入企业微信群 webhook 地址';
    return;
  }
  
  let screenshotType = 'dashboard';
  if (exportType === 'task-report') {
    if (!taskId) {
      exportMsg.textContent = '请选择任务';
      return;
    }
    screenshotType = 'task-report';
  }

  exportMsg.textContent = '正在生成截图...';
  shareToWecomBtn.disabled = true;
  confirmExportBtn.disabled = true;
  
  try {
    const response = await fetch('/api/export/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: screenshotType, taskId, format: 'png' })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || '生成截图失败');
    }
    
    const htmlContent = await response.text();
    const imageBase64 = await convertHtmlToBase64Png(htmlContent);
    
    exportMsg.textContent = '正在发送到企业微信...';
    
    const shareResponse = await fetch('/api/share/wecom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        type: screenshotType, 
        taskId: taskId || undefined,
        webhook,
        imageBase64
      })
    });
    
    if (!shareResponse.ok) {
      const err = await shareResponse.json();
      throw new Error(err.error || '分享到企业微信失败');
    }
    
    const result = await shareResponse.json();
    exportMsg.textContent = '分享成功!';
    setTimeout(() => hideExportModal(), 1000);
  } catch (err) {
    exportMsg.textContent = err.message;
  } finally {
    shareToWecomBtn.disabled = false;
    confirmExportBtn.disabled = false;
  }
}

shareToWecomBtn.addEventListener('click', handleShareToWecom);
shareToWecomCheckbox.addEventListener('change', updateWecomButtonVisibility);
