'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class PluginUpdateNotifier {
  constructor(options = {}) {
    this.marketDataPath = options.marketDataPath || path.join(__dirname, '..', 'data', 'plugins-marketplace.json');
    this.installedPluginsPath = options.installedPluginsPath || path.join(__dirname, '..', 'data', 'installed-plugins.json');
    this.pluginsDir = options.pluginsDir || path.join(__dirname, '..', 'plugins');
    this.checkInterval = options.checkInterval || 3600000;
    this.eventEmitter = options.eventEmitter || null;
    this.intervalId = null;
  }

  async loadInstalledPlugins(userId) {
    try {
      const content = await fs.promises.readFile(this.installedPluginsPath, 'utf8');
      const data = JSON.parse(content);
      
      if (userId) {
        return data[userId] || [];
      }
      
      return data;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return userId ? [] : {};
      }
      throw error;
    }
  }

  async loadMarketData() {
    try {
      const content = await fs.promises.readFile(this.marketDataPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load market data: ${error.message}`);
    }
  }

  async getInstalledPluginVersions(userId) {
    const installed = await this.loadInstalledPlugins(userId);
    const plugins = {};
    const pluginDir = this.pluginsDir;
    
    const userPlugins = userId ? installed : Object.values(installed).flat();
    
    for (const record of userPlugins) {
      const pluginPath = path.join(pluginDir, record.pluginName);
      
      try {
        const manifestPath = path.join(pluginPath, 'manifest.json');
        const content = await fs.promises.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(content);
        
        plugins[record.pluginName] = {
          installedVersion: manifest.version,
          marketVersion: record.version,
          lastChecked: record.lastChecked || null,
          pluginPath,
          marketplaceId: record.pluginId || record.marketplaceId
        };
      } catch (error) {
        plugins[record.pluginName] = {
          installedVersion: record.version,
          marketVersion: record.version,
          lastChecked: null,
          error: error.message
        };
      }
    }
    
    return plugins;
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

  async checkAllUpdates(userId) {
    const marketData = await this.loadMarketData();
    const installed = await this.getInstalledPluginVersions(userId);
    
    const updates = [];
    
    for (const [pluginName, info] of Object.entries(installed)) {
      if (info.error) continue;
      
      const marketPlugin = marketData.plugins.find(p => p.name === pluginName);
      
      if (!marketPlugin) continue;
      if (marketPlugin.status !== 'approved') continue;
      
      const comparison = this.compareVersions(info.installedVersion, marketPlugin.version);
      
      if (comparison < 0) {
        let updateType = 'patch';
        const currentParts = info.installedVersion.split('.').map(Number);
        const latestParts = marketPlugin.version.split('.').map(Number);
        
        if (latestParts[0] > currentParts[0]) {
          updateType = 'major';
        } else if (latestParts[1] > currentParts[1]) {
          updateType = 'minor';
        }
        
        updates.push({
          pluginName,
          pluginId: marketPlugin.id,
          currentVersion: info.installedVersion,
          latestVersion: marketPlugin.version,
          updateType,
          description: marketPlugin.description,
          downloadUrl: marketPlugin.downloadUrl,
          author: marketPlugin.author
        });
      }
    }
    
    this.emit('checkComplete', { userId, updates });
    
    return updates;
  }

  async getPendingUpdates(userId) {
    const updates = await this.checkAllUpdates(userId);
    
    return updates.map(u => ({
      pluginName: u.pluginName,
      pluginId: u.pluginId,
      currentVersion: u.currentVersion,
      latestVersion: u.latestVersion,
      updateType: u.updateType,
      reason: this.getUpdateReason(u.updateType)
    }));
  }

  getUpdateReason(updateType) {
    const reasons = {
      major: '有重大功能更新，可能包含破坏性变更',
      minor: '有新功能添加，向后兼容',
      patch: '包含问题修复和性能优化'
    };
    return reasons[updateType] || '有可用更新';
  }

  notifyUpdates(userId, options = {}) {
    const { includeAll = false, maxUpdates = 10 } = options;
    
    return new Promise(async (resolve, reject) => {
      try {
        const updates = await this.getPendingUpdates(userId);
        
        if (updates.length === 0) {
          return resolve({
            hasUpdates: false,
            count: 0,
            notifications: [],
            message: '所有插件已是最新版本'
          });
        }

        const limitedUpdates = includeAll ? updates : updates.slice(0, maxUpdates);
        
        const notifications = limitedUpdates.map(update => ({
          type: 'plugin_update_available',
          pluginName: update.pluginName,
          pluginId: update.pluginId,
          currentVersion: update.currentVersion,
          latestVersion: update.latestVersion,
          updateType: update.updateType,
          reason: update.reason,
          timestamp: Date.now()
        }));

        const notification = {
          type: 'plugin_updates',
          title: `插件更新可用 (${updates.length})`,
          body: updates.length === 1 
            ? `${updates[0].pluginName} 有新版本 ${updates[0].latestVersion} 可用`
            : `${updates.length} 个插件有可用更新`,
          updates: notifications,
          generatedAt: Date.now()
        };

        this.emit('notificationsGenerated', { userId, notification });
        
        resolve({
          hasUpdates: true,
          count: updates.length,
          notifications,
          notification,
          message: `发现 ${updates.length} 个可用更新`
        });
      } catch (error) {
        this.emit('notificationError', { userId, error: error.message });
        reject(error);
      }
    });
  }

  startAutoCheck(userId, callback) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const check = async () => {
      try {
        const updates = await this.checkAllUpdates(userId);
        if (updates.length > 0 && callback) {
          callback(updates);
        }
      } catch (error) {
        console.error('[PluginUpdateNotifier] Auto check failed:', error.message);
      }
    };

    this.intervalId = setInterval(check, this.checkInterval);
    check();

    return this.intervalId;
  }

  stopAutoCheck() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async fetchRemoteVersion(pluginUrl) {
    return new Promise((resolve, reject) => {
      if (!pluginUrl || (!pluginUrl.startsWith('http://') && !pluginUrl.startsWith('https://'))) {
        return reject(new Error('Invalid plugin URL'));
      }

      const client = pluginUrl.startsWith('https') ? https : http;
      const urlObj = new URL(pluginUrl);
      
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: 10000,
        headers: {
          'User-Agent': 'Agent-Orchestra-Plugin-Update-Checker/1.0'
        }
      };

      const request = client.request(options, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const manifest = JSON.parse(data);
            resolve({
              version: manifest.version,
              name: manifest.name,
              description: manifest.description,
              author: manifest.author
            });
          } catch (error) {
            reject(new Error('Failed to parse manifest'));
          }
        });
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });

      request.end();
    });
  }

  async getPluginChangelog(pluginName) {
    const marketData = await this.loadMarketData();
    const plugin = marketData.plugins.find(p => p.name === pluginName);
    
    if (!plugin) {
      throw new Error(`Plugin not found in marketplace: ${pluginName}`);
    }

    return {
      pluginName: plugin.name,
      currentVersion: plugin.version,
      changelog: plugin.changelog || '暂无更新日志',
      releaseNotes: plugin.releaseNotes || [],
      lastUpdated: plugin.updatedAt
    };
  }

  emit(event, data) {
    if (this.eventEmitter) {
      this.eventEmitter.emit(event, data);
    }
    console.log(`[PluginUpdateNotifier] ${event}:`, data);
  }
}

module.exports = PluginUpdateNotifier;
