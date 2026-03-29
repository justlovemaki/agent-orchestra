'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');
const {
  PluginSandbox,
  SandboxTimeoutError,
  SandboxMemoryError,
  SandboxAccessDeniedError
} = require('./plugin-sandbox');
const { SecurityPolicy } = require('./plugin-security-policy');

const DEFAULT_MAX_SANDBOXES = 20;
const DEFAULT_HEALTH_CHECK_INTERVAL = 30000;
const DEFAULT_RESTART_DELAY = 1000;

class SandboxManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.maxSandboxes = options.maxSandboxes || DEFAULT_MAX_SANDBOXES;
    this.healthCheckInterval = options.healthCheckInterval || DEFAULT_HEALTH_CHECK_INTERVAL;
    this.defaultTimeout = options.defaultTimeout || 30000;
    this.defaultMemoryLimit = options.defaultMemoryLimit || 128 * 1024 * 1024;
    this.defaultCpuLimit = options.defaultCpuLimit || 5000;
    
    this.sandboxes = new Map();
    this.sandboxByPlugin = new Map();
    this.interPluginCommunication = options.interPluginCommunication === true;
    this.healthCheckTimer = null;
    
    this.stats = {
      totalCreated: 0,
      totalExecuted: 0,
      totalTerminated: 0,
      totalErrors: 0,
      totalTimeouts: 0
    };
    
    this.defaultSecurityPolicy = new SecurityPolicy({
      permissionLevel: options.defaultPermissionLevel || 'sandboxed'
    });
  }

  createSandbox(pluginName, options = {}) {
    if (this.sandboxes.size >= this.maxSandboxes) {
      throw new Error(`Maximum number of sandboxes (${this.maxSandboxes}) reached`);
    }

    if (this.sandboxByPlugin.has(pluginName)) {
      return this.sandboxByPlugin.get(pluginName);
    }

    const sandboxId = options.id || `${pluginName}-${crypto.randomBytes(4).toString('hex')}`;
    
    const sandboxOptions = {
      id: sandboxId,
      pluginName,
      timeout: options.timeout || this.defaultTimeout,
      memoryLimit: options.memoryLimit || this.defaultMemoryLimit,
      cpuLimit: options.cpuLimit || this.defaultCpuLimit,
      apiWhitelist: options.apiWhitelist,
      customAPI: options.customAPI,
      useWorkerThreads: options.useWorkerThreads !== false,
      enableLogging: options.enableLogging !== false,
      securityPolicy: options.securityPolicy || this.defaultSecurityPolicy
    };

    const sandbox = new PluginSandbox(sandboxOptions);
    sandbox.initialize();

    this.sandboxes.set(sandboxId, sandbox);
    this.sandboxByPlugin.set(pluginName, sandbox);
    this.stats.totalCreated++;

    sandbox.on('log', (log) => this.emit('log', log));
    sandbox.on('error', (error) => {
      this.stats.totalErrors++;
      this.emit('sandboxError', { sandboxId, pluginName, error });
    });

    this.emit('sandboxCreated', { sandboxId, pluginName, sandbox });

    return sandbox;
  }

  getSandbox(sandboxId) {
    return this.sandboxes.get(sandboxId) || null;
  }

  getSandboxByPlugin(pluginName) {
    return this.sandboxByPlugin.get(pluginName) || null;
  }

  hasSandbox(pluginName) {
    return this.sandboxByPlugin.has(pluginName);
  }

  async executeInSandbox(pluginName, code, context = {}, options = {}) {
    let sandbox = this.getSandboxByPlugin(pluginName);
    
    if (!sandbox) {
      sandbox = this.createSandbox(pluginName, options);
    }

    if (this.interPluginCommunication && options.crossPlugin !== true) {
      const pluginContext = { ...context };
      delete pluginContext.sandbox;
      delete pluginContext.otherPlugins;
      context = pluginContext;
    }

    try {
      const result = await sandbox.execute(code, context);
      this.stats.totalExecuted++;
      this.emit('executionComplete', { 
        sandboxId: sandbox.id, 
        pluginName, 
        executionTime: result.executionTime 
      });
      return result;
    } catch (error) {
      this.stats.totalErrors++;
      
      if (error instanceof SandboxTimeoutError) {
        this.stats.totalTimeouts++;
        this.emit('timeout', { sandboxId: sandbox.id, pluginName });
      }
      
      throw error;
    }
  }

  destroySandbox(sandboxId) {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return false;
    }

    const pluginName = sandbox.pluginName;
    sandbox.terminate();
    
    this.sandboxes.delete(sandboxId);
    this.sandboxByPlugin.delete(pluginName);
    this.stats.totalTerminated++;

    this.emit('sandboxDestroyed', { sandboxId, pluginName });

    return true;
  }

  destroySandboxByPlugin(pluginName) {
    const sandbox = this.sandboxByPlugin.get(pluginName);
    if (!sandbox) {
      return false;
    }
    return this.destroySandbox(sandbox.id);
  }

  async restartSandbox(pluginName, options = {}) {
    this.destroySandboxByPlugin(pluginName);
    
    if (options.delay) {
      await new Promise(resolve => setTimeout(resolve, options.delay));
    }
    
    return this.createSandbox(pluginName, options);
  }

  destroyAll() {
    const pluginNames = Array.from(this.sandboxByPlugin.keys());
    
    for (const pluginName of pluginNames) {
      this.destroySandboxByPlugin(pluginName);
    }
  }

  startHealthCheck() {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);

    this.healthCheckTimer.unref();
  }

  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  performHealthCheck() {
    const healthReport = {
      timestamp: Date.now(),
      totalSandboxes: this.sandboxes.size,
      plugins: []
    };

    for (const [sandboxId, sandbox] of this.sandboxes) {
      const health = sandbox.getHealth();
      healthReport.plugins.push(health);

      if (sandbox.isRunning && sandbox.startTime) {
        const runningTime = Date.now() - sandbox.startTime;
        if (runningTime > sandbox.timeout) {
          this.emit('healthWarning', {
            sandboxId,
            pluginName: sandbox.pluginName,
            issue: 'running_timeout',
            runningTime,
            timeout: sandbox.timeout
          });
        }
      }
    }

    this.emit('healthCheck', healthReport);
    return healthReport;
  }

  getStats() {
    return {
      ...this.stats,
      activeSandboxes: this.sandboxes.size,
      pluginNames: Array.from(this.sandboxByPlugin.keys())
    };
  }

  getAllSandboxes() {
    const result = [];
    for (const [sandboxId, sandbox] of this.sandboxes) {
      result.push({
        sandboxId,
        pluginName: sandbox.pluginName,
        health: sandbox.getHealth()
      });
    }
    return result;
  }

  isolatePlugin(pluginName) {
    const sandbox = this.sandboxByPlugin.get(pluginName);
    if (!sandbox) {
      return false;
    }

    if (!this.interPluginCommunication) {
      return true;
    }

    for (const [otherName, otherSandbox] of this.sandboxByPlugin) {
      if (otherName !== pluginName) {
        otherSandbox.customAPI._isolatedPlugins = 
          (otherSandbox.customAPI._isolatedPlugins || []).filter(p => p !== pluginName);
      }
    }

    this.emit('pluginIsolated', { pluginName });
    return true;
  }

  setPluginAPI(pluginName, apiName, apiImplementation) {
    const sandbox = this.sandboxByPlugin.get(pluginName);
    if (!sandbox) {
      throw new Error(`Sandbox not found for plugin: ${pluginName}`);
    }

    sandbox.customAPI[apiName] = apiImplementation;
    return true;
  }

  removePluginAPI(pluginName, apiName) {
    const sandbox = this.sandboxByPlugin.get(pluginName);
    if (!sandbox) {
      return false;
    }

    delete sandbox.customAPI[apiName];
    return true;
  }

  getPluginLogs(pluginName) {
    const sandbox = this.sandboxByPlugin.get(pluginName);
    if (!sandbox) {
      return [];
    }
    return sandbox.getLogs();
  }

  clearPluginLogs(pluginName) {
    const sandbox = this.sandboxByPlugin.get(pluginName);
    if (!sandbox) {
      return false;
    }
    sandbox.clearLogs();
    return true;
  }
}

module.exports = {
  SandboxManager,
  DEFAULT_MAX_SANDBOXES,
  DEFAULT_HEALTH_CHECK_INTERVAL,
  DEFAULT_RESTART_DELAY
};
