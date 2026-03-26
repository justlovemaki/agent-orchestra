/**
 * Notifications component - Notification channel management UI
 */

import { state } from '../../state.js';
import { fetchJson, loadNotificationChannels, createNotificationChannel, updateNotificationChannel, deleteNotificationChannel } from '../../api.js';
import { escapeHtml, formatDate, show, hide } from '../../utils/dom.js';

export function getNotificationElements() {
  return {
    notificationChannelPanel: document.getElementById('notificationChannelPanel'),
    showChannelFormBtn: document.getElementById('showChannelFormBtn'),
    channelForm: document.getElementById('channelForm'),
    channelNameInput: document.getElementById('channelNameInput'),
    channelTypeInput: document.getElementById('channelTypeInput'),
    channelWebhookInput: document.getElementById('channelWebhookInput'),
    channelPriorityInput: document.getElementById('channelPriorityInput'),
    saveChannelBtn: document.getElementById('saveChannelBtn'),
    cancelChannelBtn: document.getElementById('cancelChannelBtn'),
    channelListEl: document.getElementById('channelList'),
    channelTabs: document.querySelectorAll('.channel-tab'),
    historyTabContent: document.getElementById('historyTabContent'),
    notificationStatsEl: document.getElementById('notificationStats'),
    notificationHistoryListEl: document.getElementById('notificationHistoryList'),
    historyPaginationEl: document.getElementById('historyPagination'),
    historyStatusFilter: document.getElementById('historyStatusFilter'),
    historyChannelTypeFilter: document.getElementById('historyChannelTypeFilter'),
    historyTimeFrom: document.getElementById('historyTimeFrom'),
    historyTimeTo: document.getElementById('historyTimeTo'),
    applyHistoryFilterBtn: document.getElementById('applyHistoryFilterBtn'),
    clearHistoryFilterBtn: document.getElementById('clearHistoryFilterBtn')
  };
}

export function showChannelForm(channel = null) {
  const { channelForm, channelNameInput, channelTypeInput, channelWebhookInput, channelPriorityInput } = getNotificationElements();
  if (!channelForm) return;
  
  show(channelForm);
  
  if (channel) {
    state.editingChannelId = channel.id;
    if (channelNameInput) channelNameInput.value = channel.name;
    if (channelTypeInput) channelTypeInput.value = channel.type;
    if (channelWebhookInput) channelWebhookInput.value = channel.webhook || '';
    if (channelPriorityInput) channelPriorityInput.value = channel.priority || 5;
  } else {
    state.editingChannelId = null;
    if (channelNameInput) channelNameInput.value = '';
    if (channelTypeInput) channelTypeInput.value = '';
    if (channelWebhookInput) channelWebhookInput.value = '';
    if (channelPriorityInput) channelPriorityInput.value = 5;
  }
  
  if (channelNameInput) channelNameInput.focus();
}

export function hideChannelForm() {
  const { channelForm } = getNotificationElements();
  if (channelForm) hide(channelForm);
  state.editingChannelId = null;
}

export async function saveChannel() {
  const { channelNameInput, channelTypeInput, channelWebhookInput, channelPriorityInput } = getNotificationElements();
  
  const name = channelNameInput?.value.trim();
  if (!name) {
    alert('请输入渠道名称');
    return;
  }
  
  const payload = {
    name,
    type: channelTypeInput?.value || 'feishu',
    webhook: channelWebhookInput?.value || '',
    priority: parseInt(channelPriorityInput?.value || '5', 10)
  };
  
  try {
    if (state.editingChannelId) {
      await updateNotificationChannel(state.editingChannelId, payload);
      const idx = state.notificationChannels.findIndex(c => c.id === state.editingChannelId);
      if (idx !== -1) {
        state.notificationChannels[idx] = { ...state.notificationChannels[idx], ...payload };
      }
    } else {
      const res = await createNotificationChannel(payload);
      state.notificationChannels.push({ id: res.id, ...payload });
    }
    
    hideChannelForm();
    renderChannels();
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
}

export function renderChannels() {
  const { channelListEl } = getNotificationElements();
  if (!channelListEl) return;
  
  const channels = state.notificationChannels || [];
  
  if (channels.length === 0) {
    channelListEl.innerHTML = '<div class="muted small">暂无通知渠道</div>';
    return;
  }
  
  const typeLabels = {
    feishu: '飞书',
    dingtalk: '钉钉',
    wecom: '企业微信',
    slack: 'Slack'
  };
  
  channelListEl.innerHTML = channels.map(ch => `
    <div class="channel-item" data-channel-id="${ch.id}">
      <div class="channel-item-info">
        <div class="channel-item-name">${escapeHtml(ch.name)}</div>
        <div class="channel-item-meta muted small">
          <span class="channel-type-badge">${typeLabels[ch.type] || ch.type}</span>
          <span>优先级: ${ch.priority}</span>
        </div>
      </div>
      <div class="channel-item-actions">
        <button class="ghost tiny edit-channel-btn" data-channel-id="${ch.id}">编辑</button>
        <button class="danger tiny delete-channel-btn" data-channel-id="${ch.id}">删除</button>
      </div>
    </div>
  `).join('');
  
  channelListEl.querySelectorAll('.edit-channel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const channel = channels.find(c => c.id === btn.dataset.channelId);
      if (channel) showChannelForm(channel);
    });
  });
  
  channelListEl.querySelectorAll('.delete-channel-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const channelId = btn.dataset.channelId;
      const channel = channels.find(c => c.id === channelId);
      if (!confirm(`确定要删除渠道 "${channel.name}" 吗？`)) return;
      
      try {
        await deleteNotificationChannel(channelId);
        state.notificationChannels = state.notificationChannels.filter(c => c.id !== channelId);
        renderChannels();
      } catch (err) {
        alert('删除失败: ' + err.message);
      }
    });
  });
}

