'use strict';

const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

/**
 * Notification Email Plugin
 * 
 * 邮件通知渠道插件
 * 支持通过 SMTP 协议发送 HTML 和纯文本邮件
 * 使用 Node.js 原生 net/tls 模块，无需外部依赖
 */

module.exports = async function(plugin, context) {
  /**
   * 验证配置
   */
  function validateConfig(config) {
    const required = ['smtpHost', 'smtpPort', 'username', 'password', 'from'];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`配置项 ${field} 为必填项`);
      }
    }
    
    if (!config.smtpPort || config.smtpPort < 1 || config.smtpPort > 65535) {
      throw new Error('无效的 SMTP 端口号');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(config.from)) {
      throw new Error('发件人邮箱地址格式无效');
    }
  }

  /**
   * SMTP 命令发送与响应读取
   */
  class SMTPClient {
    constructor(options) {
      this.options = options;
      this.socket = null;
      this.response = '';
      this.secure = options.secure !== false;
      this.rejectUnauthorized = options.rejectUnauthorized !== false;
    }

    /**
     * 连接 SMTP 服务器
     */
    async connect() {
      return new Promise((resolve, reject) => {
        const { smtpHost, smtpPort, secure, rejectUnauthorized } = this.options;
        
        const connectionOptions = {
          host: smtpHost,
          port: smtpPort,
          rejectUnauthorized: rejectUnauthorized
        };

        if (secure) {
          this.socket = tls.connect(connectionOptions, () => {
            resolve();
          });
        } else {
          this.socket = net.createConnection(connectionOptions, () => {
            resolve();
          });
        }

        this.socket.setEncoding('utf8');
        
        this.socket.on('data', (data) => {
          this.response += data;
        });

        this.socket.on('error', (err) => {
          reject(new Error(`SMTP 连接失败: ${err.message}`));
        });

        this.socket.on('timeout', () => {
          this.socket.destroy();
          reject(new Error('SMTP 连接超时'));
        });

        this.socket.setTimeout(30000);
      });
    }

    /**
     * 读取 SMTP 响应
     */
    async readResponse() {
      return new Promise((resolve) => {
        const checkData = () => {
          if (this.response.includes('\r\n')) {
            const lines = this.response.split('\r\n');
            const lastLine = lines[lines.length - 2] || lines[lines.length - 1];
            this.response = '';
            resolve(lastLine);
          } else {
            setTimeout(checkData, 50);
          }
        };
        checkData();
      });
    }

    /**
     * 发送命令并读取响应
     */
    async sendCommand(command) {
      return new Promise((resolve, reject) => {
        this.socket.write(command + '\r\n', 'utf8', async (err) => {
          if (err) {
            reject(new Error(`发送命令失败: ${err.message}`));
            return;
          }
          
          await new Promise(r => setTimeout(r, 100));
          const response = await this.readResponse();
          const code = response.substring(0, 3);
          
          if (code.startsWith('4') || code.startsWith('5')) {
            reject(new Error(`SMTP 错误: ${response}`));
            return;
          }
          
          resolve(response);
        });
      });
    }

    /**
     * 关闭连接
     */
    async quit() {
      try {
        await this.sendCommand('QUIT');
      } catch (e) {
        // 忽略退出时的错误
      }
      if (this.socket) {
        this.socket.destroy();
      }
    }
  }

  /**
   * 发送邮件
   * @param {string|object} message - 邮件内容或配置对象
   * @param {object} options - 发送选项
   * @returns {Promise<object>} 发送结果
   */
  plugin.send = async function(message, options = {}) {
    const config = { ...plugin.config, ...options };
    validateConfig(config);

    let to, subject, text, html;
    
    if (typeof message === 'string') {
      to = options.to || config.defaultTo;
      subject = options.subject || 'Agent Orchestra 通知';
      text = message;
      html = options.html || null;
    } else if (typeof message === 'object') {
      to = message.to || options.to || config.defaultTo;
      subject = message.subject || options.subject || 'Agent Orchestra 通知';
      text = message.text || message.body || '';
      html = message.html || options.html || null;
    }

    if (!to) {
      throw new Error('收件人地址未指定');
    }

    const recipients = Array.isArray(to) ? to : to.split(',').map(e => e.trim());
    
    for (const recipient of recipients) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        throw new Error(`无效的收件人邮箱地址: ${recipient}`);
      }
    }

    try {
      const result = await sendEmail(config, recipients, subject, text, html);
      return result;
    } catch (error) {
      throw new Error(`发送邮件失败: ${error.message}`);
    }
  };

  /**
   * 发送邮件的核心实现
   */
  async function sendEmail(config, recipients, subject, text, html) {
    const client = new SMTPClient({
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      secure: config.secure,
      rejectUnauthorized: config.rejectUnauthorized
    });

    try {
      await client.connect();
      
      // 读取服务器问候
      await client.readResponse();
      
      // EHLO 命令
      const hostname = require('os').hostname();
      await client.sendCommand(`EHLO ${hostname}`);
      
      // STARTTLS（如果需要）
      if (!config.secure && config.smtpPort === 587) {
        await client.sendCommand('STARTTLS');
        // 升级到 TLS
        client.socket = tls.connect({
          host: config.smtpHost,
          port: config.smtpPort,
          rejectUnauthorized: config.rejectUnauthorized !== false
        }, () => {});
        
        await new Promise((resolve, reject) => {
          client.socket.on('secureConnect', resolve);
          client.socket.on('error', reject);
          client.socket.setTimeout(30000);
        });
        
        // 重新发送 EHLO
        await client.sendCommand(`EHLO ${hostname}`);
      }

      // AUTH LOGIN
      await client.sendCommand('AUTH LOGIN');
      await client.sendCommand(Buffer.from(config.username).toString('base64'));
      await client.sendCommand(Buffer.from(config.password).toString('base64'));

      // MAIL FROM
      const from = config.fromName 
        ? `${config.fromName} <${config.from}>` 
        : config.from;
      await client.sendCommand(`MAIL FROM:<${config.from}>`);

      // RCPT TO
      for (const recipient of recipients) {
        await client.sendCommand(`RCPT TO:<${recipient}>`);
      }

      // DATA
      await client.sendCommand('DATA');

      // 构建邮件内容
      const messageId = `<${crypto.randomUUID()}@${config.smtpHost}>`;
      const date = new Date().toUTCString();
      
      let emailContent = `From: ${from}\r\n`;
      emailContent += `To: ${recipients.join(', ')}\r\n`;
      emailContent += `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\n`;
      emailContent += `Message-ID: ${messageId}\r\n`;
      emailContent += `Date: ${date}\r\n`;
      emailContent += `MIME-Version: 1.0\r\n`;
      emailContent += `X-Mailer: Agent Orchestra\r\n`;

      if (html && text) {
        // 多部分邮件
        const boundary = `----=_Part_${crypto.randomBytes(8).toString('hex')}`;
        emailContent += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
        emailContent += `\r\n--${boundary}\r\n`;
        emailContent += `Content-Type: text/plain; charset=UTF-8\r\n`;
        emailContent += `Content-Transfer-Encoding: base64\r\n\r\n`;
        emailContent += `${Buffer.from(text).toString('base64')}\r\n`;
        emailContent += `\r\n--${boundary}\r\n`;
        emailContent += `Content-Type: text/html; charset=UTF-8\r\n`;
        emailContent += `Content-Transfer-Encoding: base64\r\n\r\n`;
        emailContent += `${Buffer.from(html).toString('base64')}\r\n`;
        emailContent += `\r\n--${boundary}--\r\n`;
      } else if (html) {
        // 仅 HTML
        emailContent += `Content-Type: text/html; charset=UTF-8\r\n`;
        emailContent += `Content-Transfer-Encoding: base64\r\n\r\n`;
        emailContent += `${Buffer.from(html).toString('base64')}\r\n`;
      } else {
        // 仅纯文本
        emailContent += `Content-Type: text/plain; charset=UTF-8\r\n`;
        emailContent += `Content-Transfer-Encoding: base64\r\n\r\n`;
        emailContent += `${Buffer.from(text).toString('base64')}\r\n`;
      }

      emailContent += '\r\n.';
      
      await client.sendCommand(emailContent);
      
      await client.quit();

      return {
        success: true,
        message: 'Email sent successfully',
        messageId: messageId,
        timestamp: Date.now()
      };
    } catch (error) {
      try {
        await client.quit();
      } catch (e) {}
      throw error;
    }
  }

  /**
   * 测试通知
   * @param {object} testConfig - 测试配置
   * @returns {Promise<object>} 测试结果
   */
  plugin.test = async function(testConfig) {
    const config = { ...plugin.config, ...testConfig };
    validateConfig(config);

    const testSubject = 'Agent Orchestra 邮件通知测试';
    const testText = `这是一封来自 Agent Orchestra 插件系统的测试邮件。\n\n如果您收到此邮件，说明邮件通知配置正确。\n\n发送时间: ${new Date().toLocaleString('zh-CN')}`;
    const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🔔 Agent Orchestra 邮件通知测试</h2>
    </div>
    <div class="content">
      <p>这是一封来自 <strong>Agent Orchestra</strong> 插件系统的测试邮件。</p>
      <p>如果您收到此邮件，说明邮件通知配置正确。</p>
      <p><strong>发送时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
    </div>
    <div class="footer">
      <p>Agent Orchestra - 智能任务编排系统</p>
    </div>
  </div>
</body>
</html>`;

    return await plugin.send({
      to: testConfig.testTo || config.from,
      subject: testSubject,
      text: testText,
      html: testHtml
    }, config);
  };

  /**
   * 格式化任务通知
   * @param {object} task - 任务对象
   * @returns {object} 格式化的邮件内容
   */
  plugin.formatTaskNotification = function(task) {
    const statusConfig = {
      completed: { emoji: '✅', color: '#22c55e', text: '已完成', bgColor: '#dcfce7' },
      failed: { emoji: '❌', color: '#ef4444', text: '失败', bgColor: '#fee2e2' },
      running: { emoji: '🔄', color: '#3b82f6', text: '执行中', bgColor: '#dbeafe' },
      queued: { emoji: '⏳', color: '#f59e0b', text: '等待中', bgColor: '#fef3c7' },
      paused: { emoji: '⏸️', color: '#6b7280', text: '已暂停', bgColor: '#f3f4f6' },
      cancelled: { emoji: '🚫', color: '#6b7280', text: '已取消', bgColor: '#f3f4f6' }
    };

    const status = statusConfig[task.status] || { emoji: '📋', color: '#6b7280', text: task.status, bgColor: '#f3f4f6' };

    const agents = task.agents?.length > 0 
      ? task.agents.map(a => `<li>${a}</li>`).join('')
      : '<li>未分配</li>';

    const subject = `${status.emoji} 任务通知: ${task.title}`;
    
    const text = `任务: ${task.title}
状态: ${status.text}
优先级: ${task.priority || '普通'}
Agent: ${task.agents?.join(', ') || '未分配'}
创建时间: ${new Date(task.createdAt).toLocaleString('zh-CN')}
${task.description ? `\n描述: ${task.description}` : ''}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; }
    .header h2 { margin: 0; font-size: 20px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; margin-top: 8px; font-weight: 500; }
    .content { background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; }
    .info-row { display: flex; margin-bottom: 12px; }
    .label { font-weight: 600; color: #6b7280; width: 80px; flex-shrink: 0; }
    .value { color: #111827; }
    .agent-list { margin: 0; padding-left: 20px; }
    .description { background: #f9fafb; padding: 12px; border-radius: 8px; margin-top: 16px; white-space: pre-wrap; }
    .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${status.emoji} ${task.title}</h2>
      <span class="status-badge" style="background: ${status.bgColor}; color: ${status.color};">${status.text}</span>
    </div>
    <div class="content">
      <div class="info-row">
        <span class="label">优先级:</span>
        <span class="value">${task.priority || '普通'}</span>
      </div>
      <div class="info-row">
        <span class="label">Agent:</span>
        <span class="value">
          <ul class="agent-list">${agents}</ul>
        </span>
      </div>
      <div class="info-row">
        <span class="label">创建时间:</span>
        <span class="value">${new Date(task.createdAt).toLocaleString('zh-CN')}</span>
      </div>
      ${task.description ? `<div class="description">${task.description}</div>` : ''}
    </div>
    <div class="footer">
      <p>Agent Orchestra - 智能任务编排系统</p>
    </div>
  </div>
</body>
</html>`;

    return { subject, text, html };
  };

  /**
   * 格式化工作流通知
   * @param {object} workflow - 工作流对象
   * @param {object} step - 当前步骤（可选）
   * @returns {object} 格式化的邮件内容
   */
  plugin.formatWorkflowNotification = function(workflow, step) {
    const statusConfig = {
      running: { emoji: '🔄', color: '#3b82f6', text: '执行中', bgColor: '#dbeafe' },
      completed: { emoji: '✅', color: '#22c55e', text: '已完成', bgColor: '#dcfce7' },
      failed: { emoji: '❌', color: '#ef4444', text: '失败', bgColor: '#fee2e2' },
      paused: { emoji: '⏸️', color: '#6b7280', text: '已暂停', bgColor: '#f3f4f6' }
    };

    const status = statusConfig[workflow.status] || { emoji: '📋', color: '#6b7280', text: workflow.status, bgColor: '#f3f4f6' };
    const progress = workflow.currentStep !== undefined 
      ? `${workflow.currentStep} / ${workflow.totalSteps || '?'}` 
      : '?';

    const subject = `${status.emoji} 工作流通知: ${workflow.name}`;
    
    const text = `工作流: ${workflow.name}
状态: ${status.text}
进度: ${progress}
${step ? `当前步骤: ${step.name || '步骤 ' + step.index}` : ''}
开始时间: ${workflow.startedAt ? new Date(workflow.startedAt).toLocaleString('zh-CN') : '-'}
${workflow.finishedAt ? `完成时间: ${new Date(workflow.finishedAt).toLocaleString('zh-CN')}` : ''}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; }
    .header h2 { margin: 0; font-size: 20px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; margin-top: 8px; font-weight: 500; }
    .progress-bar { background: rgba(255,255,255,0.2); border-radius: 10px; height: 8px; margin-top: 16px; overflow: hidden; }
    .progress-fill { background: white; height: 100%; border-radius: 10px; transition: width 0.3s ease; }
    .content { background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; }
    .info-row { display: flex; margin-bottom: 12px; }
    .label { font-weight: 600; color: #6b7280; width: 80px; flex-shrink: 0; }
    .value { color: #111827; }
    .step-info { background: ${status.bgColor}; padding: 12px; border-radius: 8px; margin-top: 16px; }
    .step-label { font-weight: 600; color: ${status.color}; font-size: 14px; }
    .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${status.emoji} ${workflow.name}</h2>
      <span class="status-badge" style="background: ${status.bgColor}; color: ${status.color};">${status.text}</span>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${workflow.currentStep && workflow.totalSteps ? (workflow.currentStep / workflow.totalSteps * 100) : 0}%"></div>
      </div>
    </div>
    <div class="content">
      <div class="info-row">
        <span class="label">进度:</span>
        <span class="value">${progress}</span>
      </div>
      ${workflow.startedAt ? `
      <div class="info-row">
        <span class="label">开始时间:</span>
        <span class="value">${new Date(workflow.startedAt).toLocaleString('zh-CN')}</span>
      </div>` : ''}
      ${workflow.finishedAt ? `
      <div class="info-row">
        <span class="label">完成时间:</span>
        <span class="value">${new Date(workflow.finishedAt).toLocaleString('zh-CN')}</span>
      </div>` : ''}
      ${step ? `
      <div class="step-info">
        <div class="step-label">当前步骤: ${step.name || '步骤 ' + step.index}</div>
      </div>` : ''}
    </div>
    <div class="footer">
      <p>Agent Orchestra - 智能任务编排系统</p>
    </div>
  </div>
</body>
</html>`;

    return { subject, text, html };
  };

  /**
   * 发送简单文本邮件（快捷方法）
   * @param {string} to - 收件人
   * @param {string} subject - 主题
   * @param {string} text - 正文
   * @returns {Promise<object>} 发送结果
   */
  plugin.sendText = async function(to, subject, text) {
    return await plugin.send({ to, subject, text });
  };

  /**
   * 发送 HTML 邮件（快捷方法）
   * @param {string} to - 收件人
   * @param {string} subject - 主题
   * @param {string} html - HTML 内容
   * @param {string} text - 纯文本备选内容
   * @returns {Promise<object>} 发送结果
   */
  plugin.sendHtml = async function(to, subject, html, text) {
    return await plugin.send({ to, subject, html, text });
  };
};
