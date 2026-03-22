const state = {
  overview: null,
  tasks: [],
  selectedTaskId: null,
  selectedTaskIds: new Set(),
  runtime: null,
  filters: {},
  savedPresets: [],
  sharedPresets: [],
  userPresets: [],
  templates: [],
  userTemplates: [],
  editingTemplateId: null,
  groups: [],
  editingGroupId: null,
  combinations: [],
  editingCombinationId: null,
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
  authToken: localStorage.getItem('authToken'),
  syncStatus: 'idle',
  lastSyncTime: null,
  isSyncing: false,
  allUsers: [],
  userPermissions: null,
  isAdmin: false,
  trends: null,
  trendsDays: 14,
  agentUsage: null,
  taskStatusDistribution: null,
  agentWorkloadDistribution: null,
  workloadAlertConfig: null,
  workloadAlertHistory: [],
  usageTrends: null,
  usageTrendsDays: 14,
  usageTrendsCombinationId: null,
  notificationChannels: [],
  editingChannelId: null,
  notificationHistory: [],
  notificationHistoryStats: null,
  notificationHistoryPage: 1,
  notificationHistoryTotalPages: 1,
  notificationHistoryFilters: {},
  currentChannelTab: 'channels',
  notificationTemplates: null,
  templateVariables: [],
  recommendations: [],
  recommendationsGeneratedAt: null,
  currentCombinationTab: 'combinations'
};

const AUTH_TOKEN_KEY = 'authToken';

const statsEl = document.getElementById('stats');
const trendsLoadingEl = document.getElementById('trendsLoading');
const trendsEmptyEl = document.getElementById('trendsEmpty');
const trendsChartEl = document.getElementById('trendsChart');
const trends7dBtn = document.getElementById('trends7d');
const trends14dBtn = document.getElementById('trends14d');
const agentUsageLoadingEl = document.getElementById('agentUsageLoading');
const agentUsageEmptyEl = document.getElementById('agentUsageEmpty');
const agentUsageChartEl = document.getElementById('agentUsageChart');
const taskStatusLoadingEl = document.getElementById('taskStatusLoading');
const taskStatusEmptyEl = document.getElementById('taskStatusEmpty');
const taskStatusChartEl = document.getElementById('taskStatusChart');
const agentWorkloadLoadingEl = document.getElementById('agentWorkloadLoading');
const agentWorkloadEmptyEl = document.getElementById('agentWorkloadEmpty');
const agentWorkloadChartEl = document.getElementById('agentWorkloadChart');
const taskFilterBarEl = document.getElementById('taskFilterBar');

let trendsChartInstance = null;
let agentUsageChartInstance = null;
let taskStatusChartInstance = null;
let agentWorkloadChartInstance = null;
let trendDetailPopup = null;
let usageTrendsChartInstance = null;
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
const showCombinationPanelBtn = document.getElementById('showCombinationPanelBtn');
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

const combinationPanel = document.getElementById('combinationPanel');
const hideCombinationPanelBtn = document.getElementById('hideCombinationPanelBtn');
const combinationForm = document.getElementById('combinationForm');
const combinationNameInput = document.getElementById('combinationNameInput');
const combinationColorInput = document.getElementById('combinationColorInput');
const combinationDescInput = document.getElementById('combinationDescInput');
const combinationAgentCheckboxes = document.getElementById('combinationAgentCheckboxes');
const saveCombinationBtn = document.getElementById('saveCombinationBtn');
const cancelCombinationBtn = document.getElementById('cancelCombinationBtn');
const combinationListEl = document.getElementById('combinationList');
const selectFromCombinationBtn = document.getElementById('selectFromCombinationBtn');
const selectCombinationModal = document.getElementById('selectCombinationModal');
const closeSelectCombinationModal = document.getElementById('closeSelectCombinationModal');
const combinationSelectionList = document.getElementById('combinationSelectionList');
const confirmSelectCombinationBtn = document.getElementById('confirmSelectCombinationBtn');
const cancelSelectCombinationBtn = document.getElementById('cancelSelectCombinationBtn');
const selectCombinationMsg = document.getElementById('selectCombinationMsg');
const recommendationsContainer = document.getElementById('recommendationsContainer');
const recommendationsList = document.getElementById('recommendationsList');
const recommendationsEmpty = document.getElementById('recommendationsEmpty');
const refreshRecommendationsBtn = document.getElementById('refreshRecommendationsBtn');
const combinationTabs = document.querySelectorAll('.combination-tab');

const usageTrendsModal = document.getElementById('usageTrendsModal');
const closeUsageTrendsModal = document.getElementById('closeUsageTrendsModal');
const usageTrendsHeader = document.getElementById('usageTrendsHeader');
const usageTrends7dBtn = document.getElementById('usageTrends7d');
const usageTrends14dBtn = document.getElementById('usageTrends14d');
const usageTrendsLoadingEl = document.getElementById('usageTrendsLoading');
const usageTrendsEmptyEl = document.getElementById('usageTrendsEmpty');
const usageTrendsChartEl = document.getElementById('usageTrendsChart');
const usageTrendsSummaryEl = document.getElementById('usageTrendsSummary');

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
let currentPermissions = {};
let currentEditingPresetId = null;
let currentEditingPresetName = null;

const auditFilterKeywordEl = document.getElementById('auditFilterKeyword');
const auditEventTypeEl = document.getElementById('auditEventType');
const auditTimeFromEl = document.getElementById('auditTimeFrom');
const auditTimeToEl = document.getElementById('auditTimeTo');
const applyAuditFilterBtn = document.getElementById('applyAuditFilterBtn');
const clearAuditFilterBtn = document.getElementById('clearAuditFilterBtn');
const auditFilterChipsEl = document.getElementById('auditFilterChips');
const auditEventsListEl = document.getElementById('auditEventsList');
const auditResultCountEl = document.getElementById('auditResultCount');

const notificationChannelPanel = document.getElementById('notificationChannelPanel');
const showChannelFormBtn = document.getElementById('showChannelFormBtn');
const channelForm = document.getElementById('channelForm');
const channelNameInput = document.getElementById('channelNameInput');
const channelTypeInput = document.getElementById('channelTypeInput');
const channelWebhookInput = document.getElementById('channelWebhookInput');
const saveChannelBtn = document.getElementById('saveChannelBtn');
const cancelChannelBtn = document.getElementById('cancelChannelBtn');
const channelListEl = document.getElementById('channelList');
const channelTabs = document.querySelectorAll('.channel-tab');
const historyTabContent = document.getElementById('historyTabContent');
const notificationStatsEl = document.getElementById('notificationStats');
const notificationHistoryListEl = document.getElementById('notificationHistoryList');
const historyPaginationEl = document.getElementById('historyPagination');
const historyStatusFilter = document.getElementById('historyStatusFilter');
const historyChannelTypeFilter = document.getElementById('historyChannelTypeFilter');
const historyTimeFrom = document.getElementById('historyTimeFrom');
const historyTimeTo = document.getElementById('historyTimeTo');
const applyHistoryFilterBtn = document.getElementById('applyHistoryFilterBtn');
const clearHistoryFilterBtn = document.getElementById('clearHistoryFilterBtn');
const templatesTabContent = document.getElementById('templatesTabContent');
const templatesListEl = document.getElementById('templatesList');
const saveTemplatesBtn = document.getElementById('saveTemplatesBtn');
const resetAllTemplatesBtn = document.getElementById('resetAllTemplatesBtn');

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

const TEMPLATE_STORAGE_KEY = 'agentOrchestraTemplates';

