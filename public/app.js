const state = {
  overview: null,
  tasks: [],
  selectedTaskId: null,
  runtime: null,
  filters: {},
  savedPresets: [],
  templates: [],
  editingTemplateId: null
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
    loadTemplates()
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
  agentsGridEl.innerHTML = state.overview.agents.map(agent => `
    <div class="agent-card">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:start;">
        <div>
          <div style="font-weight:700">${escapeHtml(agent.name)}</div>
          <div class="muted small">${escapeHtml(agent.id)}</div>
        </div>
        <span class="badge ${agent.status}">${labelStatus(agent.status)}</span>
      </div>
      <div class="row"><span class="muted">模型</span><span>${escapeHtml(agent.model)}</span></div>
      <div class="row"><span class="muted">会话</span><span>${agent.sessionsCount}</span></div>
      <div class="row"><span class="muted">最近活跃</span><span>${escapeHtml(agent.lastActiveLabel)}</span></div>
      <div class="row"><span class="muted">最新会话</span><span class="small">${agent.latestSession ? escapeHtml(agent.latestSession.ageLabel) : '—'}</span></div>
    </div>
  `).join('');
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
    el.addEventListener('click', () => {
      state.selectedTaskId = el.dataset.taskId;
      loadTaskDetail(state.selectedTaskId);
    });
  });
}

function renderTaskCard(task) {
  const runs = task.runs.map(r => `${r.agentId}:${runStatusLabel(r.status)}`).join(' · ');
  return `
    <div class="task-card ${state.selectedTaskId === task.id ? 'selected' : ''}" data-task-id="${task.id}">
      <div class="title">${escapeHtml(task.title)}</div>
      <div class="meta">
        <div>优先级：${priorityLabel(task.priority)} · 模式：${task.mode === 'parallel' ? '并行' : '串行'}</div>
        <div>状态：${statusLabel(task.status)}</div>
        <div>Agent：${escapeHtml((task.agents || []).join('、') || '—')}</div>
        <div>执行：${escapeHtml(runs)}</div>
        <div>创建：${escapeHtml(task.createdAtLabel)}</div>
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

async function loadTaskDetail(taskId) {
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
  cancelBtn.disabled = ['completed', 'failed', 'canceled'].includes(task.status);
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
function statusLabel(v) { return ({ queued: '待执行', running: '执行中', completed: '已完成', failed: '失败', canceled: '已取消' })[v] || v; }
function escapeHtml(str) { return String(str ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s])); }
