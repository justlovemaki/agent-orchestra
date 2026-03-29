'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class PluginUpdateEmitter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.marketDataPath = options.marketDataPath || path.join(__dirname, '..', 'data', 'plugins-marketplace.json');
    this.installedPluginsPath = options.installedPluginsPath || path.join(__dirname, '..', 'data', 'installed-plugins.json');
    this.pluginsDir = options.pluginsDir || path.join(__dirname, '..', 'plugins');
    this.checkInterval = options.checkInterval || 1800000;
    this.intervals = new Map();
  }

  async loadInstalledPlugins(userId) {
    try {
      const content = await fs.promises.readFile(this.installedPluginsPath, 'utf8');
      const data = JSON.parse(content);
      return userId ? (data[userId] || []) : data;
    } catch {
      return userId ? [] : {};
    }
  }

  async loadMarketData() {
    try {
      const content = await fs.promises.readFile(this.marketDataPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return { plugins: [] };
    }
  }

  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  async checkForUpdates(userId) {
    const marketData = await this.loadMarketData();
    const installed = await this.loadInstalledPlugins(userId);
    const userPlugins = Array.isArray(installed) ? installed : [];
    
    const updates = [];
    
    for (const record of userPlugins) {
      const pluginPath = path.join(this.pluginsDir, record.pluginName);
      let installedVersion = record.version;
      
      try {
        const manifestPath = path.join(pluginPath, 'manifest.json');
        const content = await fs.promises.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(content);
        installedVersion = manifest.version;
      } catch {}
      
      const marketPlugin = marketData.plugins.find(p => 
        p.name === record.pluginName && p.status === 'approved'
      );
      
      if (!marketPlugin) continue;
      
      const comparison = this.compareVersions(installedVersion, marketPlugin.version);
      
      if (comparison < 0) {
        let updateType = 'patch';
        const currentParts = installedVersion.split('.').map(Number);
        const latestParts = marketPlugin.version.split('.').map(Number);
        
        if (latestParts[0] > currentParts[0]) {
          updateType = 'major';
        } else if (latestParts[1] > currentParts[1]) {
          updateType = 'minor';
        }
        
        updates.push({
          pluginId: record.pluginId || marketPlugin.id,
          pluginName: record.pluginName,
          currentVersion: installedVersion,
          latestVersion: marketPlugin.version,
          updateType,
          downloadUrl: marketPlugin.downloadUrl,
          description: marketPlugin.description,
          author: marketPlugin.author
        });
      }
    }
    
    this.emit('checkComplete', { userId, updates });
    
    return updates;
  }

  async startAutoCheck(userId, callback) {
    if (this.intervals.has(userId)) {
      this.stopAutoCheck(userId);
    }

    const doCheck = async () => {
      try {
        const updates = await this.checkForUpdates(userId);
        
        if (updates.length > 0) {
          this.emit('updatesAvailable', { userId, updates });
          
          if (callback) {
            callback(updates);
          }
        }
        
        this.emit('checkComplete', { userId, updates });
      } catch (error) {
        this.emit('checkError', { userId, error: error.message });
      }
    };

    doCheck();
    
    const intervalId = setInterval(doCheck, this.checkInterval);
    this.intervals.set(userId, intervalId);
    
    return intervalId;
  }

  stopAutoCheck(userId) {
    if (this.intervals.has(userId)) {
      clearInterval(this.intervals.get(userId));
      this.intervals.delete(userId);
    }
  }

  stopAllAutoCheck() {
    for (const intervalId of this.intervals.values()) {
      clearInterval(intervalId);
    }
    this.intervals.clear();
  }

  createNotificationMessage(updates) {
    if (updates.length === 0) {
      return {
        type: 'plugin_updates',
        title: '所有插件已是最新版本',
        body: '没有需要更新的插件',
        updates: []
      };
    }

    const majorUpdates = updates.filter(u => u.updateType === 'major');
    const minorUpdates = updates.filter(u => u.updateType === 'minor');
    const patchUpdates = updates.filter(u => u.updateType === 'patch');

    let body = '';
    if (majorUpdates.length > 0) {
      body += `${majorUpdates.length} 个重大更新`;
    }
    if (minorUpdates.length > 0) {
      body += (body ? ', ' : '') + `${minorUpdates.length} 个功能更新`;
    }
    if (patchUpdates.length > 0) {
      body += (body ? ', ' : '') + `${patchUpdates.length} 个修复更新`;
    }

    return {
      type: 'plugin_updates',
      title: `插件更新可用 (${updates.length})`,
      body,
      updates: updates.map(u => ({
        pluginName: u.pluginName,
        currentVersion: u.currentVersion,
        latestVersion: u.latestVersion,
        updateType: u.updateType,
        description: u.description
      })),
      timestamp: Date.now()
    };
  }

  async getPluginChangeLog(pluginName) {
    const marketData = await this.loadMarketData();
    const plugin = marketData.plugins.find(p => p.name === pluginName);
    
    if (!plugin) {
      return null;
    }

    return {
      name: plugin.name,
      version: plugin.version,
      changelog: plugin.changelog || '暂无更新日志',
      releaseNotes: plugin.releaseNotes || [],
      lastUpdated: plugin.updatedAt
    };
  }
}

module.exports = PluginUpdateEmitter;
