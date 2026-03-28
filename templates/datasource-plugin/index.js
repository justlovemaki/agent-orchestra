'use strict';

class {{PLUGIN_NAME_PASCAL}}Datasource {
  constructor(config = {}) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.example.com';
    this.timeout = config.timeout || 30000;
    this.cacheEnabled = config.cacheEnabled !== false;
    this.cache = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (!this.apiKey) {
      throw new Error('apiKey is required');
    }
    this.initialized = true;
    return this;
  }

  async query(queryString, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const cacheKey = `query:${queryString}:${JSON.stringify(options)}`;
    
    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < (options.cacheAge || 60000)) {
        return cached.data;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/query?q=${encodeURIComponent(queryString)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (this.cacheEnabled) {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }

      return data;
    } catch (error) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  async test(config = {}) {
    const testConfig = { ...this.config, ...config };
    const testPlugin = new {{PLUGIN_NAME_PASCAL}}Datasource(testConfig);
    
    await testPlugin.initialize();
    
    try {
      const result = await testPlugin.query('test', { cacheAge: 0 });
      return {
        success: true,
        message: 'Connection test successful',
        details: result
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
        details: null
      };
    }
  }

  getSchema() {
    return {
      fields: [
        { name: 'id', type: 'string', description: 'Unique identifier' },
        { name: 'name', type: 'string', description: 'Display name' },
        { name: 'value', type: 'number', description: 'Current value' },
        { name: 'timestamp', type: 'timestamp', description: 'Data timestamp' }
      ]
    };
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = function(config) {
  return new {{PLUGIN_NAME_PASCAL}}Datasource(config);
};

module.exports.{{PLUGIN_NAME_PASCAL}}Datasource = {{PLUGIN_NAME_PASCAL}}Datasource;