function loadTemplatesFromStorage() {
  try {
    const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveTemplatesToStorage(templates) {
  try {
    if (Array.isArray(templates) && templates.length > 0) {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    } else {
      localStorage.removeItem(TEMPLATE_STORAGE_KEY);
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
    const roleBadge = state.isAdmin ? '<span class="user-role-badge admin">管理员</span>' : '<span class="user-role-badge user">用户</span>';
    currentUserName.innerHTML = `${escapeHtml(state.currentUser.name)} ${roleBadge}`;
  } else {
    userInfo.classList.add('hidden');
    loginBtnContainer.classList.remove('hidden');
  }
}

function renderAdminUI() {
  const adminPanel = document.getElementById('adminPanel');
  const workloadPanel = document.getElementById('workloadAlertPanel');
  const channelPanel = document.getElementById('notificationChannelPanel');
  if (!adminPanel) return;
  
  if (state.isAdmin) {
    adminPanel.classList.remove('hidden');
    if (workloadPanel) workloadPanel.classList.remove('hidden');
    if (channelPanel) channelPanel.classList.remove('hidden');
    loadAllUsers();
    loadUserGroups();
    initUserGroupUI();
    loadWorkloadAlertConfig();
    loadNotificationChannels();
    initChannelFormHandlers();
  } else {
    adminPanel.classList.add('hidden');
    if (workloadPanel) workloadPanel.classList.add('hidden');
    if (channelPanel) channelPanel.classList.add('hidden');
  }
}

async function loadAllUsers() {
  try {
    const res = await fetchJson('/api/admin/users');
    state.allUsers = res.users || [];
    renderUserManagementPanel();
  } catch (err) {
    console.error('加载用户列表失败:', err);
  }
}

function renderUserManagementPanel() {
  const userListEl = document.getElementById('userList');
  if (!userListEl) return;
  
  if (state.allUsers.length === 0) {
    userListEl.innerHTML = '<div class="muted small">暂无用户</div>';
    return;
  }
  
  userListEl.innerHTML = state.allUsers.map(user => {
    const isCurrentUser = user.id === state.currentUser?.id;
    const roleClass = user.role === 'admin' ? 'admin' : 'user';
    const roleLabel = user.role === 'admin' ? '管理员' : '普通用户';
    const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN') : '—';
    const lastLoginAt = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN') : '从未登录';
    
    return `
      <div class="user-item" data-user-id="${user.id}">
        <div class="user-item-info">
          <div class="user-item-name">${escapeHtml(user.name)} ${isCurrentUser ? '<span class="muted">(本人)</span>' : ''} ${user.groupId ? `<span class="user-group-badge">${escapeHtml(allUserGroups.find(g => g.id === user.groupId)?.name || '未知组')}</span>` : ''}</div>
          <div class="user-item-meta">
            <span class="user-role-badge ${roleClass}">${roleLabel}</span>
            <span>注册: ${createdAt}</span>
            <span>最后登录: ${lastLoginAt}</span>
          </div>
        </div>
        <div class="user-item-actions">
          ${!isCurrentUser ? `
            <select class="user-role-select" data-user-id="${user.id}">
              <option value="user" ${user.role !== 'admin' ? 'selected' : ''}>普通用户</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>管理员</option>
            </select>
            <select class="user-group-select" data-user-id="${user.id}" style="margin-left: 8px;">
              <option value="">无</option>
              ${allUserGroups.map(g => `<option value="${g.id}" ${user.groupId === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
            </select>
            <button class="ghost tiny update-role-btn" data-user-id="${user.id}" data-user-name="${escapeHtml(user.name)}" style="margin-left: 8px;">更新角色</button>
            <button class="ghost tiny update-group-btn" data-user-id="${user.id}" data-user-name="${escapeHtml(user.name)}">更新组</button>
          ` : '<span class="muted small">当前用户</span>'}
        </div>
      </div>
    `;
  }).join('');
  
  userListEl.querySelectorAll('.update-role-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const userId = btn.dataset.userId;
      const userName = btn.dataset.userName;
      const select = userListEl.querySelector(`.user-role-select[data-user-id="${userId}"]`);
      const newRole = select.value;
      
      if (!confirm(`确定要将用户 "${userName}" 的角色修改为 ${newRole === 'admin' ? '管理员' : '普通用户'} 吗？`)) {
        return;
      }
      
      try {
        await fetchJson(`/api/users/${userId}/role`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole })
        });
        alert('角色已更新');
        await loadAllUsers();
      } catch (err) {
        alert('更新失败: ' + err.message);
      }
    });
  });
  
  userListEl.querySelectorAll('.update-group-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const userId = btn.dataset.userId;
      const userName = btn.dataset.userName;
      const select = userListEl.querySelector(`.user-group-select[data-user-id="${userId}"]`);
      const groupId = select.value || null;
      
      const groupName = groupId ? (allUserGroups.find(g => g.id === groupId)?.name || '未知组') : '无';
      if (!confirm(`确定要将用户 "${userName}" 的组别修改为 ${groupName} 吗？`)) {
        return;
      }
      
      try {
        await fetchJson(`/api/admin/users/${userId}/group`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId })
        });
        alert('用户组已更新');
        await loadAllUsers();
        await loadUserGroups();
      } catch (err) {
        alert('更新失败：' + err.message);
      }
    });
  });
}

// User Group Management
let allUserGroups = [];

async function loadUserGroups() {
  try {
    const res = await fetchJson('/api/admin/user-groups');
    allUserGroups = res.groups || [];
    renderUserGroupList();
  } catch (err) {
    console.error('加载用户组列表失败:', err);
  }
}

function renderUserGroupList() {
  const listEl = document.getElementById('userGroupList');
  if (!listEl) return;
  
  if (allUserGroups.length === 0) {
    listEl.innerHTML = '<div class="muted small">暂无用户组</div>';
    return;
  }
  
  listEl.innerHTML = allUserGroups.map(group => `
    <div class="user-group-item" data-group-id="${group.id}">
      <div class="user-group-item-info">
        <div class="user-group-item-name">
          ${escapeHtml(group.name)}
          <span class="user-group-badge">${group.memberCount || 0} 名成员</span>
        </div>
        <div class="user-group-item-meta">
          ${group.description ? escapeHtml(group.description) : '<span class="muted">无描述</span>'}
        </div>
      </div>
      <div class="user-group-item-actions">
        <button class="ghost tiny edit-group-btn" data-group-id="${group.id}">编辑</button>
        <button class="danger tiny delete-group-btn" data-group-id="${group.id}">删除</button>
      </div>
    </div>
  `).join('');
  
  listEl.querySelectorAll('.edit-group-btn').forEach(btn => {
    btn.addEventListener('click', () => openUserGroupModal(btn.dataset.groupId));
  });
  
  listEl.querySelectorAll('.delete-group-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const groupId = btn.dataset.groupId;
      const group = allUserGroups.find(g => g.id === groupId);
      if (!confirm(`确定要删除用户组 "${group.name}" 吗？`)) return;
      
      try {
        await fetchJson(`/api/admin/user-groups/${groupId}`, { method: 'DELETE' });
        await loadUserGroups();
        await loadAllUsers();
      } catch (err) {
        alert('删除失败：' + err.message);
      }
    });
  });
}

function openUserGroupModal(groupId = null) {
  const modal = document.getElementById('userGroupModal');
  const title = document.getElementById('userGroupModalTitle');
  const form = document.getElementById('userGroupForm');
  const idInput = document.getElementById('userGroupId');
  const nameInput = document.getElementById('userGroupName');
  const descInput = document.getElementById('userGroupDescription');
  const membersDiv = document.getElementById('userGroupMembers');
  
  form.reset();
  idInput.value = '';
  
  if (groupId) {
    title.textContent = '编辑用户组';
    const group = allUserGroups.find(g => g.id === groupId);
    if (group) {
      idInput.value = group.id;
      nameInput.value = group.name;
      descInput.value = group.description || '';
    }
  } else {
    title.textContent = '创建用户组';
  }
  
  // Render member checkboxes
  if (state.allUsers && state.allUsers.length > 0) {
    const groupMemberIds = groupId ? (allUserGroups.find(g => g.id === groupId)?.memberIds || []) : [];
    membersDiv.innerHTML = state.allUsers.map(user => `
      <label style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
        <input type="checkbox" value="${user.id}" ${groupMemberIds.includes(user.id) ? 'checked' : ''} />
        <span>${escapeHtml(user.name)}${user.id === state.currentUser?.id ? ' (本人)' : ''}</span>
      </label>
    `).join('');
  }
  
  modal.classList.remove('hidden');
}

async function initUserGroupUI() {
  const createBtn = document.getElementById('createUserGroupBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => openUserGroupModal());
  }
  
  const form = document.getElementById('userGroupForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msgEl = document.getElementById('userGroupFormMsg');
      const groupId = document.getElementById('userGroupId').value;
      const name = document.getElementById('userGroupName').value;
      const description = document.getElementById('userGroupDescription').value;
      
      // Get selected members
      const memberCheckboxes = document.querySelectorAll('#userGroupMembers input[type="checkbox"]:checked');
      const memberIds = Array.from(memberCheckboxes).map(cb => cb.value);
      
      try {
        if (groupId) {
          // Update existing group
          await fetchJson(`/api/admin/user-groups/${groupId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
          });
          
          // Update members (remove all then add selected)
          const group = allUserGroups.find(g => g.id === groupId);
          const oldMemberIds = group?.memberIds || [];
          
          // Remove members not in selection
          for (const oldId of oldMemberIds) {
            if (!memberIds.includes(oldId)) {
              await fetchJson(`/api/admin/user-groups/${groupId}/members/${oldId}`, { method: 'DELETE' });
            }
          }
          
          // Add new members
          for (const newId of memberIds) {
            if (!oldMemberIds.includes(newId)) {
              await fetchJson(`/api/admin/user-groups/${groupId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: newId })
              });
            }
          }
          
          msgEl.textContent = '用户组已更新';
        } else {
          // Create new group
          const group = await fetchJson('/api/admin/user-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
          });
          
          // Add members
          for (const memberId of memberIds) {
            await fetchJson(`/api/admin/user-groups/${group.id}/members`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: memberId })
            });
          }
          
          msgEl.textContent = '用户组已创建';
        }
        
        setTimeout(() => { msgEl.textContent = ''; }, 3000);
        document.getElementById('userGroupModal').classList.add('hidden');
        await loadUserGroups();
        await loadAllUsers();
      } catch (err) {
        msgEl.textContent = '操作失败：' + err.message;
      }
    });
  }
}

async function checkAuthStatus() {
  if (!state.authToken) {
    state.currentUser = null;
    state.userPermissions = null;
    state.isAdmin = false;
    renderAuthUI();
    renderAdminUI();
    return;
  }
  try {
    const res = await fetchJson('/api/auth/me');
    state.currentUser = res.user;
    state.isAdmin = res.user.role === 'admin';
    try {
      const permRes = await fetchJson('/api/users/me/permissions');
      state.userPermissions = permRes.permissions;
    } catch {}
  } catch (err) {
    state.currentUser = null;
    state.userPermissions = null;
    state.isAdmin = false;
    state.authToken = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
  renderAuthUI();
  renderAdminUI();
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
        syncUserData();
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
      state.isAdmin = res.user.role === 'admin';
      localStorage.setItem(AUTH_TOKEN_KEY, res.token);
      authMsg.textContent = '登录成功';
      setTimeout(async () => {
        hideAuthModal();
        renderAuthUI();
        renderAdminUI();
        try {
          const permRes = await fetchJson('/api/users/me/permissions');
          state.userPermissions = permRes.permissions;
        } catch {}
        syncUserData();
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
  state.isAdmin = false;
  state.userPermissions = null;
  state.allUsers = [];
  localStorage.removeItem(AUTH_TOKEN_KEY);
  renderAuthUI();
  renderAdminUI();
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
  const [overview, runtimeRes, statsRes] = await Promise.all([
    fetchJson(`/api/overview${force ? '?force=1' : ''}`),
    fetchJson('/api/runtime').catch(() => null),
    fetchJson('/api/stats').catch(() => null),
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
  state.overview = overview;
  state.runtime = runtimeRes;
  state.stats = statsRes?.stats || null;
  render();
  await loadTrends();
  if (state.selectedTaskId && state.tasks.some(task => task.id === state.selectedTaskId)) {
    await loadTaskDetail(state.selectedTaskId);
  } else if (state.selectedTaskId) {
    state.selectedTaskId = null;
    logEmptyEl.classList.remove('hidden');
    detailBodyEl.classList.add('hidden');
  }
}

async function loadTrends(days = state.trendsDays) {
  trendsLoadingEl.classList.remove('hidden');
  trendsEmptyEl.classList.add('hidden');
  trendsChartEl.style.display = 'none';
  agentUsageLoadingEl.classList.remove('hidden');
  agentUsageEmptyEl.classList.add('hidden');
  agentUsageChartEl.style.display = 'none';
  taskStatusLoadingEl.classList.remove('hidden');
  taskStatusEmptyEl.classList.add('hidden');
  taskStatusChartEl.style.display = 'none';
  agentWorkloadLoadingEl.classList.remove('hidden');
  agentWorkloadEmptyEl.classList.add('hidden');
  agentWorkloadChartEl.style.display = 'none';
  
  try {
    const res = await fetchJson(`/api/stats/trends?days=${days}`);
    state.trends = res.trends || [];
    state.trendsDays = res.days || days;
    state.agentUsage = res.agentUsage || [];
    state.taskStatusDistribution = res.taskStatusDistribution || [];
    state.agentWorkloadDistribution = res.agentWorkloadDistribution || [];
    renderTrends();
    renderAgentUsage();
    renderTaskStatusDistribution();
    renderAgentWorkloadDistribution();
  } catch (err) {
    state.trends = [];
    state.agentUsage = [];
    state.taskStatusDistribution = [];
    state.agentWorkloadDistribution = [];
    renderTrends();
    renderAgentUsage();
    renderTaskStatusDistribution();
    renderAgentWorkloadDistribution();
  }
}

function handleLegendToggle(event, legendItem, legend) {
  const index = legendItem.datasetIndex;
  const ci = legend.chart;
  const meta = ci.getDatasetMeta(index);
  
  meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
  ci.update();
}

function handleTrendsChartClick(event, elements) {
  if (elements.length === 0) return;
  
  const element = elements[0];
  const dataIndex = element.index;
  const trend = state.trends[dataIndex];
  if (!trend) return;
  
  const date = new Date(trend.date);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  
  const completionRate = trend.total > 0 ? ((trend.completed / trend.total) * 100).toFixed(1) : '0.0';
  const failRate = trend.total > 0 ? ((trend.failed / trend.total) * 100).toFixed(1) : '0.0';
  
  const timeFromValue = `${dateStr}T00:00`;
  const timeToValue = `${dateStr}T23:59`;
  
  const popupContent = `
    <div class="trend-detail-popup">
      <div class="trend-detail-header">${dateStr} 详细统计</div>
      <div class="trend-detail-row">
        <span class="trend-detail-label">总任务</span>
        <span class="trend-detail-value">${trend.total}</span>
      </div>
      <div class="trend-detail-row">
        <span class="trend-detail-label" style="color: #44d19f;">完成</span>
        <span class="trend-detail-value">${trend.completed} (${completionRate}%)</span>
      </div>
      <div class="trend-detail-row">
        <span class="trend-detail-label" style="color: #ff718d;">失败</span>
        <span class="trend-detail-value">${trend.failed} (${failRate}%)</span>
      </div>
      <div class="trend-detail-row">
        <span class="trend-detail-label" style="color: #7aa2ff;">进行中</span>
        <span class="trend-detail-value">${trend.running || 0}</span>
      </div>
      <div class="trend-detail-actions">
        <button class="trend-detail-btn" data-time-from="${timeFromValue}" data-time-to="${timeToValue}">查看该日期任务</button>
      </div>
      <div class="trend-detail-footer">点击图例可显示/隐藏对应数据线</div>
    </div>
  `;
  
  showTrendDetailPopup(event, popupContent);
}

function showTrendDetailPopup(event, content) {
  removeTrendDetailPopup();
  
  const popup = document.createElement('div');
  popup.id = 'trendDetailPopup';
  popup.className = 'trend-detail-container';
  popup.innerHTML = content;
  
  const chartRect = trendsChartEl.getBoundingClientRect();
  const x = event.clientX - chartRect.left + 10;
  const y = event.clientY - chartRect.top - 10;
  
  popup.style.left = `${Math.min(x, chartRect.width - 200)}px`;
  popup.style.top = `${Math.max(y - 100, 0)}px`;
  
  trendsChartEl.parentElement.appendChild(popup);
  trendDetailPopup = popup;
  
  const viewTasksBtn = popup.querySelector('.trend-detail-btn');
  if (viewTasksBtn) {
    viewTasksBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const timeFrom = viewTasksBtn.dataset.timeFrom;
      const timeTo = viewTasksBtn.dataset.timeTo;
      filterTimeFromEl.value = timeFrom;
      filterTimeToEl.value = timeTo;
      removeTrendDetailPopup();
      taskFilterBarEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      await applyFilters();
    });
  }
  
  setTimeout(() => {
    document.addEventListener('click', handlePopupOutsideClick, { once: true });
  }, 10);
}

function removeTrendDetailPopup() {
  if (trendDetailPopup) {
    trendDetailPopup.remove();
    trendDetailPopup = null;
  }
}

function handlePopupOutsideClick(event) {
  if (trendDetailPopup && !trendDetailPopup.contains(event.target) && !trendsChartEl.contains(event.target)) {
    removeTrendDetailPopup();
  }
}

function renderTrends() {
  trendsLoadingEl.classList.add('hidden');
  
  if (!state.trends || state.trends.length === 0) {
    trendsEmptyEl.classList.remove('hidden');
    trendsChartEl.style.display = 'none';
    if (trendsChartInstance) {
      trendsChartInstance.destroy();
      trendsChartInstance = null;
    }
    return;
  }
  
  trendsEmptyEl.classList.add('hidden');
  trendsChartEl.style.display = 'block';
  
  const labels = state.trends.map(t => {
    const d = new Date(t.date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  
  const totalData = state.trends.map(t => t.total);
  const completedData = state.trends.map(t => t.completed);
  const failedData = state.trends.map(t => t.failed);
  
  if (trendsChartInstance) {
    trendsChartInstance.destroy();
  }
  
  const ctx = trendsChartEl.getContext('2d');
  trendsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '总任务',
          data: totalData,
          borderColor: '#7aa2ff',
          backgroundColor: 'rgba(122, 162, 255, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          label: '完成',
          data: completedData,
          borderColor: '#44d19f',
          backgroundColor: 'rgba(68, 209, 159, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          label: '失败',
          data: failedData,
          borderColor: '#ff718d',
          backgroundColor: 'rgba(255, 113, 141, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      onClick: handleTrendsChartClick,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#95a5c6',
            usePointStyle: true,
            padding: 16
          },
          onClick: handleLegendToggle
        },
        tooltip: {
          backgroundColor: 'rgba(11, 20, 36, 0.95)',
          titleColor: '#eff4ff',
          bodyColor: '#c5d0e8',
          borderColor: 'rgba(144, 168, 220, 0.24)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(144, 168, 220, 0.08)',
            drawBorder: false
          },
          ticks: {
            color: '#6f81a8'
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(144, 168, 220, 0.08)',
            drawBorder: false
          },
          ticks: {
            color: '#6f81a8',
            stepSize: 1
          }
        }
      }
    }
  });
}

function handleAgentChartClick(event, elements) {
  if (elements.length === 0) return;
  const dataIndex = elements[0].index;
  const agent = state.agentUsage[dataIndex];
  if (!agent) return;
  
  const agentName = agent.agentName;
  
  state.filters = { ...state.filters, agent: agentName };
  populateFilterInputs(state.filters);
  saveFiltersToStorage(state.filters);
  syncFiltersToUrl(state.filters);
  
  taskFilterBarEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  loadTasks().then(() => {
    renderTaskBoard();
    renderFilterChips();
    renderFilterPresets();
    renderFilterSummary();
  });
}

async function loadAgentUsage() {
  agentUsageLoadingEl.classList.remove('hidden');
  agentUsageEmptyEl.classList.add('hidden');
  agentUsageChartEl.style.display = 'none';
  
  try {
    const res = await fetchJson(`/api/stats/trends?days=${state.trendsDays}`);
    state.agentUsage = res.agentUsage || [];
    renderAgentUsage();
  } catch (err) {
    state.agentUsage = [];
    renderAgentUsage();
  }
}

function renderAgentUsage() {
  agentUsageLoadingEl.classList.add('hidden');
  
  if (!state.agentUsage || state.agentUsage.length === 0) {
    agentUsageEmptyEl.classList.remove('hidden');
    agentUsageChartEl.style.display = 'none';
    if (agentUsageChartInstance) {
      agentUsageChartInstance.destroy();
      agentUsageChartInstance = null;
    }
    return;
  }
  
  agentUsageEmptyEl.classList.add('hidden');
  agentUsageChartEl.style.display = 'block';
  
  const labels = state.agentUsage.map(a => a.agentName);
  const successData = state.agentUsage.map(a => a.successCount);
  const failData = state.agentUsage.map(a => a.failCount);
  
  if (agentUsageChartInstance) {
    agentUsageChartInstance.destroy();
  }
  
  const ctx = agentUsageChartEl.getContext('2d');
  agentUsageChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '成功',
          data: successData,
          backgroundColor: '#44d19f',
          borderRadius: 4
        },
        {
          label: '失败',
          data: failData,
          backgroundColor: '#ff718d',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      onClick: handleAgentChartClick,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#95a5c6',
            usePointStyle: true,
            padding: 16
          }
        },
        tooltip: {
          backgroundColor: 'rgba(11, 20, 36, 0.95)',
          titleColor: '#eff4ff',
          bodyColor: '#c5d0e8',
          borderColor: 'rgba(144, 168, 220, 0.24)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const dataIndex = context.dataIndex;
              const agent = state.agentUsage[dataIndex];
              const total = agent.taskCount;
              const percentage = ((context.raw / total) * 100).toFixed(1);
              return `${context.dataset.label}: ${context.raw} (${percentage}%)`;
            },
            footer: function(tooltipItems) {
              const dataIndex = tooltipItems[0].dataIndex;
              const agent = state.agentUsage[dataIndex];
              return `总计: ${agent.taskCount} 次`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            color: 'rgba(144, 168, 220, 0.08)',
            drawBorder: false
          },
          ticks: {
            color: '#6f81a8',
            maxRotation: 45,
            minRotation: 0
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: {
            color: 'rgba(144, 168, 220, 0.08)',
            drawBorder: false
          },
          ticks: {
            color: '#6f81a8',
            stepSize: 1
          }
        }
      }
    }
  });
}

function handleTaskStatusChartClick(event, elements) {
  if (elements.length === 0) return;
  
  const dataIndex = elements[0].index;
  const statusData = state.taskStatusDistribution[dataIndex];
  if (!statusData) return;
  
  const statusMap = {
    pending: 'queued',
    running: 'running',
    completed: 'completed',
    failed: 'failed',
    paused: 'paused',
    cancelled: 'canceled'
  };
  const statusValue = statusMap[statusData.status] || statusData.status;
  
  state.filters = { ...state.filters, status: statusValue };
  filterStatusEl.value = statusValue;
  populateFilterInputs(state.filters);
  saveFiltersToStorage(state.filters);
  syncFiltersToUrl(state.filters);
  
  taskFilterBarEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  loadTasks().then(() => {
    renderTaskBoard();
    renderFilterChips();
    renderFilterPresets();
    renderFilterSummary();
  });
}

function renderTaskStatusDistribution() {
  taskStatusLoadingEl.classList.add('hidden');
  
  if (!state.taskStatusDistribution || state.taskStatusDistribution.length === 0) {
    taskStatusEmptyEl.classList.remove('hidden');
    taskStatusChartEl.style.display = 'none';
    if (taskStatusChartInstance) {
      taskStatusChartInstance.destroy();
      taskStatusChartInstance = null;
    }
    return;
  }
  
  const hasData = state.taskStatusDistribution.some(s => s.count > 0);
  if (!hasData) {
    taskStatusEmptyEl.classList.remove('hidden');
    taskStatusChartEl.style.display = 'none';
    if (taskStatusChartInstance) {
      taskStatusChartInstance.destroy();
      taskStatusChartInstance = null;
    }
    return;
  }
  
  taskStatusEmptyEl.classList.add('hidden');
  taskStatusChartEl.style.display = 'block';
  
  const statusLabels = {
    pending: '待执行',
    running: '执行中',
    completed: '已完成',
    failed: '失败',
    paused: '已暂停',
    cancelled: '已取消'
  };
  
  const statusColors = {
    pending: '#7aa2ff',
    running: '#f5c66a',
    completed: '#44d19f',
    failed: '#ff718d',
    paused: '#8a7dff',
    cancelled: '#6b7280'
  };
  
  const labels = state.taskStatusDistribution.map(s => statusLabels[s.status] || s.status);
  const data = state.taskStatusDistribution.map(s => s.count);
  const backgroundColors = state.taskStatusDistribution.map(s => statusColors[s.status] || '#7aa2ff');
  
  if (taskStatusChartInstance) {
    taskStatusChartInstance.destroy();
  }
  
  const ctx = taskStatusChartEl.getContext('2d');
  taskStatusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: backgroundColors,
        borderColor: 'rgba(11, 20, 36, 0.86)',
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      onClick: handleTaskStatusChartClick,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#95a5c6',
            usePointStyle: true,
            padding: 16,
            font: {
              size: 13
            },
            generateLabels: function(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, i) => {
                  const dataset = data.datasets[0];
                  const value = dataset.data[i];
                  const total = dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  return {
                    text: `${label}: ${value} (${percentage}%)`,
                    fillStyle: dataset.backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(11, 20, 36, 0.95)',
          titleColor: '#eff4ff',
          bodyColor: '#c5d0e8',
          borderColor: 'rgba(144, 168, 220, 0.24)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${value} 个任务 (${percentage}%)`;
            },
            afterLabel: function(context) {
              return '点击查看该状态的任务';
            }
          }
        }
      }
    }
  });
}

function handleAgentWorkloadChartClick(event, elements) {
  if (elements.length === 0) return;

  const dataIndex = elements[0].index;
  const agentData = state.agentWorkloadDistribution[dataIndex];
  if (!agentData) return;

  const agentName = agentData.agentName;

  state.filters = { ...state.filters, agent: agentName };
  filterAgentEl.value = agentName;
  populateFilterInputs(state.filters);
  saveFiltersToStorage(state.filters);
  syncFiltersToUrl(state.filters);

  taskFilterBarEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  loadTasks().then(() => {
    renderTaskBoard();
    renderFilterChips();
    renderFilterPresets();
    renderFilterSummary();
  });
}

function renderAgentWorkloadDistribution() {
  agentWorkloadLoadingEl.classList.add('hidden');

  if (!state.agentWorkloadDistribution || state.agentWorkloadDistribution.length === 0) {
    agentWorkloadEmptyEl.classList.remove('hidden');
    agentWorkloadChartEl.style.display = 'none';
    if (agentWorkloadChartInstance) {
      agentWorkloadChartInstance.destroy();
      agentWorkloadChartInstance = null;
    }
    return;
  }

  agentWorkloadEmptyEl.classList.add('hidden');
  agentWorkloadChartEl.style.display = 'block';

  const labels = state.agentWorkloadDistribution.map(a => a.agentName);
  const data = state.agentWorkloadDistribution.map(a => a.workloadCount);

  const colors = [
    '#7aa2ff', '#44d19f', '#f5c66a', '#ff718d', '#8a7dff',
    '#64d2ff', '#ffd666', '#ff85c0', '#5cdd72', '#ff9c6e'
  ];

  const backgroundColors = labels.map((_, i) => colors[i % colors.length]);

  if (agentWorkloadChartInstance) {
    agentWorkloadChartInstance.destroy();
  }

  const ctx = agentWorkloadChartEl.getContext('2d');
  agentWorkloadChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: backgroundColors,
        borderColor: 'rgba(11, 20, 36, 0.86)',
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      onClick: handleAgentWorkloadChartClick,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#95a5c6',
            usePointStyle: true,
            padding: 16,
            font: {
              size: 13
            },
            generateLabels: function(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, i) => {
                  const dataset = data.datasets[0];
                  const value = dataset.data[i];
                  const total = dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  return {
                    text: `${label}: ${value} (${percentage}%)`,
                    fillStyle: dataset.backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          },
          onClick: handleLegendToggle
        },
        tooltip: {
          backgroundColor: 'rgba(11, 20, 36, 0.95)',
          titleColor: '#eff4ff',
          bodyColor: '#c5d0e8',
          borderColor: 'rgba(144, 168, 220, 0.24)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${value} 个任务 (${percentage}%)`;
            },
            afterLabel: function(context) {
              return '点击查看该 Agent 的任务';
            }
          }
        }
      }
    }
  });
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
  renderSyncStatus();
  renderGroupFilter();
  renderGroupList();
  renderWorkflows();
  renderSessionList();
  renderSpawnAgentSelect();
  renderAuditEvents();
  renderAuditFilterChips();
  renderAuditResultCount();
  renderAgentUsage();
  renderTaskStatusDistribution();
  renderAgentWorkloadDistribution();
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
  if (state.stats) {
    items.push(['今日任务', state.stats.todayTasks]);
    items.push(['本周任务', state.stats.weekTasks]);
    items.push(['总任务', state.stats.totalTasks]);
  }
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
      const canEdit = state.isAdmin || permissions.canEdit.includes('Master') || permissions.canEdit.includes('*') || permissions.canEdit.includes(preset.createdBy) || permissions.canEdit.includes(state.currentUser?.id);
      const canDelete = state.isAdmin || permissions.canDelete.includes('Master') || permissions.canDelete.includes(preset.createdBy) || permissions.canDelete.includes(state.currentUser?.id);
      const isOwner = preset.createdBy === 'Master' || preset.createdBy === state.currentUser?.id;
      const canManagePermissions = state.isAdmin || isOwner;
      return `
        <span class="preset-chip preset-chip-shared ${active ? 'is-active' : ''}" data-shared-preset-id="${preset.id}">
          <button type="button" class="preset-chip-name" data-action="apply" data-shared-preset-id="${preset.id}">${escapeHtml(preset.name)}</button>
          <span class="preset-chip-meta muted small">by ${escapeHtml(preset.createdBy)}</span>
          <span class="preset-chip-actions">
            <button type="button" data-action="permissions" data-shared-preset-id="${preset.id}" title="管理权限" ${canManagePermissions ? '' : 'disabled'}>权限</button>
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
  const preset = state.savedPresets[index];
  if (preset && state.currentUser) {
    syncDeletePresetFromCloud(preset.name);
  }
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
  const nextPreset = { name, filters, updatedAt: Date.now() };
  if (existingIndex >= 0) {
    state.savedPresets.splice(existingIndex, 1, nextPreset);
  } else {
    state.savedPresets.unshift(nextPreset);
  }
  state.savedPresets = state.savedPresets.slice(0, 8);
  savePresetsToStorage(state.savedPresets);
  presetNameInputEl.value = '';
  renderFilterPresets();
  if (state.currentUser) {
    syncPresetToCloud(nextPreset);
  }
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

async function loadCombinations() {
  const res = await fetchJson('/api/agent-combinations');
  state.combinations = res.combinations || [];
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

async function syncUserData() {
  if (!state.currentUser || state.isSyncing) return;
  state.isSyncing = true;
  state.syncStatus = 'syncing';
  renderSyncStatus();
  try {
    const [presetsRes, templatesRes] = await Promise.all([
      fetchJson('/api/sync/presets'),
      fetchJson('/api/sync/templates')
    ]);
    state.sharedPresets = presetsRes.presets.filter(p => !p.isUserPreset);
    state.userPresets = presetsRes.presets.filter(p => p.isUserPreset);
    state.userTemplates = templatesRes.templates || [];
    state.savedPresets = mergePresetsFromCloud(state.userPresets);
    state.templates = mergeTemplatesFromCloud(state.userTemplates);
    savePresetsToStorage(state.savedPresets);
    saveTemplatesToStorage(state.templates);
    state.lastSyncTime = Date.now();
    state.syncStatus = 'synced';
    renderFilterPresets();
    renderTemplates();
    renderTemplateSelect();
  } catch (err) {
    console.error('同步失败:', err);
    state.syncStatus = 'error';
  } finally {
    state.isSyncing = false;
    renderSyncStatus();
  }
}

function mergePresetsFromCloud(userPresets) {
  const localPresets = loadPresetsFromStorage();
  const cloudMap = new Map(userPresets.map(p => [p.name, p]));
  const merged = [];
  const seenNames = new Set();
  for (const preset of localPresets) {
    const cloudPreset = cloudMap.get(preset.name);
    if (cloudPreset) {
      merged.push({ ...cloudPreset, name: preset.name, filters: cloudPreset.filters });
      seenNames.add(preset.name);
    } else {
      merged.push(preset);
      seenNames.add(preset.name);
    }
  }
  for (const preset of userPresets) {
    if (!seenNames.has(preset.name)) {
      merged.push({ name: preset.name, filters: preset.filters });
      seenNames.add(preset.name);
    }
  }
  return merged.slice(0, 8);
}

function mergeTemplatesFromCloud(userTemplates) {
  const localTemplates = loadTemplatesFromStorage();
  const cloudMap = new Map(userTemplates.map(t => [t.id, t]));
  const merged = [...localTemplates];
  for (const template of userTemplates) {
    if (!merged.find(t => t.id === template.id)) {
      merged.push(template);
    }
  }
  return merged;
}

async function syncPresetToCloud(preset) {
  if (!state.currentUser) return;
  try {
    const existing = state.userPresets.find(p => p.name === preset.name);
    if (existing) {
      const updated = await fetchJson(`/api/sync/presets/${existing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: preset.name, filters: preset.filters })
      });
      const idx = state.userPresets.findIndex(p => p.id === existing.id);
      state.userPresets[idx] = updated.preset;
    } else {
      const created = await fetchJson('/api/sync/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: preset.name, filters: preset.filters })
      });
      state.userPresets.push(created.preset);
    }
  } catch (err) {
    console.error('同步预设到云端失败:', err);
  }
}

