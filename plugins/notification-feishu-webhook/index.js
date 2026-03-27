'use strict';

/**
 * Notification Feishu Webhook Plugin
 * 
 * 飞书 Webhook 通知渠道插件
 * 支持通过飞书开放平台的 Webhook 机器人发送消息
 * 文档：https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN
 */

const crypto = require('crypto');

module.exports = async function(plugin, context) {
  function generateSign(secret, timestamp) {
    const stringToSign = `${timestamp}\n${secret}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(stringToSign);
    const sign = hmac.digest('base64');
    return encodeURIComponent(sign);
  }

  plugin.send = async function(message, options = {}) {
    const config = { ...plugin.config, ...options };
    
    if (!config.webhookUrl) {
      throw new Error('飞书 Webhook URL 未配置');
    }

    const msgType = options.msgType || 'text';
    let msgData = {};

    switch (msgType) {
      case 'text':
        msgData = {
          msg_type: 'text',
          content: {
            text: message
          }
        };
        break;
        
      case 'post':
        msgData = {
          msg_type: 'post',
          content: {
            post: {
              zh_cn: {
                title: options.title || 'Agent Orchestra 通知',
                content: [
                  [
                    { tag: 'text', text: message }
                  ]
                ]
              }
            }
          }
        };
        break;
        
      default:
        msgData = {
          msg_type: 'text',
          content: {
            text: message
          }
        };
    }

    let url = config.webhookUrl;
    
    if (config.secret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateSign(config.secret, timestamp);
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}timestamp=${timestamp}&sign=${sign}`;
    }

    try {
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
          },
          timeout: 10000
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              if (result.code === 0 || result.msg === 'success') {
                resolve({ success: true, result });
              } else {
                reject(new Error(`飞书 API 错误: ${result.msg || result.Error}`));
              }
            } catch (e) {
              resolve({ success: true, raw: data });
            }
          });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('请求超时'));
        });
        req.write(postData);
        req.end();
      });

      return response;
    } catch (error) {
      throw new Error(`发送飞书消息失败: ${error.message}`);
    }
  };

  plugin.test = async function(testConfig) {
    const testMessage = '🔔 Agent Orchestra 飞书通知测试消息\n这是一条来自插件系统的测试通知。';
    return await plugin.send(testMessage, testConfig);
  };

  plugin.formatTaskNotification = function(task) {
    const statusEmoji = {
      completed: '✅',
      failed: '❌',
      running: '🔄',
      queued: '⏳',
      paused: '⏸️',
      cancelled: '🚫'
    };
    
    const statusText = {
      completed: '已完成',
      failed: '失败',
      running: '执行中',
      queued: '等待中',
      paused: '已暂停',
      cancelled: '已取消'
    };
    
    return `**${statusEmoji[task.status] || '📋'} 任务通知：${task.title}**\n\n` +
      `状态: ${statusText[task.status] || task.status}\n` +
      `优先级: ${task.priority || '普通'}\n` +
      `Agent: ${task.agents?.join(', ') || '-'}\n` +
      `创建时间: ${new Date(task.createdAt).toLocaleString('zh-CN')}`;
  };

  plugin.formatWorkflowNotification = function(workflow, step) {
    const statusEmoji = {
      running: '🔄',
      completed: '✅',
      failed: '❌',
      paused: '⏸️'
    };
    
    let message = `**${statusEmoji[workflow.status] || '📋'} 工作流通知：${workflow.name}**\n\n`;
    message += `状态: ${workflow.status}\n`;
    message += `进度: ${workflow.currentStep || 0} / ${workflow.totalSteps || '?'}\n`;
    
    if (step) {
      message += `当前步骤: ${step.name || `步骤 ${step.index}`}\n`;
    }
    
    return message;
  };

  plugin.sendText = async function(text) {
    return await plugin.send(text, { msgType: 'text' });
  };

  plugin.sendPost = async function(text, title) {
    return await plugin.send(text, { msgType: 'post', title });
  };
};