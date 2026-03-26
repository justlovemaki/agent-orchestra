/**
 * Main entry point - Application initialization and orchestration
 */

import { state, AUTH_TOKEN_KEY, setAuthToken, clearState } from './state.js';
import { fetchJson, checkAuthStatus, login, register, logout, loadOverview, loadRuntime, loadStats, loadTasks, loadTemplates, loadGroups, loadCombinations, loadSharedPresets, loadWorkflows, loadSessions, loadAuditEvents, loadTrends } from './api.js';
import { renderTrends, renderAgentUsage, renderTaskStatusDistribution, renderAgentWorkloadDistribution, initChartListeners } from './charts.js';
import { escapeHtml, formatDate, show, hide, showById, hideById } from './utils/dom.js';
import { getFilters, hasActiveFilters, syncFiltersToUrl, clearFilterUrl, saveFiltersToStorage, loadFiltersFromStorage, parseFiltersFromUrl, getResolvedDefaultPresets, loadPresetsFromStorage, savePresetsToStorage } from './utils/storage.js';

import { initTaskComponent, renderTaskBoard, applyFilters, clearFilters, renderFilterChips, renderFilterPresets, renderFilterSummary, selectTask } from './components/tasks.js';
import { initAgentComponent, renderAgents, renderAgentCheckboxes, renderGroups, renderGroupFilter } from './components/agents.js';
import { initWorkflowComponent, renderWorkflows } from './components/workflows.js';
import { initSessionComponent, renderSessions } from './components/sessions.js';
import { initNotificationComponent, renderChannels, switchChannelTab } from './components/notifications.js';
import { initCombinationComponent, renderCombinations, switchCombinationTab } from './components/combinations.js';
import { initAdminComponent, renderAdminUI } from './components/admin.js';

let refreshInterval = null;

export async function refreshAll(force = false) {
  const [overview, runtimeRes, statsRes] = await Promise.all([
    loadOverview(force),
    loadRuntime().catch(() => null),
    loadStats().catch(() => null),
    checkAuthStatus(),
    loadTasks(force),
    loadTemplates(),
    loadGroups(),
    loadCombinations(),
    loadSharedPresets(),
    loadWorkflows(),
    loadSessions(),
    loadAuditEvents(force)
  ]);

  render();
  await loadTrends(state.trendsDays);

  if (state.selectedTaskId && state.tasks.some(task => task.id === state.selectedTaskId)) {
    const { selectTask: doSelectTask } = await import('./components/tasks.js');
    await doSelectTask(state.selectedTaskId);
  } else if (state.selectedTaskId) {
    state.selectedTaskId = null;
    const logEmptyEl = document.getElementById('logEmpty');
    const detailBodyEl = document.getElementById('detailBody');
    if (logEmptyEl) show(logEmptyEl);
    if (detailBodyEl) hide(detailBodyEl);
  }
}

export function render() {
  renderStats();
  renderSystemInfo();
  renderAgents();
  renderAgentCheckboxes();
  renderGroups();
  renderGroupFilter();
  renderCombinations();
  renderTaskBoard();
  renderFilterChips();
  renderFilterPresets();
  renderFilterSummary();
  renderWorkflows();
  renderSessions();
  renderChannels();
  renderAuthUI();
  renderAdminUI();
}

