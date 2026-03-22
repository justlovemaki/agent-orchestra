const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const AGENT_COMBINATIONS_FILE = path.join(DATA_DIR, 'agent-combinations.json');
const USAGE_HISTORY_FILE = path.join(DATA_DIR, 'agent-combinations-usage.json');

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(AGENT_COMBINATIONS_FILE);
  } catch {
    await fs.writeFile(AGENT_COMBINATIONS_FILE, '[]\n');
  }
}

async function loadAgentCombinations() {
  await ensureData();
  const data = await fs.readFile(AGENT_COMBINATIONS_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveAgentCombinations(combinations) {
  await ensureData();
  await fs.writeFile(AGENT_COMBINATIONS_FILE, JSON.stringify(combinations, null, 2) + '\n');
}

async function getAgentCombinations() {
  return await loadAgentCombinations();
}

async function getAgentCombination(id) {
  const combinations = await loadAgentCombinations();
  return combinations.find(c => c.id === id) || null;
}

async function createAgentCombination(data) {
  const combinations = await loadAgentCombinations();
  const newCombination = {
    id: crypto.randomUUID(),
    name: data.name,
    description: data.description || '',
    color: data.color || '#6b7280',
    agentIds: data.agentIds || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usedCount: 0,
    lastUsedAt: null,
    sharedWithTeam: data.sharedWithTeam || false,
    createdBy: data.createdBy || null
  };
  combinations.push(newCombination);
  await saveAgentCombinations(combinations);
  return newCombination;
}

async function incrementUsage(combinationId) {
  const combinations = await loadAgentCombinations();
  const idx = combinations.findIndex(c => c.id === combinationId);
  if (idx === -1) return null;
  
  combinations[idx].usedCount = (combinations[idx].usedCount || 0) + 1;
  combinations[idx].lastUsedAt = Date.now();
  combinations[idx].updatedAt = Date.now();
  
  await saveAgentCombinations(combinations);
  await recordUsageHistory(combinationId);
  return {
    usedCount: combinations[idx].usedCount,
    lastUsedAt: combinations[idx].lastUsedAt
  };
}

async function ensureUsageHistoryData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(USAGE_HISTORY_FILE);
  } catch {
    await fs.writeFile(USAGE_HISTORY_FILE, '{}');
  }
}

async function loadUsageHistory() {
  await ensureUsageHistoryData();
  const data = await fs.readFile(USAGE_HISTORY_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveUsageHistory(history) {
  await ensureUsageHistoryData();
  await fs.writeFile(USAGE_HISTORY_FILE, JSON.stringify(history, null, 2));
}

async function recordUsageHistory(combinationId) {
  const history = await loadUsageHistory();
  const now = Date.now();
  const dateKey = new Date().toISOString().split('T')[0];
  
  if (!history[combinationId]) {
    history[combinationId] = { records: [] };
  }
  
  history[combinationId].records.push({
    timestamp: now,
    date: dateKey
  });
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  cutoffDate.setHours(0, 0, 0, 0);
  
  history[combinationId].records = history[combinationId].records.filter(
    r => r.timestamp >= cutoffDate.getTime()
  );
  
  await saveUsageHistory(history);
}

async function getUsageTrends(combinationId, days = 14) {
  const history = await loadUsageHistory();
  const combinationHistory = history[combinationId];
  
  if (!combinationHistory || !combinationHistory.records || combinationHistory.records.length === 0) {
    const trends = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      trends.push({
        date: date.toISOString().split('T')[0],
        count: 0
      });
    }
    return { combinationId, trends, totalUsage: 0 };
  }
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  cutoffDate.setHours(0, 0, 0, 0);
  
  const cutoffTimestamp = cutoffDate.getTime();
  const filteredRecords = combinationHistory.records.filter(r => r.timestamp >= cutoffTimestamp);
  
  const dateCountMap = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    dateCountMap.set(dateKey, 0);
  }
  
  for (const record of filteredRecords) {
    const dateKey = record.date || new Date(record.timestamp).toISOString().split('T')[0];
    if (dateCountMap.has(dateKey)) {
      dateCountMap.set(dateKey, dateCountMap.get(dateKey) + 1);
    }
  }
  
  const trends = Array.from(dateCountMap.entries()).map(([date, count]) => ({
    date,
    count
  }));
  
  return {
    combinationId,
    trends,
    totalUsage: filteredRecords.length
  };
}

async function updateAgentCombination(id, data) {
  const combinations = await loadAgentCombinations();
  const idx = combinations.findIndex(c => c.id === id);
  if (idx === -1) return null;
  
  if (data.name != null) combinations[idx].name = data.name;
  if (data.description != null) combinations[idx].description = data.description;
  if (data.color != null) combinations[idx].color = data.color;
  if (data.agentIds != null) combinations[idx].agentIds = data.agentIds;
  combinations[idx].updatedAt = Date.now();
  
  await saveAgentCombinations(combinations);
  return combinations[idx];
}

async function deleteAgentCombination(id) {
  const combinations = await loadAgentCombinations();
  const idx = combinations.findIndex(c => c.id === id);
  if (idx === -1) return false;
  
  combinations.splice(idx, 1);
  await saveAgentCombinations(combinations);
  return true;
}

async function overwriteAgentCombinations(combinations) {
  await saveAgentCombinations(combinations);
  return true;
}

async function toggleShare(combinationId) {
  const combinations = await loadAgentCombinations();
  const idx = combinations.findIndex(c => c.id === combinationId);
  if (idx === -1) return null;
  
  combinations[idx].sharedWithTeam = !combinations[idx].sharedWithTeam;
  combinations[idx].updatedAt = Date.now();
  
  await saveAgentCombinations(combinations);
  return combinations[idx];
}

async function getPopularCombinations(limit = 10) {
  const combinations = await loadAgentCombinations();
  return combinations
    .filter(c => c.sharedWithTeam === true)
    .sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0))
    .slice(0, limit);
}

async function incrementUsageCount(combinationId) {
  return await incrementUsage(combinationId);
}

module.exports = {
  getAgentCombinations,
  getAgentCombination,
  createAgentCombination,
  updateAgentCombination,
  deleteAgentCombination,
  overwriteAgentCombinations,
  loadAgentCombinations,
  saveAgentCombinations,
  incrementUsage,
  incrementUsageCount,
  recordUsageHistory,
  getUsageTrends,
  toggleShare,
  getPopularCombinations
};