const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const NOTIFICATION_HISTORY_FILE = path.join(DATA_DIR, 'notification-history.json');

const NOTIFICATION_STATUS = ['sent', 'failed'];

const NOTIFICATION_TYPE_PATTERNS = [
  { type: 'scheduled_backup_success', patterns: ['定时备份成功通知', '定时备份成功', '📦 定时备份成功通知'] },
  { type: 'scheduled_backup_failed', patterns: ['定时备份失败通知', '定时备份失败', '📦 定时备份失败通知'] },
  { type: 'backup_success', patterns: ['定时备份通知', '📦 Agent Orchestra 定时备份通知', '备份成功'] },
  { type: 'backup_failed', patterns: ['备份失败', '❌ Agent Orchestra 定时备份通知'] },
  { type: 'workload_warning', patterns: ['负载预警', '负载警告'] },
  { type: 'workload_critical', patterns: ['负载告警', 'Agent 负载告警'] },
  { type: 'task_completed', patterns: ['✅ 任务完成通知', '任务完成通知'] },
  { type: 'task_failed', patterns: ['❌ 任务失败通知', '任务失败通知'] },
  { type: 'workflow_completed', patterns: ['✅ 工作流完成通知', '工作流完成通知'] },
  { type: 'workflow_failed', patterns: ['❌ 工作流失败通知', '工作流失败通知'] }
];

const NOTIFICATION_TYPE_NAMES = {
  'scheduled_backup_success': '定时备份完成',
  'scheduled_backup_failed': '定时备份失败',
  'backup_success': '备份完成',
  'backup_failed': '备份失败',
  'workload_warning': '负载预警',
  'workload_critical': '负载告警',
  'task_completed': '任务完成',
  'task_failed': '任务失败',
  'workflow_completed': '工作流完成',
  'workflow_failed': '工作流失败',
  'unknown': '未知类型'
};

function parseNotificationType(message) {
  if (!message) return 'unknown';
  
  for (const { type, patterns } of NOTIFICATION_TYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (message.includes(pattern)) {
        return type;
      }
    }
  }
  
  return 'unknown';
}

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(NOTIFICATION_HISTORY_FILE);
  } catch {
    await fs.writeFile(NOTIFICATION_HISTORY_FILE, '[]\n');
  }
}

