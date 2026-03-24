const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const NOTIFICATION_CHANNELS_FILE = path.join(DATA_DIR, 'notification-channels.json');

const VALID_CHANNEL_TYPES = ['feishu', 'dingtalk', 'wecom', 'slack'];
const DEFAULT_PRIORITY = 5;

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(NOTIFICATION_CHANNELS_FILE);
  } catch {
    await fs.writeFile(NOTIFICATION_CHANNELS_FILE, '[]\n');
  }
}

async function loadChannels() {
  await ensureData();
  const data = await fs.readFile(NOTIFICATION_CHANNELS_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveChannels(channels) {
  await ensureData();
  await fs.writeFile(NOTIFICATION_CHANNELS_FILE, JSON.stringify(channels, null, 2) + '\n');
}

async function getChannels() {
  return await loadChannels();
}

async function getChannel(channelId) {
  const channels = await loadChannels();
  return channels.find(c => c.id === channelId) || null;
}

async function createChannel(data) {
  if (!data.name?.trim()) {
    throw new Error('渠道名称不能为空');
  }
  if (!data.type || !VALID_CHANNEL_TYPES.includes(data.type)) {
    throw new Error(`无效的渠道类型，可选值: ${VALID_CHANNEL_TYPES.join(', ')}`);
  }
  if (!data.webhook?.trim() && !data.webhookUrl?.trim()) {
    throw new Error('Webhook 地址不能为空');
  }

  const channels = await loadChannels();
  const maxPriority = channels.reduce((max, c) => Math.max(max, c.priority || DEFAULT_PRIORITY), 0);
  const channel = {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    type: data.type,
    webhook: data.webhook?.trim() || data.webhookUrl?.trim(),
    webhookUrl: data.webhook?.trim() || data.webhookUrl?.trim(),
    isEnabled: data.isEnabled !== false,
    priority: data.priority != null ? Math.min(10, Math.max(1, parseInt(data.priority))) : maxPriority + 1,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  channels.push(channel);
  await saveChannels(channels);
  return channel;
}

async function updateChannel(channelId, data) {
  const channels = await loadChannels();
  const idx = channels.findIndex(c => c.id === channelId);
  if (idx === -1) {
    throw new Error('渠道不存在');
  }

  const channel = channels[idx];
  if (data.name != null) channel.name = data.name.trim();
  if (data.type != null) {
    if (!VALID_CHANNEL_TYPES.includes(data.type)) {
      throw new Error(`无效的渠道类型，可选值: ${VALID_CHANNEL_TYPES.join(', ')}`);
    }
    channel.type = data.type;
  }
  if (data.webhook != null) channel.webhook = data.webhook.trim();
  if (data.webhookUrl != null) channel.webhookUrl = data.webhookUrl.trim();
  if (data.isEnabled != null) channel.isEnabled = data.isEnabled;
  if (data.priority != null) channel.priority = Math.min(10, Math.max(1, parseInt(data.priority)));
  channel.updatedAt = Date.now();

  await saveChannels(channels);
  return channel;
}

async function deleteChannel(channelId) {
  const channels = await loadChannels();
  const idx = channels.findIndex(c => c.id === channelId);
  if (idx === -1) {
    throw new Error('渠道不存在');
  }
  const deleted = channels.splice(idx, 1)[0];
  await saveChannels(channels);
  return deleted;
}

async function toggleChannel(channelId) {
  const channels = await loadChannels();
  const idx = channels.findIndex(c => c.id === channelId);
  if (idx === -1) {
    throw new Error('渠道不存在');
  }
  channels[idx].isEnabled = !channels[idx].isEnabled;
  channels[idx].updatedAt = Date.now();
  await saveChannels(channels);
  return channels[idx];
}

async function sendTestMessage(channelId) {
  const channel = await getChannel(channelId);
  if (!channel) {
    throw new Error('渠道不存在');
  }

  const https = require('https');
  const http = require('http');

  const testMessage = {
    msgtype: 'text',
    text: {
      content: '🔔 Agent Orchestra 测试消息\n这是一条测试通知，用于验证渠道配置是否正确。'
    }
  };

  let webhookUrl = channel.webhook || channel.webhookUrl;
  
  if (channel.type === 'feishu') {
    webhookUrl = webhookUrl.includes('?') ? `${webhookUrl}&msgType=text&secret=` : webhookUrl;
  } else if (channel.type === 'slack') {
    webhookUrl = webhookUrl;
  }

  const urlObj = new URL(webhookUrl);
  const isHttps = urlObj.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, statusCode: res.statusCode, body: data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    if (channel.type === 'slack') {
      const slackMessage = {
        text: '🔔 Agent Orchestra 测试消息\n这是一条测试通知，用于验证渠道配置是否正确。',
        channel: channel.channelId || ''
      };
      req.write(JSON.stringify(slackMessage));
    } else {
      req.write(JSON.stringify(testMessage));
    }
    req.end();
  });
}

async function sendToChannel(channelIdOrName, message) {
  const channels = await loadChannels();
  let channel = null;
  
  if (channelIdOrName.includes('-') && channelIdOrName.length > 20) {
    channel = channels.find(c => c.id === channelIdOrName);
  }
  
  if (!channel) {
    channel = channels.find(c => c.type === channelIdOrName && c.isEnabled);
  }
  
  if (!channel) {
    throw new Error(`渠道不存在或未启用: ${channelIdOrName}`);
  }

  const https = require('https');
  const http = require('http');

  const textMessage = {
    msgtype: 'text',
    text: { content: message }
  };

  let webhookUrl = channel.webhook || channel.webhookUrl;
  
  if (channel.type === 'feishu') {
    webhookUrl = webhookUrl.includes('?') ? `${webhookUrl}&msgType=text&secret=` : webhookUrl;
  }

  const urlObj = new URL(webhookUrl);
  const isHttps = urlObj.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, statusCode: res.statusCode, channelId: channel.id, channelType: channel.type });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    if (channel.type === 'slack') {
      const slackMessage = {
        text: message,
        channel: channel.channelId || ''
      };
      req.write(JSON.stringify(slackMessage));
    } else {
      req.write(JSON.stringify(textMessage));
    }
    req.end();
  });
}