async function syncDeletePresetFromCloud(presetName) {
  if (!state.currentUser) return;
  try {
    const preset = state.userPresets.find(p => p.name === presetName);
    if (preset) {
      await fetchJson(`/api/sync/presets/${preset.id}`, { method: 'DELETE' });
      state.userPresets = state.userPresets.filter(p => p.id !== preset.id);
    }
  } catch (err) {
    console.error('删除云端预设失败:', err);
  }
}

async function syncTemplateToCloud(template) {
  if (!state.currentUser) return;
  try {
    if (template.id) {
      const existing = state.userTemplates.find(t => t.id === template.id);
      if (existing) {
        const updated = await fetchJson(`/api/sync/templates/${template.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(template)
        });
        const idx = state.userTemplates.findIndex(t => t.id === template.id);
        state.userTemplates[idx] = updated.template;
        return;
      }
    }
    const created = await fetchJson('/api/sync/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template)
    });
    const idx = state.templates.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      state.templates[idx].id = created.template.id;
    }
    if (state.editingTemplateId === template.id) {
      state.editingTemplateId = created.template.id;
    }
    state.userTemplates.push(created.template);
  } catch (err) {
    console.error('同步模板到云端失败:', err);
  }
}

async function syncDeleteTemplateFromCloud(templateId) {
  if (!state.currentUser) return;
  try {
    const template = state.userTemplates.find(t => t.id === templateId);
    if (template) {
      await fetchJson(`/api/sync/templates/${templateId}`, { method: 'DELETE' });
      state.userTemplates = state.userTemplates.filter(t => t.id !== templateId);
    }
  } catch (err) {
    console.error('删除云端模板失败:', err);
  }
}

function renderSyncStatus() {
  const syncIndicator = document.getElementById('syncIndicator');
  if (!syncIndicator) return;
  if (!state.currentUser) {
    syncIndicator.classList.add('hidden');
    return;
  }
  syncIndicator.classList.remove('hidden');
  const statusMap = {
    idle: { text: '未同步', class: 'sync-idle' },
    syncing: { text: '同步中...', class: 'sync-syncing' },
    synced: { text: '已同步', class: 'sync-synced' },
    error: { text: '同步失败', class: 'sync-error' }
  };
  const status = statusMap[state.syncStatus] || statusMap.idle;
  syncIndicator.innerHTML = `<span class="sync-dot ${status.class}"></span><span class="sync-text">${status.text}</span>`;
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
        if (state.currentUser) {
          await syncDeleteTemplateFromCloud(templateId);
        }
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
    id: state.editingTemplateId || crypto.randomUUID(),
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
    if (state.currentUser) {
      await syncTemplateToCloud(payload);
    }
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
  if (selectedCombinationId) {
    payload.combinationId = selectedCombinationId;
  }
  try {
    const { task } = await fetchJson('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    formMsg.textContent = `任务已创建：${task.title}`;
    form.reset();
    selectedCombinationId = null;
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

async function loadWorkloadAlertConfig() {
  if (!state.isAdmin) return;
  try {
    const res = await fetchJson('/api/admin/workload-alerts/config');
    state.workloadAlertConfig = res;
    renderWorkloadAlertConfig();
    await loadWorkloadAlertHistory();
  } catch (err) {
    console.error('加载负载预警配置失败:', err);
  }
}

function renderWorkloadAlertConfig() {
  const config = state.workloadAlertConfig;
  if (!config) return;
  
  const enabledCheckbox = document.getElementById('workloadAlertEnabled');
  const thresholdInput = document.getElementById('workloadThreshold');
  const warningThresholdInput = document.getElementById('warningThreshold');
  const criticalThresholdInput = document.getElementById('criticalThreshold');
  const silencePeriodInput = document.getElementById('silencePeriodMinutes');
  const messageTemplateWarning = document.getElementById('messageTemplateWarning');
  const messageTemplateCritical = document.getElementById('messageTemplateCritical');
  const channelCheckboxes = document.querySelectorAll('input[name="notifyChannel"]');
  
  if (enabledCheckbox) {
    enabledCheckbox.checked = config.enabled || false;
  }
  if (thresholdInput) {
    thresholdInput.value = config.threshold || 5;
  }
  if (warningThresholdInput) {
    warningThresholdInput.value = config.warningThreshold || 0.8;
  }
  if (criticalThresholdInput) {
    criticalThresholdInput.value = config.criticalThreshold || 1.0;
  }
  if (silencePeriodInput) {
    silencePeriodInput.value = config.silencePeriodMinutes || 30;
  }
  if (messageTemplateWarning && config.messageTemplate) {
    messageTemplateWarning.value = config.messageTemplate.warning || '';
  }
  if (messageTemplateCritical && config.messageTemplate) {
    messageTemplateCritical.value = config.messageTemplate.critical || '';
  }
  if (channelCheckboxes) {
    channelCheckboxes.forEach(cb => {
      cb.checked = (config.notifyChannels || []).includes(cb.value);
    });
  }
  
  updateNextCheckTimeDisplay();
}

function updateNextCheckTimeDisplay() {
  const nextCheckEl = document.getElementById('nextCheckTime');
  if (!nextCheckEl) return;
  
  if (state.workloadAlertConfig?.enabled) {
    const now = Date.now();
    const nextCheck = now + (5 * 60 * 1000);
    const nextTime = new Date(nextCheck).toLocaleTimeString('zh-CN');
    nextCheckEl.textContent = `下次检查: ${nextTime}`;
  } else {
    nextCheckEl.textContent = '预警已禁用';
  }
}

async function saveWorkloadAlertConfig() {
  const enabledCheckbox = document.getElementById('workloadAlertEnabled');
  const thresholdInput = document.getElementById('workloadThreshold');
  const warningThresholdInput = document.getElementById('warningThreshold');
  const criticalThresholdInput = document.getElementById('criticalThreshold');
  const silencePeriodInput = document.getElementById('silencePeriodMinutes');
  const messageTemplateWarning = document.getElementById('messageTemplateWarning');
  const messageTemplateCritical = document.getElementById('messageTemplateCritical');
  const channelCheckboxes = document.querySelectorAll('input[name="notifyChannel"]:checked');
  
  const enabled = enabledCheckbox?.checked || false;
  const threshold = parseInt(thresholdInput?.value) || 5;
  const warningThreshold = parseFloat(warningThresholdInput?.value) || 0.8;
  const criticalThreshold = parseFloat(criticalThresholdInput?.value) || 1.0;
  const silencePeriodMinutes = parseInt(silencePeriodInput?.value) || 30;
  const notifyChannels = Array.from(channelCheckboxes).map(cb => cb.value);
  
  const messageTemplate = {
    warning: messageTemplateWarning?.value || '',
    critical: messageTemplateCritical?.value || ''
  };
  
  const msgEl = document.getElementById('workloadAlertMsg');
  
  try {
    msgEl.textContent = '保存中...';
    const result = await fetchJson('/api/admin/workload-alerts/config', {
      method: 'PUT',
      body: JSON.stringify({ 
        enabled, 
        threshold, 
        warningThreshold, 
        criticalThreshold, 
        notifyChannels,
        messageTemplate,
        silencePeriodMinutes
      })
    });
    msgEl.textContent = '配置已保存';
    state.workloadAlertConfig = result;
    renderWorkloadAlertConfig();
    updateNextCheckTimeDisplay();
    setTimeout(() => { msgEl.textContent = ''; }, 3000);
  } catch (err) {
    msgEl.textContent = '保存失败: ' + err.message;
  }
}

async function triggerWorkloadCheck() {
  const msgEl = document.getElementById('workloadAlertMsg');
  
  try {
    msgEl.textContent = '正在检查...';
    const result = await fetchJson('/api/admin/workload-alerts/check', {
      method: 'POST'
    });
    
    const warningCount = (result.warningAgents || []).length;
    const criticalCount = (result.criticalAgents || []).length;
    const totalCount = warningCount + criticalCount;
    
    if (totalCount > 0) {
      let msg = '';
      if (criticalCount > 0) {
        msg += `严重: ${criticalCount} 个`;
      }
      if (warningCount > 0) {
        msg += (msg ? ', ' : '') + `警告: ${warningCount} 个`;
      }
      msgEl.textContent = `发现 ${msg} Agent 负载预警`;
    } else {
      msgEl.textContent = '所有 Agent 负载正常';
    }
    
    await loadWorkloadAlertHistory();
    setTimeout(() => { msgEl.textContent = ''; }, 5000);
  } catch (err) {
    msgEl.textContent = '检查失败: ' + err.message;
  }
}

async function loadWorkloadAlertHistory() {
  try {
    const res = await fetchJson('/api/admin/workload-alerts/history?limit=20');
    state.workloadAlertHistory = res.alerts || [];
    renderWorkloadAlertHistory();
  } catch (err) {
    console.error('加载预警历史失败:', err);
  }
}

function renderWorkloadAlertHistory() {
  const container = document.getElementById('workloadAlertHistory');
  if (!container) return;
  
  const history = state.workloadAlertHistory || [];
  
  if (history.length === 0) {
    container.innerHTML = '<div class="muted small">暂无预警记录</div>';
    return;
  }
  
  container.innerHTML = history.map(event => {
    const details = event.details || {};
    const agents = details.agents || [];
    const time = new Date(event.timestamp).toLocaleString('zh-CN');
    const channelsText = (details.notifyChannels || []).join(', ') || '未通知';
    
    const warningAgents = agents.filter(a => a.level === 'warning');
    const criticalAgents = agents.filter(a => a.level === 'critical');
    
    let levelBadge = `<span class="workload-alert-badge">${agents.length} 个 Agent</span>`;
    if (warningAgents.length > 0 && criticalAgents.length > 0) {
      levelBadge = `
        <span class="workload-alert-badge warning">警告: ${warningAgents.length}</span>
        <span class="workload-alert-badge critical">严重: ${criticalAgents.length}</span>
      `;
    } else if (criticalAgents.length > 0) {
      levelBadge = `<span class="workload-alert-badge critical">严重: ${criticalAgents.length}</span>`;
    } else if (warningAgents.length > 0) {
      levelBadge = `<span class="workload-alert-badge warning">警告: ${warningAgents.length}</span>`;
    }
    
    return `
      <div class="workload-alert-item">
        <div class="workload-alert-item-header">
          <span class="workload-alert-time">${time}</span>
          <div class="workload-alert-badges">${levelBadge}</div>
        </div>
        <div class="workload-alert-item-content">
          <div class="workload-alert-threshold">阈值: ${details.threshold || 5}</div>
          <div class="workload-alert-thresholds">分级: ${Math.round((details.warningThreshold || 0) * 100)}% / ${Math.round((details.criticalThreshold || 1) * 100)}%</div>
          <div class="workload-alert-channels">通知: ${channelsText}</div>
        </div>
        <div class="workload-alert-agents">
          ${agents.map(a => `<span class="workload-alert-agent-tag ${a.level || ''}">${escapeHtml(a.agentName)}: ${a.workloadCount} ${a.level === 'critical' ? '🔴' : '⚠️'}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('saveWorkloadAlertConfigBtn')?.addEventListener('click', saveWorkloadAlertConfig);
document.getElementById('checkWorkloadNowBtn')?.addEventListener('click', triggerWorkloadCheck);

document.querySelectorAll('.template-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const level = tab.dataset.level;
    document.querySelectorAll('.template-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('messageTemplateWarning')?.classList.toggle('hidden', level !== 'warning');
    document.getElementById('messageTemplateCritical')?.classList.toggle('hidden', level !== 'critical');
  });
});

setInterval(updateNextCheckTimeDisplay, 60000);

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

showCombinationPanelBtn.addEventListener('click', () => {
  combinationPanel.classList.remove('hidden');
  state.editingCombinationId = null;
  state.currentCombinationTab = 'combinations';
  updateCombinationTabs();
  showCombinationForm();
  renderCombinations();
});

combinationTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    state.currentCombinationTab = tabName;
    updateCombinationTabs();
    if (tabName === 'recommendations') {
      loadRecommendations();
    } else {
      renderCombinations();
    }
  });
});

refreshRecommendationsBtn.addEventListener('click', () => {
  loadRecommendations(true);
});

function updateCombinationTabs() {
  combinationTabs.forEach(tab => {
    if (tab.dataset.tab === state.currentCombinationTab) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  if (state.currentCombinationTab === 'recommendations') {
    combinationListEl.classList.add('hidden');
    combinationForm.classList.add('hidden');
    recommendationsContainer.classList.remove('hidden');
  } else {
    combinationListEl.classList.remove('hidden');
    recommendationsContainer.classList.add('hidden');
  }
}

async function loadRecommendations(forceRefresh = false) {
  recommendationsList.innerHTML = '<div class="loading">加载中...</div>';
  recommendationsEmpty.classList.add('hidden');
  recommendationsContainer.classList.remove('hidden');
  
  try {
    const params = forceRefresh ? '?refresh=true' : '';
    const res = await fetchJson(`/api/agent-combinations/recommendations${params}`);
    state.recommendations = res.recommendations || [];
    state.recommendationsGeneratedAt = res.generatedAt;
    renderRecommendations();
  } catch (err) {
    recommendationsList.innerHTML = `<div class="error">加载推荐失败: ${escapeHtml(err.message)}</div>`;
  }
}

function renderRecommendations() {
  if (!state.recommendations || state.recommendations.length === 0) {
    recommendationsList.innerHTML = '';
    recommendationsEmpty.classList.remove('hidden');
    return;
  }
  
  recommendationsEmpty.classList.add('hidden');
  const agents = state.overview?.agents || [];
  
  recommendationsList.innerHTML = state.recommendations.map(rec => {
    const agentNames = rec.agentNames || rec.agentIds.map(id => {
      const agent = agents.find(a => a.id === id);
      return agent ? agent.name : id;
    });
    
    const confidencePercent = Math.round(rec.confidence * 100);
    const confidenceClass = confidencePercent >= 80 ? 'high' : confidencePercent >= 60 ? 'medium' : 'low';
    
    const typeLabels = {
      frequent_co_occurrence: '高频协同',
      load_balance: '负载均衡',
      hot_combination_completion: '热门补全',
      failure_rate_optimization: '效率优化'
    };
    
    return `
      <div class="recommendation-item" data-recommendation-id="${rec.id}">
        <div class="recommendation-header">
          <span class="recommendation-type">${typeLabels[rec.type] || rec.type}</span>
          <span class="recommendation-confidence ${confidenceClass}">置信度 ${confidencePercent}%</span>
        </div>
        <div class="recommendation-agents">
          ${agentNames.map(name => `<span class="agent-tag">${escapeHtml(name)}</span>`).join('')}
        </div>
        <div class="recommendation-reason">${escapeHtml(rec.reason)}</div>
        <div class="recommendation-actions">
          <button class="primary small apply-recommendation-btn" data-recommendation-id="${rec.id}">应用推荐</button>
          <button class="ghost small dismiss-recommendation-btn" data-recommendation-id="${rec.id}">忽略</button>
        </div>
      </div>
    `;
  }).join('');
  
  recommendationsList.querySelectorAll('.apply-recommendation-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const recId = btn.dataset.recommendationId;
      btn.disabled = true;
      btn.textContent = '应用中...';
      try {
        const res = await fetchJson(`/api/agent-combinations/recommendations/${recId}/apply`, {
          method: 'POST'
        });
        await loadCombinations();
        state.recommendations = state.recommendations.filter(r => r.id !== recId);
        renderRecommendations();
        showToast('已根据推荐创建组合');
      } catch (err) {
        showToast('应用推荐失败: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = '应用推荐';
      }
    });
  });
  
  recommendationsList.querySelectorAll('.dismiss-recommendation-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const recId = btn.dataset.recommendationId;
      const item = btn.closest('.recommendation-item');
      try {
        await fetchJson(`/api/agent-combinations/recommendations/${recId}/dismiss`, {
          method: 'POST'
        });
        state.recommendations = state.recommendations.filter(r => r.id !== recId);
        if (item) {
          item.style.opacity = '0';
          item.style.transform = 'translateX(20px)';
          setTimeout(() => item.remove(), 300);
        }
        setTimeout(renderRecommendations, 300);
      } catch (err) {
        showToast('忽略推荐失败: ' + err.message, 'error');
      }
    });
  });
}

hideCombinationPanelBtn.addEventListener('click', () => {
  combinationPanel.classList.add('hidden');
  hideCombinationForm();
});

saveCombinationBtn.addEventListener('click', () => saveCombination());
cancelCombinationBtn.addEventListener('click', () => hideCombinationForm());

function showCombinationForm(combination = null) {
  combinationForm.classList.remove('hidden');
  if (combination) {
    combinationNameInput.value = combination.name;
    combinationColorInput.value = combination.color || '#6b7280';
    combinationDescInput.value = combination.description || '';
    state.editingCombinationId = combination.id;
    renderCombinationAgentCheckboxes(combination.agentIds);
  } else {
    combinationNameInput.value = '';
    combinationColorInput.value = '#6b7280';
    combinationDescInput.value = '';
    state.editingCombinationId = null;
    renderCombinationAgentCheckboxes([]);
  }
}

function hideCombinationForm() {
  combinationForm.classList.add('hidden');
  combinationNameInput.value = '';
  combinationColorInput.value = '#6b7280';
  combinationDescInput.value = '';
  state.editingCombinationId = null;
}

function renderCombinationAgentCheckboxes(selectedAgentIds = []) {
  const selected = new Set(selectedAgentIds);
  const agents = state.overview?.agents || [];
  combinationAgentCheckboxes.innerHTML = agents.map(agent => `
    <label class="checkbox-item">
      <input type="checkbox" name="combinationAgents" value="${agent.id}" ${selected.has(agent.id) ? 'checked' : ''} />
      <span>${escapeHtml(agent.name)}</span>
    </label>
  `).join('');
}

async function saveCombination() {
  const name = combinationNameInput.value.trim();
  if (!name) {
    alert('请输入组合名称');
    return;
  }
  const agentCheckboxes = combinationAgentCheckboxes.querySelectorAll('input:checked');
  const agentIds = [...agentCheckboxes].map(cb => cb.value);
  const data = {
    name,
    description: combinationDescInput.value.trim(),
    color: combinationColorInput.value,
    agentIds
  };
  try {
    if (state.editingCombinationId) {
      await fetchJson(`/api/agent-combinations/${state.editingCombinationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      await fetchJson('/api/agent-combinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }
    await loadCombinations();
    hideCombinationForm();
    renderCombinations();
  } catch (err) {
    alert(err.message);
  }
}

function formatUsageTime(timestamp) {
  if (!timestamp) return '从未使用';
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN');
}

function renderCombinations() {
  if (!state.combinations || state.combinations.length === 0) {
    combinationListEl.innerHTML = '<div class="muted small">还没有创建任何组合</div>';
    return;
  }
  const agents = state.overview?.agents || [];
  combinationListEl.innerHTML = state.combinations.map(combination => {
    const agentCount = combination.agentIds?.length || 0;
    const agentNames = (combination.agentIds || []).slice(0, 3).map(id => {
      const agent = agents.find(a => a.id === id);
      return agent ? escapeHtml(agent.name) : id;
    }).join(', ');
    const moreText = agentCount > 3 ? ` 等${agentCount}个` : '';
    const usedCount = combination.usedCount || 0;
    const lastUsedAt = formatUsageTime(combination.lastUsedAt);
    return `
      <div class="combination-item" data-combination-id="${combination.id}">
        <div class="combination-header">
          <div class="combination-color" style="background-color: ${combination.color || '#6b7280'}"></div>
          <div class="combination-info">
            <div class="combination-name">${escapeHtml(combination.name)}</div>
            <div class="combination-desc">${escapeHtml(combination.description || '暂无描述')}</div>
            <div class="combination-meta">
              <span>${agentCount} 个 Agent</span>
              <span class="combination-agents">${agentNames}${moreText}</span>
            </div>
            <div class="combination-usage">
              <span class="combination-used-count">使用 ${usedCount} 次</span>
              <span class="combination-last-used">最后使用: ${lastUsedAt}</span>
            </div>
          </div>
          <div class="combination-actions">
            <button class="ghost tiny view-usage-trends-btn" data-combination-id="${combination.id}" title="查看使用趋势">趋势</button>
            <button class="ghost tiny edit-combination-btn" data-combination-id="${combination.id}" title="编辑组合">编辑</button>
            <button class="ghost tiny danger delete-combination-btn" data-combination-id="${combination.id}" title="删除组合">删除</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  combinationListEl.querySelectorAll('.edit-combination-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const combinationId = btn.dataset.combinationId;
      const combination = state.combinations.find(c => c.id === combinationId);
      if (combination) {
        combinationPanel.classList.remove('hidden');
        showCombinationForm(combination);
      }
    });
  });

  combinationListEl.querySelectorAll('.delete-combination-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const combinationId = btn.dataset.combinationId;
      const combination = state.combinations.find(c => c.id === combinationId);
      if (!combination) return;
      if (!confirm(`确定要删除组合 "${combination.name}" 吗？`)) return;
      try {
        await fetchJson(`/api/agent-combinations/${combinationId}`, { method: 'DELETE' });
        await loadCombinations();
        renderCombinations();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  combinationListEl.querySelectorAll('.view-usage-trends-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const combinationId = btn.dataset.combinationId;
      openUsageTrendsModal(combinationId);
    });
  });
}

async function openUsageTrendsModal(combinationId) {
  const combination = state.combinations.find(c => c.id === combinationId);
  if (!combination) return;

  state.usageTrendsCombinationId = combinationId;
  state.usageTrendsDays = 14;

  usageTrendsHeader.innerHTML = `
    <div class="usage-trends-title">${escapeHtml(combination.name)}</div>
    <div class="usage-trends-subtitle muted small">${escapeHtml(combination.description || '暂无描述')}</div>
  `;

  usageTrends14dBtn.classList.add('filter-btn-active');
  usageTrends7dBtn.classList.remove('filter-btn-active');

  await loadUsageTrends(combinationId, 14);
  usageTrendsModal.classList.remove('hidden');
}

async function loadUsageTrends(combinationId, days) {
  usageTrendsLoadingEl.classList.remove('hidden');
  usageTrendsEmptyEl.classList.add('hidden');
  usageTrendsChartEl.style.display = 'none';

  try {
    const res = await fetchJson(`/api/agent-combinations/${combinationId}/usage-trends?days=${days}`);
    state.usageTrends = res.trends?.trends || [];
    state.usageTrendsDays = days;
    renderUsageTrends();
  } catch (err) {
    state.usageTrends = [];
    renderUsageTrends();
  }
}

function renderUsageTrends() {
  usageTrendsLoadingEl.classList.add('hidden');

  if (!state.usageTrends || state.usageTrends.length === 0) {
    usageTrendsEmptyEl.classList.remove('hidden');
    usageTrendsChartEl.style.display = 'none';
    usageTrendsSummaryEl.innerHTML = '';
    if (usageTrendsChartInstance) {
      usageTrendsChartInstance.destroy();
      usageTrendsChartInstance = null;
    }
    return;
  }

  usageTrendsEmptyEl.classList.add('hidden');
  usageTrendsChartEl.style.display = 'block';

  const labels = state.usageTrends.map(t => {
    const d = new Date(t.date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });

  const data = state.usageTrends.map(t => t.count);
  const totalUsage = data.reduce((sum, val) => sum + val, 0);
  const avgUsage = totalUsage > 0 ? (totalUsage / data.length).toFixed(1) : 0;
  const maxUsage = Math.max(...data, 0);

  usageTrendsSummaryEl.innerHTML = `
    <div class="usage-summary-item">
      <span class="usage-summary-label">总使用次数</span>
      <span class="usage-summary-value">${totalUsage}</span>
    </div>
    <div class="usage-summary-item">
      <span class="usage-summary-label">日均使用</span>
      <span class="usage-summary-value">${avgUsage}</span>
    </div>
    <div class="usage-summary-item">
      <span class="usage-summary-label">单日最高</span>
      <span class="usage-summary-value">${maxUsage}</span>
    </div>
  `;

  if (usageTrendsChartInstance) {
    usageTrendsChartInstance.destroy();
  }

  const ctx = usageTrendsChartEl.getContext('2d');
  usageTrendsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '使用次数',
        data,
        borderColor: '#7aa2ff',
        backgroundColor: 'rgba(122, 162, 255, 0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#7aa2ff',
        pointBorderColor: 'rgba(11, 20, 36, 0.86)',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(11, 20, 36, 0.95)',
          titleColor: '#eff4ff',
          bodyColor: '#c5d0e8',
          borderColor: 'rgba(144, 168, 220, 0.24)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              return `使用次数: ${context.raw}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(144, 168, 220, 0.08)',
            drawBorder: false
          },
          ticks: {
            color: '#6f81a8'
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(144, 168, 220, 0.08)',
            drawBorder: false
          },
          ticks: {
            color: '#6f81a8',
            stepSize: 1,
            precision: 0
          }
        }
      }
    }
  });
}

selectFromCombinationBtn.addEventListener('click', () => {
  renderCombinationSelectionList();
  selectCombinationModal.classList.remove('hidden');
});

closeSelectCombinationModal.addEventListener('click', () => {
  selectCombinationModal.classList.add('hidden');
});

cancelSelectCombinationBtn.addEventListener('click', () => {
  selectCombinationModal.classList.add('hidden');
});

function renderCombinationSelectionList() {
  if (!state.combinations || state.combinations.length === 0) {
    combinationSelectionList.innerHTML = '<div class="muted small">还没有创建任何组合</div>';
    return;
  }
  const sortedCombinations = [...state.combinations].sort((a, b) => {
    const aUsage = a.usedCount || 0;
    const bUsage = b.usedCount || 0;
    return bUsage - aUsage;
  });
  combinationSelectionList.innerHTML = sortedCombinations.map(combination => `
    <label class="combination-selection-item">
      <input type="radio" name="selectCombination" value="${combination.id}" />
      <span class="combination-color-dot" style="background-color: ${combination.color || '#6b7280'}"></span>
      <span class="combination-selection-name">${escapeHtml(combination.name)}</span>
      <span class="combination-selection-count">${combination.agentIds?.length || 0} 个 Agent</span>
      <span class="combination-selection-usage">使用 ${combination.usedCount || 0} 次</span>
    </label>
  `).join('');
}

let selectedCombinationId = null;

confirmSelectCombinationBtn.addEventListener('click', () => {
  const selected = combinationSelectionList.querySelector('input[name="selectCombination"]:checked');
  if (!selected) {
    selectCombinationMsg.textContent = '请选择一个组合';
    return;
  }
  selectedCombinationId = selected.value;
  const combination = state.combinations.find(c => c.id === selectedCombinationId);
  if (!combination) return;
  const agentCheckboxes = agentCheckboxesEl.querySelectorAll('input[type="checkbox"]');
  agentCheckboxes.forEach(cb => {
    if (combination.agentIds.includes(cb.value)) {
      cb.checked = true;
    } else {
      cb.checked = false;
    }
  });
  selectCombinationModal.classList.add('hidden');
  selectCombinationMsg.textContent = '';
});

const importCombinationsModal = document.getElementById('importCombinationsModal');
const closeImportCombinationsModal = document.getElementById('closeImportCombinationsModal');
const combinationFileInput = document.getElementById('combinationFileInput');
const importCombinationInfo = document.getElementById('importCombinationInfo');
const importCombinationMsg = document.getElementById('importCombinationMsg');
const confirmImportCombinationsBtn = document.getElementById('confirmImportCombinationsBtn');
const cancelImportCombinationsBtn = document.getElementById('cancelImportCombinationsBtn');
const exportCombinationsBtn = document.getElementById('exportCombinationsBtn');
const importCombinationsBtn = document.getElementById('importCombinationsBtn');

let importedCombinationData = null;

function showImportCombinationsModal() {
  importedCombinationData = null;
  combinationFileInput.value = '';
  importCombinationInfo.textContent = '';
  importCombinationMsg.textContent = '';
  confirmImportCombinationsBtn.disabled = true;
  importCombinationsModal.classList.remove('hidden');
}

function hideImportCombinationsModal() {
  importCombinationsModal.classList.add('hidden');
  importedCombinationData = null;
  combinationFileInput.value = '';
}

async function handleExportCombinations() {
  try {
    const response = await fetch('/api/agent-combinations/export');
    if (!response.ok) throw new Error('导出失败');
    const data = await response.blob();
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agent-combinations.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('导出失败：' + err.message);
  }
}

function handleCombinationFileSelect(event) {
  const file = event.target.files[0];
  if (!file) {
    importedCombinationData = null;
    importCombinationInfo.textContent = '';
    confirmImportCombinationsBtn.disabled = true;
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.version || !data.combinations || !Array.isArray(data.combinations)) {
        importCombinationInfo.textContent = '无效的文件格式';
        importCombinationMsg.textContent = '文件格式不正确，应包含 version 和 combinations 字段';
        confirmImportCombinationsBtn.disabled = true;
        return;
      }
      importedCombinationData = data;
      importCombinationInfo.textContent = `发现 ${data.combinations.length} 个组合`;
      importCombinationMsg.textContent = '';
      confirmImportCombinationsBtn.disabled = false;
    } catch (err) {
      importCombinationInfo.textContent = '解析失败';
      importCombinationMsg.textContent = '无法解析 JSON 文件';
      confirmImportCombinationsBtn.disabled = true;
    }
  };
  reader.readAsText(file);
}

async function handleImportCombinations() {
  if (!importedCombinationData) return;
  const mode = document.querySelector('input[name="combinationImportMode"]:checked').value;
  importCombinationMsg.textContent = '正在导入...';
  confirmImportCombinationsBtn.disabled = true;
  try {
    const res = await fetchJson('/api/agent-combinations/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: importedCombinationData, mode })
    });
    const message = `导入完成：成功 ${res.imported} 个${res.skipped > 0 ? `，跳过 ${res.skipped} 个` : ''}`;
    importCombinationMsg.textContent = message;
    setTimeout(async () => {
      hideImportCombinationsModal();
      await loadCombinations();
      renderCombinations();
    }, 1000);
  } catch (err) {
    importCombinationMsg.textContent = '导入失败：' + err.message;
    confirmImportCombinationsBtn.disabled = false;
  }
}