function renderStats() {
  const statsEl = document.getElementById('stats');
  if (!statsEl) return;

  const overview = state.overview;
  if (!overview) {
    statsEl.innerHTML = '<div class="muted">加载中...</div>';
    return;
  }

  statsEl.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${overview.runningTasks || 0}</div>
        <div class="stat-label">运行中</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${overview.queuedTasks || 0}</div>
        <div class="stat-label">待执行</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${overview.completedToday || 0}</div>
        <div class="stat-label">今日完成</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${overview.failedToday || 0}</div>
        <div class="stat-label">今日失败</div>
      </div>
    </div>
  `;
}

function renderSystemInfo() {
  const systemInfoEl = document.getElementById('systemInfo');
  if (!systemInfoEl) return;

  const runtime = state.runtime;
  if (!runtime) {
    systemInfoEl.innerHTML = '<div class="muted small">系统信息加载中...</div>';
    return;
  }

  const agents = runtime.agents || [];
  const totalRunning = agents.reduce((sum, a) => sum + (a.runningTasks || 0), 0);
  const totalQueued = agents.reduce((sum, a) => sum + (a.queuedTasks || 0), 0);

  systemInfoEl.innerHTML = `
    <div class="system-info-row">
      <span class="system-info-label">Agent 数量</span>
      <span class="system-info-value">${agents.length}</span>
    </div>
    <div class="system-info-row">
      <span class="system-info-label">总运行任务</span>
      <span class="system-info-value">${totalRunning}</span>
    </div>
    <div class="system-info-row">
      <span class="system-info-label">总排队任务</span>
      <span class="system-info-value">${totalQueued}</span>
    </div>
    <div class="system-info-row">
      <span class="system-info-label">在线状态</span>
      <span class="system-info-value success">正常</span>
    </div>
  `;
}

function renderAuthUI() {
  const userInfo = document.getElementById('userInfo');
  const loginBtnContainer = document.getElementById('loginBtnContainer');
  const currentUserName = document.getElementById('currentUserName');

  if (state.currentUser) {
    if (userInfo) show(userInfo);
    if (loginBtnContainer) hide(loginBtnContainer);
    if (currentUserName) {
      const roleBadge = state.isAdmin ? '<span class="user-role-badge admin">管理员</span>' : '<span class="user-role-badge user">用户</span>';
      currentUserName.innerHTML = `${escapeHtml(state.currentUser.name)} ${roleBadge}`;
    }
  } else {
    if (userInfo) hide(userInfo);
    if (loginBtnContainer) show(loginBtnContainer);
  }
}

function initAuthHandlers() {
  const loginBtn = document.getElementById('loginBtn');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authSwitchBtn = document.getElementById('authSwitchBtn');
  const cancelAuthBtn = document.getElementById('cancelAuthBtn');
  const closeAuthModal = document.getElementById('closeAuthModal');
  const logoutBtn = document.getElementById('logoutBtn');
  const authModal = document.getElementById('authModal');

  let authMode = 'login';

  function showAuthModal(mode = 'login') {
    authMode = mode;
    if (authModal) show(authModal);
    const authNameInput = document.getElementById('authNameInput');
    const authPasswordInput = document.getElementById('authPasswordInput');
    const authConfirmPasswordInput = document.getElementById('authConfirmPasswordInput');
    const authModalTitle = document.getElementById('authModalTitle');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authSwitchBtn = document.getElementById('authSwitchBtn');
    const confirmPasswordLabel = document.getElementById('confirmPasswordLabel');

    if (authNameInput) authNameInput.value = '';
    if (authPasswordInput) authPasswordInput.value = '';
    if (authConfirmPasswordInput) authConfirmPasswordInput.value = '';
    const authMsg = document.getElementById('authMsg');
    if (authMsg) authMsg.textContent = '';

    if (mode === 'login') {
      if (authModalTitle) authModalTitle.textContent = '登录';
      if (authSubmitBtn) authSubmitBtn.textContent = '登录';
      if (authSwitchBtn) authSwitchBtn.textContent = '注册新账号';
      if (confirmPasswordLabel) hide(confirmPasswordLabel);
    } else {
      if (authModalTitle) authModalTitle.textContent = '注册';
      if (authSubmitBtn) authSubmitBtn.textContent = '注册';
      if (authSwitchBtn) authSwitchBtn.textContent = '已有账号？登录';
      if (confirmPasswordLabel) show(confirmPasswordLabel);
    }
    if (authNameInput) authNameInput.focus();
  }

  function hideAuthModal() {
    if (authModal) hide(authModal);
  }

  if (loginBtn) loginBtn.addEventListener('click', () => showAuthModal('login'));
  if (authSubmitBtn) {
    authSubmitBtn.addEventListener('click', async () => {
      const name = document.getElementById('authNameInput')?.value.trim();
      const password = document.getElementById('authPasswordInput')?.value;
      const confirmPassword = document.getElementById('authConfirmPasswordInput')?.value;
      const authMsg = document.getElementById('authMsg');

      if (!name) { if (authMsg) authMsg.textContent = '请输入用户名'; return; }
      if (!password) { if (authMsg) authMsg.textContent = '请输入密码'; return; }

      if (authMsg) authMsg.textContent = '处理中...';
      authSubmitBtn.disabled = true;

      try {
        if (authMode === 'login') {
          await login(name, password);
          if (authMsg) authMsg.textContent = '登录成功';
          setTimeout(() => { hideAuthModal(); renderAuthUI(); refreshAll(); }, 500);
        } else {
          if (password.length < 4) { if (authMsg) authMsg.textContent = '密码至少需要 4 个字符'; authSubmitBtn.disabled = false; return; }
          if (password !== confirmPassword) { if (authMsg) authMsg.textContent = '两次输入的密码不一致'; authSubmitBtn.disabled = false; return; }
          await register(name, password);
          if (authMsg) authMsg.textContent = '登录成功';
          setTimeout(() => { hideAuthModal(); renderAuthUI(); renderAdminUI(); refreshAll(); }, 500);
        }
      } catch (err) {
        if (authMsg) authMsg.textContent = err.message;
      } finally {
        authSubmitBtn.disabled = false;
      }
    });
  }
  if (authSwitchBtn) authSwitchBtn.addEventListener('click', () => showAuthModal(authMode === 'login' ? 'register' : 'login'));
  if (cancelAuthBtn) cancelAuthBtn.addEventListener('click', () => hideAuthModal());
  if (closeAuthModal) closeAuthModal.addEventListener('click', () => hideAuthModal());
  if (logoutBtn) logoutBtn.addEventListener('click', async () => { await logout(); renderAuthUI(); renderAdminUI(); });
  const backdrop = authModal?.querySelector('.modal-backdrop');
  if (backdrop) backdrop.addEventListener('click', () => hideAuthModal());
}

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

function populateFilterInputs(filters) {
  const filterKeywordEl = document.getElementById('filterKeyword');
  const filterStatusEl = document.getElementById('filterStatus');
  const filterAgentEl = document.getElementById('filterAgent');
  const filterPriorityEl = document.getElementById('filterPriority');
  const filterModeEl = document.getElementById('filterMode');
  const filterTimeFromEl = document.getElementById('filterTimeFrom');
  const filterTimeToEl = document.getElementById('filterTimeTo');

  if (filterKeywordEl) filterKeywordEl.value = filters.keyword || '';
  if (filterStatusEl) filterStatusEl.value = filters.status || '';
  if (filterAgentEl) filterAgentEl.value = filters.agent || '';
  if (filterPriorityEl) filterPriorityEl.value = filters.priority || '';
  if (filterModeEl) filterModeEl.value = filters.mode || '';
  if (filterTimeFromEl && filters.timeFrom) {
    const date = new Date(filters.timeFrom);
    filterTimeFromEl.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  if (filterTimeToEl && filters.timeTo) {
    const date = new Date(filters.timeTo);
    filterTimeToEl.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}

function initRefreshButton() {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => refreshAll(true));
  }
}

function updateLastUpdated() {
  const lastUpdatedEl = document.getElementById('lastUpdated');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = `最后更新: ${new Date().toLocaleTimeString('zh-CN')}`;
  }
}

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    refreshAll();
    updateLastUpdated();
  }, 30000);
}

export async function init() {
  console.log('Initializing Agent Orchestra...');
  
  initAuthHandlers();
  initFilters();
  initRefreshButton();
  
  const taskHandler = initTaskComponent({
    onTaskCreated: () => refreshAll(),
    onTaskAction: () => refreshAll()
  });
  
  initAgentComponent();
  initWorkflowComponent();
  initSessionComponent();
  initNotificationComponent();
  initCombinationComponent(taskHandler);
  initAdminComponent();
  
  initChartListeners(
    async (days) => {
      state.trendsDays = days;
      await loadTrends(days);
      renderTrends();
      renderAgentUsage();
      renderTaskStatusDistribution();
      renderAgentWorkloadDistribution();
    },
    () => applyFilters()
  );
  
  await refreshAll();
  updateLastUpdated();
  startAutoRefresh();
  
  console.log('Agent Orchestra initialized');
}

window.addEventListener('DOMContentLoaded', init);