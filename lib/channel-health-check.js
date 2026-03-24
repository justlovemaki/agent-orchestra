const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const HEALTH_FILE = path.join(DATA_DIR, 'channel-health.json');
const CONFIG_FILE = path.join(DATA_DIR, 'channel-health-config.json');

const DEFAULT_CONFIG = {
  enabled: false,
  intervalMinutes: 30,
  timeoutMs: 5000,
  unhealthyThreshold: 3,
  autoDisable: false
};

let periodicTimer = null;

// --- Data persistence ---

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadHealthData() {
  await ensureData();
  try {
    const data = await fs.readFile(HEALTH_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { statuses: {}, history: {} };
  }
}

async function saveHealthData(data) {
  await ensureData();
  await fs.writeFile(HEALTH_FILE, JSON.stringify(data, null, 2) + '\n');
}

async function getConfig() {
  await ensureData();
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

async function updateConfig(newConfig) {
  const config = await getConfig();
  const updated = {
    ...config,
    ...newConfig,
    updatedAt: Date.now()
  };
  if (updated.intervalMinutes != null) {
    updated.intervalMinutes = Math.max(1, Math.min(1440, parseInt(updated.intervalMinutes) || 30));
  }
  if (updated.timeoutMs != null) {
    updated.timeoutMs = Math.max(1000, Math.min(30000, parseInt(updated.timeoutMs) || 5000));
  }
  if (updated.unhealthyThreshold != null) {
    updated.unhealthyThreshold = Math.max(1, Math.min(20, parseInt(updated.unhealthyThreshold) || 3));
  }
  await ensureData();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(updated, null, 2) + '\n');
  return updated;
}

// --- Health check core ---

function probeWebhook(webhookUrl, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const urlObj = new URL(webhookUrl);
      const isHttps = urlObj.protocol === 'https:';
      const lib = isHttps ? https : http;

      // Use a minimal POST with empty body to probe connectivity
      // Most webhook endpoints accept POST and return quickly
      const req = lib.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AgentOrchestra-HealthCheck/1.0'
        },
        timeout: timeoutMs
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const latencyMs = Date.now() - start;
          // Consider 2xx, 4xx as "reachable" (webhook is alive, may reject empty payload)
          // Only 5xx or network errors indicate unhealthy
          const healthy = res.statusCode < 500;
          resolve({
            healthy,
            latencyMs,
            statusCode: res.statusCode,
            error: healthy ? null : `HTTP ${res.statusCode}`,
            checkedAt: Date.now()
          });
        });
      });

      req.on('error', (err) => {
        resolve({
          healthy: false,
          latencyMs: Date.now() - start,
          statusCode: null,
          error: err.message || 'Connection error',
          checkedAt: Date.now()
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          healthy: false,
          latencyMs: Date.now() - start,
          statusCode: null,
          error: `Timeout after ${timeoutMs}ms`,
          checkedAt: Date.now()
        });
      });

      // Send minimal JSON body
      req.write(JSON.stringify({ msgtype: 'text', text: { content: '' } }));
      req.end();
    } catch (err) {
      resolve({
        healthy: false,
        latencyMs: Date.now() - start,
        statusCode: null,
        error: err.message || 'Invalid URL',
        checkedAt: Date.now()
      });
    }
  });
}

async function healthCheck(channelId) {
  const notificationChannels = require('./notification-channels');
  const channel = await notificationChannels.getChannel(channelId);
  if (!channel) {
    throw new Error('渠道不存在');
  }

  const config = await getConfig();
  const webhookUrl = channel.webhook || channel.webhookUrl;
  if (!webhookUrl) {
    return {
      channelId,
      channelName: channel.name,
      channelType: channel.type,
      healthy: false,
      latencyMs: 0,
      statusCode: null,
      error: 'No webhook URL configured',
      checkedAt: Date.now()
    };
  }

  const result = await probeWebhook(webhookUrl, config.timeoutMs);

  // Update persistent state
  const healthData = await loadHealthData();
  if (!healthData.statuses) healthData.statuses = {};
  if (!healthData.history) healthData.history = {};

  const prevStatus = healthData.statuses[channelId] || {};
  const consecutiveFailures = result.healthy ? 0 : (prevStatus.consecutiveFailures || 0) + 1;
  const wasHealthy = prevStatus.healthy !== false;
  const justBecameUnhealthy = wasHealthy && !result.healthy && consecutiveFailures >= config.unhealthyThreshold;
  const justRecovered = !wasHealthy && result.healthy && prevStatus.consecutiveFailures >= config.unhealthyThreshold;

  healthData.statuses[channelId] = {
    channelId,
    channelName: channel.name,
    channelType: channel.type,
    healthy: result.healthy,
    latencyMs: result.latencyMs,
    statusCode: result.statusCode,
    error: result.error,
    consecutiveFailures,
    lastCheckedAt: result.checkedAt,
    lastHealthyAt: result.healthy ? result.checkedAt : (prevStatus.lastHealthyAt || null),
    markedUnhealthy: consecutiveFailures >= config.unhealthyThreshold ? true : false
  };

  // Record history (keep last 500 entries per channel)
  if (!healthData.history[channelId]) healthData.history[channelId] = [];
  healthData.history[channelId].unshift({
    healthy: result.healthy,
    latencyMs: result.latencyMs,
    statusCode: result.statusCode,
    error: result.error,
    checkedAt: result.checkedAt
  });
  if (healthData.history[channelId].length > 500) {
    healthData.history[channelId] = healthData.history[channelId].slice(0, 500);
  }

  await saveHealthData(healthData);

  // Auto-disable if configured
  if (config.autoDisable && consecutiveFailures >= config.unhealthyThreshold && channel.isEnabled) {
    try {
      await notificationChannels.toggleChannel(channelId);
    } catch { /* ignore */ }
  }

  return {
    ...healthData.statuses[channelId],
    justBecameUnhealthy,
    justRecovered
  };
}

