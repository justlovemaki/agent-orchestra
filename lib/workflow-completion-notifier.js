const notificationChannels = require('./notification-channels');
const notificationHistory = require('./notification-history');
const notificationTemplates = require('./notification-templates');
const audit = require('./audit');

async function sendWorkflowCompletionNotification(workflowRun) {
  const workflowCompletionConfig = require('./workflow-completion-config');
  const config = await workflowCompletionConfig.getConfig();
  
  if (!config.enabled) {
    return { skipped: true, reason: 'Workflow completion notifications are disabled' };
  }
  
  const status = workflowRun.status;
  
  if (status === 'completed' && !config.notifyOnComplete) {
    return { skipped: true, reason: 'Notifications for completed workflows are disabled' };
  }
  
  if (status === 'failed' && !config.notifyOnFailed) {
    return { skipped: true, reason: 'Notifications for failed workflows are disabled' };
  }
  
  if (!config.notifyChannels || config.notifyChannels.length === 0) {
    return { skipped: true, reason: 'No notification channels configured' };
  }
  
  const templateType = status === 'completed' ? 'workflow_completed' : 'workflow_failed';
  const templates = await notificationTemplates.getTemplates();
  const template = templates[templateType];
  
  if (!template) {
    throw new Error(`Template ${templateType} not found`);
  }
  
  const duration = workflowRun.finishedAt && workflowRun.startedAt 
    ? Math.round((workflowRun.finishedAt - workflowRun.startedAt) / 1000) 
    : 0;
  const durationStr = duration < 60 
    ? `${duration}秒` 
    : `${Math.round(duration / 60)}分钟`;
  
  const stepSummary = workflowRun.steps 
    ? workflowRun.steps.map((s, i) => `${i + 1}. ${s.agentId}: ${s.status}`).join('\n')
    : 'N/A';
  
  const templateData = {
    time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    workflowName: workflowRun.workflowName || 'Unnamed Workflow',
    runId: workflowRun.id?.slice(0, 8) || 'N/A',
    status: status === 'completed' ? '完成' : '失败',
    duration: durationStr,
    stepCount: workflowRun.steps?.length || 0,
    stepSummary: stepSummary,
    error: workflowRun.error?.slice(0, 300) || 'Unknown error'
  };
  
  let message = template.template;
  for (const [key, value] of Object.entries(templateData)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  
  const results = [];
  for (const channelId of config.notifyChannels) {
    try {
      const result = await notificationChannels.sendToChannel(channelId, message);
      
      await notificationHistory.recordNotification({
        channelId: result.channelId,
        channelName: channelId,
        channelType: result.channelType,
        message,
        status: 'sent',
        relatedWorkflowId: workflowRun.workflowId,
        relatedWorkflowRunId: workflowRun.id,
        relatedWorkflowStatus: status
      });
      
      await audit.addAuditEvent('workflow_completion.notified', {
        workflowId: workflowRun.workflowId,
        workflowName: workflowRun.workflowName,
        workflowRunId: workflowRun.id,
        workflowStatus: status,
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
        relatedWorkflowId: workflowRun.workflowId,
        relatedWorkflowRunId: workflowRun.id,
        relatedWorkflowStatus: status
      });
      
      results.push({ channelId, success: false, error: error.message });
    }
  }
  
  return {
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}

module.exports = {
  sendWorkflowCompletionNotification
};