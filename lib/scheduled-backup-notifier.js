const notificationChannels = require('./notification-channels');
const notificationHistory = require('./notification-history');
const notificationTemplates = require('./notification-templates');
const audit = require('./audit');

async function sendScheduledBackupNotification(backupResult) {
  const scheduledBackupNotifyConfig = require('./scheduled-backup-config');
  const config = await scheduledBackupNotifyConfig.getConfig();
  
  if (!config.enabled) {
    return { skipped: true, reason: 'Scheduled backup notifications are disabled' };
  }
  
  const status = backupResult.success ? 'success' : 'failed';
  
  if (status === 'success' && !config.notifyOnComplete) {
    return { skipped: true, reason: 'Notifications for completed scheduled backups are disabled' };
  }
  
  if (status === 'failed' && !config.notifyOnFailed) {
    return { skipped: true, reason: 'Notifications for failed scheduled backups are disabled' };
  }
  
  if (!config.notifyChannels || config.notifyChannels.length === 0) {
    return { skipped: true, reason: 'No notification channels configured' };
  }
  
  const templateType = status === 'success' ? 'scheduled_backup_success' : 'scheduled_backup_failed';
  const templates = await notificationTemplates.getTemplates();
  const template = templates[templateType];
  
  if (!template) {
    throw new Error(`Template ${templateType} not found`);
  }
  
  const duration = backupResult.duration 
    ? Math.round(backupResult.duration / 1000) 
    : 0;
  const durationStr = duration < 60 
    ? `${duration}秒` 
    : `${Math.round(duration / 60)}分钟`;
  
  const fileSizeStr = backupResult.fileSize 
    ? formatFileSize(backupResult.fileSize) 
    : 'N/A';
  
  const templateData = {
    time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    backupType: backupResult.type || 'full',
    status: status === 'success' ? '成功' : '失败',
    fileName: backupResult.fileName || 'N/A',
    fileSize: fileSizeStr,
    duration: durationStr,
    error: backupResult.error?.slice(0, 300) || ''
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
        relatedBackupId: backupResult.id,
        relatedBackupStatus: status,
        relatedBackupType: 'scheduled'
      });
      
      await audit.addAuditEvent('scheduled_backup.notified', {
        backupId: backupResult.id,
        backupStatus: status,
        backupType: backupResult.type,
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
        relatedBackupId: backupResult.id,
        relatedBackupStatus: status,
        relatedBackupType: 'scheduled'
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

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

module.exports = {
  sendScheduledBackupNotification
};
