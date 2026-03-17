const state = {
  overview: null,
  tasks: [],
  selectedTaskId: null,
  selectedTaskIds: new Set(),
  runtime: null,
  filters: {},
  savedPresets: [],
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
  selectedSessionKey: null
};

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
const presetNameInputEl = document.getElementById('presetNameInput');
const savePresetBtn = document.getElementById('savePresetBtn');
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

const FILTER_STORAGE_KEY = 'agentOrchestraFilters';
const FILTER_PRESET_STORAGE_KEY = 'agentOrchestraFilterPresets';
const DEFAULT_PRESETS = [
  { key: 'running', name: '运行中任务', filters: { status: 'running' } },
  { key: 'high-failed', name: '高优先级失败任务', filters: { status: 'failed', priority: 'high' } },
  { key: 'today', name: '今天创建的任务', filters: { timeFrom: 'dynamic:todayStart', timeTo: 'dynamic:todayEnd' } }
];

async function fetchJson(url, options) {
  const res = await fetch(url, options);
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

async function loadTasks(force = false) {
  const query = buildTaskQuery(state.filters, force);
  const tasksRes = await fetchJson(`/api/tasks${query}`);
  state.tasks = tasksRes.tasks;
}

async function refreshAll(force = false) {
  const [overview, runtimeRes] = await Promise.all([
    fetchJson(`/api/overview${force ? '?force=1' : ''}`),
    fetchJson('/api/runtime').catch(() => null),
    loadTasks(force),
    loadTemplates(),
    loadGroups(),
    loadWorkflows(),
    loadSessions()
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
  return `
    <div class="run-item">
      <div><strong>${escapeHtml(run.agentId)}</strong></div>
      <div class="muted small">${runStatusLabel(run.status)}${run.exitCode != null ? ` · exit ${run.exitCode}` : ''}</div>
      ${run.error ? `<div class="run-error">${escapeHtml(run.error)}</div>` : ''}
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

function saveCurrentPreset() {
  const name = normalizePresetName(presetNameInputEl.value);
  const filters = getFilters();

  if (!name) {
    alert('请先输入预设名称');
    presetNameInputEl.focus();
    return;
  }

  if (!hasActiveFilters(filters)) {
    alert('当前没有可保存的筛选条件');
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
