const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

let ROOT = path.resolve(__dirname, '..');
if (!ROOT.endsWith('agent-orchestra')) {
  ROOT = path.resolve(process.cwd());
}
const DATA_DIR = path.join(ROOT, 'data');

/**
 * Get Feishu configuration from data directory.
 * @returns {Object|null} Feishu config object or null if not found
 */
function getFeishuConfig() {
  const configPath = path.join(DATA_DIR, 'feishu-config.json');
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    return null;
  }
}

/**
 * Get Feishu access token using app credentials.
 * @param {Object} config - Feishu app configuration
 * @returns {Promise<string>} Access token
 */
async function getFeishuAccessToken(config) {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret
    })
  });
  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`获取飞书 access_token 失败: ${data.msg}`);
  }
  return data.tenant_access_token;
}

/**
 * Upload image to Feishu and get image key.
 * @param {Object} config - Feishu app configuration
 * @param {string} accessToken - Feishu access token
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} [imageType='png'] - Image type/extension
 * @returns {Promise<string>} Image key for Feishu
 */
async function uploadFeishuImage(config, accessToken, imageBase64, imageType = 'png') {
  const buffer = Buffer.from(imageBase64, 'base64');
  const formData = new FormData();
  formData.append('image_type', 'message');
  formData.append('image', new Blob([buffer], `image/${imageType}`), `screenshot.${imageType}`);

  const response = await fetch('https://open.feishu.cn/open-apis/im/v1/images', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: formData
  });
  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`上传图片到飞书失败: ${data.msg}`);
  }
  return data.data.image_key;
}

/**
 * Send image message via Feishu.
 * @param {Object} config - Feishu app configuration
 * @param {string} channelId - Feishu channel or chat ID
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} [title] - Message title
 * @returns {Promise<Object>} Response data from Feishu API
 */
async function sendFeishuImageMessage(config, channelId, imageBase64, title) {
  const accessToken = await getFeishuAccessToken(config);
  const imageKey = await uploadFeishuImage(config, accessToken, imageBase64);

  const receiveIdType = channelId.startsWith('oc_') ? 'open_id' : 'chat_id';
  const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      receive_id: channelId,
      receive_id_type: receiveIdType,
      msg_type: 'image',
      content: JSON.stringify({ image_key: imageKey })
    })
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`发送飞书消息失败: ${data.msg}`);
  }
  return data.data;
}

/**
 * Send text message via Feishu.
 * @param {Object} config - Feishu app configuration
 * @param {string} channelId - Feishu channel or chat ID
 * @param {string} text - Text message content
 * @returns {Promise<Object>} Response data from Feishu API
 */
async function sendFeishuTextMessage(config, channelId, text) {
  const accessToken = await getFeishuAccessToken(config);
  const receiveIdType = channelId.startsWith('oc_') ? 'open_id' : 'chat_id';
  
  const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      receive_id: channelId,
      receive_id_type: receiveIdType,
      msg_type: 'text',
      content: JSON.stringify({ text })
    })
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`发送飞书文本消息失败: ${data.msg}`);
  }
  return data.data;
}

/**
 * Get DingTalk configuration from data directory.
 * @returns {Object|null} DingTalk config object or null if not found
 */
function getDingTalkConfig() {
  const configPath = path.join(DATA_DIR, 'dingtalk-config.json');
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    return null;
  }
}

/**
 * Save DingTalk configuration to data directory.
 * @param {Object} config - DingTalk configuration to save
 * @returns {Promise<Object>} The saved config
 */
async function saveDingTalkConfig(config) {
  const configPath = path.join(DATA_DIR, 'dingtalk-config.json');
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  return config;
}

/**
 * Get DingTalk access token using app credentials.
 * @param {Object} config - DingTalk app configuration
 * @returns {Promise<string>} Access token
 */
async function getDingTalkAccessToken(config) {
  const response = await fetch(`https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(config.appKey)}&appsecret=${encodeURIComponent(config.appSecret)}`);
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`获取钉钉 access_token 失败：${data.errmsg}`);
  }
  return data.access_token;
}

