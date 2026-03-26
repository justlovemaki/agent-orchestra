'use strict';

/**
 * Plugin Registry Module
 * 
 * Manages the registration, lifecycle, and state of all loaded plugins.
 */

const fs = require('fs').promises;
const path = require('path');
const { PLUGIN_STATES } = require('./plugin-interface');

class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.listeners = new Map();
  }

  register(plugin) {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already registered: ${plugin.name}`);
    }
    this.plugins.set(plugin.name, plugin);
    this.emit('registered', plugin);
    return plugin;
  }

  unregister(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }
    if (plugin.state === PLUGIN_STATES.ENABLED) {
      throw new Error(`Cannot unregister enabled plugin: ${pluginName}`);
    }
    this.plugins.delete(pluginName);
    this.emit('unregistered', plugin);
    return plugin;
  }

  get(pluginName) {
    return this.plugins.get(pluginName) || null;
  }

  getAll() {
    return Array.from(this.plugins.values());
  }

  getByType(type) {
    return this.getAll().filter(p => p.type === type);
  }

  getEnabled() {
    return this.getAll().filter(p => p.state === PLUGIN_STATES.ENABLED);
  }

  async enablePlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }
    if (plugin.state === PLUGIN_STATES.ENABLED) {
      return plugin;
    }
    if (plugin.state === PLUGIN_STATES.ERROR) {
      throw new Error(`Cannot enable plugin with errors: ${plugin.error}`);
    }
    
    try {
      await plugin.enable();
      this.emit('enabled', plugin);
      return plugin;
    } catch (error) {
      plugin.state = PLUGIN_STATES.ERROR;
      plugin.error = error.message;
      throw error;
    }
  }

  async disablePlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }
    if (plugin.state !== PLUGIN_STATES.ENABLED) {
      return plugin;
    }
    
    try {
      await plugin.disable();
      this.emit('disabled', plugin);
      return plugin;
    } catch (error) {
      plugin.state = PLUGIN_STATES.ERROR;
      plugin.error = error.message;
      throw error;
    }
  }

  updateConfig(pluginName, config) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }
    
    plugin.validateConfig(config);
    plugin.config = { ...plugin.config, ...config };
    this.emit('configUpdated', plugin);
    return plugin;
  }

  getConfig(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }
    return plugin.config;
  }

  getList() {
    return this.getAll().map(p => ({
      name: p.name,
      version: p.version,
      description: p.description,
      type: p.type,
      author: p.author,
      state: p.state,
      configSchema: p.configSchema,
      pluginPath: p.pluginPath,
      error: p.error
    }));
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    for (const callback of this.listeners.get(event)) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Plugin registry listener error for ${event}:`, error);
      }
    }
  }

  async saveState(dataDir) {
    const state = {
      plugins: {}
    };
    
    for (const [name, plugin] of this.plugins) {
      state.plugins[name] = {
        config: plugin.config,
        state: plugin.state
      };
    }
    
    const stateFile = path.join(dataDir, 'plugin-state.json');
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
    return stateFile;
  }

  async loadState(dataDir) {
    const stateFile = path.join(dataDir, 'plugin-state.json');
    
    try {
      const content = await fs.readFile(stateFile, 'utf8');
      const state = JSON.parse(content);
      
      for (const [name, pluginState] of Object.entries(state.plugins)) {
        const plugin = this.plugins.get(name);
        if (plugin) {
          plugin.config = pluginState.config || {};
          if (pluginState.state === PLUGIN_STATES.ENABLED) {
            try {
              await this.enablePlugin(name);
            } catch (error) {
              console.error(`Failed to restore plugin ${name} state:`, error.message);
            }
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load plugin state:', error.message);
      }
    }
  }
}

module.exports = PluginRegistry;
