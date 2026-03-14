function normalizeFilterValues(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [];
}

function parseDateValue(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function matchesKeyword(task, keyword) {
  if (!keyword) return true;
  const text = `${task.title || ''}\n${task.prompt || ''}`.toLowerCase();
  return text.includes(String(keyword).toLowerCase());
}

function matchesList(values, actual) {
  if (!values.length) return true;
  return values.includes(actual);
}

function matchesAgents(values, agents) {
  if (!values.length) return true;
  return Array.isArray(agents) && agents.some(agent => values.includes(agent));
}

function matchesTimeRange(task, { timeFrom, timeTo }) {
  if (!timeFrom && !timeTo) return true;
  const createdAt = Number(task.createdAt || 0);
  const from = parseDateValue(timeFrom);
  const to = parseDateValue(timeTo);

  if (from != null && createdAt < from) return false;
  if (to != null && createdAt > to) return false;
  return true;
}

function filterTasks(tasks, filters = {}) {
  const statusValues = normalizeFilterValues(filters.status);
  const priorityValues = normalizeFilterValues(filters.priority);
  const modeValues = normalizeFilterValues(filters.mode);
  const agentValues = normalizeFilterValues(filters.agent);

  return (Array.isArray(tasks) ? tasks : []).filter(task => {
    if (!matchesKeyword(task, filters.keyword)) return false;
    if (!matchesList(statusValues, task.status)) return false;
    if (!matchesList(priorityValues, task.priority)) return false;
    if (!matchesList(modeValues, task.mode)) return false;
    if (!matchesAgents(agentValues, task.agents)) return false;
    if (!matchesTimeRange(task, filters)) return false;
    return true;
  });
}

function parseTaskFilters(query = {}) {
  const filters = {
    keyword: typeof query.keyword === 'string' ? query.keyword.trim() : '',
    status: normalizeFilterValues(query.status),
    agent: normalizeFilterValues(query.agent),
    priority: normalizeFilterValues(query.priority),
    mode: normalizeFilterValues(query.mode),
    timeFrom: typeof query.timeFrom === 'string' ? query.timeFrom : '',
    timeTo: typeof query.timeTo === 'string' ? query.timeTo : ''
  };

  return Object.fromEntries(Object.entries(filters).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  }));
}

module.exports = {
  filterTasks,
  parseTaskFilters,
  normalizeFilterValues,
  parseDateValue
};
