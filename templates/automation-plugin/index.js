'use strict';

class {{PLUGIN_NAME_PASCAL}}Automation {
  constructor(manifest, config = {}) {
    this.manifest = manifest;
    this.config = config;
    this.enabled = config.enabled !== false;
    this.schedule = config.schedule || manifest.trigger?.cron || '0 * * * *';
    this.retryCount = config.retryCount || 3;
    this.retryDelay = config.retryDelay || 5000;
    this.eventTypes = manifest.eventTypes || [];
    this.state = 'idle';
    this.lastRun = null;
    this.lastResult = null;
    this.scheduledTask = null;
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    return this;
  }

  async execute(context = {}) {
    if (!this.enabled) {
      return {
        success: false,
        skipped: true,
        message: 'Automation is disabled'
      };
    }

    this.state = 'running';
    let lastError = null;

    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        const result = await this.runAutomation(context);
        
        this.state = 'idle';
        this.lastRun = new Date().toISOString();
        this.lastResult = result;
        
        return {
          success: true,
          result,
          attempts: attempt + 1,
          timestamp: this.lastRun
        };
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryCount) {
          await this.delay(this.retryDelay);
        }
      }
    }

    this.state = 'error';
    this.lastRun = new Date().toISOString();
    this.lastResult = { error: lastError.message };
    
    return {
      success: false,
      error: lastError.message,
      attempts: this.retryCount + 1,
      timestamp: this.lastRun
    };
  }

  async runAutomation(context) {
    const results = {
      processed: 0,
      actions: [],
      timestamp: new Date().toISOString()
    };

    results.actions.push({
      type: 'log',
      message: `Automation {{PLUGIN_NAME_PASCAL}} executed`
    });

    results.processed = results.actions.length;
    
    return results;
  }

  async validate(config) {
    const errors = [];
    const warnings = [];

    if (config.schedule && !this.isValidCron(config.schedule)) {
      errors.push('Invalid cron expression');
    }

    if (config.retryCount < 0) {
      errors.push('retryCount must be non-negative');
    }

    if (config.retryDelay < 0) {
      errors.push('retryDelay must be non-negative');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  isValidCron(expression) {
    const parts = expression.split(' ');
    return parts.length === 5 || parts.length === 6;
  }

  async onEvent(eventType, payload) {
    if (!this.eventTypes.includes(eventType)) {
      return null;
    }

    return await this.execute({
      event: eventType,
      payload,
      timestamp: new Date().toISOString()
    });
  }

  enable() {
    this.enabled = true;
    return { success: true, message: 'Automation enabled' };
  }

  disable() {
    this.enabled = false;
    return { success: true, message: 'Automation disabled' };
  }

  getStatus() {
    return {
      enabled: this.enabled,
      state: this.state,
      schedule: this.schedule,
      lastRun: this.lastRun,
      lastResult: this.lastResult,
      eventTypes: this.eventTypes
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = {{PLUGIN_NAME_PASCAL}}Automation;
