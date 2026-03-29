'use strict';

/**
 * Plugin System Module
 * 
 * Main entry point for the plugin system.
 * Provides plugin loading, registry, and lifecycle management.
 */

const path = require('path');
const PluginLoader = require('./plugin-loader');
const PluginRegistry = require('./plugin-registry');
const pluginInterface = require('./plugin-interface');
const { createEventSystem, getEventSystem } = require('../plugin-event-system');
const { SandboxManager } = require('../plugin-sandbox-manager');
const { SecurityPolicy, PERMISSION_LEVELS } = require('../plugin-security-policy');

class PluginSystem {
  constructor(pluginsDir, eventSystem = null, options = {}) {
    this.pluginsDir = pluginsDir;
    this.loader = new PluginLoader(pluginsDir);
    this.registry = new PluginRegistry();
    this.eventSystem = eventSystem || createEventSystem();
    this.initialized = false;
    
    this.sandboxEnabled = options.sandboxEnabled !== false;
    this.sandboxOptions = options.sandboxOptions || {};
    this.sandboxManager = null;
    
    if (this.sandboxEnabled) {
      this.sandboxManager = new SandboxManager({
        maxSandboxes: this.sandboxOptions.maxSandboxes || 20,
        healthCheckInterval: this.sandboxOptions.healthCheckInterval || 30000,
        defaultTimeout: this.sandboxOptions.defaultTimeout || 30000,
        defaultMemoryLimit: this.sandboxOptions.defaultMemoryLimit || 128 * 1024 * 1024,
        defaultPermissionLevel: this.sandboxOptions.defaultPermissionLevel || 'sandboxed',
        interPluginCommunication: this.sandboxOptions.interPluginCommunication !== true
      });
      
      this.sandboxManager.on('sandboxError', ({ sandboxId, pluginName, error }) => {
        console.error(`[PluginSystem] Sandbox error for ${pluginName}:`, error.message);
      });
      
      this.sandboxManager.on('healthCheck', (report) => {
        console.log(`[PluginSystem] Sandbox health check: ${report.totalSandboxes} active`);
      });
    }
  }

  async initialize(dataDir) {
    if (this.initialized) {
      throw new Error('Plugin system already initialized');
    }

    const results = await this.loader.loadAll(this.registry);

    this._registerEventHandlers();

    if (dataDir) {
      await this.registry.loadState(dataDir);
    }

    this.initialized = true;
    console.log(`[PluginSystem] Initialized with ${results.success.length} plugins`);
    
    return results;
  }

  _registerEventHandlers() {
    const enabledPlugins = this.registry.getEnabled();
    for (const plugin of enabledPlugins) {
      if (plugin.eventTypes && plugin.eventTypes.length > 0) {
        try {
          this.eventSystem.registerPlugin(plugin);
        } catch (error) {
          console.error(`[PluginSystem] Failed to register event handler for plugin ${plugin.name}:`, error.message);
        }
      }
    }
    console.log(`[PluginSystem] Registered ${this.eventSystem.getTotalListenerCount()} event handlers`);
  }

  getRegistry() {
    return this.registry;
  }

  getLoader() {
    return this.loader;
  }

  getEventSystem() {
    return this.eventSystem;
  }

