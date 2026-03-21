const fs = require('fs').promises;
const path = require('path');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const AGENT_COMBINATIONS_FILE = path.join(DATA_DIR, 'agent-combinations.json');

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
    lastUsedAt: null
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
  return {
    usedCount: combinations[idx].usedCount,
    lastUsedAt: combinations[idx].lastUsedAt
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

module.exports = {
  getAgentCombinations,
  getAgentCombination,
  createAgentCombination,
  updateAgentCombination,
  deleteAgentCombination,
  overwriteAgentCombinations,
  loadAgentCombinations,
  saveAgentCombinations,
  incrementUsage
};