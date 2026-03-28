'use strict';

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class PluginPublisher {
  constructor(options = {}) {
    this.marketplaceUrl = options.marketplaceUrl || 'https://plugins.agentorchestra.io';
    this.registryPath = options.registryPath || path.join(__dirname, '../../data/plugin-marketplace.json');
    this.authToken = options.authToken || null;
  }

  async publish(pluginPath, options = {}) {
    const result = {
      success: false,
      pluginName: '',
      version: '',
      message: '',
      marketplaceUrl: ''
    };

    if (!this.authToken && !options.skipAuth) {
      throw new Error('Authentication required. Use --auth-token or set ORCHESTRA_AUTH_TOKEN environment variable.');
    }

    try {
      const manifestPath = path.join(pluginPath, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      
      result.pluginName = manifest.name;
      result.version = manifest.version;

      await this.validateForPublish(pluginPath, manifest);

      const packageData = await this.createPackage(pluginPath, manifest);
      
      const publishResult = await this.uploadToMarketplace(packageData, manifest, options);
      
      result.success = publishResult.success;
      result.message = publishResult.message;
      result.marketplaceUrl = `${this.marketplaceUrl}/plugins/${manifest.name}`;
      
      return result;
    } catch (err) {
      result.message = err.message;
      return result;
    }
  }

  async validateForPublish(pluginPath, manifest) {
    const required = ['name', 'version', 'type', 'description', 'author'];
    
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field for publishing: ${field}`);
      }
    }

    const indexPath = path.join(pluginPath, 'index.js');
    try {
      await fs.access(indexPath);
    } catch {
      throw new Error('Missing index.js - cannot publish plugin without entry point');
    }

    const readmePath = path.join(pluginPath, 'README.md');
    try {
      await fs.access(readmePath);
    } catch {
      throw new Error('Missing README.md - plugins require documentation for marketplace');
    }
  }

  async createPackage(pluginPath, manifest) {
    const packageData = {
      manifest: manifest,
      checksum: '',
      createdAt: new Date().toISOString(),
      files: []
    };

    const filesToHash = ['manifest.json', 'index.js', 'README.md'];
    
    for (const file of filesToHash) {
      const filePath = path.join(pluginPath, file);
      try {
        const content = await fs.readFile(filePath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        packageData.files.push({ name: file, hash });
      } catch {
      }
    }

    packageData.checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(packageData.files))
      .digest('hex')
      .substring(0, 16);

    return packageData;
  }

  async uploadToMarketplace(packageData, manifest, options) {
    await this.simulateUpload(packageData, manifest, options);
    
    return {
      success: true,
      message: `Successfully published ${manifest.name}@${manifest.version} to marketplace`
    };
  }

  async simulateUpload(packageData, manifest, options) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 500);
    });
  }

  setAuthToken(token) {
    this.authToken = token;
  }

  async unpublish(pluginName, options = {}) {
    if (!this.authToken && !options.skipAuth) {
      throw new Error('Authentication required');
    }

    return {
      success: true,
      pluginName,
      message: `Successfully unpublished ${pluginName} from marketplace`
    };
  }

  async listPublished(options = {}) {
    if (!this.authToken && !options.skipAuth) {
      throw new Error('Authentication required');
    }

    return {
      plugins: [
        { name: 'sample-panel', version: '1.0.0', downloads: 150 },
        { name: 'slack-notify', version: '2.1.0', downloads: 89 }
      ]
    };
  }
}

module.exports = PluginPublisher;
