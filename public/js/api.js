/**
 * API client - Fetch wrappers and API endpoints
 */

import { state, setAuthToken, clearState } from '../state.js';

export async function fetchJson(url, options = {}) {
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

export async function loadTasks(force = false) {
  const { buildTaskQuery, getFilters } = await import('../utils/storage.js');
  const query = buildTaskQuery(state.filters, force);
  const tasksRes = await fetchJson(`/api/tasks${query}`);
  state.tasks = tasksRes.tasks;
}

export async function loadOverview(force = false) {
  const overview = await fetchJson(`/api/overview${force ? '?force=1' : ''}`);
  state.overview = overview;
  return overview;
}

export async function loadRuntime() {
  const runtimeRes = await fetchJson('/api/runtime').catch(() => null);
  state.runtime = runtimeRes;
  return runtimeRes;
}

export async function loadStats() {
  const statsRes = await fetchJson('/api/stats').catch(() => null);
  state.stats = statsRes?.stats || null;
  return state.stats;
}

export async function loadTemplates() {
  const res = await fetchJson('/api/templates');
  state.templates = res.templates || [];
}

export async function loadGroups() {
  const res = await fetchJson('/api/groups');
  state.groups = res.groups || [];
}

export async function loadCombinations() {
  const res = await fetchJson('/api/combinations');
  state.combinations = res.combinations || [];
}

export async function loadSharedPresets() {
  const res = await fetchJson('/api/presets/shared').catch(() => ({ presets: [] }));
  state.sharedPresets = res.presets || [];
}

export async function loadWorkflows() {
  const res = await fetchJson('/api/workflows');
  state.workflows = res.workflows || [];
}

export async function loadSessions() {
  const res = await fetchJson('/api/sessions');
  state.sessions = res.sessions || [];
}

export async function loadAuditEvents(force = false) {
  const params = new URLSearchParams();
  if (force) params.set('force', '1');
  Object.entries(state.auditFilters).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, value);
  });
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetchJson(`/api/audit${query}`);
  state.auditEvents = res.events || [];
}

export async function checkAuthStatus() {
  if (!state.authToken) {
    state.currentUser = null;
    state.userPermissions = null;
    state.isAdmin = false;
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
    clearState();
  }
}

export async function login(name, password) {
  const res = await fetchJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ name, password })
  });
  setAuthToken(res.token);
  state.currentUser = res.user;
  state.isAdmin = res.user.role === 'admin';
  return res;
}

export async function register(name, password) {
  const res = await fetchJson('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, password })
  });
  setAuthToken(res.token);
  state.currentUser = res.user;
  state.isAdmin = res.user.role === 'admin';
  return res;
}

export async function logout() {
  try {
    await fetchJson('/api/auth/logout', { method: 'POST' });
  } catch {}
  clearState();
}

