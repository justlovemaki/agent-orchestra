/**
 * Plugin Updates Realtime Component
 * Handles WebSocket connection for real-time plugin update notifications
 */

class PluginUpdatesRealtime {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || this.getWebSocketUrl();
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 3000;
    this.heartbeatTimeout = options.heartbeatTimeout || 60000;
    this.heartbeatTimer = null;
    this.listeners = new Map();
    this.subscriptions = new Set();
    this.authenticated = false;
    this.clientId = null;
    this.connected = false;
    this.messageQueue = [];
  }

  getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/api/plugins/updates/stream`;
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.wsUrl);

        this.socket.onopen = () => {
          console.log('[PluginUpdatesRealtime] Connected to WebSocket');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
          this.emit('connected', { clientId: this.clientId });
          resolve();
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onclose = (event) => {
          console.log('[PluginUpdatesRealtime] WebSocket closed:', event.code, event.reason);
          this.connected = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code: event.code, reason: event.reason });
          this.attemptReconnect();
        };

        this.socket.onerror = (error) => {
          console.error('[PluginUpdatesRealtime] WebSocket error:', error);
          this.emit('error', { error });
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
    this.connected = false;
  }

  handleMessage(data) {
    try {
      const lines = data.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          this.processMessage(message);
        } catch {}
      }
    } catch (error) {
      console.error('[PluginUpdatesRealtime] Error handling message:', error);
    }
  }

  processMessage(message) {
    switch (message.type) {
      case 'connected':
        this.clientId = message.clientId;
        console.log('[PluginUpdatesRealtime] Assigned client ID:', this.clientId);
        this.emit('registered', { clientId: this.clientId });
        break;

      case 'authResult':
        this.authenticated = message.success;
        this.emit('authenticated', { success: message.success, userId: message.userId });
        break;

      case 'subscribeResult':
        if (message.success) {
          this.subscriptions.add(message.subscription);
        }
        this.emit('subscribed', { 
          success: message.success, 
          subscription: message.subscription,
          allSubscriptions: message.subscriptions
        });
        break;

      case 'unsubscribeResult':
        if (message.success) {
          this.subscriptions.delete(message.subscription);
        }
        this.emit('unsubscribed', { 
          success: message.success, 
          subscription: message.subscription,
          allSubscriptions: message.subscriptions
        });
        break;

      case 'subscriptions':
        this.subscriptions = new Set(message.subscriptions);
        this.emit('subscriptionsUpdated', { subscriptions: message.subscriptions });
        break;

      case 'pluginUpdate':
        this.emit('pluginUpdate', { 
          pluginId: message.pluginId,
          pluginName: message.pluginName,
          currentVersion: message.currentVersion,
          latestVersion: message.latestVersion,
          updateType: message.updateType,
          downloadUrl: message.downloadUrl,
          description: message.description,
          author: message.author,
          timestamp: message.timestamp
        });
        break;

      case 'batchUpdate':
        this.emit('batchUpdate', {
          count: message.count,
          updates: message.updates,
          timestamp: message.timestamp
        });
        break;

      case 'heartbeat':
        this.emit('heartbeat', { timestamp: message.timestamp });
        break;

      case 'pong':
        break;

      default:
        console.log('[PluginUpdatesRealtime] Unknown message type:', message.type);
    }
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data) + '\n');
    } else {
      this.messageQueue.push(data);
    }
  }

  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const data = this.messageQueue.shift();
      this.send(data);
    }
  }

  authenticate(userId) {
    this.send({
      type: 'auth',
      userId: userId
    });
  }

  subscribe(pluginIdOrName) {
    const subscriptionKey = typeof pluginIdOrName === 'object' 
      ? (pluginIdOrName.pluginId || pluginIdOrName.pluginName)
      : pluginIdOrName;
    
    this.send({
      type: 'subscribe',
      pluginId: subscriptionKey,
      pluginName: subscriptionKey
    });
  }

  unsubscribe(pluginIdOrName) {
    const subscriptionKey = typeof pluginIdOrName === 'object' 
      ? (pluginIdOrName.pluginId || pluginIdOrName.pluginName)
      : pluginIdOrName;
    
    this.send({
      type: 'unsubscribe',
      pluginId: subscriptionKey,
      pluginName: subscriptionKey
    });
  }

  subscribeToAll() {
    this.send({
      type: 'subscribe',
      pluginId: '*',
      pluginName: '*'
    });
  }

  getSubscriptions() {
    this.send({
      type: 'getSubscriptions'
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[PluginUpdatesRealtime] Max reconnection attempts reached');
      this.emit('reconnectFailed', { attempts: this.reconnectAttempts });
      return;
    }

    this.reconnectAttempts++;
    console.log(`[PluginUpdatesRealtime] Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect().catch(() => {});
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, this.heartbeatTimeout);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data);
        } catch (error) {
          console.error(`[PluginUpdatesRealtime] Error in ${event} listener:`, error);
        }
      }
    }
  }

  getSubscriptions() {
    return Array.from(this.subscriptions);
  }

  isConnected() {
    return this.connected;
  }

  isAuthenticated() {
    return this.authenticated;
  }
}