  registerPluginEvents(pluginName) {
    const plugin = this.registry.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }
    if (plugin.state !== 'enabled') {
      throw new Error(`Plugin ${pluginName} must be enabled to register events`);
    }
    return this.eventSystem.registerPlugin(plugin);
  }

  unregisterPluginEvents(pluginName) {
    return this.eventSystem.unregisterPlugin(pluginName);
  }

  getPlugin(name) {
    return this.registry.get(name);
  }

  getAllPlugins() {
    return this.registry.getList();
  }

  getPluginsByType(type) {
    return this.registry.getByType(type);
  }

  getEnabledPlugins() {
    return this.registry.getEnabled();
  }

  async enablePlugin(name) {
    const result = await this.registry.enablePlugin(name);
    const plugin = this.registry.get(name);
    if (plugin && plugin.eventTypes && plugin.eventTypes.length > 0) {
      try {
        this.eventSystem.registerPlugin(plugin);
      } catch (error) {
        console.error(`[PluginSystem] Failed to register event handler for plugin ${name}:`, error.message);
      }
    }
    return result;
  }

  async disablePlugin(name) {
    this.eventSystem.unregisterPlugin(name);
    return await this.registry.disablePlugin(name);
  }

  getPluginConfig(name) {
    return this.registry.getConfig(name);
  }

  updatePluginConfig(name, config) {
    return this.registry.updateConfig(name, config);
  }

  async reloadPlugin(name) {
    return await this.loader.reloadPlugin(name, this.registry);
  }

  async saveState(dataDir) {
    return await this.registry.saveState(dataDir);
  }

  getSandboxManager() {
    return this.sandboxManager;
  }

  isSandboxEnabled() {
    return this.sandboxEnabled;
  }

  async executeInSandbox(pluginName, code, context = {}, options = {}) {
    if (!this.sandboxEnabled || !this.sandboxManager) {
      throw new Error('Sandbox is not enabled');
    }
    
    const plugin = this.registry.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }
    
    const permissionLevel = plugin.manifest.securityLevel || this.sandboxOptions.defaultPermissionLevel || 'sandboxed';
    
    const sandboxOptions = {
      ...options,
      securityPolicy: new SecurityPolicy({
        name: pluginName,
        permissionLevel
      })
    };
    
    return await this.sandboxManager.executeInSandbox(pluginName, code, context, sandboxOptions);
  }

  createSandboxForPlugin(pluginName, options = {}) {
    if (!this.sandboxEnabled || !this.sandboxManager) {
      throw new Error('Sandbox is not enabled');
    }
    
    return this.sandboxManager.createSandbox(pluginName, options);
  }

  destroySandbox(pluginName) {
    if (!this.sandboxManager) {
      return false;
    }
    return this.sandboxManager.destroySandboxByPlugin(pluginName);
  }

  startSandboxHealthCheck() {
    if (this.sandboxManager) {
      this.sandboxManager.startHealthCheck();
    }
  }

  stopSandboxHealthCheck() {
    if (this.sandboxManager) {
      this.sandboxManager.stopHealthCheck();
    }
  }

  getSandboxStats() {
    if (!this.sandboxManager) {
      return null;
    }
    return this.sandboxManager.getStats();
  }

  getSandboxHealth() {
    if (!this.sandboxManager) {
      return null;
    }
    return this.sandboxManager.performHealthCheck();
  }

  getPluginSecurityLevel(pluginName) {
    const plugin = this.registry.get(pluginName);
    if (!plugin) {
      return null;
    }
    return plugin.manifest.securityLevel || 'sandboxed';
  }

  setPluginSecurityLevel(pluginName, level) {
    const plugin = this.registry.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }
    
    if (!Object.values(PERMISSION_LEVELS).includes(level)) {
      throw new Error(`Invalid security level: ${level}`);
    }
    
    plugin.manifest.securityLevel = level;
    
    if (this.sandboxManager && this.sandboxManager.hasSandbox(pluginName)) {
      this.sandboxManager.restartSandbox(pluginName);
    }
    
    return true;
  }

  isolatePlugin(pluginName) {
    if (!this.sandboxManager) {
      return false;
    }
    return this.sandboxManager.isolatePlugin(pluginName);
  }
}

function createPluginSystem(pluginsDir, dataDir) {
  const ps = new PluginSystem(pluginsDir);
  return ps;
}

module.exports = {
  PluginSystem,
  createPluginSystem,
  PluginLoader,
  PluginRegistry,
  createEventSystem,
  getEventSystem,
  SandboxManager,
  SecurityPolicy,
  PERMISSION_LEVELS,
  ...pluginInterface
};
