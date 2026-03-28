'use strict';

const fs = require('fs').promises;
const path = require('path');

const VALID_PLUGIN_TYPES = ['panel', 'notification', 'datasource', 'automation'];

const REQUIRED_MANIFEST_FIELDS = ['name', 'version', 'type'];

class PluginValidator {
  constructor(options = {}) {
    this.strictMode = options.strictMode || false;
  }

  async validatePlugin(pluginPath) {
    const result = {
      valid: false,
      errors: [],
      warnings: [],
      manifest: null,
      pluginPath
    };

    try {
      const manifestPath = path.join(pluginPath, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      result.manifest = manifest;
    } catch (err) {
      if (err.code === 'ENOENT') {
        result.errors.push('Missing manifest.json file');
      } else if (err instanceof SyntaxError) {
        result.errors.push(`Invalid manifest.json: ${err.message}`);
      } else {
        result.errors.push(`Failed to read manifest.json: ${err.message}`);
      }
      return result;
    }

    this.validateManifestFields(result);
    
    if (result.errors.length > 0) {
      return result;
    }

    await this.validatePluginFiles(result);
    this.validateConfigSchema(result);
    this.validateEventTypes(result);

    result.valid = result.errors.length === 0;
    
    return result;
  }

  validateManifestFields(result) {
    const manifest = result.manifest;
    
    for (const field of REQUIRED_MANIFEST_FIELDS) {
      if (!manifest[field]) {
        result.errors.push(`Missing required field in manifest: ${field}`);
      }
    }

    if (manifest.type && !VALID_PLUGIN_TYPES.includes(manifest.type)) {
      result.errors.push(`Invalid plugin type: ${manifest.type}. Must be one of: ${VALID_PLUGIN_TYPES.join(', ')}`);
    }

    if (manifest.version) {
      if (!this.isValidVersion(manifest.version)) {
        result.errors.push(`Invalid version format: ${manifest.version}. Use semver (e.g., 1.0.0)`);
      }
    }

    if (manifest.name) {
      if (!/^[a-z0-9-]+$/.test(manifest.name)) {
        result.errors.push(`Invalid plugin name: ${manifest.name}. Use lowercase letters, numbers, and hyphens only.`);
      }
      if (manifest.name.length < 3) {
        result.errors.push(`Plugin name must be at least 3 characters: ${manifest.name}`);
      }
    }

    if (!manifest.description || manifest.description.length < 10) {
      result.warnings.push('Plugin description should be at least 10 characters');
    }

    if (!manifest.author) {
      result.warnings.push('Missing author field in manifest');
    }
  }

  isValidVersion(version) {
    return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(version);
  }

  async validatePluginFiles(result) {
    const pluginPath = result.pluginPath;
    const manifest = result.manifest;
    const type = manifest.type;

    try {
      const indexPath = path.join(pluginPath, 'index.js');
      await fs.access(indexPath);
    } catch {
      result.errors.push('Missing index.js file');
    }

    try {
      const readmePath = path.join(pluginPath, 'README.md');
      await fs.access(readmePath);
    } catch {
      result.warnings.push('Missing README.md file');
    }

    if (type === 'panel') {
      if (!manifest.component) {
        result.warnings.push('Panel plugin should specify component in manifest');
      }
    }

    if (type === 'notification') {
      if (!manifest.channelName) {
        result.warnings.push('Notification plugin should specify channelName in manifest');
      }
    }

    if (type === 'datasource') {
      if (!manifest.schema) {
        result.warnings.push('Datasource plugin should specify schema in manifest');
      }
    }
  }

  validateConfigSchema(result) {
    const manifest = result.manifest;
    const configSchema = manifest.configSchema;
    
    if (!configSchema) {
      result.warnings.push('Missing configSchema - consider adding configuration options');
      return;
    }

    for (const [key, schema] of Object.entries(configSchema)) {
      if (!schema.type) {
        result.errors.push(`Config field "${key}" missing type definition`);
      }

      if (schema.required !== undefined && typeof schema.required !== 'boolean') {
        result.errors.push(`Config field "${key}" has invalid required value`);
      }

      if (schema.enum && !Array.isArray(schema.enum)) {
        result.errors.push(`Config field "${key}" enum must be an array`);
      }
    }
  }

  validateEventTypes(result) {
    const manifest = result.manifest;
    const eventTypes = manifest.eventTypes;
    
    if (!eventTypes || !Array.isArray(eventTypes)) {
      return;
    }

    const validEvents = [
      'task.created', 'task.completed', 'task.failed',
      'workflow.started', 'workflow.completed', 'workflow.failed',
      'agent.status_changed', 'session.message_sent', 'notification.sent'
    ];

    for (const event of eventTypes) {
      if (!validEvents.includes(event)) {
        result.warnings.push(`Unknown event type: ${event}`);
      }
    }
  }

  async validateDirectory(pluginPath) {
    try {
      const stats = await fs.stat(pluginPath);
      if (!stats.isDirectory()) {
        return { valid: false, error: 'Plugin path is not a directory' };
      }
      return { valid: true };
    } catch (err) {
      return { valid: false, error: `Cannot access plugin path: ${err.message}` };
    }
  }
}

module.exports = PluginValidator;