exportCombinationsBtn.addEventListener('click', handleExportCombinations);
importCombinationsBtn.addEventListener('click', showImportCombinationsModal);
closeImportCombinationsModal.addEventListener('click', hideImportCombinationsModal);
cancelImportCombinationsBtn.addEventListener('click', hideImportCombinationsModal);
importCombinationsModal.querySelector('.modal-backdrop').addEventListener('click', hideImportCombinationsModal);
combinationFileInput.addEventListener('change', handleCombinationFileSelect);
confirmImportCombinationsBtn.addEventListener('click', handleImportCombinations);

closeUsageTrendsModal.addEventListener('click', () => {
  usageTrendsModal.classList.add('hidden');
  if (usageTrendsChartInstance) {
    usageTrendsChartInstance.destroy();
    usageTrendsChartInstance = null;
  }
});
usageTrendsModal.querySelector('.modal-backdrop').addEventListener('click', () => {
  usageTrendsModal.classList.add('hidden');
  if (usageTrendsChartInstance) {
    usageTrendsChartInstance.destroy();
    usageTrendsChartInstance = null;
  }
});

usageTrends7dBtn.addEventListener('click', async () => {
  usageTrends7dBtn.classList.add('filter-btn-active');
  usageTrends14dBtn.classList.remove('filter-btn-active');
  await loadUsageTrends(state.usageTrendsCombinationId, 7);
});

