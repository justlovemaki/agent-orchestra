/**
 * OpenClaw Integration Module
 * Provides deep integration between Agent Orchestra and OpenClaw
 * - Gateway API client
 * - WebSocket/SSE bidirectional communication
 * - Tool registration (Orchestra as OpenClaw tool)
 * - Configuration management
 */

const EventEmitter = require('events');
const https = require('https');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

class OpenClawIntegration extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      gatewayUrl: config.gatewayUrl || 'http://127.0.0.1:13000',
      token: config.token || '',
      reconnectInterval: config.reconnectInterval || 5000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      ...config
    };
    this.connected = false;
    this.connecting = false;
    this.ws = null;
    this.wsReconnectTimer = null;
    this.heartbeatTimer = null;
    this.eventSubscriptions = new Map();
    this.registeredTools = new Map();
    this.session = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  setConfig(config) {
    this.config = { ...this.config, ...config };
    return this;
  }

  getConfig() {
    return {
      gatewayUrl: this.config.gatewayUrl,
      token: this.config.token ? '***' + this.config.token.slice(-4) : '',
      reconnectInterval: this.config.reconnectInterval,
      heartbeatInterval: this.config.heartbeatInterval,
      connected: this.connected,
      connecting: this.connecting
    };
  }

  async connect() {
    if (this.connected || this.connecting) {
      return { success: false, message: 'Already connected or connecting' };
    }

    this.connecting = true;
    
    try {
      const testResult = await this.testConnection();
      if (!testResult.success) {
        this.connecting = false;
        return testResult;
      }

      this.connected = true;
      this.connecting = false;
      this.startHeartbeat();
      this.emit('connected', { gatewayUrl: this.config.gatewayUrl });
      
      return { success: true, message: 'Connected to OpenClaw Gateway' };
    } catch (error) {
      this.connecting = false;
      this.connected = false;
      return { success: false, message: error.message };
    }
  }

  disconnect() {
    this.stopHeartbeat();
    this.stopReconnect();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
    this.connecting = false;
    this.emit('disconnected', { reason: 'Manual disconnect' });
    
    return { success: true, message: 'Disconnected from OpenClaw Gateway' };
  }

  async testConnection() {
    try {
      const response = await this.apiRequest('/api/health');
      return { 
        success: true, 
        latency: response.latency,
        gateway: response.gateway,
        version: response.version
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async apiRequest(endpoint, method = 'GET', body = null, timeout = 30000) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(this.config.gatewayUrl + endpoint);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (this.config.token) {
        headers['Authorization'] = `Bearer ${this.config.token}`;
      }
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path,
        method: method,
        headers: headers,
        timeout: timeout
      };
      
      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const latency = Date.now() - startTime;
          
          try {
            const json = data ? JSON.parse(data) : {};
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ ...json, latency });
            } else {
              reject(new Error(json.error || json.message || `HTTP ${res.statusCode}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }

  async sessionsList(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.apiRequest(`/api/sessions${query ? '?' + query : ''}`);
  }

  async sessionsHistory(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.apiRequest(`/api/sessions/history${query ? '?' + query : ''}`);
  }

  async sessionsSend(sessionId, message) {
    return this.apiRequest(`/api/sessions/${sessionId}/send`, 'POST', { message });
  }

  async subagentsSpawn(agentId, prompt, options = {}) {
    return this.apiRequest('/api/subagents/spawn', 'POST', {
      agentId,
      prompt,
      ...options
    });
  }

  async subagentsList() {
    return this.apiRequest('/api/subagents');
  }

  async subagentsStatus(subagentId) {
    return this.apiRequest(`/api/subagents/${subagentId}`);
  }

  async subagentsStop(subagentId) {
    return this.apiRequest(`/api/subagents/${subagentId}/stop`, 'POST');
  }

  async agentsList() {
    return this.apiRequest('/api/agents');
  }

  async agentsInfo(agentId) {
    return this.apiRequest(`/api/agents/${agentId}`);
  }

  async gatewayStatus() {
    return this.apiRequest('/api/gateway/status');
  }

  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(async () => {
      if (!this.connected) return;
      
      try {
        await this.gatewayStatus();
        this.emit('heartbeat', { timestamp: Date.now() });
      } catch (error) {
        this.emit('heartbeat-error', { error: error.message });
      }
    }, this.config.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  startReconnect() {
    this.stopReconnect();
    
    this.wsReconnectTimer = setInterval(async () => {
      if (!this.connected && !this.connecting) {
        await this.connect();
      }
    }, this.config.reconnectInterval);
  }

  stopReconnect() {
    if (this.wsReconnectTimer) {
      clearInterval(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
  }

  subscribeToEvent(eventType, handler) {
    if (!this.eventSubscriptions.has(eventType)) {
      this.eventSubscriptions.set(eventType, new Set());
    }
    this.eventSubscriptions.get(eventType).add(handler);
    
    return {
      unsubscribe: () => {
        const handlers = this.eventSubscriptions.get(eventType);
        if (handlers) {
          handlers.delete(handler);
        }
      }
    };
  }

  handleEvent(event) {
    const { type, data } = event;
    
    this.emit(type, data);
    this.emit('*', event);
    
    const handlers = this.eventSubscriptions.get(type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.emit('event-handler-error', { eventType: type, error: error.message });
        }
      });
    }
    
    const wildcardHandlers = this.eventSubscriptions.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          this.emit('event-handler-error', { eventType: '*', error: error.message });
        }
      });
    }
  }

  registerTool(toolDef) {
    const { name, description, parameters, handler } = toolDef;
    
    if (!name) {
      throw new Error('Tool name is required');
    }
    
    this.registeredTools.set(name, {
      name,
      description: description || '',
      parameters: parameters || {},
      handler: handler || null,
      registeredAt: Date.now()
    });
    
    this.emit('tool.registered', { name, description });
    
    return { success: true, tool: { name, description } };
  }

  unregisterTool(name) {
    const tool = this.registeredTools.get(name);
    if (!tool) {
      return { success: false, message: 'Tool not found' };
    }
    
    this.registeredTools.delete(name);
    this.emit('tool.unregistered', { name });
    
    return { success: true, message: `Tool ${name} unregistered` };
  }

  listTools() {
    return Array.from(this.registeredTools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      registeredAt: tool.registeredAt
    }));
  }

  async executeTool(name, params = {}) {
    const tool = this.registeredTools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    
    if (!tool.handler) {
      throw new Error(`Tool ${name} has no handler`);
    }
    
    try {
      const result = await tool.handler(params);
      this.emit('tool.executed', { name, params, result });
      return result;
    } catch (error) {
      this.emit('tool.error', { name, params, error: error.message });
      throw error;
    }
  }

  getStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      gatewayUrl: this.config.gatewayUrl,
      toolsCount: this.registeredTools.size,
      subscriptionsCount: Array.from(this.eventSubscriptions.values()).reduce((sum, set) => sum + set.size, 0),
      uptime: this.session?.startedAt ? Date.now() - this.session.startedAt : 0
    };
  }

  getEventSubscriptions() {
    const subscriptions = [];
    this.eventSubscriptions.forEach((handlers, eventType) => {
      subscriptions.push({
        eventType,
        handlerCount: handlers.size
      });
    });
    return subscriptions;
  }
}

function createOpenClawIntegration(config) {
  return new OpenClawIntegration(config);
}

function loadOpenClawConfig(dataDir) {
  const configPath = path.join(dataDir, 'openclaw-config.json');
  
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[OpenClaw] Failed to load config:', error.message);
  }
  
  return {
    gatewayUrl: 'http://127.0.0.1:13000',
    token: '',
    eventSubscriptions: {
      'agent.spawned': true,
      'agent.completed': true,
      'session.created': true,
      'session.ended': true,
      'task.created': true,
      'task.completed': true
    },
    autoConnect: false
  };
}

function saveOpenClawConfig(dataDir, config) {
  const configPath = path.join(dataDir, 'openclaw-config.json');
  
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

module.exports = {
  OpenClawIntegration,
  createOpenClawIntegration,
  loadOpenClawConfig,
  saveOpenClawConfig
};
