const fs = require('fs').promises;
const path = require('path');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'scheduled-backup-notify-config.json');

const DEFAULT_CONFIG = {
  enabled: false,
  notifyOnComplete: true,
  notifyOnFailed: true,
  notifyChannels: [],
  updatedAt: null
};

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(CONFIG_FILE);
  } catch {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
  }
}

async function loadConfig() {
  await ensureData();
  const data = await fs.readFile(CONFIG_FILE, 'utf8');
  return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
}

async function saveConfig(config) {
  await ensureData();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
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
