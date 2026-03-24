const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'quiet-hours-config.json');
const QUEUE_FILE = path.join(DATA_DIR, 'quiet-hours-queue.json');

const DEFAULT_CONFIG = {
  enabled: false,
  schedule: {
    startTime: '22:00',
    endTime: '08:00',
    timezone: 'Asia/Shanghai'
  },
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  queueMode: 'discard',
  allowCritical: true
};

function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    fs.accessSync(CONFIG_FILE);
  } catch {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
  }
  try {
    fs.accessSync(QUEUE_FILE);
  } catch {
    fs.writeFileSync(QUEUE_FILE, '[]\n');
  }
}

function loadConfig() {
  ensureData();
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config) {
  ensureData();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

function getConfig() {
  return loadConfig();
}

function updateConfig(patch) {
  const config = loadConfig();
  const updated = { ...config, ...patch };
  if (patch.schedule) {
    updated.schedule = { ...config.schedule, ...patch.schedule };
  }
  saveConfig(updated);
  return updated;
}

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function getCurrentTimeInTimezone(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const getPart = (type) => parts.find(p => p.type === type)?.value || '00';
  return {
    year: parseInt(getPart('year')),
    month: parseInt(getPart('month')),
    day: parseInt(getPart('day')),
    hour: parseInt(getPart('hour')),
    minute: parseInt(getPart('minute')),
    weekday: now.getDay()
  };
}

function isQuietHours(config = null) {
  const cfg = config || loadConfig();
  
  if (!cfg.enabled) {
    return { isQuiet: false, reason: 'disabled' };
  }

  const { schedule, daysOfWeek } = cfg;
  const current = getCurrentTimeInTimezone(schedule.timezone);
  
  if (!daysOfWeek.includes(current.weekday)) {
    return { isQuiet: false, reason: 'not_scheduled_day' };
  }

  const currentMinutes = current.hour * 60 + current.minute;
  const startMinutes = parseTime(schedule.startTime);
  const endMinutes = parseTime(schedule.endTime);

  let isInRange;
  if (startMinutes <= endMinutes) {
    isInRange = currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    isInRange = currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return { 
    isQuiet: isInRange, 
    reason: isInRange ? 'quiet_hours' : 'outside_hours',
    currentTime: current
  };
}

function getNextTransitionTime(config = null) {
  const cfg = config || loadConfig();
  
  if (!cfg.enabled) {
    return null;
  }

  const { schedule, daysOfWeek } = cfg;
  const current = getCurrentTimeInTimezone(schedule.timezone);
  const currentMinutes = current.hour * 60 + current.minute;
  const startMinutes = parseTime(schedule.startTime);
  const endMinutes = parseTime(schedule.endTime);

  const isCurrentlyQuiet = isQuietHours(cfg).isQuiet;
  
  let nextTime = null;
  let nextType = null;

  if (isCurrentlyQuiet) {
    if (startMinutes > endMinutes) {
      nextTime = { ...current, hour: Math.floor(endMinutes / 60), minute: endMinutes % 60 };
      nextType = 'end';
    } else {
      for (let i = 0; i < 7; i++) {
        const checkDay = (current.weekday + i) % 7;
        if (daysOfWeek.includes(checkDay)) {
          if (i === 0) {
            if (endMinutes > currentMinutes) {
              nextTime = { ...current, hour: Math.floor(endMinutes / 60), minute: endMinutes % 60 };
              nextType = 'end';
              break;
            }
          } else {
            const daysToAdd = daysOfWeek.filter(d => d >= current.weekday && d < current.weekday + i).length;
            if (daysToAdd > 0 || i > 0) {
              nextTime = { ...current, hour: Math.floor(endMinutes / 60), minute: endMinutes % 60 };
              nextType = 'end';
              break;
            }
          }
        }
      }
    }
  } else {
    if (startMinutes > endMinutes) {
      nextTime = { ...current, hour: Math.floor(startMinutes / 60), minute: startMinutes % 60 };
      nextType = 'start';
    } else {
      if (startMinutes > currentMinutes) {
        nextTime = { ...current, hour: Math.floor(startMinutes / 60), minute: startMinutes % 60 };
        nextType = 'start';
      } else {
        for (let i = 1; i <= 7; i++) {
          const checkDay = (current.weekday + i) % 7;
          if (daysOfWeek.includes(checkDay)) {
            nextTime = { ...current, hour: Math.floor(startMinutes / 60), minute: startMinutes % 60 };
            nextType = 'start';
            break;
          }
        }
      }
    }
  }

  return nextTime ? { time: nextTime, type: nextType } : null;
}

function getStatus() {
  const config = loadConfig();
  const quietStatus = isQuietHours(config);
  const nextTransition = getNextTransitionTime(config);
  const queue = getQueuedNotifications();
  
  return {
    isQuietHours: quietStatus.isQuiet,
    reason: quietStatus.reason,
    config,
    nextTransition,
    queueCount: queue.length
  };
}

function loadQueue() {
  ensureData();
  try {
    const data = fs.readFileSync(QUEUE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  ensureData();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2) + '\n');
}

function getQueuedNotifications() {
  return loadQueue();
}

function addToQueue(notification) {
  const queue = loadQueue();
  const entry = {
    id: crypto.randomUUID(),
    notification,
    queuedAt: Date.now()
  };
  queue.push(entry);
  saveQueue(queue);
  return entry;
}

function clearQueue() {
  saveQueue([]);
}

async function processQueue() {
  const queue = loadQueue();
  if (queue.length === 0) {
    return { processed: 0, queue: [] };
  }
  
  const notificationChannels = require('./notification-channels');
  
  const results = [];
  
  for (const entry of queue) {
    try {
      const result = await notificationChannels.sendWithFallback(entry.notification.message, entry.notification.options);
      results.push({ id: entry.id, success: true, result });
    } catch (error) {
      results.push({ id: entry.id, success: false, error: error.message });
    }
  }
  
  clearQueue();
  
  return { 
    processed: queue.length, 
    results,
    queue: []
  };
}

function checkAndHandleQuietHours(message, options = {}) {
  const config = loadConfig();
  const quietStatus = isQuietHours(config);
  
  if (!quietStatus.isQuiet) {
    return { shouldSend: true, reason: 'normal' };
  }
  
  if (config.allowCritical && options.priority === 'critical') {
    return { shouldSend: true, reason: 'critical_allowed' };
  }
  
  if (config.queueMode === 'queue') {
    addToQueue({ message, options });
    return { shouldSend: false, reason: 'queued' };
  }
  
  return { shouldSend: false, reason: 'discarded' };
}

module.exports = {
  getConfig,
  updateConfig,
  isQuietHours,
  getStatus,
  getQueuedNotifications,
  addToQueue,
  clearQueue,
  processQueue,
  checkAndHandleQuietHours,
  DEFAULT_CONFIG
};
