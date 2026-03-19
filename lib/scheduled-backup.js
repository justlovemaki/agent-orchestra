const fs = require('fs').promises;
const fsp = fs;
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const CONFIG_FILE = path.join(DATA_DIR, 'scheduled-backup-config.json');
const HISTORY_FILE = path.join(DATA_DIR, 'scheduled-backup-history.json');

let schedulerTimer = null;
let currentConfig = null;
let backupCreateFn = null;
let notificationFn = null;

const DEFAULT_CONFIG = {
  enabled: false,
  frequency: 'daily',
  time: '02:00',
  dayOfWeek: 1,
  retentionCount: 5,
  notification: {
    enabled: false,
    channels: []
  }
};

async function ensureDirectories() {
  await fsp.mkdir(BACKUPS_DIR, { recursive: true });
  try {
    await fsp.access(CONFIG_FILE);
  } catch {
    await fsp.writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
  }
  try {
    await fsp.access(HISTORY_FILE);
  } catch {
    await fsp.writeFile(HISTORY_FILE, '[]\n');
  }
}

async function loadConfig() {
  await ensureDirectories();
  const data = await fsp.readFile(CONFIG_FILE, 'utf8');
  return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
}

async function saveConfig(config) {
  await ensureDirectories();
  await fsp.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
  currentConfig = config;
}

async function loadHistory() {
  try {
    const data = await fsp.readFile(HISTORY_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function addHistoryEntry(entry) {
  const history = await loadHistory();
  history.unshift(entry);
  await fsp.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2) + '\n');
}

function setBackupCreateFunction(fn) {
  backupCreateFn = fn;
}

function setNotificationFunction(fn) {
  notificationFn = fn;
}

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

function calculateNextRunTime(config) {
  const now = new Date();
  const { hours, minutes } = parseTime(config.time);
  
  let next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  if (config.frequency === 'weekly') {
    const targetDay = config.dayOfWeek || 1;
    while (next.getDay() !== targetDay) {
      next.setDate(next.getDate() + 1);
    }
  }
  
  return next.getTime();
}

function getNextScheduledTime(config) {
  if (!config.enabled) return null;
  return calculateNextRunTime(config);
}

async function executeScheduledBackup() {
  if (!backupCreateFn) {
    console.error('[ScheduledBackup] Backup create function not set');
    return null;
  }
  
  const config = await loadConfig();
  if (!config.enabled) {
    return null;
  }
  
  const startTime = Date.now();
  const entry = {
    id: crypto.randomUUID(),
    type: 'scheduled',
    status: 'running',
    startedAt: startTime,
    finishedAt: null,
    error: null,
    fileName: null,
    fileSize: null
  };
  
  try {
    const result = await backupCreateFn(config.mode || 'full');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `scheduled-backup-${timestamp}.json`;
    const backupPath = path.join(BACKUPS_DIR, backupFileName);
    
    await fsp.writeFile(backupPath, JSON.stringify(result, null, 2) + '\n');
    
    const stats = await fsp.stat(backupPath);
    
    entry.status = 'success';
    entry.finishedAt = Date.now();
    entry.fileName = backupFileName;
    entry.fileSize = stats.size;
    
    await addHistoryEntry(entry);
    await cleanupOldBackups(config.retentionCount);

    if (config.notification?.enabled && notificationFn) {
      try {
        await notificationFn({
          success: true,
          type: config.mode || 'full',
          fileName: backupFileName,
          fileSize: stats.size,
          duration: Date.now() - startTime,
          channels: config.notification.channels
        });
      } catch (notifyError) {
        console.error('[ScheduledBackup] 发送通知失败:', notifyError.message);
      }
    }
    
    return {
      success: true,
      fileName: backupFileName,
      fileSize: stats.size,
      nextRunTime: getNextScheduledTime(config)
    };
  } catch (error) {
    entry.status = 'failed';
    entry.finishedAt = Date.now();
    entry.error = error.message;
    
    await addHistoryEntry(entry);

    if (config.notification?.enabled && notificationFn) {
      try {
        await notificationFn({
          success: false,
          type: config.mode || 'full',
          error: error.message,
          channels: config.notification.channels
        });
      } catch (notifyError) {
        console.error('[ScheduledBackup] 发送通知失败:', notifyError.message);
      }
    }
    
    return {
      success: false,
      error: error.message,
      nextRunTime: getNextScheduledTime(config)
    };
  }
}

async function cleanupOldBackups(retentionCount) {
  try {
    const files = await fsp.readdir(BACKUPS_DIR);
    const backupFiles = files
      .filter(f => f.startsWith('scheduled-backup-') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(BACKUPS_DIR, f),
        time: f.match(/scheduled-backup-([\d-]+)/)?.[1]
      }))
      .filter(f => f.time)
      .sort((a, b) => b.time.localeCompare(a.time));
    
    if (backupFiles.length > retentionCount) {
      const toDelete = backupFiles.slice(retentionCount);
      for (const file of toDelete) {
        await fsp.unlink(file.path);
      }
    }
  } catch (error) {
    console.error('[ScheduledBackup] Cleanup error:', error.message);
  }
}

function startScheduler() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  
  scheduleNextRun();
}

function scheduleNextRun() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  
  if (!currentConfig || !currentConfig.enabled) {
    return;
  }
  
  const nextRunTime = getNextScheduledTime(currentConfig);
  if (!nextRunTime) {
    return;
  }
  
  const delay = nextRunTime - Date.now();
  
  if (delay <= 0) {
    executeScheduledBackup().then(() => {
      scheduleNextRun();
    });
    return;
  }
  
  schedulerTimer = setTimeout(async () => {
    await executeScheduledBackup();
    scheduleNextRun();
  }, delay);
}

async function stopScheduler() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
}

async function updateConfig(newConfig) {
  const oldConfig = await loadConfig();
  const mergedConfig = { ...oldConfig, ...newConfig };
  
  await saveConfig(mergedConfig);
  currentConfig = mergedConfig;
  
  if (mergedConfig.enabled) {
    startScheduler();
  } else {
    await stopScheduler();
  }
  
  return {
    config: mergedConfig,
    nextRunTime: getNextScheduledTime(mergedConfig)
  };
}

async function getConfig() {
  const config = await loadConfig();
  return {
    ...config,
    nextRunTime: getNextScheduledTime(config)
  };
}

async function getHistory(limit = 20) {
  const history = await loadHistory();
  return history.slice(0, limit);
}

async function init() {
  await ensureDirectories();
  currentConfig = await loadConfig();
  
  if (currentConfig.enabled) {
    startScheduler();
  }
}

module.exports = {
  init,
  getConfig,
  updateConfig,
  getHistory,
  executeScheduledBackup,
  setBackupCreateFunction,
  setNotificationFunction,
  getNextScheduledTime,
  startScheduler,
  stopScheduler
};