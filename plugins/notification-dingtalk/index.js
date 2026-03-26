'use strict';

/**
 * Notification DingTalk Plugin
 * 
 * 钉钉通知渠道插件
 * 支持通过钉钉机器人发送各种格式的消息
 */

const crypto = require('crypto');

module.exports = async function(plugin, context) {
  function generateSign(secret) {
    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${secret}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(stringToSign);
    const sign = hmac.digest('base64');
    return { timestamp, sign: encodeURIComponent(sign) };
  }

  plugin.send = async function(message, options = {}) {
    const config = { ...plugin.config, ...options };
    
    if (!config.webhookUrl) {
      throw new Error('钉钉 Webhook URL 未配置');
    }

    const msgType = options.msgType || 'text';
    let msgData = {};

    switch (msgType) {
      case 'text':
        msgData = {
          msgtype: 'text',
          text: {
            content: message
          },
          at: {
            atMobiles: config.atMobiles || [],
            isAtAll: config.isAtAll || false
          }
        };
        break;
        
      case 'markdown':
        msgData = {
          msgtype: 'markdown',
          markdown: {
            title: options.title || '通知',
            text: message
          },
          at: {
            atMobiles: config.atMobiles || [],
            isAtAll: config.isAtAll || false
          }
        };
        break;
        
      case 'link':
        msgData = {
          msgtype: 'link',
          link: {
            title: options.title || '通知',
            text: message,
            messageUrl: options.url || 'https://agent-orchestra.local',
            picUrl: options.imageUrl || ''
          }
        };
        break;
        
      case 'actionCard':
        msgData = {
          msgtype: 'actionCard',
          actionCard: {
            title: options.title || '通知',
            text: message,
            btnOrientation: options.btnOrientation || '0',
            buttons: options.buttons || [
              { title: '查看详情', actionURL: options.url || 'https://agent-orchestra.local' }
            ]
          }
        };
        break;
        
      default:
        msgData = {
          msgtype: 'text',
          text: { content: message }
        };
    }

    let url = config.webhookUrl;
    if (config.secret) {
      const { timestamp, sign } = generateSign(config.secret);
      url += `&timestamp=${timestamp}&sign=${sign}`;
    }

    try {
      const fetch = require('node:https') || require('http');
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const lib = isHttps ? require('https') : require('http');
      
      const postData = JSON.stringify(msgData);
      
      const response = await new Promise((resolve, reject) => {
        const req = lib.request({
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              if (result.errcode === 0) {
                resolve({ success: true, result });
              } else {
                reject(new Error(`钉钉 API 错误: ${result.errmsg}`));
              }
            } catch (e) {
              resolve({ success: true, raw: data });
            }
          });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      return response;
    } catch (error) {
      throw new Error(`发送钉钉消息失败: ${error.message}`);
    }
  };

  plugin.test = async function(testConfig) {
    const testMessage = '🔔 Agent Orchestra 钉钉通知测试消息\n这是一条来自插件系统的测试通知。';
    return await plugin.send(testMessage, {
      msgType: 'markdown',
      title: '测试通知',
      ...testConfig
    });
  };

  plugin.formatTaskNotification = function(task) {
    const statusEmoji = {
      completed: '✅',
      failed: '❌',
      running: '🔄',
      queued: '⏳'
    };
    
    const statusText = {
      completed: '已完成',
      failed: '失败',
      running: '执行中',
      queued: '等待中'
    };
    
    return `## 任务状态通知\n\n` +
      `**${statusEmoji[task.status] || '📋'} ${task.title}**\n\n` +
      `- 状态: ${statusText[task.status] || task.status}\n` +
      `- Agent: ${task.agents?.join(', ') || '-'}\n` +
      `- 创建时间: ${new Date(task.createdAt).toLocaleString('zh-CN')}\n`;
  };
};
