/**
 * Workload Alerts - Agent 负载告警模块
 * 
 * 功能：
 * - 监控 Agent 任务负载
 * - 根据阈值发送预警/告警通知
 * - 支持静默期配置，避免告警风暴
 * - 审计日志记录
 */

const path = require('path');
const fsp = require('fs/promises');
const { readTasks } = require('./runtime-utils');
const { listAgents } = require('./agents');
const notificationChannels = require('./notification-channels');
const notificationHistory = require('./notification-history');
const { addAuditEvent } = require('./audit');

const DATA_DIR = path.join(__dirname, '..', 'data');
const WORKLOAD_ALERTS_CONFIG_FILE = path.join(DATA_DIR, 'workload-alerts-config.json');
const WORKLOAD_ALERTS_STATE_FILE = path.join(DATA_DIR, 'workload-alerts-state.json');

let workloadAlertTimer = null;
let nextWorkloadCheckTime = null;

const DEFAULT_WORKLOAD_CONFIG = {
  enabled: false,
  threshold: 5,
  warningThreshold: 0.8,
  criticalThreshold: 1.0,
  notifyChannels: [],
  messageTemplate: {
    warning: '🚨 [{level}] Agent 负载预警\n━━━━━━━━━━━━━━━━━━━━\n⏰ 时间：{time}\n📊 阈值：{threshold}\n⚠️ 级别：{level}\n⚠️ Agent: {agentName}\n📈 负载：{workload} 个任务 ({percentage}%)\n━━━━━━━━━━━━━━━━━━━━',
    critical: '🚨 [{level}] Agent 负载告警\n━━━━━━━━━━━━━━━━━━━━\n⏰ 时间：{time}\n📊 阈值：{threshold}\n🔴 级别：{level}\n🔴 Agent: {agentName}\n📈 负载：{workload} 个任务 ({percentage}%)\n━━━━━━━━━━━━━━━━━━━━'
  },
  silencePeriodMinutes: 30
};

