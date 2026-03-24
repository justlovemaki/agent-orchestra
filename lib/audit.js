const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const AUDIT_EVENTS_FILE = path.join(DATA_DIR, 'audit-events.json');

const AUDIT_EVENT_TYPES = [
  'task.created',
  'task.completed',
  'task.failed',
  'task.cancelled',
  'task.retried',
  'task.paused',
  'task.resumed',
  'task.reassigned',
  'session.message_sent',
  'session.spawned',
  'workflow.executed',
  'agent.called',
  'user.registered',
  'user.logged_in',
  'user.logged_out',
  'user.role_changed',
  'user.group_changed',
  'user_group.created',
  'user_group.updated',
  'user_group.deleted',
  'user_group.member_added',
  'user_group.member_removed',
  'agent_combination.created',
  'agent_combination.updated',
  'agent_combination.deleted',
  'agent_combination.exported',
  'agent_combination.imported',
  'agent_combination.shared',
  'agent_combination.unshared',
  'agent_combination.favorited',
  'agent_combination.unfavorited',
  'recommendation_feedback.submitted',
  'backup.created',
  'backup.restored',
  'backup.auto_snapshot_created',
  'scheduled_backup.config_changed',
  'scheduled_backup.executed',
  'scheduled_backup.failed',
  'scheduled_backup.notified',
  'cloud_storage.config_changed',
  'cloud_backup.uploaded',
  'cloud_backup.downloaded',
  'cloud_backup.deleted',
  'cloud_backup.restored',
  'cloud_backup.cleanup',
  'cloud_backup.cleanup_failed',
  'workload_alert.triggered',
  'workload_alert.config_changed',
  'notification_channel.created',
  'notification_channel.updated',
  'notification_channel.deleted',
  'notification_channel.tested',
  'notification_channel.toggled',
  'notification_channel.priority_changed',
  'notification_channel.reordered',
  'notification_channel.sent_with_fallback',
  'notification.sent',
  'notification.failed',
  'notification.retry',
  'notification_template.updated',
  'notification_template.reset',
  'notification_template.reset_all',
  'task_completion.config_changed',
  'task_completion.notified',
  'workflow_completion.config_changed',
  'workflow_completion.notified',
  'combination.recommended_applied',
  'combination_recommendation.applied',
  'combination_recommendation.dismissed',
  'channel_health.checked',
  'channel_health.config_changed',
  'channel_health.channel_unhealthy',
  'channel_health.channel_recovered'
];

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(AUDIT_EVENTS_FILE);
  } catch {
    await fs.writeFile(AUDIT_EVENTS_FILE, '[]\n');
  }
}

async function loadAuditEvents() {
  await ensureData();
  const data = await fs.readFile(AUDIT_EVENTS_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveAuditEvents(events) {
  await ensureData();
  await fs.writeFile(AUDIT_EVENTS_FILE, JSON.stringify(events, null, 2) + '\n');
}

function createAuditEvent(type, details = {}, user = 'system', userId = null) {
  if (!AUDIT_EVENT_TYPES.includes(type)) {
    throw new Error(`Invalid audit event type: ${type}`);
  }

  return {
    id: crypto.randomUUID(),
    type,
    user,
    userId: userId || null,
    details,
    timestamp: Date.now()
  };
}

async function addAuditEvent(type, details = {}, user = 'system', userId = null) {
  const event = createAuditEvent(type, details, user, userId);
  const events = await loadAuditEvents();
  events.push(event);
  await saveAuditEvents(events);
  return event;
}

async function queryAuditEvents(filters = {}) {
  const events = await loadAuditEvents();
  
  let filtered = [...events];

  if (filters.eventType) {
    filtered = filtered.filter(e => e.type === filters.eventType);
  }

  if (filters.user) {
    filtered = filtered.filter(e => e.user.toLowerCase().includes(filters.user.toLowerCase()));
  }

  if (filters.timeFrom) {
    const from = typeof filters.timeFrom === 'string' ? new Date(filters.timeFrom).getTime() : filters.timeFrom;
    filtered = filtered.filter(e => e.timestamp >= from);
  }

  if (filters.timeTo) {
    const to = typeof filters.timeTo === 'string' ? new Date(filters.timeTo).getTime() : filters.timeTo;
    filtered = filtered.filter(e => e.timestamp <= to);
  }

  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase();
    filtered = filtered.filter(e => {
      const detailsStr = JSON.stringify(e.details).toLowerCase();
      return e.type.toLowerCase().includes(keyword) || 
             e.user.toLowerCase().includes(keyword) || 
             detailsStr.includes(keyword);
    });
  }

  filtered.sort((a, b) => b.timestamp - a.timestamp);

  if (filters.limit) {
    filtered = filtered.slice(0, filters.limit);
  }

  if (filters.offset) {
    filtered = filtered.slice(filters.offset);
  }

  return filtered;
}

function getAuditEventTypes() {
  return AUDIT_EVENT_TYPES;
}

module.exports = {
  addAuditEvent,
  queryAuditEvents,
  getAuditEventTypes,
  createAuditEvent,
  loadAuditEvents,
  saveAuditEvents,
  AUDIT_EVENT_TYPES
};
