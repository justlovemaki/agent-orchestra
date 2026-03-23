const fs = require('fs').promises;
const path = require('path');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const WORKFLOW_COMPLETION_CONFIG_FILE = path.join(DATA_DIR, 'workflow-completion-config.json');

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(WORKFLOW_COMPLETION_CONFIG_FILE);
  } catch {
    await fs.writeFile(WORKFLOW_COMPLETION_CONFIG_FILE, JSON.stringify({
      enabled: false,
      notifyOnComplete: true,
      notifyOnFailed: true,
      notifyChannels: []
    }, null, 2) + '\n');
  }
}

async function loadConfig() {
  await ensureData();
  const data = await fs.readFile(WORKFLOW_COMPLETION_CONFIG_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveConfig(config) {
  await ensureData();
  await fs.writeFile(WORKFLOW_COMPLETION_CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
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
  config.updatedAt = Date.now();
  await saveConfig(config);
  return config;
}

module.exports = {
  getConfig,
  updateConfig
};