class PluginUpdateNotificationUI {
  constructor(options = {}) {
    this.realtime = options.realtime || new PluginUpdatesRealtime(options);
    this.notifications = [];
    this.maxNotifications = options.maxNotifications || 50;
    this.autoSubscribe = options.autoSubscribe !== false;
    this.container = null;
    this.toastContainer = null;
  }

  initialize(containerSelector = '#pluginUpdateNotifications') {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      this.createNotificationContainer();
    }
    this.createToastContainer();
    this.setupEventListeners();
    
    if (this.autoSubscribe) {
      this.realtime.connect().catch(err => {
        console.error('[PluginUpdateNotificationUI] Failed to connect:', err);
      });
    }
  }

  createNotificationContainer() {
    this.container = document.createElement('div');
    this.container.id = 'pluginUpdateNotifications';
    this.container.className = 'plugin-update-notifications';
    this.container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    document.body.appendChild(this.container);
  }

  createToastContainer() {
    this.toastContainer = document.getElementById('pluginUpdatesToast');
    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.id = 'pluginUpdatesToast';
      this.toastContainer.className = 'plugin-updates-toast-container';
      this.toastContainer.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 9999;';
      document.body.appendChild(this.toastContainer);
    }
  }

  setupEventListeners() {
    this.realtime.on('connected', (data) => {
      console.log('[PluginUpdateNotificationUI] Connected:', data);
    });

    this.realtime.on('pluginUpdate', (data) => {
      this.handlePluginUpdate(data);
    });

    this.realtime.on('batchUpdate', (data) => {
      this.handleBatchUpdate(data);
    });

    this.realtime.on('disconnected', (data) => {
      console.log('[PluginUpdateNotificationUI] Disconnected:', data);
    });

    this.realtime.on('error', (data) => {
      console.error('[PluginUpdateNotificationUI] Error:', data);
    });
  }

  handlePluginUpdate(update) {
    const notification = {
      id: `update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'pluginUpdate',
      pluginId: update.pluginId,
      pluginName: update.pluginName,
      currentVersion: update.currentVersion,
      latestVersion: update.latestVersion,
      updateType: update.updateType,
      downloadUrl: update.downloadUrl,
      description: update.description,
      author: update.author,
      timestamp: update.timestamp || Date.now(),
      read: false
    };

    this.addNotification(notification);
    this.showToast(notification);
  }

  handleBatchUpdate(data) {
    for (const update of data.updates) {
      this.handlePluginUpdate({
        ...update,
        timestamp: data.timestamp
      });
    }
  }

  addNotification(notification) {
    this.notifications.unshift(notification);
    
    if (this.notifications.length > this.maxNotifications) {
      this.notifications.pop();
    }

    this.emit('notificationAdded', notification);
  }

  showToast(notification) {
    const toast = document.createElement('div');
    toast.className = 'plugin-update-toast';
    toast.style.cssText = `
      background: white;
      border-left: 4px solid ${this.getUpdateTypeColor(notification.updateType)};
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 300px;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;

    const typeLabel = {
      major: '重大更新',
      minor: '功能更新',
      patch: '修复更新'
    };

    toast.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
        <div style="font-weight: 600; color: #1a1a1a; font-size: 14px;">
          🔄 ${this.escapeHtml(notification.pluginName)}
        </div>
        <button class="toast-close" style="background: none; border: none; cursor: pointer; font-size: 18px; color: #999; padding: 0; line-height: 1;">&times;</button>
      </div>
      <div style="font-size: 13px; color: #666; margin-bottom: 8px;">
        ${notification.currentVersion || '?'} → <strong>${notification.latestVersion}</strong>
        <span style="background: ${this.getUpdateTypeColor(notification.updateType)}20; color: ${this.getUpdateTypeColor(notification.updateType)}; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">
          ${typeLabel[notification.updateType] || notification.updateType}
        </span>
      </div>
      ${notification.description ? `<div style="font-size: 12px; color: #999; margin-bottom: 8px;">${this.escapeHtml(notification.description.substring(0, 100))}${notification.description.length > 100 ? '...' : ''}</div>` : ''}
      <div style="display: flex; gap: 8px;">
        ${notification.downloadUrl ? `<a href="${this.escapeHtml(notification.downloadUrl)}" target="_blank" class="toast-action" style="background: #4a90d9; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 12px;">查看详情</a>` : ''}
        <button class="toast-dismiss" style="background: #f5f5f5; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">知道了</button>
      </div>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    const dismissBtn = toast.querySelector('.toast-dismiss');

    const removeToast = () => {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    };

    closeBtn.addEventListener('click', removeToast);
    dismissBtn.addEventListener('click', removeToast);

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        removeToast();
      }
    }, 10000);
  }

  getUpdateTypeColor(updateType) {
    const colors = {
      major: '#ef4444',
      minor: '#f59e0b',
      patch: '#22c55e'
    };
    return colors[updateType] || '#4a90d9';
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  getNotifications(options = {}) {
    let filtered = this.notifications;

    if (options.unreadOnly) {
      filtered = filtered.filter(n => !n.read);
    }

    if (options.pluginName) {
      filtered = filtered.filter(n => n.pluginName === options.pluginName);
    }

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.emit('notificationRead', notification);
    }
  }

  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    this.emit('allNotificationsRead');
  }

  clearNotifications() {
    this.notifications = [];
    this.emit('notificationsCleared');
  }

  on(event, callback) {
    return this.realtime.on(event, callback);
  }

  off(event, callback) {
    return this.realtime.off(event, callback);
  }

  emit(event, data) {
    if (this.listeners && this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        callback(data);
      }
    }
  }

  subscribe(pluginIdOrName) {
    this.realtime.subscribe(pluginIdOrName);
  }

  unsubscribe(pluginIdOrName) {
    this.realtime.unsubscribe(pluginIdOrName);
  }

  connect() {
    return this.realtime.connect();
  }

  disconnect() {
    return this.realtime.disconnect();
  }
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes slideOut {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
  
  .plugin-update-toast:hover {
    box-shadow: 0 6px 16px rgba(0,0,0,0.2);
  }
  
  .toast-action:hover {
    opacity: 0.9;
  }
  
  .toast-dismiss:hover {
    background: #e8e8e8 !important;
  }
`;
document.head.appendChild(style);

if (typeof window !== 'undefined') {
  window.PluginUpdatesRealtime = PluginUpdatesRealtime;
  window.PluginUpdateNotificationUI = PluginUpdateNotificationUI;
}

export { PluginUpdatesRealtime, PluginUpdateNotificationUI };
