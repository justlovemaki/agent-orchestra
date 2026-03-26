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

class PluginSystem {
  constructor(pluginsDir) {
    this.pluginsDir = pluginsDir;
    this.loader = new PluginLoader(pluginsDir);
    this.registry = new PluginRegistry();
    this.initialized = false;
  }

  async initialize(dataDir) {
    if (this.initialized) {
      throw new Error('Plugin system already initialized');
    }

    const results = await this.loader.loadAll(this.registry);
    
    if (dataDir) {
      await this.registry.loadState(dataDir);
    }

    this.initialized = true;
    console.log(`[PluginSystem] Initialized with ${results.success.length} plugins`);
    
    return results;
  }

  getRegistry() {
    return this.registry;
  }

  getLoader() {
    return this.loader;
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
    return await this.registry.enablePlugin(name);
  }

  async disablePlugin(name) {
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
  ...pluginInterface
};
