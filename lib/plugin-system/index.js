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

class PluginSystem {
  constructor(pluginsDir, eventSystem = null) {
    this.pluginsDir = pluginsDir;
    this.loader = new PluginLoader(pluginsDir);
    this.registry = new PluginRegistry();
    this.eventSystem = eventSystem || createEventSystem();
    this.initialized = false;
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
  ...pluginInterface
};