export function switchChannelTab(tabName) {
  const { channelTabs } = getNotificationElements();
  state.currentChannelTab = tabName;
  
  if (channelTabs) {
    channelTabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }
  
  const tabContentIds = {
    channels: 'channelTabContent',
    templates: 'templatesTabContent',
    history: 'historyTabContent',
    stats: 'statsTabContent',
    workflow: 'workflowNotificationTab',
    scheduledbackup: 'scheduledBackupNotificationTab',
    taskcompletion: 'taskCompletionNotificationTab'
  };
  
  Object.entries(tabContentIds).forEach(([tab, contentId]) => {
    const content = document.getElementById(contentId);
    if (content) {
      if (tab === tabName) {
        show(content);
      } else {
        hide(content);
      }
    }
  });
}

export function renderNotificationHistory() {
  const { notificationHistoryListEl } = getNotificationElements();
  if (!notificationHistoryListEl) return;
  
  const history = state.notificationHistory || [];
  
  if (history.length === 0) {
    notificationHistoryListEl.innerHTML = '<div class="muted small">暂无发送历史</div>';
    return;
  }
  
  const statusLabels = { sent: '成功', failed: '失败' };
  const typeLabels = { feishu: '飞书', dingtalk: '钉钉', wecom: '企业微信', slack: 'Slack' };
  
  notificationHistoryListEl.innerHTML = history.map(item => `
    <div class="notification-history-item">
      <div class="notification-history-info">
        <span class="notification-history-channel">${escapeHtml(item.channelName || item.channelType)}</span>
        <span class="notification-history-status ${item.status}">${statusLabels[item.status] || item.status}</span>
      </div>
      <div class="notification-history-meta muted small">
        <span>${typeLabels[item.channelType] || item.channelType}</span>
        <span>${formatDate(item.sentAt)}</span>
      </div>
      ${item.error ? `<div class="notification-history-error muted small">${escapeHtml(item.error)}</div>` : ''}
    </div>
  `).join('');
}

export function renderNotificationStats() {
  const { notificationStatsEl } = getNotificationElements();
  if (!notificationStatsEl) return;
  
  const stats = state.notificationHistoryStats;
  if (!stats) {
    notificationStatsEl.innerHTML = '<div class="muted small">加载中...</div>';
    return;
  }
  
  const total = stats.totalCount || 0;
  const success = stats.successCount || 0;
  const failed = stats.failedCount || 0;
  const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : 0;
  
  notificationStatsEl.innerHTML = `
    <div class="notification-stats-grid">
      <div class="notification-stat-card">
        <div class="notification-stat-value">${total}</div>
        <div class="notification-stat-label">总发送量</div>
      </div>
      <div class="notification-stat-card success">
        <div class="notification-stat-value">${success}</div>
        <div class="notification-stat-label">成功</div>
      </div>
      <div class="notification-stat-card danger">
        <div class="notification-stat-value">${failed}</div>
        <div class="notification-stat-label">失败</div>
      </div>
      <div class="notification-stat-card">
        <div class="notification-stat-value">${successRate}%</div>
        <div class="notification-stat-label">成功率</div>
      </div>
    </div>
  `;
}

export function initNotificationComponent() {
  const els = getNotificationElements();
  
  if (els.showChannelFormBtn) {
    els.showChannelFormBtn.addEventListener('click', () => showChannelForm());
  }
  
  if (els.cancelChannelBtn) {
    els.cancelChannelBtn.addEventListener('click', () => hideChannelForm());
  }
  
  if (els.saveChannelBtn) {
    els.saveChannelBtn.addEventListener('click', () => saveChannel());
  }
  
  if (els.channelTabs) {
    els.channelTabs.forEach(tab => {
      tab.addEventListener('click', () => switchChannelTab(tab.dataset.tab));
    });
  }
  
  return {
    showChannelForm,
    hideChannelForm,
    renderChannels,
    switchChannelTab,
    renderNotificationHistory,
    renderNotificationStats
  };
}