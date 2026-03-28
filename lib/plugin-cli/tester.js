'use strict';

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class PluginTester {
  constructor(options = {}) {
    this.pluginsDir = options.pluginsDir || path.join(__dirname, '../../plugins');
    this.timeout = options.timeout || 60000;
  }

  async runTests(pluginPath, options = {}) {
    const result = {
      success: false,
      passed: 0,
      failed: 0,
      errors: [],
      output: '',
      pluginPath
    };

    const validationResult = await this.validatePluginStructure(pluginPath);
    if (!validationResult.valid) {
      result.errors.push(...validationResult.errors);
      return result;
    }

    try {
      await this.loadAndTestPlugin(pluginPath, result, options);
    } catch (err) {
      result.errors.push(`Test execution failed: ${err.message}`);
    }

    result.success = result.failed === 0 && result.errors.length === 0;
    
    return result;
  }

  async validatePluginStructure(pluginPath) {
    const errors = [];
    
    try {
      const manifestPath = path.join(pluginPath, 'manifest.json');
      await fs.access(manifestPath);
      
      const content = await fs.readFile(manifestPath, 'utf-8');
      JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        errors.push('Missing manifest.json');
      } else if (err instanceof SyntaxError) {
        errors.push(`Invalid manifest.json: ${err.message}`);
      } else {
        errors.push(`Cannot read manifest: ${err.message}`);
      }
    }

    try {
      const indexPath = path.join(pluginPath, 'index.js');
      await fs.access(indexPath);
    } catch {
      errors.push('Missing index.js');
    }

    return { valid: errors.length === 0, errors };
  }

  async loadAndTestPlugin(pluginPath, result, options) {
    const testPlugin = {
      manifest: null,
      instance: null,
      config: options.config || {}
    };

    const manifestPath = path.join(pluginPath, 'manifest.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    testPlugin.manifest = JSON.parse(manifestContent);

    if (testPlugin.manifest.type === 'notification') {
      await this.testNotificationPlugin(pluginPath, testPlugin, result, options);
    } else if (testPlugin.manifest.type === 'datasource') {
      await this.testDatasourcePlugin(pluginPath, testPlugin, result, options);
    } else if (testPlugin.manifest.type === 'panel') {
      await this.testPanelPlugin(pluginPath, testPlugin, result, options);
    } else if (testPlugin.manifest.type === 'automation') {
      await this.testAutomationPlugin(pluginPath, testPlugin, result, options);
    } else {
      result.passed++;
    }
  }

  async testNotificationPlugin(pluginPath, testPlugin, result, options) {
    const indexPath = path.join(pluginPath, 'index.js');
    let pluginFn;
    
    try {
      pluginFn = require(indexPath);
    } catch (err) {
      result.errors.push(`Failed to load plugin: ${err.message}`);
      return;
    }

    result.passed++;

    const pluginInstance = typeof pluginFn === 'function' ? pluginFn(testPlugin.config) : pluginFn;
    
    if (pluginInstance.test && typeof pluginInstance.test === 'function') {
      try {
        await this.runWithTimeout(pluginInstance.test(testPlugin.config), this.timeout);
        result.passed++;
      } catch (err) {
        result.failed++;
        result.errors.push(`Plugin test() failed: ${err.message}`);
      }
    } else {
      result.passed++;
    }

    if (pluginInstance.send && typeof pluginInstance.send === 'function') {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push('Plugin missing send() method');
    }
  }

  async testDatasourcePlugin(pluginPath, testPlugin, result, options) {
    const indexPath = path.join(pluginPath, 'index.js');
    let pluginFn;
    
    try {
      pluginFn = require(indexPath);
    } catch (err) {
      result.errors.push(`Failed to load plugin: ${err.message}`);
      return;
    }

    result.passed++;

    const pluginInstance = typeof pluginFn === 'function' ? pluginFn(testPlugin.config) : pluginFn;
    
    if (pluginInstance.query && typeof pluginInstance.query === 'function') {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push('Plugin missing query() method');
    }

    if (pluginInstance.test && typeof pluginInstance.test === 'function') {
      try {
        await this.runWithTimeout(pluginInstance.test(testPlugin.config), this.timeout);
        result.passed++;
      } catch (err) {
        result.failed++;
        result.errors.push(`Plugin test() failed: ${err.message}`);
      }
    } else {
      result.passed++;
    }
  }

  async testPanelPlugin(pluginPath, testPlugin, result, options) {
    const indexPath = path.join(pluginPath, 'index.js');
    let pluginFn;
    
    try {
      pluginFn = require(indexPath);
    } catch (err) {
      result.errors.push(`Failed to load plugin: ${err.message}`);
      return;
    }

    result.passed++;

    const manifest = testPlugin.manifest;
    
    if (manifest.component) {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push('Panel plugin missing component in manifest');
    }

    if (manifest.renderMethod) {
      result.passed++;
    } else {
      result.warnings = result.warnings || [];
      result.warnings.push('Panel plugin missing renderMethod in manifest');
    }
  }

  async testAutomationPlugin(pluginPath, testPlugin, result, options) {
    const indexPath = path.join(pluginPath, 'index.js');
    let pluginFn;
    
    try {
      pluginFn = require(indexPath);
    } catch (err) {
      result.errors.push(`Failed to load plugin: ${err.message}`);
      return;
    }

    result.passed++;

    const pluginInstance = typeof pluginFn === 'function' ? pluginFn(testPlugin.config) : pluginFn;
    
    if (pluginInstance.execute && typeof pluginInstance.execute === 'function') {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push('Automation plugin missing execute() method');
    }

    if (pluginInstance.validate && typeof pluginInstance.validate === 'function') {
      result.passed++;
    } else {
      result.warnings = result.warnings || [];
      result.warnings.push('Automation plugin should implement validate() method');
    }
  }

  runWithTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${ms}ms`));
      }, ms);
      
      promise
        .then(value => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  async discoverPlugins() {
    const plugins = [];
    
    try {
      const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(this.pluginsDir, entry.name);
          const manifestPath = path.join(pluginPath, 'manifest.json');
          
          try {
            const content = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(content);
            plugins.push({
              name: manifest.name,
              version: manifest.version,
              type: manifest.type,
              path: pluginPath
            });
          } catch {
          }
        }
      }
    } catch {
      return [];
    }
    
    return plugins;
  }
}

module.exports = PluginTester;