async function ensureData() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function getWorkloadAlertsState() {
  await ensureData();
  try {
    const data = await fsp.readFile(WORKLOAD_ALERTS_STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveWorkloadAlertsState(state) {
  await ensureData();
  await fsp.writeFile(WORKLOAD_ALERTS_STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

async function shouldSendAlert(agentId, level, silencePeriodMinutes) {
  const state = await getWorkloadAlertsState();
  const key = `${agentId}:${level}`;
  const lastAlert = state[key];
  
  if (!lastAlert) {
    return true;
  }
  
  const silenceMs = silencePeriodMinutes * 60 * 1000;
  const elapsed = Date.now() - lastAlert;
  
  return elapsed >= silenceMs;
}

async function recordAlertSent(agentId, level) {
  const state = await getWorkloadAlertsState();
  const key = `${agentId}:${level}`;
  state[key] = Date.now();
  await saveWorkloadAlertsState(state);
}

async function getWorkloadAlertsConfig() {
  await ensureData();
  try {
    const data = await fsp.readFile(WORKLOAD_ALERTS_CONFIG_FILE, 'utf8');
    const config = JSON.parse(data);
    return {
      ...DEFAULT_WORKLOAD_CONFIG,
      ...config
    };
  } catch {
    return { ...DEFAULT_WORKLOAD_CONFIG };
  }
}

async function saveWorkloadAlertsConfig(updates) {
  await ensureData();
  const current = await getWorkloadAlertsConfig();
  const config = {
    ...current,
    ...updates
  };
  await fsp.writeFile(WORKLOAD_ALERTS_CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
  return config;
}

async function getAgentWorkload() {
  const tasks = await readTasks();
  const agentWorkloadMap = new Map();
  
  for (const task of tasks) {
    if (task.status !== 'running' && task.status !== 'queued') continue;
    const runs = task.runs || [];
    for (const run of runs) {
      if (!run.agentId) continue;
      if (run.status !== 'running' && run.status !== 'queued') continue;
      const current = agentWorkloadMap.get(run.agentId) || { agentId: run.agentId, workloadCount: 0 };
      current.workloadCount += 1;
      agentWorkloadMap.set(run.agentId, current);
    }
  }
  
  return Array.from(agentWorkloadMap.values());
}

function renderMessageTemplate(template, data) {
  return template
    .replace(/{agentName}/g, data.agentName)
    .replace(/{workload}/g, data.workload)
    .replace(/{threshold}/g, data.threshold)
    .replace(/{level}/g, data.level)
    .replace(/{time}/g, data.time)
    .replace(/{percentage}/g, data.percentage);
}

async function sendWorkloadAlertNotification(agents, threshold, level = 'warning') {
  const config = await getWorkloadAlertsConfig();
  const timeText = new Date().toLocaleString('zh-CN');
  
  const template = config.messageTemplate?.[level] || config.messageTemplate?.warning || 
    `🚨 [{level}] Agent 负载预警\nAgent: {agentName}\n负载：{workload} 个任务 ({percentage}%)\n阈值：{threshold}`;
  
  const messages = [];
  for (const agent of agents) {
    const percentage = Math.round((agent.workloadCount / threshold) * 100);
    const message = renderMessageTemplate(template, {
      agentName: agent.agentName,
      workload: agent.workloadCount,
      threshold: threshold,
      level: level === 'critical' ? '严重' : '警告',
      time: timeText,
      percentage: percentage
    });
    messages.push(message);
  }
  
  const combinedMessage = messages.join('\n\n');
  
  const results = { sent: [], failed: [], level, agentCount: agents.length };
  const channelsList = await notificationChannels.getChannels();
  
  for (const channelId of config.notifyChannels) {
    const channel = channelsList.find(c => c.id === channelId || c.type === channelId);
    try {
      await notificationChannels.sendToChannel(channelId, combinedMessage);
      await notificationHistory.recordNotification({
        channelId: channel?.id || channelId,
        channelName: channel?.name || channelId,
        channelType: channel?.type || 'unknown',
        message: combinedMessage,
        status: 'sent'
      });
      await addAuditEvent('notification.sent', {
        channelId: channel?.id,
        channelName: channel?.name,
        channelType: channel?.type,
        source: 'workload_alert',
        level
      }, 'system');
      results.sent.push(channelId);
    } catch (err) {
      console.error(`[WorkloadAlert] 发送通知到渠道 ${channelId} 失败:`, err.message);
      await notificationHistory.recordNotification({
        channelId: channel?.id || channelId,
        channelName: channel?.name || channelId,
        channelType: channel?.type || 'unknown',
        message: combinedMessage,
        status: 'failed',
        error: err.message
      });
      await addAuditEvent('notification.failed', {
        channelId: channel?.id,
        channelName: channel?.name,
        channelType: channel?.type,
        source: 'workload_alert',
        level,
        error: err.message
      }, 'system');
      results.failed.push({ channel: channelId, error: err.message });
    }
  }
  
  return results;
}

async function performWorkloadCheck() {
  const config = await getWorkloadAlertsConfig();
  const agentWorkloads = await getAgentWorkload();
  const agentsList = await listAgents();
  const agentNameMap = new Map(agentsList.map(a => [a.id, a.identity || a.id]));
  
  for (const workload of agentWorkloads) {
    workload.agentName = agentNameMap.get(workload.agentId) || workload.agentId;
  }
  
  const warningThresholdValue = config.threshold * (config.warningThreshold || 0.8);
  const criticalThresholdValue = config.threshold * (config.criticalThreshold || 1.0);
  const silencePeriod = config.silencePeriodMinutes || 30;
  
  const warningAgents = agentWorkloads.filter(a => a.workloadCount >= warningThresholdValue && a.workloadCount < criticalThresholdValue);
  const criticalAgents = agentWorkloads.filter(a => a.workloadCount >= criticalThresholdValue);
  const triggeredAt = Date.now();
  
  for (const agent of agentWorkloads) {
    agent.warningLevel = 'normal';
    if (agent.workloadCount >= criticalThresholdValue) {
      agent.warningLevel = 'critical';
    } else if (agent.workloadCount >= warningThresholdValue) {
      agent.warningLevel = 'warning';
    }
    agent.percentage = Math.round((agent.workloadCount / config.threshold) * 100);
  }
  
  const result = {
    checkedAt: triggeredAt,
    threshold: config.threshold,
    warningThreshold: warningThresholdValue,
    criticalThreshold: criticalThresholdValue,
    totalAgents: agentWorkloads.length,
    warningAgents,
    criticalAgents,
    notified: false,
    notifications: []
  };
  
  if (config.enabled && config.notifyChannels.length > 0) {
    const sentAlerts = [];
    
    for (const agent of [...criticalAgents, ...warningAgents]) {
      const level = agent.warningLevel;
      const shouldSend = await shouldSendAlert(agent.agentId, level, silencePeriod);
      
      if (shouldSend) {
        const notifyResult = await sendWorkloadAlertNotification([agent], config.threshold, level);
        await recordAlertSent(agent.agentId, level);
        
        sentAlerts.push({
          agentId: agent.agentId,
          agentName: agent.agentName,
          level,
          workloadCount: agent.workloadCount,
          notifyResult
        });
        
        result.notifications.push(notifyResult);
        result.notified = true;
      }
    }
    
    if (sentAlerts.length > 0) {
      await addAuditEvent('workload_alert.triggered', {
        agents: sentAlerts.map(a => ({
          agentId: a.agentId,
          agentName: a.agentName,
          workloadCount: a.workloadCount,
          level: a.level
        })),
        threshold: config.threshold,
        warningThreshold: warningThresholdValue,
        criticalThreshold: criticalThresholdValue,
        notifyChannels: config.notifyChannels,
        notified: sentAlerts.some(a => a.notifyResult.sent.length > 0),
        notifyResults: sentAlerts.map(a => a.notifyResult),
        silencePeriodMinutes: silencePeriod
      }, 'system');
    }
  }
  
  return result;
}

function startWorkloadAlertScheduler() {
  if (workloadAlertTimer) {
    clearTimeout(workloadAlertTimer);
    workloadAlertTimer = null;
  }
  
  scheduleNextWorkloadCheck();
}

function scheduleNextWorkloadCheck() {
  const INTERVAL_MS = 5 * 60 * 1000;
  nextWorkloadCheckTime = Date.now() + INTERVAL_MS;
  
  workloadAlertTimer = setTimeout(async () => {
    const config = await getWorkloadAlertsConfig();
    if (config.enabled) {
      try {
        await performWorkloadCheck();
      } catch (err) {
        console.error('[WorkloadAlert] 自动检查失败:', err.message);
      }
    }
    scheduleNextWorkloadCheck();
  }, INTERVAL_MS);
}

function getWorkloadAlertStatus() {
  return {
    nextCheckTime: nextWorkloadCheckTime,
    isRunning: workloadAlertTimer !== null
  };
}

function setNotificationFunction(notifyFn) {
  // 兼容性占位，实际已内联实现
}

module.exports = {
  getWorkloadAlertsConfig,
  saveWorkloadAlertsConfig,
  getAgentWorkload,
  performWorkloadCheck,
  startWorkloadAlertScheduler,
  getWorkloadAlertStatus,
  sendWorkloadAlertNotification,
  setNotificationFunction
};