/**
 * Upload image to DingTalk and get media ID.
 * @param {string} accessToken - DingTalk access token
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} [imageType='png'] - Image type/extension
 * @returns {Promise<string>} Media ID for DingTalk
 */
async function uploadDingTalkImage(accessToken, imageBase64, imageType = 'png') {
  const buffer = Buffer.from(imageBase64, 'base64');
  const formData = new FormData();
  formData.append('media', new Blob([buffer], `image/${imageType}`), `screenshot.${imageType}`);
  formData.append('type', 'image');

  const response = await fetch('https://oapi.dingtalk.com/media/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: formData
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`上传图片到钉钉失败：${data.errmsg}`);
  }
  return data.media_id;
}

/**
 * Send image message via DingTalk webhook.
 * @param {string} webhook - DingTalk webhook URL
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} [title] - Message title
 * @returns {Promise<Object>} Response with message ID
 */
async function sendDingTalkImageMessage(webhook, imageBase64, title) {
  const imageType = 'png';
  const buffer = Buffer.from(imageBase64, 'base64');
  const formData = new FormData();
  formData.append('media', new Blob([buffer], `image/${imageType}`), `screenshot.${imageType}`);
  formData.append('type', 'image');

  const uploadResponse = await fetch('https://oapi.dingtalk.com/media/upload', {
    method: 'POST',
    body: formData
  });
  const uploadData = await uploadResponse.json();
  if (uploadData.errcode !== 0) {
    throw new Error(`上传图片到钉钉失败：${uploadData.errmsg}`);
  }
  const mediaId = uploadData.media_id;

  const messagePayload = {
    msgtype: 'markdown',
    markdown: {
      title: title || 'Agent Orchestra 面板截图',
      text: `![screenshot](@${mediaId})\n\n**${title || 'Agent Orchestra 面板截图'}**`
    }
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(messagePayload)
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`发送钉钉消息失败：${data.errmsg}`);
  }
  return { messageId: mediaId };
}

/**
 * Send text message via DingTalk webhook.
 * @param {string} webhook - DingTalk webhook URL
 * @param {string} text - Text message content
 * @returns {Promise<Object>} Response with message ID
 */
async function sendDingTalkTextMessage(webhook, text) {
  const messagePayload = {
    msgtype: 'text',
    text: { content: text }
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(messagePayload)
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`发送钉钉文本消息失败: ${data.errmsg}`);
  }
  return { messageId: data.errcode };
}

/**
 * Get WeChat Work (Wecom) configuration from data directory.
 * @returns {Object|null} Wecom config object or null if not found
 */
function getWecomConfig() {
  const configPath = path.join(DATA_DIR, 'wecom-config.json');
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    return null;
  }
}

/**
 * Save WeChat Work (Wecom) configuration to data directory.
 * @param {Object} config - Wecom configuration to save
 * @returns {Promise<Object>} The saved config
 */
async function saveWecomConfig(config) {
  const configPath = path.join(DATA_DIR, 'wecom-config.json');
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  return config;
}

/**
 * Get WeChat Work (Wecom) access token using app credentials.
 * @param {Object} config - Wecom app configuration
 * @returns {Promise<string>} Access token
 */
async function getWecomAccessToken(config) {
  const response = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(config.corpId)}&corpsecret=${encodeURIComponent(config.secret)}`);
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`获取企业微信 access_token 失败：${data.errmsg}`);
  }
  return data.access_token;
}

/**
 * Upload image to WeChat Work (Wecom) and get media ID.
 * @param {string} accessToken - Wecom access token
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} [imageType='png'] - Image type/extension
 * @returns {Promise<string>} Media ID for Wecom
 */
async function uploadWecomImage(accessToken, imageBase64, imageType = 'png') {
  const buffer = Buffer.from(imageBase64, 'base64');
  const formData = new FormData();
  formData.append('media', new Blob([buffer], `image/${imageType}`), `screenshot.${imageType}`);

  const response = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${accessToken}&type=image`, {
    method: 'POST',
    body: formData
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`上传图片到企业微信失败：${data.errmsg}`);
  }
  return data.media_id;
}

