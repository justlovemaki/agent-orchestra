'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');

const SYSTEM_EVENTS = {
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_COMPLETED: 'workflow.completed',
  AGENT_STATUS_CHANGED: 'agent.status_changed',
  SESSION_MESSAGE_SENT: 'session.message_sent',
  NOTIFICATION_SENT: 'notification.sent'
};

const VALID_EVENTS = Object.values(SYSTEM_EVENTS);

class PluginEventSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    this.setMaxListeners(options.maxListeners || 100);
    this.eventLog = [];
    this.maxLogSize = options.maxLogSize || 1000;
    this.pluginListeners = new Map();
    this.logEnabled = options.logEnabled !== false;
  }

  registerPlugin(plugin, handler) {
    if (!plugin || !plugin.manifest) {
      throw new Error('Invalid plugin: manifest is required');
    }

    const eventTypes = plugin.manifest.eventTypes || [];
    const pluginName = plugin.name || plugin.manifest.name;

    if (!handler || typeof handler !== 'function') {
      if (!plugin.onEvent) {
        throw new Error(`Plugin ${pluginName} must implement onEvent handler or provide one`);
      }
      handler = plugin.onEvent.bind(plugin);
    }

    const listener = this._createPluginListener(pluginName, handler);
    this.pluginListeners.set(pluginName, { plugin, handler: listener, eventTypes });

    for (const eventType of eventTypes) {
      if (!VALID_EVENTS.includes(eventType)) {
        console.warn(`[PluginEventSystem] Plugin ${pluginName} registered for unknown event type: ${eventType}`);
      }
      this.on(eventType, listener);
    }

    console.log(`[PluginEventSystem] Registered plugin ${pluginName} for events: ${eventTypes.join(', ') || 'all'}`);
    return this;
  }

  unregisterPlugin(pluginName) {
    const registration = this.pluginListeners.get(pluginName);
    if (!registration) {
      console.warn(`[PluginEventSystem] Plugin ${pluginName} not registered`);
      return false;
    }

    const { handler, eventTypes } = registration;
    for (const eventType of eventTypes) {
      this.removeListener(eventType, handler);
    }
    this.pluginListeners.delete(pluginName);

    console.log(`[PluginEventSystem] Unregistered plugin ${pluginName}`);
    return true;
  }

  _createPluginListener(pluginName, handler) {
    return async (eventType, payload) => {
      const eventId = crypto.randomUUID();
      const startTime = Date.now();

      this._log({
        eventId,
        eventType,
        pluginName,
        timestamp: startTime,
        phase: 'start'
      });

      try {
        const result = await handler(eventType, payload);

        this._log({
          eventId,
          eventType,
          pluginName,
          timestamp: Date.now(),
          phase: 'complete',
          duration: Date.now() - startTime,
          success: true
        });

        return result;
      } catch (error) {
        this._log({
          eventId,
          eventType,
          pluginName,
          timestamp: Date.now(),
          phase: 'error',
          duration: Date.now() - startTime,
          success: false,
          error: error.message
        });

        console.error(`[PluginEventSystem] Plugin ${pluginName} event handler error:`, error.message);
      }
    };
  }

  async emitAsync(eventType, payload) {
    if (!VALID_EVENTS.includes(eventType)) {
      console.warn(`[PluginEventSystem] Emitting unknown event type: ${eventType}`);
    }

    const eventId = crypto.randomUUID();
    const startTime = Date.now();

    this._log({
      eventId,
      eventType,
      timestamp: startTime,
      phase: 'emit',
      payload: this._sanitizePayload(payload)
    });

    const listeners = this.listeners(eventType);
    if (listeners.length === 0) {
      this._log({
        eventId,
        eventType,
        timestamp: Date.now(),
        phase: 'complete',
        duration: Date.now() - startTime,
        handlersCount: 0
      });
      return { handled: false, handlersCount: 0 };
    }

    const results = await Promise.allSettled(
      listeners.map(listener => {
        try {
          return listener(eventType, payload);
        } catch (error) {
          console.error(`[PluginEventSystem] Event handler error:`, error.message);
          return Promise.resolve(null);
        }
      })
    );

    const handled = results.some(r => r.status === 'fulfilled');
    const errors = results.filter(r => r.status === 'rejected').length;

    this._log({
      eventId,
      eventType,
      timestamp: Date.now(),
      phase: 'complete',
      duration: Date.now() - startTime,
      handlersCount: listeners.length,
      handled,
      errors
    });

    return { handled, handlersCount: listeners.length, errors };
  }

  emit(eventType, payload) {
    if (!VALID_EVENTS.includes(eventType)) {
      console.warn(`[PluginEventSystem] Emitting unknown event type: ${eventType}`);
    }

    const eventId = crypto.randomUUID();
    const startTime = Date.now();

    this._log({
      eventId,
      eventType,
      timestamp: startTime,
      phase: 'emit',
      payload: this._sanitizePayload(payload)
    });

    try {
      super.emit(eventType, payload);

      this._log({
        eventId,
        eventType,
        timestamp: Date.now(),
        phase: 'complete',
        duration: Date.now() - startTime,
        handlersCount: this.listenerCount(eventType)
      });

      return { handled: true, handlersCount: this.listenerCount(eventType) };
    } catch (error) {
      this._log({
        eventId,
        eventType,
        timestamp: Date.now(),
        phase: 'error',
        duration: Date.now() - startTime,
        error: error.message
      });
      throw error;
    }
  }

  _sanitizePayload(payload) {
    if (!payload) return payload;
    const sanitized = {};
    for (const [key, value] of Object.entries(payload)) {
      if (key.toLowerCase().includes('password') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this._sanitizePayload(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  _log(entry) {
    if (!this.logEnabled) return;

    this.eventLog.push(entry);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize);
    }
  }

  getEventLog(options = {}) {
    const { eventType, pluginName, limit = 100 } = options;

    let logs = [...this.eventLog];

    if (eventType) {
      logs = logs.filter(l => l.eventType === eventType);
    }
    if (pluginName) {
      logs = logs.filter(l => l.pluginName === pluginName);
    }

    return logs.slice(-limit);
  }

  clearEventLog() {
    this.eventLog = [];
  }

  getRegisteredPlugins() {
    const plugins = [];
    for (const [name, registration] of this.pluginListeners.entries()) {
      plugins.push({
        name,
        eventTypes: registration.eventTypes
      });
    }
    return plugins;
  }

  getListenerCount(eventType) {
    return this.listenerCount(eventType);
  }

  getTotalListenerCount() {
    let count = 0;
    for (const eventType of VALID_EVENTS) {
      count += this.listenerCount(eventType);
    }
    return count;
  }

  hasPlugin(pluginName) {
    return this.pluginListeners.has(pluginName);
  }

  isEventValid(eventType) {
    return VALID_EVENTS.includes(eventType);
  }

  getValidEvents() {
    return [...VALID_EVENTS];
  }

  removeAllPluginListeners() {
    for (const [pluginName] of this.pluginListeners) {
      this.unregisterPlugin(pluginName);
    }
  }
}

let globalEventSystem = null;

function createEventSystem(options) {
  return new PluginEventSystem(options);
}

function getEventSystem() {
  if (!globalEventSystem) {
    globalEventSystem = new PluginEventSystem();
  }
  return globalEventSystem;
}

function setGlobalEventSystem(eventSystem) {
  globalEventSystem = eventSystem;
}

function emitTaskCreated(task) {
  return getEventSystem().emitAsync(SYSTEM_EVENTS.TASK_CREATED, task);
}

function emitTaskCompleted(task) {
  return getEventSystem().emitAsync(SYSTEM_EVENTS.TASK_COMPLETED, task);
}

function emitTaskFailed(task) {
  return getEventSystem().emitAsync(SYSTEM_EVENTS.TASK_FAILED, task);
}

function emitWorkflowStarted(workflowRun) {
  return getEventSystem().emitAsync(SYSTEM_EVENTS.WORKFLOW_STARTED, workflowRun);
}

function emitWorkflowCompleted(workflowRun) {
  return getEventSystem().emitAsync(SYSTEM_EVENTS.WORKFLOW_COMPLETED, workflowRun);
}

function emitAgentStatusChanged(agentId, status, metadata = {}) {
  return getEventSystem().emitAsync(SYSTEM_EVENTS.AGENT_STATUS_CHANGED, {
    agentId,
    status,
    ...metadata
  });
}

function emitSessionMessageSent(sessionId, message, metadata = {}) {
  return getEventSystem().emitAsync(SYSTEM_EVENTS.SESSION_MESSAGE_SENT, {
    sessionId,
    message,
    ...metadata
  });
}

function emitNotificationSent(notification) {
  return getEventSystem().emitAsync(SYSTEM_EVENTS.NOTIFICATION_SENT, notification);
}

module.exports = {
  PluginEventSystem,
  createEventSystem,
  getEventSystem,
  setGlobalEventSystem,
  SYSTEM_EVENTS,
  VALID_EVENTS,
  emitTaskCreated,
  emitTaskCompleted,
  emitTaskFailed,
  emitWorkflowStarted,
  emitWorkflowCompleted,
  emitAgentStatusChanged,
  emitSessionMessageSent,
  emitNotificationSent
};
