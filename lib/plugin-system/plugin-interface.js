'use strict';

/**
 * Plugin Interface Module
 * 
 * Defines base classes and interfaces for all plugin types.
 * Each plugin type (panel, notification, datasource) extends these base classes.
 */

const PLUGIN_TYPES = {
  PANEL: 'panel',
  NOTIFICATION: 'notification',
  DATASOURCE: 'datasource'
};

const PLUGIN_STATES = {
  UNLOADED: 'unloaded',
  LOADED: 'loaded',
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  ERROR: 'error'
};

class BasePlugin {
  constructor(manifest, pluginPath) {
    this.manifest = manifest;
    this.name = manifest.name;
    this.version = manifest.version;
    this.description = manifest.description || '';
    this.type = manifest.type;
    this.author = manifest.author || '';
    this.configSchema = manifest.configSchema || {};
    this.state = PLUGIN_STATES.UNLOADED;
    this.pluginPath = pluginPath;
    this.instance = null;
    this.config = {};
    this.error = null;
  }

  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  async enable() {
    if (this.state !== PLUGIN_STATES.LOADED && this.state !== PLUGIN_STATES.DISABLED) {
      throw new Error(`Cannot enable plugin in state: ${this.state}`);
    }
    this.state = PLUGIN_STATES.ENABLED;
  }

  async disable() {
    if (this.state !== PLUGIN_STATES.ENABLED) {
      throw new Error(`Cannot disable plugin in state: ${this.state}`);
    }
    this.state = PLUGIN_STATES.DISABLED;
  }

  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      type: this.type,
      author: this.author,
      state: this.state,
      configSchema: this.configSchema
    };
  }

  validateConfig(config) {
    for (const [key, schema] of Object.entries(this.configSchema)) {
      if (schema.required && (config[key] === undefined || config[key] === null)) {
        throw new Error(`Missing required config: ${key}`);
      }
      if (config[key] !== undefined) {
        if (schema.type && typeof config[key] !== schema.type) {
          throw new Error(`Invalid type for ${key}: expected ${schema.type}`);
        }
        if (schema.enum && !schema.enum.includes(config[key])) {
          throw new Error(`Invalid value for ${key}: must be one of ${schema.enum.join(', ')}`);
        }
      }
    }
    return true;
  }
}

class PanelPlugin extends BasePlugin {
  constructor(manifest, pluginPath) {
    super(manifest, pluginPath);
    this.component = null;
    this.renderMethod = null;
  }

  async initialize() {
    if (!this.manifest.component) {
      throw new Error('Panel plugin must specify component in manifest');
    }
    this.component = this.manifest.component;
    this.renderMethod = this.manifest.renderMethod || 'default';
    this.state = PLUGIN_STATES.LOADED;
  }

  getComponentInfo() {
    return {
      component: this.component,
      renderMethod: this.renderMethod,
      props: this.manifest.props || {}
    };
  }
}

class NotificationPlugin extends BasePlugin {
  constructor(manifest, pluginPath) {
    super(manifest, pluginPath);
    this.channelName = manifest.channelName || manifest.name;
  }

  async initialize() {
    if (!this.send || typeof this.send !== 'function') {
      throw new Error('Notification plugin must implement send method');
    }
    this.state = PLUGIN_STATES.LOADED;
  }

  async send(message, options = {}) {
    throw new Error('send() must be implemented by notification plugin');
  }

  async test(config) {
    throw new Error('test() must be implemented by notification plugin');
  }

  getChannelInfo() {
    return {
      channelName: this.channelName,
      supportedFormats: this.manifest.supportedFormats || ['text']
    };
  }
}

class DatasourcePlugin extends BasePlugin {
  constructor(manifest, pluginPath) {
    super(manifest, pluginPath);
    this.queryMethod = null;
  }

  async initialize() {
    if (!this.query || typeof this.query !== 'function') {
      throw new Error('Datasource plugin must implement query method');
    }
    this.state = PLUGIN_STATES.LOADED;
  }

  async query(queryString, options = {}) {
    throw new Error('query() must be implemented by datasource plugin');
  }

  async test(config) {
    throw new Error('test() must be implemented by datasource plugin');
  }

  getSchema() {
    return this.manifest.schema || { fields: [] };
  }
}

function createPlugin(manifest, pluginPath) {
  switch (manifest.type) {
    case PLUGIN_TYPES.PANEL:
      return new PanelPlugin(manifest, pluginPath);
    case PLUGIN_TYPES.NOTIFICATION:
      return new NotificationPlugin(manifest, pluginPath);
    case PLUGIN_TYPES.DATASOURCE:
      return new DatasourcePlugin(manifest, pluginPath);
    default:
      throw new Error(`Unknown plugin type: ${manifest.type}`);
  }
}

function validateManifest(manifest) {
  const required = ['name', 'version', 'type'];
  for (const field of required) {
    if (!manifest[field]) {
      throw new Error(`Missing required field in manifest: ${field}`);
    }
  }

  if (!Object.values(PLUGIN_TYPES).includes(manifest.type)) {
    throw new Error(`Invalid plugin type: ${manifest.type}`);
  }

  return true;
}

module.exports = {
  PLUGIN_TYPES,
  PLUGIN_STATES,
  BasePlugin,
  PanelPlugin,
  NotificationPlugin,
  DatasourcePlugin,
  createPlugin,
  validateManifest
};
