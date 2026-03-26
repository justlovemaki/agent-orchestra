'use strict';

/**
 * Plugin Loader Module
 * 
 * Discovers and dynamically loads plugins from the plugins directory.
 */

const fs = require('fs').promises;
const path = require('path');
const { createPlugin, validateManifest } = require('./plugin-interface');

class PluginLoader {
  constructor(pluginsDir) {
    this.pluginsDir = pluginsDir;
    this.loadedPaths = new Map();
  }

  async scan() {
    const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });
    const pluginDirs = [];
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(this.pluginsDir, entry.name, 'manifest.json');
        try {
          await fs.access(manifestPath);
          pluginDirs.push(entry.name);
        } catch {
          console.log(`[PluginLoader] Skipping ${entry.name}: no manifest.json found`);
        }
      }
    }
    
    return pluginDirs;
  }

  async loadPlugin(pluginName) {
    const pluginPath = path.join(this.pluginsDir, pluginName);
    
    try {
      await fs.access(pluginPath);
    } catch {
      throw new Error(`Plugin directory not found: ${pluginName}`);
    }

    const manifestPath = path.join(pluginPath, 'manifest.json');
    let manifest;
    
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      manifest = JSON.parse(manifestContent);
    } catch (error) {
      throw new Error(`Failed to load manifest for ${pluginName}: ${error.message}`);
    }

    try {
      validateManifest(manifest);
    } catch (error) {
      throw new Error(`Invalid manifest for ${pluginName}: ${error.message}`);
    }

    const plugin = createPlugin(manifest, pluginPath);

    const indexPath = path.join(pluginPath, 'index.js');
    try {
      const indexModule = require(indexPath);
      if (typeof indexModule === 'function') {
        await indexModule(plugin, { rootPath: pluginPath });
      } else if (indexModule.default && typeof indexModule.default === 'function') {
        await indexModule.default(plugin, { rootPath: pluginPath });
      } else if (indexModule.initialize && typeof indexModule.initialize === 'function') {
        await indexModule.initialize(plugin, { rootPath: pluginPath });
      }
    } catch (error) {
      plugin.state = 'error';
      plugin.error = error.message;
      throw new Error(`Failed to initialize plugin ${pluginName}: ${error.message}`);
    }

    try {
      await plugin.initialize();
    } catch (error) {
      plugin.state = 'error';
      plugin.error = error.message;
      throw new Error(`Plugin ${pluginName} initialization failed: ${error.message}`);
    }

    this.loadedPaths.set(pluginName, pluginPath);
    return plugin;
  }

  async loadAll(registry) {
    const pluginNames = await this.scan();
    const results = {
      success: [],
      failed: []
    };

    console.log(`[PluginLoader] Found ${pluginNames.length} plugins to load`);

    for (const pluginName of pluginNames) {
      try {
        const plugin = await this.loadPlugin(pluginName);
        registry.register(plugin);
        results.success.push({
          name: pluginName,
          type: plugin.type,
          version: plugin.version
        });
        console.log(`[PluginLoader] Loaded plugin: ${pluginName} (${plugin.type} v${plugin.version})`);
      } catch (error) {
        results.failed.push({
          name: pluginName,
          error: error.message
        });
        console.error(`[PluginLoader] Failed to load plugin ${pluginName}:`, error.message);
      }
    }

    return results;
  }

  async reloadPlugin(pluginName, registry) {
    const pluginPath = this.loadedPaths.get(pluginName);
    if (!pluginPath) {
      throw new Error(`Plugin not previously loaded: ${pluginName}`);
    }

    if (registry.get(pluginName)) {
      try {
        await registry.disablePlugin(pluginName);
      } catch {}
      registry.unregister(pluginName);
    }

    delete require.cache[require.resolve(path.join(pluginPath, 'index.js'))];

    return await this.loadPlugin(pluginName);
  }

  async unloadPlugin(pluginName, registry) {
    const plugin = registry.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not registered: ${pluginName}`);
    }

    if (plugin.state === 'enabled') {
      await registry.disablePlugin(pluginName);
    }

    registry.unregister(pluginName);
    this.loadedPaths.delete(pluginName);

    const indexPath = path.join(this.pluginsDir, pluginName, 'index.js');
    delete require.cache[require.resolve(indexPath)];
  }

  getLoadedPaths() {
    return new Map(this.loadedPaths);
  }
}

module.exports = PluginLoader;
