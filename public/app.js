const state = { overview: null, tasks: [], selectedTaskId: null };

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

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

async function refreshAll(force = false) {
  const [overview, tasksRes] = await Promise.all([
    fetchJson(`/api/overview${force ? '?force=1' : ''}`),
    fetchJson('/api/tasks')
  ]);
  state.overview = overview;
  state.tasks = tasksRes.tasks;
  render();
  if (state.selectedTaskId) await loadTaskDetail(state.selectedTaskId);
}

function render() {
  renderStats();
  renderAgents();
  renderSystemInfo();
  renderTaskBoard();
  renderAgentCheckboxes();
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
  statsEl.innerHTML = items.map(([k,v]) => `<div class="stat"><div class="muted">${k}</div><div class="v">${v}</div></div>`).join('');
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
  systemInfoEl.innerHTML = `
    <div class="kv"><div class="muted">Gateway</div><div>${gateway.reachable ? '可达' : '不可达'}</div></div>
    <div class="kv"><div class="muted">地址</div><div>${escapeHtml(gateway.url || '—')}</div></div>
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
      <div class="muted small prompt-box">${escapeHtml(task.prompt)}</div>
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

form.addEventListener('submit', async (e) => {
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

setInterval(refreshAll, 10000);
refreshAll();

function columnTitle(key) { return ({ queued:'待执行', running:'执行中', completed:'已完成', failed:'失败', canceled:'已取消' })[key] || key; }
function priorityLabel(v) { return ({ low:'低', medium:'中', high:'高' })[v] || v; }
function runStatusLabel(v) { return ({ queued:'待命', running:'执行中', completed:'完成', failed:'失败', canceled:'已取消' })[v] || v; }
function labelStatus(v) { return ({ busy:'忙碌', idle:'空闲', offline:'离线' })[v] || v; }
function statusLabel(v) { return ({ queued:'待执行', running:'执行中', completed:'已完成', failed:'失败', canceled:'已取消' })[v] || v; }
function escapeHtml(str) { return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
