/**
 * Storage utilities - Local storage helpers for filters, presets, and templates
 */

export const FILTER_STORAGE_KEY = 'agentOrchestraFilters';
export const FILTER_PRESET_STORAGE_KEY = 'agentOrchestraFilterPresets';
export const TEMPLATE_STORAGE_KEY = 'agentOrchestraTemplates';

export const DEFAULT_PRESETS = [
  { key: 'running', name: '运行中任务', filters: { status: 'running' } },
  { key: 'high-failed', name: '高优先级失败任务', filters: { status: 'failed', priority: 'high' } },
  { key: 'today', name: '今天创建的任务', filters: { timeFrom: 'dynamic:todayStart', timeTo: 'dynamic:todayEnd' } }
];

export function loadFiltersFromStorage() {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveFiltersToStorage(filters) {
  try {
    const hasActiveFilters = Object.values(filters).some(value => value != null && value !== '');
    if (hasActiveFilters) {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } else {
      localStorage.removeItem(FILTER_STORAGE_KEY);
    }
  } catch {}
}

export function loadPresetsFromStorage() {
  try {
    const stored = localStorage.getItem(FILTER_PRESET_STORAGE_KEY);
    const presets = stored ? JSON.parse(stored) : [];
    return Array.isArray(presets) ? presets.filter(isValidPreset) : [];
  } catch {
    return [];
  }
}

export function savePresetsToStorage(presets) {
  try {
    if (Array.isArray(presets) && presets.length > 0) {
      localStorage.setItem(FILTER_PRESET_STORAGE_KEY, JSON.stringify(presets));
    } else {
      localStorage.removeItem(FILTER_PRESET_STORAGE_KEY);
    }
  } catch {}
}

export function loadTemplatesFromStorage() {
  try {
    const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveTemplatesToStorage(templates) {
  try {
    if (Array.isArray(templates) && templates.length > 0) {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    } else {
      localStorage.removeItem(TEMPLATE_STORAGE_KEY);
    }
  } catch {}
}

export function normalizePresetName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
}

export function isValidPreset(preset) {
  return Boolean(preset && typeof preset.name === 'string' && preset.name.trim() && preset.filters && typeof preset.filters === 'object');
}

export function getTodayBounds() {
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

export function resolveDynamicPresetFilters(filters = {}) {
  const next = { ...filters };
  const today = getTodayBounds();
  if (next.timeFrom === 'dynamic:todayStart') next.timeFrom = today.start;
  if (next.timeTo === 'dynamic:todayEnd') next.timeTo = today.end;
  return next;
}

export function areFiltersEqual(a = {}, b = {}) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

export function getResolvedDefaultPresets() {
  return DEFAULT_PRESETS.map(preset => ({
    ...preset,
    filters: resolveDynamicPresetFilters(preset.filters)
  }));
}

export function buildTaskQuery(filters = {}, force = false) {
  const params = new URLSearchParams();
  if (force) params.set('force', '1');
  Object.entries(filters).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getFilters() {
  const filters = {};
  const filterKeywordEl = document.getElementById('filterKeyword');
  const filterStatusEl = document.getElementById('filterStatus');
  const filterAgentEl = document.getElementById('filterAgent');
  const filterPriorityEl = document.getElementById('filterPriority');
  const filterModeEl = document.getElementById('filterMode');
  const filterTimeFromEl = document.getElementById('filterTimeFrom');
  const filterTimeToEl = document.getElementById('filterTimeTo');

  if (!filterKeywordEl) return filters;

  const keyword = filterKeywordEl.value.trim();
  const status = filterStatusEl?.value;
  const agent = filterAgentEl?.value;
  const priority = filterPriorityEl?.value;
  const mode = filterModeEl?.value;
  const timeFrom = filterTimeFromEl?.value;
  const timeTo = filterTimeToEl?.value;

  if (keyword) filters.keyword = keyword;
  if (status) filters.status = status;
  if (agent) filters.agent = agent;
  if (priority) filters.priority = priority;
  if (mode) filters.mode = mode;
  if (timeFrom) filters.timeFrom = new Date(timeFrom).toISOString();
  if (timeTo) filters.timeTo = new Date(timeTo).toISOString();

  return filters;
}

export function hasActiveFilters(filters = {}) {
  return Object.values(filters).some(value => value != null && value !== '');
}

export function parseFiltersFromUrl() {
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

export function syncFiltersToUrl(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, value);
  });
  const query = params.toString();
  const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
}

export function clearFilterUrl() {
  window.history.replaceState({}, '', window.location.pathname);
}