export async function createTask(payload) {
  return fetchJson('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function retryTask(taskId) {
  return fetchJson(`/api/tasks/${taskId}/retry`, { method: 'POST' });
}

export async function cancelTask(taskId) {
  return fetchJson(`/api/tasks/${taskId}/cancel`, { method: 'POST' });
}

export async function pauseTask(taskId) {
  return fetchJson(`/api/tasks/${taskId}/pause`, { method: 'POST' });
}

export async function resumeTask(taskId) {
  return fetchJson(`/api/tasks/${taskId}/resume`, { method: 'POST' });
}

export async function getTaskDetail(taskId) {
  return fetchJson(`/api/tasks/${taskId}`);
}

export async function createTemplate(payload) {
  return fetchJson('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateTemplate(templateId, payload) {
  return fetchJson(`/api/templates/${templateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function deleteTemplate(templateId) {
  return fetchJson(`/api/templates/${templateId}`, { method: 'DELETE' });
}

export async function createGroup(payload) {
  return fetchJson('/api/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateGroup(groupId, payload) {
  return fetchJson(`/api/groups/${groupId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function deleteGroup(groupId) {
  return fetchJson(`/api/groups/${groupId}`, { method: 'DELETE' });
}

export async function createCombination(payload) {
  return fetchJson('/api/combinations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateCombination(combinationId, payload) {
  return fetchJson(`/api/combinations/${combinationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function deleteCombination(combinationId) {
  return fetchJson(`/api/combinations/${combinationId}`, { method: 'DELETE' });
}

export async function createWorkflow(payload) {
  return fetchJson('/api/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateWorkflow(workflowId, payload) {
  return fetchJson(`/api/workflows/${workflowId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function deleteWorkflow(workflowId) {
  return fetchJson(`/api/workflows/${workflowId}`, { method: 'DELETE' });
}

export async function runWorkflow(workflowId, stopOnFailure = true) {
  return fetchJson(`/api/workflows/${workflowId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stopOnFailure })
  });
}

export async function cancelWorkflowRun(runId) {
  return fetchJson(`/api/workflows/runs/${runId}/cancel`, { method: 'POST' });
}

export async function spawnSession(agentId, task) {
  return fetchJson('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, task })
  });
}

export async function sendSessionMessage(sessionKey, message) {
  return fetchJson(`/api/sessions/${sessionKey}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
}

export async function loadNotificationChannels() {
  const res = await fetchJson('/api/admin/notification-channels');
  state.notificationChannels = res.channels || [];
}

export async function createNotificationChannel(payload) {
  return fetchJson('/api/admin/notification-channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateNotificationChannel(channelId, payload) {
  return fetchJson(`/api/admin/notification-channels/${channelId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function deleteNotificationChannel(channelId) {
  return fetchJson(`/api/admin/notification-channels/${channelId}`, { method: 'DELETE' });
}

export async function loadWorkloadAlertConfig() {
  if (!state.isAdmin) return;
  const res = await fetchJson('/api/admin/workload-alerts/config');
  state.workloadAlertConfig = res;
}

export async function saveWorkloadAlertConfig(payload) {
  return fetchJson('/api/admin/workload-alerts/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function loadWorkloadAlertHistory() {
  const res = await fetchJson('/api/admin/workload-alerts/history');
  state.workloadAlertHistory = res.history || [];
}

export async function loadTrends(days = state.trendsDays) {
  const res = await fetchJson(`/api/stats/trends?days=${days}`);
  state.trends = res.trends || [];
  state.trendsDays = res.days || days;
  state.agentUsage = res.agentUsage || [];
  state.taskStatusDistribution = res.taskStatusDistribution || [];
  state.agentWorkloadDistribution = res.agentWorkloadDistribution || [];
  return res;
}

export async function loadAllUsers() {
  const res = await fetchJson('/api/admin/users');
  state.allUsers = res.users || [];
}

export async function updateUserRole(userId, role) {
  return fetchJson(`/api/users/${userId}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role })
  });
}

export async function updateUserGroup(userId, groupId) {
  return fetchJson(`/api/admin/users/${userId}/group`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId })
  });
}

export async function loadUserGroups() {
  const res = await fetchJson('/api/admin/user-groups');
  return res.groups || [];
}

export async function createUserGroup(payload) {
  return fetchJson('/api/admin/user-groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateUserGroup(groupId, payload) {
  return fetchJson(`/api/admin/user-groups/${groupId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function deleteUserGroup(groupId) {
  return fetchJson(`/api/admin/user-groups/${groupId}`, { method: 'DELETE' });
}

export async function loadUsageTrends(combinationId, days = state.usageTrendsDays) {
  const params = new URLSearchParams({ days });
  if (combinationId) params.set('combinationId', combinationId);
  const res = await fetchJson(`/api/stats/usage-trends?${params}`);
  state.usageTrends = res.trends || [];
  state.usageTrendsDays = days;
  state.usageTrendsCombinationId = combinationId;
  return res;
}

export async function loadNotificationHistory(page = 1, filters = {}) {
  const params = new URLSearchParams({ page });
  Object.entries(filters).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, value);
  });
  const res = await fetchJson(`/api/admin/notifications/history?${params}`);
  state.notificationHistory = res.history || [];
  state.notificationHistoryPage = res.page || 1;
  state.notificationHistoryTotalPages = res.totalPages || 1;
}

export async function loadNotificationTrends(days = state.notificationTrendsDays) {
  const res = await fetchJson(`/api/admin/notifications/trends?days=${days}`);
  state.notificationTrends = res.trends || [];
  state.notificationTrendsDays = days;
}

export async function loadNotificationStats(days = state.notificationChartDays) {
  const res = await fetchJson(`/api/admin/notifications/stats?days=${days}`);
  state.notificationChartStats = res;
}

export async function loadPopularCombinations(sortBy = 'recent') {
  const res = await fetchJson(`/api/combinations/popular?sort=${sortBy}`);
  state.popularCombinations = res.combinations || [];
}

export async function loadRecommendations() {
  const res = await fetchJson('/api/combinations/recommendations');
  state.recommendations = res.recommendations || [];
  state.recommendationsGeneratedAt = res.generatedAt;
}

export async function loadBackupHistory() {
  const res = await fetchJson('/api/admin/backup');
  return res;
}

export async function createBackup() {
  return fetchJson('/api/admin/backup', { method: 'POST' });
}

export async function restoreBackup(backupId, mode = 'full') {
  return fetchJson(`/api/admin/backup/${backupId}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode })
  });
}

export async function loadAgentPerformance() {
  return fetchJson('/api/agent-performance');
}