usageTrends14dBtn.addEventListener('click', async () => {
  usageTrends14dBtn.classList.add('filter-btn-active');
  usageTrends7dBtn.classList.remove('filter-btn-active');
  await loadUsageTrends(state.usageTrendsCombinationId, 14);
});

cancelSelectCombinationBtn.addEventListener('click', () => {
  selectCombinationMsg.textContent = '';
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
    'task.created': '任务创建',
    'task.completed': '任务完成',
    'task.failed': '任务失败',
    'task.cancelled': '任务取消',
    'task.retried': '任务重试',
    'task.paused': '任务暂停',
    'task.resumed': '任务恢复',
    'task.reassigned': '任务重指派',
    'session.message_sent': '会话消息',
    'session.spawned': 'Subagent启动',
    'workflow.executed': '工作流执行',
    'agent.called': 'Agent调用',
    'user.registered': '用户注册',
    'user.logged_in': '用户登录',
    'user.logged_out': '用户登出',
    'user.role_changed': '角色变更',
    'backup.created': '备份创建',
    'backup.restored': '备份恢复',
    'backup.auto_snapshot_created': '自动快照',
    'scheduled_backup.created': '定时备份',
    'scheduled_backup.failed': '定时备份失败',
    'scheduled_backup.config_changed': '定时备份配置变更',
    'scheduled_backup.notified': '定时备份通知',
    'cloud_backup.uploaded': '云端备份上传',
    'cloud_backup.downloaded': '云端备份下载',
    'cloud_backup.deleted': '云端备份删除',
    'cloud_backup.restored': '云端备份恢复',
    'cloud_backup.cleanup': '云端备份清理',
    'cloud_backup.cleanup_failed': '云端备份清理失败',
    'preset_admin_deleted': '预设删除',
    'preset_permissions_changed': '权限变更',
    'system': '系统事件'
  };
  return labels[type] || labels[type.replace(/\./g, '_')] || type;
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

async function loadNotificationChannels() {
  try {
    const res = await fetchJson('/api/admin/notification-channels');
    state.notificationChannels = res.channels || [];
    renderNotificationChannels();
  } catch (err) {
    console.error('加载通知渠道失败:', err);
  }
}

function renderNotificationChannels() {
  const channels = state.notificationChannels;
  if (!channels || channels.length === 0) {
    channelListEl.innerHTML = '<div class="empty-state muted">暂无通知渠道，点击上方按钮创建</div>';
    return;
  }
  const channelTypeLabels = {
    feishu: '飞书',
    dingtalk: '钉钉',
    wecom: '企业微信',
    slack: 'Slack'
  };
  channelListEl.innerHTML = channels.map(channel => `
    <div class="channel-item" data-channel-id="${channel.id}">
      <div class="channel-info">
        <div class="channel-name">${escapeHtml(channel.name)}</div>
        <div class="channel-meta">
          <span class="channel-type-badge">${channelTypeLabels[channel.type] || channel.type}</span>
          <span class="channel-webhook muted small">${escapeHtml(channel.webhook || channel.webhookUrl || '')}</span>
        </div>
      </div>
      <div class="channel-status">
        <label class="toggle-label toggle-label-small">
          <input type="checkbox" class="channel-toggle" data-channel-id="${channel.id}" ${channel.isEnabled ? 'checked' : ''} />
          <span>${channel.isEnabled ? '已启用' : '已禁用'}</span>
        </label>
      </div>
      <div class="channel-actions">
        <button class="ghost small channel-edit-btn" data-channel-id="${channel.id}">编辑</button>
        <button class="ghost small channel-test-btn" data-channel-id="${channel.id}">测试</button>
        <button class="ghost small danger channel-delete-btn" data-channel-id="${channel.id}">删除</button>
      </div>
    </div>
  `).join('');

  channelListEl.querySelectorAll('.channel-toggle').forEach(el => {
    el.addEventListener('change', () => {
      const channelId = el.dataset.channelId;
      toggleChannel(channelId);
    });
  });

  channelListEl.querySelectorAll('.channel-edit-btn').forEach(el => {
    el.addEventListener('click', () => {
      const channelId = el.dataset.channelId;
      openChannelModal(channelId);
    });
  });

  channelListEl.querySelectorAll('.channel-test-btn').forEach(el => {
    el.addEventListener('click', () => {
      const channelId = el.dataset.channelId;
      testChannel(channelId);
    });
  });

  channelListEl.querySelectorAll('.channel-delete-btn').forEach(el => {
    el.addEventListener('click', () => {
      const channelId = el.dataset.channelId;
      deleteChannel(channelId);
    });
  });
}

function openChannelModal(channelId = null) {
  state.editingChannelId = channelId;
  if (channelId) {
    const channel = state.notificationChannels.find(c => c.id === channelId);
    if (channel) {
      channelNameInput.value = channel.name;
      channelTypeInput.value = channel.type;
      channelWebhookInput.value = channel.webhook || channel.webhookUrl || '';
    }
  } else {
    channelNameInput.value = '';
    channelTypeInput.value = '';
    channelWebhookInput.value = '';
  }
  channelForm.classList.remove('hidden');
}

function closeChannelModal() {
  state.editingChannelId = null;
  channelForm.classList.add('hidden');
}

async function saveChannel() {
  const name = channelNameInput.value.trim();
  const type = channelTypeInput.value;
  const webhook = channelWebhookInput.value.trim();

  if (!name) {
    alert('请输入渠道名称');
    return;
  }
  if (!type) {
    alert('请选择渠道类型');
    return;
  }
  if (!webhook) {
    alert('请输入 Webhook 地址');
    return;
  }

  try {
    const data = { name, type, webhook };
    if (state.editingChannelId) {
      await fetchJson(`/api/admin/notification-channels/${state.editingChannelId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await fetchJson('/api/admin/notification-channels', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
    await loadNotificationChannels();
    closeChannelModal();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteChannel(channelId) {
  if (!confirm('确定要删除此通知渠道吗？')) return;
  try {
    await fetchJson(`/api/admin/notification-channels/${channelId}`, {
      method: 'DELETE'
    });
    await loadNotificationChannels();
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
}

async function toggleChannel(channelId) {
  try {
    await fetchJson(`/api/admin/notification-channels/${channelId}/toggle`, {
      method: 'PUT'
    });
    await loadNotificationChannels();
  } catch (err) {
    alert('切换状态失败: ' + err.message);
    await loadNotificationChannels();
  }
}

async function testChannel(channelId) {
  const btn = channelListEl.querySelector(`.channel-test-btn[data-channel-id="${channelId}"]`);
  if (!btn) return;
  const originalText = btn.textContent;
  btn.textContent = '测试中...';
  btn.disabled = true;
  try {
    const res = await fetchJson(`/api/admin/notification-channels/${channelId}/test`, {
      method: 'POST'
    });
    if (res.success) {
      alert('测试消息发送成功！');
    } else {
      alert('测试失败: ' + (res.error || '未知错误'));
    }
  } catch (err) {
    alert('测试失败: ' + err.message);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function initChannelFormHandlers() {
  showChannelFormBtn.addEventListener('click', () => openChannelModal(null));
  saveChannelBtn.addEventListener('click', saveChannel);
  cancelChannelBtn.addEventListener('click', closeChannelModal);

  channelTabs.forEach(tab => {
    tab.addEventListener('click', () => switchChannelTab(tab.dataset.tab));
  });

  applyHistoryFilterBtn.addEventListener('click', () => applyHistoryFilters());
  clearHistoryFilterBtn.addEventListener('click', () => clearHistoryFilters());
  historyTimeFrom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyHistoryFilters();
  });
  historyTimeTo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyHistoryFilters();
  });

  saveTemplatesBtn.addEventListener('click', saveTemplates);
  resetAllTemplatesBtn.addEventListener('click', resetAllTemplates);
}

function switchChannelTab(tab) {
  state.currentChannelTab = tab;
  channelTabs.forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  
  channelListEl.classList.toggle('hidden', tab !== 'channels');
  historyTabContent.classList.toggle('hidden', tab !== 'history');
  templatesTabContent.classList.toggle('hidden', tab !== 'templates');
  
  if (tab === 'history') {
    loadNotificationHistory();
    loadNotificationStats();
  } else if (tab === 'templates') {
    loadNotificationTemplates();
  }
}

async function loadNotificationHistory() {
  try {
    const params = new URLSearchParams();
    params.set('page', state.notificationHistoryPage);
    params.set('pageSize', '20');
    
    if (state.notificationHistoryFilters.status) {
      params.set('status', state.notificationHistoryFilters.status);
    }
    if (state.notificationHistoryFilters.channelType) {
      params.set('channelType', state.notificationHistoryFilters.channelType);
    }
    if (state.notificationHistoryFilters.timeFrom) {
      params.set('timeFrom', state.notificationHistoryFilters.timeFrom);
    }
    if (state.notificationHistoryFilters.timeTo) {
      params.set('timeTo', state.notificationHistoryFilters.timeTo);
    }
    
    const res = await fetchJson(`/api/admin/notification-history?${params.toString()}`);
    state.notificationHistory = res.items || [];
    state.notificationHistoryTotalPages = res.totalPages || 1;
    renderNotificationHistory();
    renderHistoryPagination();
  } catch (err) {
    console.error('加载通知历史失败:', err);
    notificationHistoryListEl.innerHTML = '<div class="empty-state muted">加载失败</div>';
  }
}

async function loadNotificationStats() {
  try {
    const res = await fetchJson('/api/admin/notification-history/stats');
    state.notificationHistoryStats = res.stats;
    renderNotificationStats();
  } catch (err) {
    console.error('加载通知统计失败:', err);
  }
}

function renderNotificationStats() {
  if (!state.notificationHistoryStats) {
    notificationStatsEl.innerHTML = '';
    return;
  }
  
  const stats = state.notificationHistoryStats;
  notificationStatsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-value">${stats.total || 0}</div>
      <div class="stat-card-label">总发送数</div>
    </div>
    <div class="stat-card stat-card-success">
      <div class="stat-card-value">${stats.sent || 0}</div>
      <div class="stat-card-label">成功</div>
    </div>
    <div class="stat-card stat-card-failed">
      <div class="stat-card-value">${stats.failed || 0}</div>
      <div class="stat-card-label">失败</div>
    </div>
    <div class="stat-card stat-card-rate">
      <div class="stat-card-value">${stats.successRate || 0}%</div>
      <div class="stat-card-label">成功率</div>
    </div>
  `;
}

function renderNotificationHistory() {
  if (!state.notificationHistory || state.notificationHistory.length === 0) {
    notificationHistoryListEl.innerHTML = '<div class="empty-state muted">暂无通知记录</div>';
    return;
  }
  
  notificationHistoryListEl.innerHTML = state.notificationHistory.map(n => `
    <div class="history-item" data-id="${n.id}">
      <div class="history-item-header">
        <div class="history-item-meta">
          <span class="channel-type-badge">${getChannelTypeName(n.channelType)}</span>
          <span class="history-channel-name">${escapeHtml(n.channelName || '—')}</span>
          <span class="history-time">${n.createdAt ? new Date(n.createdAt).toLocaleString('zh-CN') : '—'}</span>
        </div>
        <div class="history-item-actions">
          ${n.status === 'failed' ? `<button class="retry-btn" data-id="${n.id}">重试</button>` : ''}
        </div>
      </div>
      <div class="history-item-message">${escapeHtml(n.message || '')}</div>
      ${n.status === 'failed' && n.error ? `<div class="history-item-error">${escapeHtml(n.error)}</div>` : ''}
      ${n.retryCount > 0 ? `<div class="history-item-retry-count">已重试 ${n.retryCount} 次</div>` : ''}
    </div>
  `).join('');
  
  notificationHistoryListEl.querySelectorAll('.retry-btn').forEach(btn => {
    btn.addEventListener('click', () => handleRetryNotification(btn.dataset.id));
  });
}

function renderHistoryPagination() {
  if (state.notificationHistoryTotalPages <= 1) {
    historyPaginationEl.innerHTML = '';
    return;
  }
  
  let html = '';
  
  if (state.notificationHistoryPage > 1) {
    html += `<button class="pagination-btn" data-page="${state.notificationHistoryPage - 1}">上一页</button>`;
  }
  
  html += `<span class="pagination-info">第 ${state.notificationHistoryPage} / ${state.notificationHistoryTotalPages} 页</span>`;
  
  if (state.notificationHistoryPage < state.notificationHistoryTotalPages) {
    html += `<button class="pagination-btn" data-page="${state.notificationHistoryPage + 1}">下一页</button>`;
  }
  
  historyPaginationEl.innerHTML = html;
  
  historyPaginationEl.querySelectorAll('.pagination-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.notificationHistoryPage = parseInt(btn.dataset.page);
      loadNotificationHistory();
    });
  });
}

function applyHistoryFilters() {
  state.notificationHistoryFilters = {
    status: historyStatusFilter.value,
    channelType: historyChannelTypeFilter.value,
    timeFrom: historyTimeFrom.value ? new Date(historyTimeFrom.value).toISOString() : '',
    timeTo: historyTimeTo.value ? new Date(historyTimeTo.value).toISOString() : ''
  };
  state.notificationHistoryPage = 1;
  loadNotificationHistory();
}

function clearHistoryFilters() {
  historyStatusFilter.value = '';
  historyChannelTypeFilter.value = '';
  historyTimeFrom.value = '';
  historyTimeTo.value = '';
  state.notificationHistoryFilters = {};
  state.notificationHistoryPage = 1;
  loadNotificationHistory();
}

async function handleRetryNotification(id) {
  if (!confirm('确定要重试这条通知吗？')) return;
  
  try {
    await fetchJson(`/api/admin/notification-history/${id}/retry`, { method: 'POST' });
    loadNotificationHistory();
    loadNotificationStats();
  } catch (err) {
    alert('重试失败：' + err.message);
  }
}

function getChannelTypeName(type) {
  const names = {
    feishu: '飞书',
    dingtalk: '钉钉',
    wecom: '企业微信',
    slack: 'Slack',
    unknown: '未知'
  };
  return names[type] || names.unknown;
}

async function loadNotificationTemplates() {
  try {
    const res = await fetchJson('/api/admin/notification-templates');
    state.notificationTemplates = res.templates || {};
    state.templateVariables = res.variables || [];
    renderTemplates();
  } catch (err) {
    console.error('加载通知模板失败:', err);
    templatesListEl.innerHTML = '<div class="empty-state muted">加载失败</div>';
  }
}

function renderTemplates() {
  if (!state.notificationTemplates) {
    templatesListEl.innerHTML = '<div class="empty-state muted">暂无模板数据</div>';
    return;
  }

  const templateTypes = [
    { key: 'backup_success', label: '备份成功通知', icon: '✅' },
    { key: 'backup_failed', label: '备份失败通知', icon: '❌' },
    { key: 'workload_warning', label: '负载预警警告', icon: '⚠️' },
    { key: 'workload_critical', label: '负载预警严重', icon: '🚨' }
  ];

  templatesListEl.innerHTML = templateTypes.map(t => `
    <div class="template-item" data-type="${t.key}">
      <div class="template-item-header">
        <div class="template-item-title">
          <span class="template-icon">${t.icon}</span>
          <span class="template-name">${t.label}</span>
        </div>
        <button class="ghost small reset-template-btn" data-type="${t.key}">恢复默认</button>
      </div>
      <div class="template-item-body">
        <textarea 
          id="template-${t.key}" 
          class="template-textarea" 
          rows="6"
          placeholder="输入消息模板..."
        >${escapeHtml(state.notificationTemplates[t.key]?.template || '')}</textarea>
        <div class="template-item-meta">
          <span class="muted small">
            最后更新: ${state.notificationTemplates[t.key]?.updatedAt 
              ? new Date(state.notificationTemplates[t.key].updatedAt).toLocaleString('zh-CN') 
              : '—'}
          </span>
        </div>
      </div>
    </div>
  `).join('');

  templatesListEl.querySelectorAll('.reset-template-btn').forEach(btn => {
    btn.addEventListener('click', () => resetTemplate(btn.dataset.type));
  });
}

async function saveTemplates() {
  const templates = {};
  const templateKeys = ['backup_success', 'backup_failed', 'workload_warning', 'workload_critical'];
  
  for (const key of templateKeys) {
    const textarea = document.getElementById(`template-${key}`);
    if (textarea) {
      templates[key] = {
        template: textarea.value
      };
    }
  }

  try {
    await fetchJson('/api/admin/notification-templates', {
      method: 'PUT',
      body: JSON.stringify({ templates })
    });
    alert('模板保存成功');
    loadNotificationTemplates();
  } catch (err) {
    alert('保存失败：' + err.message);
  }
}

async function resetTemplate(type) {
  if (!confirm('确定要恢复此模板为默认内容吗？')) return;

  try {
    await fetchJson(`/api/admin/notification-templates/${type}/reset`, {
      method: 'POST'
    });
    loadNotificationTemplates();
  } catch (err) {
    alert('重置失败：' + err.message);
  }
}

async function resetAllTemplates() {
  if (!confirm('确定要恢复所有模板为默认内容吗？此操作不可撤销。')) return;

  try {
    await fetchJson('/api/admin/notification-templates/reset-all', {
      method: 'POST'
    });
    loadNotificationTemplates();
  } catch (err) {
    alert('重置失败：' + err.message);
  }
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
  updateSlackShareVisibility();
  checkFeishuConfig();
  checkDingTalkConfig();
  checkWecomConfig();
  checkSlackConfig();
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
    updateSlackShareVisibility();
  });
});

