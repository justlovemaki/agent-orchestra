/**
 * Global state management - Central application state
 */

export const AUTH_TOKEN_KEY = 'authToken';

export const state = {
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
  notificationTrends: null,
  notificationTrendsDays: 7,
  notificationChartStats: null,
  notificationChartDays: 14,
  currentChannelTab: 'channels',
  notificationTemplates: null,
  templateVariables: [],
  workflowNotificationConfig: null,
  scheduledBackupNotificationConfig: null,
  recommendations: [],
  recommendationsGeneratedAt: null,
  currentCombinationTab: 'combinations',
  combinationSortBy: 'recent',
  popularCombinations: [],
  stats: null
};

export function setAuthToken(token) {
  state.authToken = token;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export function clearState() {
  state.currentUser = null;
  state.authToken = null;
  state.isAdmin = false;
  state.userPermissions = null;
  state.allUsers = [];
  localStorage.removeItem(AUTH_TOKEN_KEY);
}