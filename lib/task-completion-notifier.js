const notificationChannels = require('./notification-channels');
const notificationHistory = require('./notification-history');
const notificationTemplates = require('./notification-templates');
const audit = require('./audit');
const fs = require('fs').promises;
const path = require('path');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const AGENT_GROUPS_FILE = path.join(DATA_DIR, 'agent-groups.json');

async function loadAgentGroups() {
  try {
    const data = await fs.readFile(AGENT_GROUPS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function sendTaskCompletionNotification(task, run, status) {
  const config = require('./task-completion-config');
  const taskConfig = await config.getConfig();
  
  if (!taskConfig.enabled) {
    return { skipped: true, reason: 'Task completion notifications are disabled' };
  }
  
  if (status === 'completed' && !taskConfig.notifyOnComplete) {
    return { skipped: true, reason: 'Notifications for completed tasks are disabled' };
  }
  
  if (status === 'failed' && !taskConfig.notifyOnFailed) {
    return { skipped: true, reason: 'Notifications for failed tasks are disabled' };
  }
  
  if (!taskConfig.notifyChannels || taskConfig.notifyChannels.length === 0) {
    return { skipped: true, reason: 'No notification channels configured' };
  }
  
  if (taskConfig.priorityFilter && taskConfig.priorityFilter.enabled) {
    const allowedPriorities = taskConfig.priorityFilter.priorities || [];
    const taskPriority = task.priority || 'medium';
    if (!allowedPriorities.includes(taskPriority)) {
      return { skipped: true, reason: `Task priority '${taskPriority}' not in allowed priorities: [${allowedPriorities.join(', ')}]` };
    }
  }
  
  if (taskConfig.agentGroupFilter && taskConfig.agentGroupFilter.enabled) {
    const allowedGroups = taskConfig.agentGroupFilter.groups || [];
    if (allowedGroups.length > 0) {
      const agentGroups = await loadAgentGroups();
      const agentGroupNames = agentGroups
        .filter(g => g.agents && g.agents.includes(run.agentId))
        .map(g => g.name);
      const hasMatchingGroup = allowedGroups.some(allowed => agentGroupNames.includes(allowed));
      if (!hasMatchingGroup) {
        return { skipped: true, reason: `Agent '${run.agentId}' not in allowed groups: [${allowedGroups.join(', ')}]` };
      }
    }
  }
  
  const templateType = status === 'completed' ? 'task_completed' : 'task_failed';
  const templates = await notificationTemplates.getTemplates();
  const template = templates[templateType];
  
  if (!template) {
    throw new Error(`Template ${templateType} not found`);
  }
  
  const duration = run.finishedAt && run.startedAt 
    ? Math.round((run.finishedAt - run.startedAt) / 1000) 
    : 0;
  const durationStr = duration < 60 
    ? `${duration}秒` 
    : `${Math.round(duration / 60)}分钟`;
  
  const templateData = {
    time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    taskTitle: task.title || task.prompt?.slice(0, 50) || 'Untitled Task',
    agentName: run.agentId,
    duration: durationStr,
    error: run.error?.slice(0, 200) || 'Unknown error'
  };
  
  let message = template.template;
  for (const [key, value] of Object.entries(templateData)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  
  const results = [];
  
  if (taskConfig.notifyChannels && taskConfig.notifyChannels.length > 0) {
    const sortedChannels = await notificationChannels.getSortedChannels();
    const notifyType = taskConfig.notifyChannels[0];
    
    if (notifyType === 'fallback') {
      const fallbackResult = await notificationChannels.sendWithFallback(message);
      
      await notificationHistory.recordNotification({
        channelId: fallbackResult.channelId || null,
        channelName: fallbackResult.channelName || '',
        channelType: fallbackResult.channelType || '',
        message,
        status: fallbackResult.success ? 'sent' : 'failed',
        error: fallbackResult.error || null,
        relatedTaskId: task.id,
        relatedTaskStatus: status,
        attemptCount: fallbackResult.attemptCount,
        usedFallback: fallbackResult.usedFallback
      });
      
      if (fallbackResult.success) {
        await audit.addAuditEvent('notification_channel.sent_with_fallback', {
          taskId: task.id,
          taskTitle: task.title,
          taskStatus: status,
          agentId: run.agentId,
          channelId: fallbackResult.channelId,
          channelName: fallbackResult.channelName,
          channelType: fallbackResult.channelType,
          attemptCount: fallbackResult.attemptCount,
          usedFallback: fallbackResult.usedFallback
        }, 'system');
      }
      
      results.push({ 
        channelId: fallbackResult.channelId, 
        success: fallbackResult.success, 
        usedFallback: fallbackResult.usedFallback,
        attemptCount: fallbackResult.attemptCount,
        error: fallbackResult.error 
      });
    } else {
      for (const channelId of taskConfig.notifyChannels) {
        try {
          const result = await notificationChannels.sendToChannel(channelId, message);
          
          await notificationHistory.recordNotification({
            channelId: result.channelId,
            channelName: channelId,
            channelType: result.channelType,
            message,
            status: 'sent',
            relatedTaskId: task.id,
            relatedTaskStatus: status
          });
          
          await audit.addAuditEvent('task_completion.notified', {
            taskId: task.id,
            taskTitle: task.title,
            taskStatus: status,
            agentId: run.agentId,
            channelId: result.channelId,
            channelType: result.channelType
          }, 'system');
          
          results.push({ channelId, success: true });
        } catch (error) {
          await notificationHistory.recordNotification({
            channelId,
            channelName: channelId,
            channelType: 'unknown',
            message,
            status: 'failed',
            error: error.message,
            relatedTaskId: task.id,
            relatedTaskStatus: status
          });
          
          results.push({ channelId, success: false, error: error.message });
        }
      }
    }
  }
  
  return {
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}

module.exports = {
  sendTaskCompletionNotification
};
