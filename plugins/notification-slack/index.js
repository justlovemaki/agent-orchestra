'use strict';

/**
 * Notification Slack Plugin
 * 
 * Slack 通知渠道插件
 * 支持通过 Slack Incoming Webhook 发送各种格式的消息
 * 文档：https://api.slack.com/messaging/webhooks
 */

module.exports = async function(plugin, context) {
  /**
   * 发送 Slack 消息
   * @param {string|object} message - 消息内容或 blocks 数组
   * @param {object} options - 发送选项
   * @returns {Promise<object>} 发送结果
   */
  plugin.send = async function(message, options = {}) {
    const config = { ...plugin.config, ...options };
    
    if (!config.webhookUrl) {
      throw new Error('Slack Webhook URL 未配置');
    }

    const msgType = options.msgType || 'text';
    let payload = {};

    // 基础配置
    if (config.username) {
      payload.username = config.username;
    }
    if (config.iconEmoji) {
      payload.icon_emoji = config.iconEmoji;
    }
    if (config.iconUrl) {
      payload.icon_url = config.iconUrl;
    }
    if (config.defaultChannel) {
      payload.channel = config.defaultChannel;
    }

    // 根据消息类型构建 payload
    switch (msgType) {
      case 'text':
        payload.text = message;
        break;
        
      case 'markdown':
        // Slack 使用 mrkdwn 格式
        payload.text = message;
        payload.mrkdwn = true;
        break;
        
      case 'blocks':
        // Slack Blocks 格式（结构化消息）
        if (Array.isArray(message)) {
          payload.blocks = message;
        } else {
          payload.blocks = [message];
        }
        // 可选的备用文本
        if (options.fallback) {
          payload.text = options.fallback;
        }
        break;
        
      case 'attachment':
        // Slack Attachments 格式
        payload.attachments = Array.isArray(message) ? message : [message];
        break;
        
      default:
        payload.text = message;
    }

    try {
      const fetch = global.fetch || require('node-fetch');
      
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      // Slack Webhook 成功时返回 "ok"
      const responseText = await response.text();
      
      if (response.ok && responseText === 'ok') {
        return { 
          success: true, 
          message: 'Message sent successfully',
          timestamp: Date.now()
        };
      } else {
        throw new Error(`Slack API error: ${response.status} ${responseText}`);
      }
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        // 降级使用原生 https 模块
        return await sendWithNativeHttps(config.webhookUrl, payload);
      }
      throw new Error(`发送 Slack 消息失败：${error.message}`);
    }
  };

  /**
   * 使用原生 https 模块发送（node-fetch 不可用时）
   */
  async function sendWithNativeHttps(webhookUrl, payload) {
    const https = require('https');
    const http = require('http');
    const urlObj = new URL(webhookUrl);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const postData = JSON.stringify(payload);
    
    return await new Promise((resolve, reject) => {
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
          if (res.statusCode === 200 && data === 'ok') {
            resolve({ 
              success: true, 
              message: 'Message sent successfully',
              timestamp: Date.now()
            });
          } else {
            reject(new Error(`Slack API error: ${res.statusCode} ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * 测试通知
   * @param {object} testConfig - 测试配置
   * @returns {Promise<object>} 测试结果
   */
  plugin.test = async function(testConfig) {
    const testMessage = '🔔 *Agent Orchestra 通知测试*\n\n这是一条来自插件系统的测试通知。\n如果收到此消息，说明 Slack 集成配置正确。';
    
    return await plugin.send(testMessage, {
      msgType: 'markdown',
      ...testConfig
    });
  };

  /**
   * 格式化任务通知
   * @param {object} task - 任务对象
   * @returns {object} Slack blocks 格式的消息
   */
  plugin.formatTaskNotification = function(task) {
    const statusConfig = {
      completed: { emoji: '✅', color: '#36a64f', text: '已完成' },
      failed: { emoji: '❌', color: '#ff0000', text: '失败' },
      running: { emoji: '🔄', color: '#2eb886', text: '执行中' },
      queued: { emoji: '⏳', color: '#ffa500', text: '等待中' },
      paused: { emoji: '⏸️', color: '#808080', text: '已暂停' },
      cancelled: { emoji: '🚫', color: '#808080', text: '已取消' }
    };
    
    const status = statusConfig[task.status] || { emoji: '📋', color: '#808080', text: task.status };
    
    const agents = task.agents?.length > 0 
      ? task.agents.map(a => `• ${a}`).join('\n')
      : '• 未分配';

    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${status.emoji} ${task.title}`,
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*状态:*\n${status.text}`
            },
            {
              type: 'mrkdwn',
              text: `*优先级:*\n${task.priority || '普通'}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Agent:*\n${agents}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `创建时间：<!date^${Math.floor(task.createdAt / 1000)}^{date} {time}|${new Date(task.createdAt).toLocaleString('zh-CN')}>`
            }
          ]
        }
      ],
      attachments: [{
        color: status.color
      }]
    };
  };

  /**
   * 格式化工作流通知
   * @param {object} workflow - 工作流对象
   * @param {object} step - 当前步骤（可选）
   * @returns {object} Slack blocks 格式的消息
   */
  plugin.formatWorkflowNotification = function(workflow, step) {
    const statusEmoji = {
      running: '🔄',
      completed: '✅',
      failed: '❌',
      paused: '⏸️'
    };

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji[workflow.status] || '📋'} 工作流：${workflow.name}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*状态:*\n${workflow.status}\n*进度:*\n${workflow.currentStep || 0} / ${workflow.totalSteps || '?'}`
        }
      }
    ];

    if (step) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*当前步骤:*\n${step.name || `步骤 ${step.index}`}`
        }
      });
    }

    return { blocks };
  };

  /**
   * 发送简单文本消息（快捷方法）
   * @param {string} text - 文本内容
   * @returns {Promise<object>} 发送结果
   */
  plugin.sendText = async function(text) {
    return await plugin.send(text, { msgType: 'text' });
  };

  /**
   * 发送 Markdown 消息（快捷方法）
   * @param {string} markdown - Markdown 内容
   * @returns {Promise<object>} 发送结果
   */
  plugin.sendMarkdown = async function(markdown) {
    return await plugin.send(markdown, { msgType: 'markdown' });
  };

  /**
   * 发送 Blocks 消息（快捷方法）
   * @param {array} blocks - Slack blocks 数组
   * @returns {Promise<object>} 发送结果
   */
  plugin.sendBlocks = async function(blocks) {
    return await plugin.send(blocks, { msgType: 'blocks' });
  };
};
