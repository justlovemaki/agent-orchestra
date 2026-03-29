'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

class PluginUpdateWebSocket extends EventEmitter {
  constructor(options = {}) {
    super();
    this.server = options.server || null;
    this.path = options.path || '/api/plugins/updates/stream';
    this.clients = new Map();
    this.subscriptions = new Map();
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.heartbeatTimer = null;
    this.maxClients = options.maxClients || 100;
    this.messageQueue = new Map();
  }

  initialize(server) {
    this.server = server;
    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  setupWebSocketServer() {
    if (!this.server) {
      throw new Error('Server is required');
    }

    this.server.on('upgrade', (request, socket, head) => {
      const parsed = new URL(request.url, `http://${request.headers.host}`);
      
      if (parsed.pathname === this.path) {
        this.handleConnection(request, socket, head);
      } else {
        socket.destroy();
      }
    });

    console.log(`[PluginUpdateWebSocket] WebSocket server initialized at ${this.path}`);
  }

  handleConnection(request, socket, head) {
    if (this.clients.size >= this.maxClients) {
      socket.write('HTTP/1.1 503 Service Full\r\n\r\n');
      socket.destroy();
      return;
    }

    const clientId = crypto.randomUUID();
    const client = {
      id: clientId,
      socket,
      subscriptions: new Set(),
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      authenticated: false,
      userId: null
    };

    this.clients.set(clientId, client);

    socket.on('data', (buffer) => {
      this.handleMessage(clientId, buffer);
    });

    socket.on('close', () => {
      this.handleDisconnect(clientId);
    });

    socket.on('error', (error) => {
      console.error(`[PluginUpdateWebSocket] Client ${clientId} error:`, error.message);
      this.handleDisconnect(clientId);
    });

    socket.on('pong', () => {
      client.lastHeartbeat = Date.now();
    });

    this.sendRaw(clientId, {
      type: 'connected',
      clientId,
      timestamp: Date.now()
    });

    console.log(`[PluginUpdateWebSocket] Client connected: ${clientId}`);
    this.emit('clientConnected', { clientId, totalClients: this.clients.size });
  }

  handleMessage(clientId, buffer) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const message = buffer.toString('utf8');
      const lines = message.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          this.processMessage(clientId, data);
        } catch {}
      }
    } catch (error) {
      console.error(`[PluginUpdateWebSocket] Error handling message from ${clientId}:`, error.message);
    }
  }

  processMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (data.type) {
      case 'auth':
        this.handleAuth(clientId, data);
        break;
      case 'subscribe':
        this.handleSubscribe(clientId, data);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(clientId, data);
        break;
      case 'ping':
        this.sendRaw(clientId, { type: 'pong', timestamp: Date.now() });
        break;
      case 'getSubscriptions':
        this.sendRaw(clientId, {
          type: 'subscriptions',
          subscriptions: Array.from(client.subscriptions)
        });
        break;
      default:
        console.log(`[PluginUpdateWebSocket] Unknown message type: ${data.type}`);
    }
  }

  handleAuth(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.authenticated = true;
    client.userId = data.userId || null;

    this.sendRaw(clientId, {
      type: 'authResult',
      success: true,
      userId: client.userId
    });

    console.log(`[PluginUpdateWebSocket] Client ${clientId} authenticated as ${client.userId || 'anonymous'}`);
    this.emit('clientAuthenticated', { clientId, userId: client.userId });
  }

  handleSubscribe(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { pluginId, pluginName } = data;
    const subscriptionKey = pluginId || pluginName;

    if (!subscriptionKey) {
      this.sendRaw(clientId, {
        type: 'subscribeResult',
        success: false,
        error: 'pluginId or pluginName is required'
      });
      return;
    }

    client.subscriptions.add(subscriptionKey);

    if (!this.subscriptions.has(subscriptionKey)) {
      this.subscriptions.set(subscriptionKey, new Set());
    }
    this.subscriptions.get(subscriptionKey).add(clientId);

    this.sendRaw(clientId, {
      type: 'subscribeResult',
      success: true,
      subscription: subscriptionKey,
      subscriptions: Array.from(client.subscriptions)
    });

    console.log(`[PluginUpdateWebSocket] Client ${clientId} subscribed to ${subscriptionKey}`);
    this.emit('subscribed', { clientId, subscription: subscriptionKey });
  }

  handleUnsubscribe(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { pluginId, pluginName } = data;
    const subscriptionKey = pluginId || pluginName;

    if (!subscriptionKey) {
      this.sendRaw(clientId, {
        type: 'unsubscribeResult',
        success: false,
        error: 'pluginId or pluginName is required'
      });
      return;
    }

    client.subscriptions.delete(subscriptionKey);

    const subClients = this.subscriptions.get(subscriptionKey);
    if (subClients) {
      subClients.delete(clientId);
      if (subClients.size === 0) {
        this.subscriptions.delete(subscriptionKey);
      }
    }

    this.sendRaw(clientId, {
      type: 'unsubscribeResult',
      success: true,
      subscription: subscriptionKey,
      subscriptions: Array.from(client.subscriptions)
    });

    console.log(`[PluginUpdateWebSocket] Client ${clientId} unsubscribed from ${subscriptionKey}`);
    this.emit('unsubscribed', { clientId, subscription: subscriptionKey });
  }

  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const subscriptionKey of client.subscriptions) {
      const subClients = this.subscriptions.get(subscriptionKey);
      if (subClients) {
        subClients.delete(clientId);
        if (subClients.size === 0) {
          this.subscriptions.delete(subscriptionKey);
        }
      }
    }

    this.clients.delete(clientId);
    console.log(`[PluginUpdateWebSocket] Client disconnected: ${clientId}`);
    this.emit('clientDisconnected', { clientId, totalClients: this.clients.size });
  }

  sendRaw(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client || !client.socket || client.socket.destroyed) {
      return false;
    }

    try {
      const message = JSON.stringify(data) + '\n';
      client.socket.write(message);
      return true;
    } catch (error) {
      console.error(`[PluginUpdateWebSocket] Error sending to ${clientId}:`, error.message);
      return false;
    }
  }

  broadcastToAll(data) {
    const message = JSON.stringify({
      ...data,
      timestamp: Date.now()
    }) + '\n';

    for (const [clientId, client] of this.clients) {
      if (client.socket && !client.socket.destroyed) {
        try {
          client.socket.write(message);
        } catch (error) {
          console.error(`[PluginUpdateWebSocket] Error broadcasting to ${clientId}:`, error.message);
        }
      }
    }
  }

  broadcastToSubscribers(subscriptionKey, data) {
    const subClients = this.subscriptions.get(subscriptionKey);
    if (!subClients) return 0;

    const message = JSON.stringify({
      ...data,
      type: 'pluginUpdate',
      subscription: subscriptionKey,
      timestamp: Date.now()
    }) + '\n';

    let sentCount = 0;
    for (const clientId of subClients) {
      const client = this.clients.get(clientId);
      if (client && client.socket && !client.socket.destroyed) {
        try {
          client.socket.write(message);
          sentCount++;
        } catch (error) {
          console.error(`[PluginUpdateWebSocket] Error sending to ${clientId}:`, error.message);
        }
      }
    }

    return sentCount;
  }

  broadcastPluginUpdate(update) {
    const updateData = {
      type: 'pluginUpdate',
      pluginId: update.pluginId,
      pluginName: update.pluginName,
      currentVersion: update.currentVersion,
      latestVersion: update.latestVersion,
      updateType: update.updateType,
      downloadUrl: update.downloadUrl,
      description: update.description,
      author: update.author
    };

    const specificCount = this.broadcastToSubscribers(update.pluginName, updateData);
    this.broadcastToSubscribers(update.pluginId, updateData);

    if (specificCount > 0) {
      console.log(`[PluginUpdateWebSocket] Broadcast update for ${update.pluginName} to ${specificCount} subscribers`);
    }

    this.broadcastToAll({
      type: 'pluginUpdate',
      pluginId: update.pluginId,
      pluginName: update.pluginName,
      latestVersion: update.latestVersion,
      updateType: update.updateType
    });

    this.emit('pluginUpdateBroadcast', { update, subscribers: specificCount });
  }

  broadcastUpdatesBatch(updates) {
    for (const update of updates) {
      this.broadcastPluginUpdate(update);
    }

    this.broadcastToAll({
      type: 'batchUpdate',
      count: updates.length,
      updates: updates.map(u => ({
        pluginId: u.pluginId,
        pluginName: u.pluginName,
        latestVersion: u.latestVersion,
        updateType: u.updateType
      }))
    });
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      
      for (const [clientId, client] of this.clients) {
        if (client.socket && !client.socket.destroyed) {
          if (now - client.lastHeartbeat > this.heartbeatInterval * 2) {
            console.log(`[PluginUpdateWebSocket] Client ${clientId} heartbeat timeout`);
            client.socket.destroy();
            continue;
          }

          try {
            client.socket.write('{"type":"heartbeat","timestamp":' + now + '}\n');
          } catch {}
        }
      }
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  getClientCount() {
    return this.clients.size;
  }

  getSubscriptionCount(subscriptionKey) {
    const subClients = this.subscriptions.get(subscriptionKey);
    return subClients ? subClients.size : 0;
  }

  getAllSubscriptions() {
    const result = {};
    for (const [key, clients] of this.subscriptions) {
      result[key] = clients.size;
    }
    return result;
  }

  getClientInfo(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return null;

    return {
      id: client.id,
      connectedAt: client.connectedAt,
      lastHeartbeat: client.lastHeartbeat,
      authenticated: client.authenticated,
      userId: client.userId,
      subscriptions: Array.from(client.subscriptions)
    };
  }

  shutdown() {
    this.stopHeartbeat();

    for (const [clientId, client] of this.clients) {
      if (client.socket && !client.socket.destroyed) {
        try {
          client.socket.end();
        } catch {}
      }
    }

    this.clients.clear();
    this.subscriptions.clear();
    console.log('[PluginUpdateWebSocket] WebSocket server shutdown');
  }
}

module.exports = PluginUpdateWebSocket;