shareToFeishuCheckbox.addEventListener('change', updateFeishuButtonVisibility);
shareToDingTalkCheckbox.addEventListener('change', updateDingTalkButtonVisibility);

const shareToWecomBtn = document.getElementById('shareToWecomBtn');
const shareToWecomCheckbox = document.getElementById('shareToWecom');
const wecomWebhookInput = document.getElementById('wecomWebhookInput');
const wecomWebhook = document.getElementById('wecomWebhook');
const wecomShareSection = document.getElementById('wecomShareSection');

const shareToSlackBtn = document.getElementById('shareToSlackBtn');
const shareToSlackCheckbox = document.getElementById('shareToSlack');
const slackChannelInput = document.getElementById('slackChannelInput');
const slackChannelId = document.getElementById('slackChannelId');
const slackShareSection = document.getElementById('slackShareSection');

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

function updateSlackShareVisibility() {
  const format = document.querySelector('input[name="exportFormat"]:checked').value;
  const isPngFormat = format === 'png';
  
  if (isPngFormat) {
    slackShareSection.classList.remove('hidden');
  } else {
    slackShareSection.classList.add('hidden');
    shareToSlackCheckbox.checked = false;
    slackChannelInput.classList.add('hidden');
    confirmExportBtn.classList.remove('hidden');
    shareToSlackBtn.classList.add('hidden');
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

async function checkSlackConfig() {
  try {
    const response = await fetch('/api/slack/config');
    const data = await response.json();
    if (!data.configured) {
      slackShareSection.querySelector('.field-label').textContent = '分享到 Slack (需配置)';
      shareToSlackCheckbox.disabled = true;
    } else {
      slackShareSection.querySelector('.field-label').textContent = '分享到 Slack';
      shareToSlackCheckbox.disabled = false;
    }
  } catch (err) {
    shareToSlackCheckbox.disabled = true;
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

function updateSlackButtonVisibility() {
  if (shareToSlackCheckbox.checked) {
    confirmExportBtn.classList.add('hidden');
    shareToSlackBtn.classList.remove('hidden');
    slackChannelInput.classList.remove('hidden');
  } else {
    confirmExportBtn.classList.remove('hidden');
    shareToSlackBtn.classList.add('hidden');
    slackChannelInput.classList.add('hidden');
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

async function handleShareToSlack() {
  const exportType = document.querySelector('input[name="exportType"]:checked').value;
  const taskId = exportTaskSelectEl.value;
  const channelId = slackChannelId.value.trim();
  
  if (!channelId) {
    exportMsg.textContent = '请输入 Slack Channel ID';
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
  shareToSlackBtn.disabled = true;
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
    
    exportMsg.textContent = '正在发送到 Slack...';
    
    const shareResponse = await fetch('/api/share/slack', {
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
      throw new Error(err.error || '分享到 Slack 失败');
    }
    
    const result = await shareResponse.json();
    exportMsg.textContent = '分享成功!';
    setTimeout(() => hideExportModal(), 1000);
  } catch (err) {
    exportMsg.textContent = err.message;
  } finally {
    shareToSlackBtn.disabled = false;
    confirmExportBtn.disabled = false;
  }
}

shareToWecomBtn.addEventListener('click', handleShareToWecom);
shareToWecomCheckbox.addEventListener('change', updateWecomButtonVisibility);
shareToSlackBtn.addEventListener('click', handleShareToSlack);
shareToSlackCheckbox.addEventListener('change', updateSlackButtonVisibility);

const backupModal = document.getElementById('backupModal');
const closeBackupModal = document.getElementById('closeBackupModal');
const backupMsg = document.getElementById('backupMsg');
const createBackupBtn = document.getElementById('createBackupBtn');
const restoreBackupBtn = document.getElementById('restoreBackupBtn');
const backupFileInput = document.getElementById('backupFileInput');
const backupFileArea = document.getElementById('backupFileArea');
const backupFileInfo = document.getElementById('backupFileInfo');
const backupFileName = document.getElementById('backupFileName');
const backupFilePlaceholder = document.getElementById('backupFilePlaceholder');
const clearBackupFile = document.getElementById('clearBackupFile');
const backupPreviewSection = document.getElementById('backupPreviewSection');
const backupPreviewContent = document.getElementById('backupPreviewContent');
const autoSnapshotCheckbox = document.getElementById('autoSnapshotCheckbox');

const scheduledBackupEnabled = document.getElementById('scheduledBackupEnabled');
const scheduledBackupOptions = document.getElementById('scheduledBackupOptions');
const scheduledBackupFrequency = document.getElementById('scheduledBackupFrequency');
const scheduledBackupDayOfWeek = document.getElementById('scheduledBackupDayOfWeek');
const dayOfWeekField = document.getElementById('dayOfWeekField');
const scheduledBackupTime = document.getElementById('scheduledBackupTime');
const scheduledBackupMode = document.getElementById('scheduledBackupMode');
const scheduledBackupRetention = document.getElementById('scheduledBackupRetention');
const nextScheduledBackupTime = document.getElementById('nextScheduledBackupTime');
const saveScheduledBackupConfigBtn = document.getElementById('saveScheduledBackupConfigBtn');
const runScheduledBackupNowBtn = document.getElementById('runScheduledBackupNowBtn');
const scheduledBackupHistoryList = document.getElementById('scheduledBackupHistoryList');
const scheduledBackupNotifyEnabled = document.getElementById('scheduledBackupNotifyEnabled');
const scheduledBackupNotifyChannels = document.getElementById('scheduledBackupNotifyChannels');
const notifyFeishu = document.getElementById('notifyFeishu');
const notifyDingtalk = document.getElementById('notifyDingtalk');
const notifyWecom = document.getElementById('notifyWecom');
const notifySlack = document.getElementById('notifySlack');

// Cloud Storage elements
const cloudStorageEnabled = document.getElementById('cloudStorageEnabled');
const cloudStorageProvider = document.getElementById('cloudStorageProvider');
const cloudStorageBucket = document.getElementById('cloudStorageBucket');
const cloudStorageRegion = document.getElementById('cloudStorageRegion');
const cloudStorageEndpoint = document.getElementById('cloudStorageEndpoint');
const cloudStorageAccessKeyId = document.getElementById('cloudStorageAccessKeyId');
const cloudStorageAccessKeySecret = document.getElementById('cloudStorageAccessKeySecret');
const saveCloudStorageConfigBtn = document.getElementById('saveCloudStorageConfigBtn');
const testCloudStorageBtn = document.getElementById('testCloudStorageBtn');
const createCloudBackupBtn = document.getElementById('createCloudBackupBtn');
const refreshCloudBackupListBtn = document.getElementById('refreshCloudBackupListBtn');
const runCleanupNowBtn = document.getElementById('runCleanupNowBtn');
const cloudBackupList = document.getElementById('cloudBackupList');

let selectedBackupFile = null;
let selectedBackupData = null;

function showBackupModal() {
  loadBackupStatus();
  loadBackupHistory();
  loadScheduledBackupConfig();
  loadScheduledBackupHistory();
  loadCloudStorageConfig();
  loadCloudBackupList();
  loadLifecycleStats();
  backupModal.classList.remove('hidden');
}

function hideBackupModal() {
  backupModal.classList.add('hidden');
  clearBackupFileSelection();
}

function clearBackupFileSelection() {
  selectedBackupFile = null;
  selectedBackupData = null;
  backupFileInput.value = '';
  backupFileInfo.classList.add('hidden');
  backupFilePlaceholder.classList.remove('hidden');
  backupPreviewSection.classList.add('hidden');
  restoreBackupBtn.disabled = true;
}

async function loadBackupStatus() {
  try {
    const res = await fetchJson('/api/admin/backup/status');
    document.getElementById('lastBackupTime').textContent = res.lastBackupAt
      ? new Date(res.lastBackupAt).toLocaleString('zh-CN')
      : '—';
    document.getElementById('lastBackupSize').textContent = res.lastBackupSize
      ? formatBytes(res.lastBackupSize)
      : '—';
    document.getElementById('backupCount').textContent = res.backupCount || 0;
  } catch (err) {
    console.error('加载备份状态失败:', err);
  }
}

let selectedBackupIds = [];
let currentBackupVersions = [];
let currentTagBackupId = null;
let pendingVersionTags = [];

async function loadBackupHistory() {
  try {
    const res = await fetchJson('/api/audit?eventType=backup.created&limit=20');
    const versionsRes = await fetchJson('/api/admin/backup/versions').catch(() => ({ backups: [] }));
    const list = document.getElementById('backupHistoryList');
    const actionsDiv = document.getElementById('backupHistoryActions');

    currentBackupVersions = versionsRes.backups || [];

    if (!res.events || res.events.length === 0) {
      list.innerHTML = '<div class="muted small">暂无备份记录</div>';
      actionsDiv.classList.add('hidden');
      return;
    }

    actionsDiv.classList.remove('hidden');

    list.innerHTML = res.events.map(e => {
      const size = e.details.size ? formatBytes(e.details.size) : '—';
      const taskCount = e.details.taskCount || 0;
      const userCount = e.details.userCount || 0;
      const backupId = e.details.backupId || '';
      const versionName = e.details.versionName || '';
      const versionInfo = currentBackupVersions.find(v => v.id === backupId) || {};
      const versionTags = versionInfo.versionTags || e.details.versionTags || [];

      return `
        <div class="backup-history-item" data-backup-id="${backupId}">
          <div class="backup-history-checkbox">
            <input type="checkbox" class="backup-select-checkbox" data-backup-id="${backupId}" data-backup-at="${e.timestamp}" />
          </div>
          <div class="backup-history-info">
            <div class="backup-history-header">
              <span class="backup-history-time">${new Date(e.timestamp).toLocaleString('zh-CN')}</span>
              <span class="muted">${e.details.mode === 'incremental' ? '增量' : '完整'}备份</span>
              ${versionName ? `<span class="backup-version-name">${escapeHtml(versionName)}</span>` : ''}
            </div>
            <div class="backup-history-tags">
              ${versionTags.map(tag => `<span class="backup-tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
          </div>
          <div class="backup-history-meta muted small">
            大小: ${size} | 任务: ${taskCount} | 用户: ${userCount}
          </div>
          <div class="backup-history-actions">
            <button class="ghost tiny add-tag-btn" data-backup-id="${backupId}" title="添加标签">🏷️</button>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.backup-select-checkbox').forEach(cb => {
      cb.addEventListener('change', updateBackupSelection);
    });

    document.querySelectorAll('.add-tag-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const backupId = btn.dataset.backupId;
        showVersionTagModal(backupId);
      });
    });

    updateBackupSelection();
  } catch (err) {
    console.error('加载备份历史失败:', err);
  }
}

function updateBackupSelection() {
  const checkboxes = document.querySelectorAll('.backup-select-checkbox:checked');
  selectedBackupIds = Array.from(checkboxes).map(cb => cb.dataset.backupId);

  const compareBtn = document.getElementById('compareVersionsBtn');
  const selectiveBtn = document.getElementById('selectiveRestoreBtn');

  if (selectedBackupIds.length >= 2) {
    compareBtn.disabled = false;
    compareBtn.textContent = `版本对比 (${selectedBackupIds.length})`;
  } else {
    compareBtn.disabled = true;
    compareBtn.textContent = '版本对比';
  }

  if (selectedBackupIds.length === 1) {
    selectiveBtn.disabled = false;
  } else {
    selectiveBtn.disabled = true;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showVersionTagModal(backupId) {
  currentTagBackupId = backupId;
  const versionInfo = currentBackupVersions.find(v => v.id === backupId) || {};

  document.getElementById('versionTagName').value = versionInfo.versionName || '';
  pendingVersionTags = [...(versionInfo.versionTags || [])];
  updateVersionTagsPreview();
  document.getElementById('versionTagModal').classList.remove('hidden');
  document.getElementById('versionTagMsg').textContent = '';
}

function updateVersionTagsPreview() {
  const preview = document.getElementById('versionTagsPreview');
  preview.innerHTML = pendingVersionTags.map((tag, idx) => `
    <span class="version-tag-chip">
      ${escapeHtml(tag)}
      <button class="tag-remove-btn" data-idx="${idx}">&times;</button>
    </span>
  `).join('');

  preview.querySelectorAll('.tag-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      pendingVersionTags.splice(idx, 1);
      updateVersionTagsPreview();
    });
  });
}

async function handleSaveVersionTag() {
  if (!currentTagBackupId) return;

  const versionName = document.getElementById('versionTagName').value.trim() || null;
  const msgEl = document.getElementById('versionTagMsg');
  const saveBtn = document.getElementById('saveVersionTagBtn');

  saveBtn.disabled = true;
  msgEl.textContent = '正在保存...';

  try {
    const res = await fetchJson(`/api/admin/backup/${currentTagBackupId}/tag`, {
      method: 'POST',
      body: JSON.stringify({
        versionName,
        versionTags: pendingVersionTags
      })
    });

    msgEl.textContent = '保存成功';
    msgEl.style.color = 'var(--color-success, #10b981)';

    setTimeout(() => {
      document.getElementById('versionTagModal').classList.add('hidden');
      loadBackupHistory();
    }, 1000);
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.style.color = 'var(--color-error, #ef4444)';
  } finally {
    saveBtn.disabled = false;
  }
}

async function handleVersionCompare() {
  if (selectedBackupIds.length < 2) return;

  const fromId = selectedBackupIds[0];
  const toId = selectedBackupIds[1];

  const modal = document.getElementById('versionCompareModal');
  const content = document.getElementById('versionCompareContent');

  modal.classList.remove('hidden');
  content.innerHTML = '<div class="muted small">正在加载对比数据...</div>';

  try {
    const res = await fetchJson(`/api/admin/backup/compare?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}`);

    const fromDate = new Date(res.from.backupAt).toLocaleString('zh-CN');
    const toDate = new Date(res.to.backupAt).toLocaleString('zh-CN');

    const formatChange = (change) => {
      if (change > 0) return `<span class="diff-added">+${change}</span>`;
      if (change < 0) return `<span class="diff-removed">${change}</span>`;
      return '<span class="diff-unchanged">0</span>';
    };

    const DATA_TYPE_LABELS = {
      users: '用户',
      tasks: '任务',
      templates: '模板',
      'agent-groups': 'Agent 分组',
      'shared-presets': '共享预设',
      'user-presets': '用户预设',
      'user-templates': '用户模板',
      workflows: '工作流',
      'workflow-runs': '工作流执行记录'
    };

    let diffTable = '';
    for (const [type, diff] of Object.entries(res.diff)) {
      const label = DATA_TYPE_LABELS[type] || type;
      diffTable += `
        <tr>
          <td>${label}</td>
          <td>${diff.from}</td>
          <td>${diff.to}</td>
          <td>${formatChange(diff.to - diff.from)}</td>
        </tr>
      `;
    }

    content.innerHTML = `
      <div class="version-compare-header">
        <div class="compare-version">
          <h4>版本 1 (旧)</h4>
          <p class="muted small">${fromDate}</p>
          <p class="muted small">${res.from.backupMode === 'incremental' ? '增量' : '完整'}备份</p>
          ${res.from.versionName ? `<p>名称: ${escapeHtml(res.from.versionName)}</p>` : ''}
          ${res.from.versionTags?.length ? `<p>标签: ${res.from.versionTags.map(t => `<span class="backup-tag">${escapeHtml(t)}</span>`).join('')}</p>` : ''}
        </div>
        <div class="compare-arrow">→</div>
        <div class="compare-version">
          <h4>版本 2 (新)</h4>
          <p class="muted small">${toDate}</p>
          <p class="muted small">${res.to.backupMode === 'incremental' ? '增量' : '完整'}备份</p>
          ${res.to.versionName ? `<p>名称: ${escapeHtml(res.to.versionName)}</p>` : ''}
          ${res.to.versionTags?.length ? `<p>标签: ${res.to.versionTags.map(t => `<span class="backup-tag">${escapeHtml(t)}</span>`).join('')}</p>` : ''}
        </div>
      </div>
      <h4>数据差异统计</h4>
      <table class="version-compare-table">
        <thead>
          <tr>
            <th>数据类型</th>
            <th>旧版本</th>
            <th>新版本</th>
            <th>变化</th>
          </tr>
        </thead>
        <tbody>
          ${diffTable}
        </tbody>
      </table>
    `;
  } catch (err) {
    content.innerHTML = `<div class="error-text">加载失败: ${err.message}</div>`;
  }
}

function showSelectiveRestoreModal() {
  if (selectedBackupIds.length !== 1) return;

  document.getElementById('selectiveRestoreModal').classList.remove('hidden');
  document.getElementById('selectiveRestoreMsg').textContent = '';
  document.querySelectorAll('input[name="selectiveType"]').forEach(cb => cb.checked = false);
  document.querySelector('input[name="selectiveRestoreMode"][value="merge"]').checked = true;
  document.getElementById('selectiveAutoSnapshot').checked = true;
  updateSelectiveRestoreBtn();
}

function updateSelectiveRestoreBtn() {
  const checked = document.querySelectorAll('input[name="selectiveType"]:checked');
  document.getElementById('confirmSelectiveRestore').disabled = checked.length === 0;
}

async function handleSelectiveRestore() {
  const selectedTypes = Array.from(document.querySelectorAll('input[name="selectiveType"]:checked')).map(cb => cb.value);
  const restoreMode = document.querySelector('input[name="selectiveRestoreMode"]:checked').value;
  const autoSnapshot = document.getElementById('selectiveAutoSnapshot').checked;
  const msgEl = document.getElementById('selectiveRestoreMsg');
  const confirmBtn = document.getElementById('confirmSelectiveRestore');

  if (selectedTypes.length === 0) {
    msgEl.textContent = '请至少选择一个数据类型';
    return;
  }

  if (!confirm(`确定要恢复以下数据类型吗？\n${selectedTypes.join(', ')}\n\n恢复模式: ${restoreMode === 'merge' ? '合并（保留现有数据）' : '覆盖（清空现有数据）'}`)) {
    return;
  }

  confirmBtn.disabled = true;
  msgEl.textContent = '正在恢复数据...';

  try {
    const res = await fetchJson('/api/admin/restore/selective', {
      method: 'POST',
      body: JSON.stringify({
        dataTypes: selectedTypes,
        restoreMode,
        autoSnapshot
      })
    });

    if (res.success) {
      msgEl.textContent = `恢复成功！已恢复: ${Object.entries(res.result.restored).map(([k, v]) => `${k}: ${v}`).join(', ')}`;
      msgEl.style.color = 'var(--color-success, #10b981)';
      setTimeout(() => {
        document.getElementById('selectiveRestoreModal').classList.add('hidden');
        loadBackupHistory();
      }, 2000);
    }
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.style.color = 'var(--color-error, #ef4444)';
  } finally {
    confirmBtn.disabled = false;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function handleCreateBackup() {
  const mode = document.querySelector('input[name="backupMode"]:checked').value;
  backupMsg.textContent = '正在创建备份...';
  createBackupBtn.disabled = true;
  try {
    const response = await fetch(`/api/admin/backup?mode=${mode}`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || '创建备份失败');
    }
    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `agent-orchestra-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="([^"]+)"/);
      if (match) filename = match[1];
    }
    downloadBlob(blob, filename);
    backupMsg.textContent = '备份创建成功';
    await loadBackupStatus();
    await loadBackupHistory();
  } catch (err) {
    backupMsg.textContent = err.message;
  } finally {
    createBackupBtn.disabled = false;
  }
}

function handleBackupFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.name.endsWith('.json')) {
    backupMsg.textContent = '请选择 JSON 格式的备份文件';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      selectedBackupData = JSON.parse(event.target.result);
      if (!selectedBackupData.version || !selectedBackupData.data) {
        backupMsg.textContent = '无效的备份文件格式';
        return;
      }
      selectedBackupFile = file;
      backupFileName.textContent = file.name;
      backupFileInfo.classList.remove('hidden');
      backupFilePlaceholder.classList.add('hidden');
      restoreBackupBtn.disabled = false;
      backupMsg.textContent = '';
      showBackupPreview();
    } catch {
      backupMsg.textContent = '无法解析备份文件';
    }
  };
  reader.readAsText(file);
}

function showBackupPreview() {
  if (!selectedBackupData) return;
  const { data, backupAt, backupMode } = selectedBackupData;
  const summary = [];
  if (data.users) summary.push(`用户: ${data.users.length}`);
  if (data.tasks) summary.push(`任务: ${data.tasks.length}`);
  if (data.templates) summary.push(`模板: ${data.templates.length}`);
  if (data.workflows) summary.push(`工作流: ${data.workflows.length}`);
  if (data['shared-presets']) summary.push(`共享预设: ${data['shared-presets'].length}`);
  if (data['agent-groups']) summary.push(`Agent分组: ${data['agent-groups'].length}`);
  backupPreviewContent.innerHTML = `
    <div class="backup-preview-meta">
      <span>备份时间: ${backupAt ? new Date(backupAt).toLocaleString('zh-CN') : '—'}</span>
      <span>备份模式: ${backupMode === 'incremental' ? '增量' : '完整'}</span>
      <span>版本: ${selectedBackupData.version}</span>
    </div>
    <div class="backup-preview-summary">${summary.join(' | ')}</div>
  `;
  backupPreviewSection.classList.remove('hidden');
}

async function handleRestoreBackup() {
  if (!selectedBackupFile || !selectedBackupData) {
    backupMsg.textContent = '请先选择备份文件';
    return;
  }
  const restoreMode = document.querySelector('input[name="restoreMode"]:checked').value;
  const autoSnapshot = autoSnapshotCheckbox.checked;
  const modeText = restoreMode === 'overwrite' ? '覆盖模式' : '合并模式';
  const confirmMsg = autoSnapshot
    ? `确定要恢复数据吗？\n\n恢复模式: ${modeText}\n\n恢复前将自动创建当前数据的快照。`
    : `警告：恢复前不会创建快照！\n\n确定要恢复数据吗？\n\n恢复模式: ${modeText}`;
  if (!confirm(confirmMsg)) {
    return;
  }
  backupMsg.textContent = '正在恢复数据...';
  restoreBackupBtn.disabled = true;
  createBackupBtn.disabled = true;
  try {
    const formData = new FormData();
    formData.append('file', selectedBackupFile);
    formData.append('mode', restoreMode);
    formData.append('autoSnapshot', autoSnapshot);
    const response = await fetch('/api/admin/restore', {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || '恢复失败');
    }
    const result = await response.json();
    const resultSummary = [];
    if (result.result?.restored) {
      for (const [key, val] of Object.entries(result.result.restored)) {
        resultSummary.push(`${key}: ${val}`);
      }
    }
    backupMsg.textContent = `恢复成功！已恢复: ${resultSummary.join(', ') || '无'}`;
    setTimeout(() => {
      hideBackupModal();
      loadTasks();
      loadTemplates();
      loadSharedPresets();
      loadWorkflows();
      loadAgentGroups();
    }, 1500);
  } catch (err) {
    backupMsg.textContent = err.message;
  } finally {
    restoreBackupBtn.disabled = false;
    createBackupBtn.disabled = false;
  }
}

backupFileArea.addEventListener('click', () => backupFileInput.click());
backupFileArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  backupFileArea.classList.add('drag-over');
});
backupFileArea.addEventListener('dragleave', () => {
  backupFileArea.classList.remove('drag-over');
});
backupFileArea.addEventListener('drop', (e) => {
  e.preventDefault();
  backupFileArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    backupFileInput.files = dt.files;
    handleBackupFileSelect({ target: backupFileInput });
  }
});

closeBackupModal.addEventListener('click', hideBackupModal);
backupModal.querySelector('.modal-backdrop').addEventListener('click', hideBackupModal);
createBackupBtn.addEventListener('click', handleCreateBackup);
backupFileInput.addEventListener('change', handleBackupFileSelect);
clearBackupFile.addEventListener('click', clearBackupFileSelection);
restoreBackupBtn.addEventListener('click', handleRestoreBackup);

document.getElementById('closeVersionCompareModal').addEventListener('click', () => {
  document.getElementById('versionCompareModal').classList.add('hidden');
});
document.getElementById('versionCompareModal').querySelector('.modal-backdrop').addEventListener('click', () => {
  document.getElementById('versionCompareModal').classList.add('hidden');
});

document.getElementById('closeSelectiveRestoreModal').addEventListener('click', () => {
  document.getElementById('selectiveRestoreModal').classList.add('hidden');
});
document.getElementById('cancelSelectiveRestore').addEventListener('click', () => {
  document.getElementById('selectiveRestoreModal').classList.add('hidden');
});
document.getElementById('selectiveRestoreModal').querySelector('.modal-backdrop').addEventListener('click', () => {
  document.getElementById('selectiveRestoreModal').classList.add('hidden');
});
document.querySelectorAll('input[name="selectiveType"]').forEach(cb => {
  cb.addEventListener('change', updateSelectiveRestoreBtn);
});
document.getElementById('confirmSelectiveRestore').addEventListener('click', handleSelectiveRestore);

document.getElementById('closeVersionTagModal').addEventListener('click', () => {
  document.getElementById('versionTagModal').classList.add('hidden');
});
document.getElementById('cancelVersionTagBtn').addEventListener('click', () => {
  document.getElementById('versionTagModal').classList.add('hidden');
});
document.getElementById('versionTagModal').querySelector('.modal-backdrop').addEventListener('click', () => {
  document.getElementById('versionTagModal').classList.add('hidden');
});
document.getElementById('saveVersionTagBtn').addEventListener('click', handleSaveVersionTag);
document.getElementById('versionTagInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const input = e.target;
    const tag = input.value.trim();
    if (tag && !pendingVersionTags.includes(tag)) {
      pendingVersionTags.push(tag);
      updateVersionTagsPreview();
      input.value = '';
    }
  }
});

document.getElementById('compareVersionsBtn').addEventListener('click', handleVersionCompare);
document.getElementById('selectiveRestoreBtn').addEventListener('click', showSelectiveRestoreModal);

async function loadScheduledBackupConfig() {
  try {
    const res = await fetchJson('/api/admin/scheduled-backup/config');
    scheduledBackupEnabled.checked = res.enabled || false;
    scheduledBackupFrequency.value = res.frequency || 'daily';
    scheduledBackupDayOfWeek.value = res.dayOfWeek !== undefined ? res.dayOfWeek : 1;
    scheduledBackupTime.value = res.time || '02:00';
    scheduledBackupMode.value = res.mode || 'full';
    scheduledBackupRetention.value = res.retentionCount || 5;
    
    const notification = res.notification || {};
    scheduledBackupNotifyEnabled.checked = notification.enabled || false;
    notifyFeishu.checked = notification.channels?.includes('feishu') || false;
    notifyDingtalk.checked = notification.channels?.includes('dingtalk') || false;
    notifyWecom.checked = notification.channels?.includes('wecom') || false;
    notifySlack.checked = notification.channels?.includes('slack') || false;
    
    if (res.enabled) {
      scheduledBackupOptions.classList.remove('hidden');
      if (res.nextRunTime) {
        nextScheduledBackupTime.textContent = new Date(res.nextRunTime).toLocaleString('zh-CN');
      } else {
        nextScheduledBackupTime.textContent = '—';
      }
    } else {
      scheduledBackupOptions.classList.add('hidden');
      nextScheduledBackupTime.textContent = '—';
    }
    
    updateDayOfWeekVisibility();
    updateNotificationChannelsVisibility();
  } catch (err) {
    console.error('加载定时备份配置失败:', err);
  }
}

function updateDayOfWeekVisibility() {
  if (scheduledBackupFrequency.value === 'weekly') {
    dayOfWeekField.style.display = 'block';
  } else {
    dayOfWeekField.style.display = 'none';
  }
}

function updateNotificationChannelsVisibility() {
  if (scheduledBackupNotifyEnabled.checked) {
    scheduledBackupNotifyChannels.classList.remove('hidden');
  } else {
    scheduledBackupNotifyChannels.classList.add('hidden');
  }
}

async function loadScheduledBackupHistory() {
  try {
    const res = await fetchJson('/api/admin/scheduled-backup/history');
    const list = scheduledBackupHistoryList;
    if (!res.history || res.history.length === 0) {
      list.innerHTML = '<div class="muted small">暂无自动备份记录</div>';
      return;
    }
    list.innerHTML = res.history.map(h => `
      <div class="backup-history-item ${h.status === 'failed' ? 'backup-history-failed' : ''}">
        <div class="backup-history-info">
          <span class="backup-history-time">${new Date(h.startedAt).toLocaleString('zh-CN')}</span>
          <span class="${h.status === 'success' ? 'success' : (h.status === 'failed' ? 'error' : 'muted')}">${h.status === 'success' ? '成功' : (h.status === 'failed' ? '失败' : '运行中')}</span>
        </div>
        <div class="backup-history-meta muted small">
          ${h.fileName ? `文件: ${h.fileName}` : ''}
          ${h.fileSize ? ` | 大小: ${formatBytes(h.fileSize)}` : ''}
          ${h.error ? ` | 错误: ${escapeHtml(h.error)}` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('加载自动备份历史失败:', err);
  }
}

// Cloud Storage Functions
async function loadCloudStorageConfig() {
  try {
    const res = await fetchJson('/api/admin/cloud-storage/config');
    cloudStorageEnabled.checked = res.enabled || false;
    cloudStorageProvider.value = res.provider || 'oss';
    cloudStorageBucket.value = res.bucket || '';
    cloudStorageRegion.value = res.region || '';
    cloudStorageEndpoint.value = res.endpoint || '';
    cloudStorageAccessKeyId.value = res.accessKeyId || '';
    cloudStorageAccessKeySecret.value = '';
    const retentionDaysInput = document.getElementById('cloudStorageRetentionDays');
    if (retentionDaysInput) {
      retentionDaysInput.value = res.retentionDays || 30;
    }
  } catch (err) {
    console.error('加载云存储配置失败:', err);
  }
}

async function handleSaveCloudStorageConfig() {
  const msg = document.getElementById('backupMsg');
  const retentionDaysInput = document.getElementById('cloudStorageRetentionDays');
  try {
    const config = {
      enabled: cloudStorageEnabled.checked,
      provider: cloudStorageProvider.value,
      bucket: cloudStorageBucket.value,
      region: cloudStorageRegion.value,
      endpoint: cloudStorageEndpoint.value,
      accessKeyId: cloudStorageAccessKeyId.value,
      accessKeySecret: cloudStorageAccessKeySecret.value,
      retentionDays: parseInt(retentionDaysInput.value, 10) || 30
    };

    if (config.enabled && (!config.bucket || !config.accessKeyId || !config.accessKeySecret)) {
      msg.textContent = '启用云存储时，存储桶名称、Access Key ID 和 Secret 是必需的';
      msg.className = 'form-msg error';
      return;
    }

    if (config.retentionDays < 1 || config.retentionDays > 365) {
      msg.textContent = '保留天数必须在 1-365 之间';
      msg.className = 'form-msg error';
      return;
    }

    await fetch('/api/admin/cloud-storage/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    msg.textContent = '云存储配置已保存';
    msg.className = 'form-msg success';
    setTimeout(() => { msg.textContent = ''; }, 3000);
    
    if (config.enabled) {
      loadCloudBackupList();
      loadLifecycleStats();
    }
  } catch (err) {
    msg.textContent = '保存配置失败：' + err.message;
    msg.className = 'form-msg error';
  }
}

async function handleTestCloudStorage() {
  const msg = document.getElementById('backupMsg');
  try {
    msg.textContent = '正在测试连接...';
    msg.className = 'form-msg';
    
    const res = await fetch('/api/admin/backup/cloud/test', { method: 'POST' });
    const result = await res.json();
    
    if (result.success) {
      msg.textContent = '云存储连接测试成功！';
      msg.className = 'form-msg success';
    } else {
      msg.textContent = '连接测试失败：' + (result.error || '未知错误');
      msg.className = 'form-msg error';
    }
  } catch (err) {
    msg.textContent = '测试连接失败：' + err.message;
    msg.className = 'form-msg error';
  }
  setTimeout(() => { msg.textContent = ''; }, 5000);
}

async function handleCreateCloudBackup() {
  const msg = document.getElementById('backupMsg');
  try {
    msg.textContent = '正在创建备份并上传到云存储...';
    msg.className = 'form-msg';
    
    const res = await fetch('/api/admin/backup/cloud?mode=full', { method: 'POST' });
    const result = await res.json();
    
    if (result.success) {
      msg.textContent = '云备份创建成功：' + result.fileName;
      msg.className = 'form-msg success';
      loadCloudBackupList();
    } else {
      msg.textContent = '创建云备份失败：' + (result.error || '未知错误');
      msg.className = 'form-msg error';
    }
  } catch (err) {
    msg.textContent = '创建云备份失败：' + err.message;
    msg.className = 'form-msg error';
  }
  setTimeout(() => { msg.textContent = ''; }, 5000);
}

async function loadCloudBackupList() {
  try {
    const res = await fetchJson('/api/admin/backup/cloud/list');
    const list = cloudBackupList;
    
    if (!res.success || !res.files || res.files.length === 0) {
      list.innerHTML = '<div class="muted small">暂无云端备份</div>';
      return;
    }
    
    list.innerHTML = res.files.map(f => `
      <div class="backup-history-item">
        <div class="backup-history-info">
          <span class="backup-history-time">${new Date(f.lastModified).toLocaleString('zh-CN')}</span>
          <span class="success">云端</span>
        </div>
        <div class="backup-history-meta muted small">
          文件：${f.key} | 大小：${formatBytes(f.size)}
          <button class="ghost small" onclick="restoreCloudBackup('${f.key}')" style="margin-left: 10px;">从此备份恢复</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('加载云端备份列表失败:', err);
    cloudBackupList.innerHTML = '<div class="muted small">加载失败：' + escapeHtml(err.message) + '</div>';
  }
}

async function restoreCloudBackup(cloudKey) {
  const msg = document.getElementById('backupMsg');
  if (!confirm('确定要从云端备份恢复吗？\n\n文件：' + cloudKey + '\n\n这将创建自动快照并恢复数据。')) {
    return;
  }
  
  try {
    msg.textContent = '正在从云存储下载并恢复备份...';
    msg.className = 'form-msg';
    
    const res = await fetch('/api/admin/backup/cloud/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cloudKey, restoreMode: 'merge' })
    });
    const result = await res.json();
    
    if (result.success) {
      msg.textContent = '云备份恢复成功！';
      msg.className = 'form-msg success';
      setTimeout(() => location.reload(), 2000);
    } else {
      msg.textContent = '恢复失败：' + (result.error || '未知错误');
      msg.className = 'form-msg error';
    }
  } catch (err) {
    msg.textContent = '恢复失败：' + err.message;
    msg.className = 'form-msg error';
  }
}

window.restoreCloudBackup = restoreCloudBackup;

async function loadLifecycleStats() {
  try {
    const res = await fetchJson('/api/admin/backup/cloud/lifecycle');
    const fileCountEl = document.getElementById('cloudBackupFileCount');
    const totalSizeEl = document.getElementById('cloudBackupTotalSize');
    const retentionDaysEl = document.getElementById('cloudBackupRetentionDays');
    const nextCleanupEl = document.getElementById('nextCleanupTime');
    
    if (fileCountEl) {
      fileCountEl.textContent = res.cloudStats?.fileCount ?? '—';
    }
    if (totalSizeEl) {
      totalSizeEl.textContent = res.cloudStats?.totalSize ? formatBytes(res.cloudStats.totalSize) : '—';
    }
    if (retentionDaysEl) {
      retentionDaysEl.textContent = res.retentionDays || 30;
      const retentionInput = document.getElementById('cloudStorageRetentionDays');
      if (retentionInput) {
        retentionInput.value = res.retentionDays || 30;
      }
    }
    if (nextCleanupEl) {
      nextCleanupEl.textContent = res.nextCleanupAt ? new Date(res.nextCleanupAt).toLocaleString('zh-CN') : '—';
    }
  } catch (err) {
    console.error('加载生命周期统计失败:', err);
  }
}

async function handleRunCleanupNow() {
  const msg = document.getElementById('cleanupMsg') || document.getElementById('backupMsg');
  try {
    msg.textContent = '正在清理过期备份...';
    msg.className = 'form-msg';
    runCleanupNowBtn.disabled = true;
    
    const res = await fetchJson('/api/admin/backup/cloud/cleanup', { method: 'POST' });
    
    if (res.success) {
      msg.textContent = `清理完成：扫描 ${res.scannedCount} 个文件，删除 ${res.deletedCount} 个，释放 ${formatBytes(res.deletedSize)}`;
      msg.className = 'form-msg success';
      loadLifecycleStats();
      loadCloudBackupList();
    } else {
      msg.textContent = '清理失败：' + (res.error || '未知错误');
      msg.className = 'form-msg error';
    }
  } catch (err) {
    msg.textContent = '清理失败：' + err.message;
    msg.className = 'form-msg error';
  } finally {
    runCleanupNowBtn.disabled = false;
    setTimeout(() => { msg.textContent = ''; }, 5000);
  }
}

async function handleSaveScheduledBackupConfig() {
  const channels = [];
  if (notifyFeishu.checked) channels.push('feishu');
  if (notifyDingtalk.checked) channels.push('dingtalk');
  if (notifyWecom.checked) channels.push('wecom');
  if (notifySlack.checked) channels.push('slack');
  
  const config = {
    enabled: scheduledBackupEnabled.checked,
    frequency: scheduledBackupFrequency.value,
    time: scheduledBackupTime.value,
    dayOfWeek: parseInt(scheduledBackupDayOfWeek.value, 10),
    mode: scheduledBackupMode.value,
    retentionCount: parseInt(scheduledBackupRetention.value, 10),
    notification: {
      enabled: scheduledBackupNotifyEnabled.checked,
      channels
    }
  };
  
  try {
    backupMsg.textContent = '正在保存配置...';
    const res = await fetchJson('/api/admin/scheduled-backup/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
    
    if (res.nextRunTime) {
      nextScheduledBackupTime.textContent = new Date(res.nextRunTime).toLocaleString('zh-CN');
    }
    
    if (config.enabled) {
      scheduledBackupOptions.classList.remove('hidden');
    } else {
      scheduledBackupOptions.classList.add('hidden');
      nextScheduledBackupTime.textContent = '—';
    }
    
    backupMsg.textContent = '配置保存成功';
    setTimeout(() => { backupMsg.textContent = ''; }, 3000);
  } catch (err) {
    backupMsg.textContent = err.message;
  }
}

async function handleRunScheduledBackupNow() {
  try {
    backupMsg.textContent = '正在执行备份...';
    runScheduledBackupNowBtn.disabled = true;
    const res = await fetchJson('/api/admin/scheduled-backup/run', { method: 'POST' });
    
    if (res.success) {
      backupMsg.textContent = `备份创建成功: ${res.fileName}`;
      await loadScheduledBackupHistory();
      if (res.nextRunTime) {
        nextScheduledBackupTime.textContent = new Date(res.nextRunTime).toLocaleString('zh-CN');
      }
    } else {
      backupMsg.textContent = `备份失败: ${res.error}`;
      await loadScheduledBackupHistory();
    }
  } catch (err) {
    backupMsg.textContent = err.message;
  } finally {
    runScheduledBackupNowBtn.disabled = false;
  }
}

scheduledBackupEnabled.addEventListener('change', () => {
  if (scheduledBackupEnabled.checked) {
    scheduledBackupOptions.classList.remove('hidden');
  } else {
    scheduledBackupOptions.classList.add('hidden');
  }
});

scheduledBackupFrequency.addEventListener('change', updateDayOfWeekVisibility);
scheduledBackupNotifyEnabled.addEventListener('change', updateNotificationChannelsVisibility);
saveScheduledBackupConfigBtn.addEventListener('click', handleSaveScheduledBackupConfig);
runScheduledBackupNowBtn.addEventListener('click', handleRunScheduledBackupNow);

// Cloud Storage event listeners
saveCloudStorageConfigBtn.addEventListener('click', handleSaveCloudStorageConfig);
testCloudStorageBtn.addEventListener('click', handleTestCloudStorage);
createCloudBackupBtn.addEventListener('click', handleCreateCloudBackup);
refreshCloudBackupListBtn.addEventListener('click', loadCloudBackupList);
runCleanupNowBtn.addEventListener('click', handleRunCleanupNow);

const openBackupModalBtn = document.getElementById('openBackupModalBtn');
if (openBackupModalBtn) {
  openBackupModalBtn.addEventListener('click', showBackupModal);
}

trends7dBtn.addEventListener('click', async () => {
  trends7dBtn.classList.add('filter-btn-active');
  trends14dBtn.classList.remove('filter-btn-active');
  await loadTrends(7);
});

trends14dBtn.addEventListener('click', async () => {
  trends14dBtn.classList.add('filter-btn-active');
  trends7dBtn.classList.remove('filter-btn-active');
  await loadTrends(14);
});

loadTrends();
