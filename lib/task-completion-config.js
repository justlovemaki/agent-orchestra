const fs = require('fs').promises;
const path = require('path');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const TASK_COMPLETION_CONFIG_FILE = path.join(DATA_DIR, 'task-completion-config.json');

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(TASK_COMPLETION_CONFIG_FILE);
  } catch {
    await fs.writeFile(TASK_COMPLETION_CONFIG_FILE, JSON.stringify({
      enabled: false,
      notifyOnComplete: true,
      notifyOnFailed: true,
      notifyChannels: [],
      priorityFilter: { enabled: false, priorities: [] },
      agentGroupFilter: { enabled: false, groups: [] }
    }, null, 2) + '\n');
  }
}

async function loadConfig() {
  await ensureData();
  const data = await fs.readFile(TASK_COMPLETION_CONFIG_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveConfig(config) {
  await ensureData();
  await fs.writeFile(TASK_COMPLETION_CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

async function getConfig() {
  return await loadConfig();
}

async function updateConfig(data) {
  const config = await loadConfig();
  if (data.enabled != null) config.enabled = data.enabled;
  if (data.notifyOnComplete != null) config.notifyOnComplete = data.notifyOnComplete;
  if (data.notifyOnFailed != null) config.notifyOnFailed = data.notifyOnFailed;
  if (data.notifyChannels != null) config.notifyChannels = data.notifyChannels;
  if (data.priorityFilter != null) {
    if (typeof data.priorityFilter.enabled === 'boolean') {
      config.priorityFilter.enabled = data.priorityFilter.enabled;
    }
    if (Array.isArray(data.priorityFilter.priorities)) {
      config.priorityFilter.priorities = data.priorityFilter.priorities;
    }
  }
  if (data.agentGroupFilter != null) {
    if (typeof data.agentGroupFilter.enabled === 'boolean') {
      config.agentGroupFilter.enabled = data.agentGroupFilter.enabled;
    }
    if (Array.isArray(data.agentGroupFilter.groups)) {
      config.agentGroupFilter.groups = data.agentGroupFilter.groups;
    }
  }
  config.updatedAt = Date.now();
  await saveConfig(config);
  return config;
}

module.exports = {
  getConfig,
  updateConfig
};