async function loadHistory() {
  await ensureData();
  const data = await fs.readFile(NOTIFICATION_HISTORY_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveHistory(history) {
  await ensureData();
  await fs.writeFile(NOTIFICATION_HISTORY_FILE, JSON.stringify(history, null, 2) + '\n');
}

async function recordNotification(data) {
  const history = await loadHistory();
  const notification = {
    id: crypto.randomUUID(),
    channelId: data.channelId || null,
    channelName: data.channelName || '',
    channelType: data.channelType || '',
    message: (data.message || '').substring(0, 1000),
    status: data.status || 'sent',
    error: data.error || null,
    createdAt: data.createdAt || Date.now(),
    retryCount: data.retryCount || 0
  };
  history.unshift(notification);
  await saveHistory(history);
  return notification;
}

async function getHistory(filters = {}) {
  let history = await loadHistory();

  if (filters.status) {
    history = history.filter(n => n.status === filters.status);
  }

  if (filters.channelType) {
    history = history.filter(n => n.channelType === filters.channelType);
  }

  if (filters.channelId) {
    history = history.filter(n => n.channelId === filters.channelId);
  }

  if (filters.timeFrom) {
    const from = typeof filters.timeFrom === 'string' ? new Date(filters.timeFrom).getTime() : filters.timeFrom;
    history = history.filter(n => n.createdAt >= from);
  }

  if (filters.timeTo) {
    const to = typeof filters.timeTo === 'string' ? new Date(filters.timeTo).getTime() : filters.timeTo;
    history = history.filter(n => n.createdAt <= to);
  }

  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase();
    history = history.filter(n =>
      n.message.toLowerCase().includes(keyword) ||
      n.channelName.toLowerCase().includes(keyword)
    );
  }

  history.sort((a, b) => b.createdAt - a.createdAt);

  const total = history.length;
  const page = Math.max(1, parseInt(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(filters.pageSize) || 20));
  const offset = (page - 1) * pageSize;

  const items = history.slice(offset, offset + pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}

async function getFailedNotifications() {
  const history = await loadHistory();
  return history.filter(n => n.status === 'failed');
}

async function getNotification(id) {
  const history = await loadHistory();
  return history.find(n => n.id === id) || null;
}

async function updateNotification(id, updates) {
  const history = await loadHistory();
  const idx = history.findIndex(n => n.id === id);
  if (idx === -1) {
    throw new Error('通知记录不存在');
  }
  history[idx] = { ...history[idx], ...updates };
  await saveHistory(history);
  return history[idx];
}

async function retryNotification(id) {
  const notification = await getNotification(id);
  if (!notification) {
    throw new Error('通知记录不存在');
  }
  if (notification.status !== 'failed') {
    throw new Error('只能重试失败的通知');
  }

  await updateNotification(id, {
    status: 'pending',
    retryCount: notification.retryCount + 1
  });

  return await getNotification(id);
}

async function getStatistics() {
  const history = await loadHistory();

  const total = history.length;
  const sent = history.filter(n => n.status === 'sent').length;
  const failed = history.filter(n => n.status === 'failed').length;

  const channelTypeStats = {};
  const channels = {};

  for (const n of history) {
    if (!channels[n.channelType]) {
      channels[n.channelType] = { total: 0, sent: 0, failed: 0 };
    }
    channels[n.channelType].total++;
    if (n.status === 'sent') {
      channels[n.channelType].sent++;
    } else if (n.status === 'failed') {
      channels[n.channelType].failed++;
    }
  }

  for (const [type, stats] of Object.entries(channels)) {
    channelTypeStats[type] = {
      ...stats,
      successRate: stats.total > 0 ? parseFloat(((stats.sent / stats.total) * 100).toFixed(1)) : 0
    };
  }

  const successRate = total > 0 ? parseFloat(((sent / total) * 100).toFixed(1)) : 0;

  const now = Date.now();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const todayTotal = history.filter(n => n.createdAt >= dayStart.getTime()).length;
  const todaySent = history.filter(n => n.createdAt >= dayStart.getTime() && n.status === 'sent').length;
  const todayFailed = history.filter(n => n.createdAt >= dayStart.getTime() && n.status === 'failed').length;

  const typeStats = {};
  const typeNames = {};

  for (const n of history) {
    const notificationType = n.notificationType || parseNotificationType(n.message);
    if (!typeStats[notificationType]) {
      typeStats[notificationType] = { total: 0, sent: 0, failed: 0 };
    }
    typeStats[notificationType].total++;
    if (n.status === 'sent') {
      typeStats[notificationType].sent++;
    } else if (n.status === 'failed') {
      typeStats[notificationType].failed++;
    }
  }

  const byNotificationType = Object.entries(typeStats).map(([type, stats]) => ({
    type,
    name: NOTIFICATION_TYPE_NAMES[type] || type,
    ...stats,
    successRate: stats.total > 0 ? parseFloat(((stats.sent / stats.total) * 100).toFixed(1)) : 0
  }));

  const totalTypeCount = byNotificationType.reduce((sum, t) => sum + t.total, 0);
  for (const t of byNotificationType) {
    t.percentage = totalTypeCount > 0 ? parseFloat(((t.total / totalTypeCount) * 100).toFixed(1)) : 0;
  }

  return {
    total,
    sent,
    failed,
    successRate,
    today: {
      total: todayTotal,
      sent: todaySent,
      failed: todayFailed
    },
    byChannelType: channelTypeStats,
    byNotificationType
  };
}

async function getTrends(days = 7) {
  const history = await loadHistory();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const trendsMap = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    trendsMap.set(d.toISOString().split('T')[0], { sent: 0, failed: 0, total: 0, byChannelType: {} });
  }
  
  const cutoffTime = new Date(now);
  cutoffTime.setDate(cutoffTime.getDate() - days);
  
  const channelTypeStats = {};
  
  for (const n of history) {
    if (n.createdAt < cutoffTime.getTime()) continue;
    
    const dateKey = new Date(n.createdAt).toISOString().split('T')[0];
    if (!trendsMap.has(dateKey)) continue;
    
    const trend = trendsMap.get(dateKey);
    trend.total++;
    if (n.status === 'sent') {
      trend.sent++;
    } else if (n.status === 'failed') {
      trend.failed++;
    }
    
    const channelType = n.channelType || 'unknown';
    if (!trend.byChannelType[channelType]) {
      trend.byChannelType[channelType] = { sent: 0, failed: 0, total: 0 };
    }
    trend.byChannelType[channelType].total++;
    if (n.status === 'sent') {
      trend.byChannelType[channelType].sent++;
    } else if (n.status === 'failed') {
      trend.byChannelType[channelType].failed++;
    }
    
    if (!channelTypeStats[channelType]) {
      channelTypeStats[channelType] = { sent: 0, failed: 0, total: 0 };
    }
    channelTypeStats[channelType].total++;
    if (n.status === 'sent') {
      channelTypeStats[channelType].sent++;
    } else if (n.status === 'failed') {
      channelTypeStats[channelType].failed++;
    }
  }
  
  const trends = Array.from(trendsMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .reverse();
  
  const channelTypeDistribution = Object.entries(channelTypeStats).map(([type, stats]) => ({
    channelType: type,
    ...stats,
    successRate: stats.total > 0 ? parseFloat(((stats.sent / stats.total) * 100).toFixed(1)) : 0
  }));
  
  return {
    trends,
    days,
    byChannelType: channelTypeDistribution
  };
}

module.exports = {
  recordNotification,
  getHistory,
  getFailedNotifications,
  getNotification,
  updateNotification,
  retryNotification,
  getStatistics,
  getTrends,
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPE_PATTERNS,
  NOTIFICATION_TYPE_NAMES,
  parseNotificationType
};