/**
 * Send image message via WeChat Work (Wecom) webhook.
 * @param {string} webhook - Wecom webhook URL
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} [title] - Message title
 * @returns {Promise<Object>} Response with message ID
 */
async function sendWecomImageMessage(webhook, imageBase64, title) {
  const imageType = 'png';
  const buffer = Buffer.from(imageBase64, 'base64');
  const formData = new FormData();
  formData.append('media', new Blob([buffer], `image/${imageType}`), `screenshot.${imageType}`);

  const uploadResponse = await fetch(`${webhook}&type=image`, {
    method: 'POST',
    body: formData
  });
  const uploadData = await uploadResponse.json();
  if (uploadData.errcode !== 0) {
    throw new Error(`上传图片到企业微信失败：${uploadData.errmsg}`);
  }
  const mediaId = uploadData.media_id;

  const messagePayload = {
    msgtype: 'image',
    image: {
      media_id: mediaId
    }
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(messagePayload)
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`发送企业微信消息失败：${data.errmsg}`);
  }
  return { messageId: mediaId };
}

/**
 * Send text message via WeChat Work (Wecom) webhook.
 * @param {string} webhook - Wecom webhook URL
 * @param {string} text - Text message content
 * @returns {Promise<Object>} Response with message ID
 */
async function sendWecomTextMessage(webhook, text) {
  const messagePayload = {
    msgtype: 'text',
    text: { content: text }
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(messagePayload)
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`发送企业微信文本消息失败: ${data.errmsg}`);
  }
  return { messageId: data.msgid };
}

/**
 * Get Slack configuration from data directory.
 * @returns {Object|null} Slack config object or null if not found
 */
function getSlackConfig() {
  const configPath = path.join(DATA_DIR, 'slack-config.json');
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    return null;
  }
}

/**
 * Save Slack configuration to data directory.
 * @param {Object} config - Slack configuration to save
 * @returns {Promise<Object>} The saved config
 */
async function saveSlackConfig(config) {
  const configPath = path.join(DATA_DIR, 'slack-config.json');
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  return config;
}

/**
 * Send image message via Slack.
 * @param {Object} config - Slack app configuration
 * @param {string} channelId - Slack channel ID
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} [title] - Message title
 * @returns {Promise<Object>} Response with message ID
 */
async function sendSlackImageMessage(config, channelId, imageBase64, title) {
  const buffer = Buffer.from(imageBase64, 'base64');
  const formData = new FormData();
  formData.append('file', new Blob([buffer], 'image/png'), 'screenshot.png');
  formData.append('channels', channelId);
  formData.append('title', title || 'Agent Orchestra 面板截图');

  const uploadResponse = await fetch('https://slack.com/api/files.upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.botToken}`
    },
    body: formData
  });
  const uploadData = await uploadResponse.json();
  if (!uploadData.ok) {
    throw new Error(`上传图片到 Slack 失败：${uploadData.error}`);
  }

  return { messageId: uploadData.file?.id || 'uploaded' };
}

/**
 * Send text message via Slack.
 * @param {Object} config - Slack app configuration
 * @param {string} channelId - Slack channel ID
 * @param {string} text - Text message content
 * @returns {Promise<Object>} Response with message ID
 */
async function sendSlackTextMessage(config, channelId, text) {
  const payload = {
    channel: channelId,
    text: text
  };

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.botToken}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(`发送 Slack 文本消息失败: ${data.error}`);
  }
  return { messageId: data.ts };
}

/**
 * Format bytes into human-readable string.
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string (e.g., "1.5 MB")
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
  getFeishuConfig,
  getFeishuAccessToken,
  uploadFeishuImage,
  sendFeishuImageMessage,
  sendFeishuTextMessage,
  getDingTalkConfig,
  saveDingTalkConfig,
  getDingTalkAccessToken,
  uploadDingTalkImage,
  sendDingTalkImageMessage,
  sendDingTalkTextMessage,
  getWecomConfig,
  saveWecomConfig,
  getWecomAccessToken,
  uploadWecomImage,
  sendWecomImageMessage,
  sendWecomTextMessage,
  getSlackConfig,
  saveSlackConfig,
  sendSlackImageMessage,
  sendSlackTextMessage,
  formatBytes
};