async function getChannelsByType(type) {
  const channels = await loadChannels();
  return channels.filter(c => c.type === type && c.isEnabled);
}

async function getSortedChannels() {
  const channels = await loadChannels();
  return channels
    .filter(c => c.isEnabled)
    .sort((a, b) => (a.priority || DEFAULT_PRIORITY) - (b.priority || DEFAULT_PRIORITY));
}

async function updateChannelPriority(channelId, priority) {
  const channels = await loadChannels();
  const idx = channels.findIndex(c => c.id === channelId);
  if (idx === -1) {
    throw new Error('渠道不存在');
  }
  const newPriority = Math.min(10, Math.max(1, parseInt(priority)));
  channels[idx].priority = newPriority;
  channels[idx].updatedAt = Date.now();
  await saveChannels(channels);
  return channels[idx];
}

async function reorderChannels(orderedIds) {
  const channels = await loadChannels();
  for (let i = 0; i < orderedIds.length; i++) {
    const idx = channels.findIndex(c => c.id === orderedIds[i]);
    if (idx !== -1) {
      channels[idx].priority = i + 1;
      channels[idx].updatedAt = Date.now();
    }
  }
  await saveChannels(channels);
  return channels;
}

async function sendWithFallback(message, options = {}) {
  const quietHours = require('./quiet-hours');
  const quietResult = quietHours.checkAndHandleQuietHours(message, options);
  
  if (!quietResult.shouldSend) {
    if (quietResult.reason === 'queued') {
      return {
        success: true,
        queued: true,
        reason: 'notification_queued_during_quiet_hours'
      };
    }
    return {
      success: true,
      skipped: true,
      reason: quietResult.reason
    };
  }

  const channels = await getSortedChannels();
  if (channels.length === 0) {
    throw new Error('没有启用的通知渠道');
  }

  const https = require('https');
  const http = require('http');

  const attemptHistory = [];
  let lastError = null;

  for (const channel of channels) {
    attemptHistory.push({
      channelId: channel.id,
      channelName: channel.name,
      channelType: channel.type,
      priority: channel.priority,
      attemptedAt: Date.now(),
      status: 'pending'
    });

    try {
      const result = await sendToChannel(channel.id, message);
      const usedFallback = attemptHistory.length > 1;
      
      return {
        success: true,
        channelId: channel.id,
        channelName: channel.name,
        channelType: channel.type,
        usedFallback,
        attemptCount: attemptHistory.length,
        attemptHistory
      };
    } catch (error) {
      lastError = error;
      attemptHistory[attemptHistory.length - 1].status = 'failed';
      attemptHistory[attemptHistory.length - 1].error = error.message;
    }
  }

  return {
    success: false,
    error: lastError?.message || '所有渠道发送失败',
    attemptCount: attemptHistory.length,
    attemptHistory
  };
}

async function sendTemplatedMessage(channelIdOrName, template, data) {
  const message = renderTemplate(template, data);
  return await sendToChannel(channelIdOrName, message);
}

function renderTemplate(template, data) {
  return template
    .replace(/{agentName}/g, data.agentName || '')
    .replace(/{workload}/g, data.workload || '')
    .replace(/{threshold}/g, data.threshold || '')
    .replace(/{level}/g, data.level || '')
    .replace(/{time}/g, data.time || '')
    .replace(/{percentage}/g, data.percentage || '')
    .replace(/{backupType}/g, data.backupType || '')
    .replace(/{fileSize}/g, data.fileSize || '')
    .replace(/{duration}/g, data.duration || '')
    .replace(/{error}/g, data.error || '')
    .replace(/{fileName}/g, data.fileName || '');
}

module.exports = {
  getChannels,
  getChannel,
  createChannel,
  updateChannel,
  deleteChannel,
  toggleChannel,
  sendTestMessage,
  sendToChannel,
  sendTemplatedMessage,
  getChannelsByType,
  getSortedChannels,
  updateChannelPriority,
  reorderChannels,
  sendWithFallback,
  renderTemplate,
  VALID_CHANNEL_TYPES,
  DEFAULT_PRIORITY
};