async function checkAllChannels() {
  const notificationChannels = require('./notification-channels');
  const channels = await notificationChannels.getChannels();
  const enabledChannels = channels.filter(c => c.isEnabled);

  const results = [];
  for (const channel of enabledChannels) {
    try {
      const result = await healthCheck(channel.id);
      results.push(result);
    } catch (err) {
      results.push({
        channelId: channel.id,
        channelName: channel.name,
        channelType: channel.type,
        healthy: false,
        error: err.message,
        checkedAt: Date.now()
      });
    }
  }

  return results;
}

async function getHealthStatus() {
  const healthData = await loadHealthData();
  const notificationChannels = require('./notification-channels');
  const channels = await notificationChannels.getChannels();

  return channels.map(channel => {
    const s = healthData.statuses?.[channel.id] || null;
    // Compute a status string for frontend: 'healthy' | 'unhealthy' | 'unchecked'
    let statusStr = 'unchecked';
    if (s && s.healthy === true) statusStr = 'healthy';
    else if (s && s.healthy === false) statusStr = 'unhealthy';

    return {
      channelId: channel.id,
      channelName: channel.name,
      channelType: channel.type,
      isEnabled: channel.isEnabled,
      priority: channel.priority,
      // Native fields
      healthy: s ? s.healthy : null,
      latencyMs: s ? s.latencyMs : null,
      error: s ? s.error : null,
      consecutiveFailures: s ? s.consecutiveFailures : 0,
      lastCheckedAt: s ? s.lastCheckedAt : null,
      lastHealthyAt: s ? s.lastHealthyAt : null,
      markedUnhealthy: s ? s.markedUnhealthy : false,
      // Frontend-friendly aliases
      status: statusStr,
      lastCheck: s ? s.lastCheckedAt : null,
      lastLatency: s ? s.latencyMs : null
    };
  });
}

async function getHealthHistory(channelId, days = 7) {
  const healthData = await loadHealthData();
  const history = healthData.history?.[channelId] || [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return history.filter(h => h.checkedAt >= cutoff);
}

// --- Periodic check ---

function startPeriodicCheck(intervalMinutes) {
  stopPeriodicCheck();
  const ms = (intervalMinutes || 30) * 60 * 1000;
  periodicTimer = setInterval(async () => {
    try {
      await checkAllChannels();
    } catch { /* ignore periodic check errors */ }
  }, ms);
  // Don't block startup, run first check after a short delay
  setTimeout(async () => {
    try {
      await checkAllChannels();
    } catch { /* ignore */ }
  }, 5000);
}

function stopPeriodicCheck() {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
}

// --- Cleanup ---

async function removeChannelHealth(channelId) {
  const healthData = await loadHealthData();
  if (healthData.statuses) delete healthData.statuses[channelId];
  if (healthData.history) delete healthData.history[channelId];
  await saveHealthData(healthData);
}

// --- Get healthy channels (for integration with sendWithFallback) ---

async function getHealthySortedChannelIds() {
  const healthData = await loadHealthData();
  const statuses = healthData.statuses || {};
  // Return channel IDs that are known healthy, sorted by latency
  return Object.values(statuses)
    .filter(s => s.healthy === true)
    .sort((a, b) => (a.latencyMs || 0) - (b.latencyMs || 0))
    .map(s => s.channelId);
}

async function init() {
  await ensureData();
}

module.exports = {
  init,
  healthCheck,
  checkAllChannels,
  getHealthStatus,
  getHealthHistory,
  getConfig,
  updateConfig,
  startPeriodicCheck,
  stopPeriodicCheck,
  removeChannelHealth,
  getHealthySortedChannelIds
};
