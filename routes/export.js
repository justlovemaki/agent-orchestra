/**
 * Export & Share Routes
 * 
 * Handles dashboard snapshots, task reports, and sharing to external platforms.
 * Supports multiple export formats (JSON, HTML, PNG) and sharing to Feishu, DingTalk, WeCom, and Slack.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

/**
 * Register export and share routes
 * @param {Object} server - Server instance with helper methods
 * @param {Object} deps - Dependencies including data files and utility functions
 */
module.exports.register = (server, deps) => {
  const { json, readJson, readTasks, getTask, readLog, readRuntime, buildOverview } = deps;
  const { 
    generateSnapshotHtml, generateTaskReportHtml, generateFullDashboardHtml,
    generateLogSummary, formatTaskForUi
  } = deps;

  // Helper functions for integrations (will be called from server context)
  const getFeishuConfig = deps.getFeishuConfig || (() => null);
  const sendFeishuImageMessage = deps.sendFeishuImageMessage || (async () => ({ message_id: null }));
  const getDingTalkConfig = deps.getDingTalkConfig || (() => null);
  const saveDingTalkConfig = deps.saveDingTalkConfig || (async () => {});
  const sendDingTalkImageMessage = deps.sendDingTalkImageMessage || (async () => ({ messageId: null }));
  const getWecomConfig = deps.getWecomConfig || (() => null);
  const saveWecomConfig = deps.saveWecomConfig || (async () => {});
  const sendWecomImageMessage = deps.sendWecomImageMessage || (async () => ({ messageId: null }));
  const getSlackConfig = deps.getSlackConfig || (() => null);
  const saveSlackConfig = deps.saveSlackConfig || (async () => {});
  const sendSlackImageMessage = deps.sendSlackImageMessage || (async () => ({ messageId: null }));

  server.on('route', async ({ req, res, pathname, parsed }) => {
    // ===== Feishu Config =====
    if (req.method === 'GET' && pathname === '/api/feishu/config') {
      const config = getFeishuConfig();
      if (config) {
        return json(res, 200, { 
          configured: true, 
          appId: config.appId ? config.appId.slice(0, 4) + '****' : '',
          hasAppSecret: !!config.appSecret
        });
      }
      return json(res, 200, { configured: false });
    }
    if (req.method === 'POST' && pathname === '/api/feishu/config') {
      const body = await readJson(req);
      const { appId, appSecret } = body;
      if (!appId || !appSecret) {
        throw new Error('缺少 appId 或 appSecret 参数');
      }
      const DATA_DIR = deps.DATA_DIR || path.join(__dirname, 'data');
      const configPath = path.join(DATA_DIR, 'feishu-config.json');
      await fsp.writeFile(configPath, JSON.stringify({ appId, appSecret }, null, 2));
      return json(res, 200, { success: true, message: '飞书配置已保存' });
    }

    // ===== Export: Dashboard Snapshot =====
    if (req.method === 'GET' && pathname === '/api/export/snapshot') {
      const overview = await buildOverview(true);
      const exportData = {
        type: 'dashboard-snapshot',
        exportedAt: new Date().toISOString(),
        overview
      };
      const format = parsed.query.format || 'json';
      if (format === 'html') {
        const html = generateSnapshotHtml(exportData);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': 'attachment; filename="dashboard-snapshot.html"'
        });
        return res.end(html);
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="dashboard-snapshot.json"'
      });
      return res.end(JSON.stringify(exportData, null, 2));
    }

    // ===== Export: Task Report =====
    if (req.method === 'POST' && pathname === '/api/export/task-report') {
      const body = await readJson(req);
      const taskId = body.taskId;
      if (!taskId) throw new Error('缺少 taskId 参数');
      const task = await getTask(taskId);
      if (!task) throw new Error('任务不存在');
      const log = await readLog(taskId);
      const logSummary = generateLogSummary(log);
      const exportData = {
        type: 'task-report',
        exportedAt: new Date().toISOString(),
        task,
        logSummary
      };
      const format = body.format || 'json';
      if (format === 'html') {
        const html = generateTaskReportHtml(exportData);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': 'attachment; filename="task-report.html"'
        });
        return res.end(html);
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="task-report.json"'
      });
      return res.end(JSON.stringify(exportData, null, 2));
    }

    // ===== Export: Full Dashboard =====
    if (req.method === 'GET' && pathname === '/api/export/dashboard') {
      const overview = await buildOverview(true);
      const tasks = await readTasks();
      const runtime = await readRuntime();
      const exportData = {
        type: 'full-dashboard',
        exportedAt: new Date().toISOString(),
        overview,
        tasks: tasks.map(formatTaskForUi),
        runtime
      };
      const format = parsed.query.format || 'json';
      if (format === 'html') {
        const html = generateFullDashboardHtml(exportData);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': 'attachment; filename="full-dashboard.html"'
        });
        return res.end(html);
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="full-dashboard.json"'
      });
      return res.end(JSON.stringify(exportData, null, 2));
    }

    // ===== Export: Screenshot (HTML for PNG conversion) =====
    if (req.method === 'POST' && pathname === '/api/export/screenshot') {
      const body = await readJson(req);
      const { type, taskId, format } = body;
      
      if (!type || !['dashboard', 'task-report'].includes(type)) {
        throw new Error('无效的导出类型，请指定 dashboard 或 task-report');
      }
      
      if (format !== 'png') {
        throw new Error('仅支持 PNG 格式导出');
      }
      
      let htmlContent = '';
      let filename = '';
      
      if (type === 'dashboard') {
        const overview = await buildOverview(true);
        const exportData = {
          type: 'dashboard-snapshot',
          exportedAt: new Date().toISOString(),
          overview
        };
        htmlContent = generateSnapshotHtml(exportData);
        filename = 'dashboard-snapshot.png';
      } else if (type === 'task-report') {
        if (!taskId) {
          throw new Error('导出任务汇报需要提供 taskId 参数');
        }
        const task = await getTask(taskId);
        if (!task) throw new Error('任务不存在');
        const log = await readLog(taskId);
        const logSummary = generateLogSummary(log);
        const exportData = {
          type: 'task-report',
          exportedAt: new Date().toISOString(),
          task,
          logSummary
        };
        htmlContent = generateTaskReportHtml(exportData);
        filename = 'task-report.png';
      }
      
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename.replace('.png', '.html')}"`
      });
      return res.end(htmlContent);
    }

    // ===== Share: Feishu =====
    if (req.method === 'POST' && pathname === '/api/share/feishu') {
      const body = await readJson(req);
      const { type, taskId, channelId, imageBase64 } = body;

      if (!channelId) {
        throw new Error('缺少 channelId 参数');
      }

      if (!type || !['dashboard', 'task-report'].includes(type)) {
        throw new Error('无效的分享类型，请指定 dashboard 或 task-report');
      }

      if (!imageBase64) {
        throw new Error('缺少图片数据');
      }

      const feishuConfig = getFeishuConfig();
      if (!feishuConfig || !feishuConfig.appId || !feishuConfig.appSecret) {
        throw new Error('飞书配置未完成，请先配置飞书机器人');
      }

      let title = type === 'dashboard' ? '仪表板快照' : '任务汇报';
      if (type === 'task-report' && taskId) {
        const task = await getTask(taskId);
        if (task) title = `任务汇报 - ${task.name || task.id}`;
      }

      const result = await sendFeishuImageMessage(feishuConfig, channelId, imageBase64, title);
      return json(res, 200, { success: true, message: '分享成功', messageId: result.message_id });
    }

    // ===== Share: DingTalk =====
    if (req.method === 'GET' && pathname === '/api/dingtalk/config') {
      const config = getDingTalkConfig();
      if (config) {
        return json(res, 200, { 
          configured: true, 
          appKey: config.appKey ? config.appKey.slice(0, 4) + '****' : '',
          hasAppSecret: !!config.appSecret,
          hasWebhook: !!config.webhook
        });
      }
      return json(res, 200, { configured: false });
    }
    if (req.method === 'POST' && pathname === '/api/dingtalk/config') {
      const body = await readJson(req);
      const { appKey, appSecret, webhook } = body;
      if (!appKey || !appSecret || !webhook) {
        throw new Error('缺少 appKey、appSecret 或 webhook 参数');
      }
      await saveDingTalkConfig({ appKey, appSecret, webhook });
      return json(res, 200, { success: true, message: '钉钉配置已保存' });
    }
    if (req.method === 'POST' && pathname === '/api/share/dingtalk') {
      const body = await readJson(req);
      const { type, taskId, webhook, imageBase64 } = body;

      if (!webhook) {
        throw new Error('缺少 webhook 参数');
      }

      if (!type || !['dashboard', 'task-report'].includes(type)) {
        throw new Error('无效的分享类型，请指定 dashboard 或 task-report');
      }

      if (!imageBase64) {
        throw new Error('缺少图片数据');
      }

      let title = type === 'dashboard' ? '仪表板快照' : '任务汇报';
      if (type === 'task-report' && taskId) {
        const task = await getTask(taskId);
        if (task) title = `任务汇报 - ${task.name || task.id}`;
      }

      const result = await sendDingTalkImageMessage(webhook, imageBase64, title);
      return json(res, 200, { success: true, message: '分享成功', messageId: result.messageId });
    }

    // ===== Share: WeCom =====
    if (req.method === 'GET' && pathname === '/api/wecom/config') {
      const config = getWecomConfig();
      if (config) {
        return json(res, 200, {
          configured: true,
          corpId: config.corpId ? config.corpId.slice(0, 4) + '****' : '',
          hasAgentId: !!config.agentId,
          hasSecret: !!config.secret,
          hasWebhook: !!config.webhook
        });
      }
      return json(res, 200, { configured: false });
    }
    if (req.method === 'POST' && pathname === '/api/wecom/config') {
      const body = await readJson(req);
      const { corpId, agentId, secret, webhook } = body;
      if (!corpId || !agentId || !secret || !webhook) {
        throw new Error('缺少 corpId、agentId、secret 或 webhook 参数');
      }
      await saveWecomConfig({ corpId, agentId, secret, webhook });
      return json(res, 200, { success: true, message: '企业微信配置已保存' });
    }
    if (req.method === 'POST' && pathname === '/api/share/wecom') {
      const body = await readJson(req);
      const { type, taskId, webhook, imageBase64 } = body;

      if (!webhook) {
        throw new Error('缺少 webhook 参数');
      }

      if (!type || !['dashboard', 'task-report'].includes(type)) {
        throw new Error('无效的分享类型，请指定 dashboard 或 task-report');
      }

      if (!imageBase64) {
        throw new Error('缺少图片数据');
      }

      let title = type === 'dashboard' ? 'Agent Orchestra 仪表板快照' : '任务汇报';
      if (type === 'task-report' && taskId) {
        const task = await getTask(taskId);
        if (task) title = `任务汇报 - ${task.title || task.id}`;
      }

      const result = await sendWecomImageMessage(webhook, imageBase64, title);
      return json(res, 200, { success: true, message: '分享成功', messageId: result.messageId });
    }

    // ===== Share: Slack =====
    if (req.method === 'GET' && pathname === '/api/slack/config') {
      const config = getSlackConfig();
      if (config) {
        return json(res, 200, { 
          configured: true, 
          botToken: config.botToken ? config.botToken.slice(0, 8) + '****' : ''
        });
      }
      return json(res, 200, { configured: false });
    }
    if (req.method === 'POST' && pathname === '/api/slack/config') {
      const body = await readJson(req);
      const { botToken } = body;
      if (!botToken) {
        throw new Error('缺少 botToken 参数');
      }
      await saveSlackConfig({ botToken });
      return json(res, 200, { success: true, message: 'Slack 配置已保存' });
    }
    if (req.method === 'POST' && pathname === '/api/share/slack') {
      const body = await readJson(req);
      const { type, taskId, channelId, imageBase64 } = body;

      if (!channelId) {
        throw new Error('缺少 channelId 参数');
      }

      if (!type || !['dashboard', 'task-report'].includes(type)) {
        throw new Error('无效的分享类型，请指定 dashboard 或 task-report');
      }

      if (!imageBase64) {
        throw new Error('缺少图片数据');
      }

      const slackConfig = getSlackConfig();
      if (!slackConfig || !slackConfig.botToken) {
        throw new Error('Slack 配置未完成，请先配置 Slack Bot Token');
      }

      let title = type === 'dashboard' ? 'Agent Orchestra 仪表板快照' : '任务汇报';
      if (type === 'task-report' && taskId) {
        const task = await getTask(taskId);
        if (task) title = `任务汇报 - ${task.title || task.id}`;
      }

      const result = await sendSlackImageMessage(slackConfig, channelId, imageBase64, title);
      return json(res, 200, { success: true, message: '分享成功', messageId: result.messageId });
    }
  });
};
