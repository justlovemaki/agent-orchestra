'use strict';

class {{PLUGIN_NAME_PASCAL}}Panel {
  constructor(manifest, config = {}) {
    this.manifest = manifest;
    this.config = config;
    this.component = manifest.component || '{{PLUGIN_NAME_CAMEL}}-panel';
    this.renderMethod = manifest.renderMethod || 'default';
    this.props = manifest.props || {};
    this.refreshInterval = config.refreshInterval || this.props.refreshInterval || 30000;
    this.showHeader = config.showHeader !== undefined ? config.showHeader : this.props.showHeader !== false;
    this.dataSource = config.dataSource || this.props.dataSource || null;
    this.data = null;
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    await this.fetchData();
    return this;
  }

  async fetchData() {
    try {
      if (this.dataSource) {
        const datasource = require('./datasource') || {};
        if (datasource.query) {
          this.data = await datasource.query('default');
        }
      }
      
      if (!this.data) {
        this.data = this.getDefaultData();
      }
    } catch (error) {
      console.error('Failed to fetch panel data:', error);
      this.data = { error: error.message };
    }
  }

  getDefaultData() {
    return {
      items: [],
      total: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  async render(container) {
    if (!this.initialized) {
      await this.initialize();
    }

    const html = this.generateHTML();
    
    if (container) {
      container.innerHTML = html;
      this.attachEventHandlers(container);
    }
    
    return html;
  }

  generateHTML() {
    const headerHtml = this.showHeader ? `
      <div class="panel-header">
        <span class="panel-icon">${this.props.icon || '📊'}</span>
        <span class="panel-title">${this.props.title || 'Panel'}</span>
      </div>
    ` : '';

    return `
      <div class="{{PLUGIN_NAME_CAMEL}}-panel panel" data-component="${this.component}">
        ${headerHtml}
        <div class="panel-content">
          ${this.generateContent()}
        </div>
        <div class="panel-footer">
          <span class="last-updated">Last updated: ${this.data?.lastUpdated || 'N/A'}</span>
        </div>
      </div>
    `;
  }

  generateContent() {
    if (this.data?.error) {
      return `<div class="panel-error">${this.data.error}</div>`;
    }

    return `
      <div class="panel-placeholder">
        <p>Configure this panel with a data source</p>
        <button class="configure-btn">Configure</button>
      </div>
    `;
  }

  attachEventHandlers(container) {
    const configureBtn = container.querySelector('.configure-btn');
    if (configureBtn) {
      configureBtn.addEventListener('click', () => {
        this.emit('configure', { panel: this.component });
      });
    }
  }

  async refresh() {
    await this.fetchData();
    return this.data;
  }

  on(event, callback) {
    if (!this.eventHandlers) {
      this.eventHandlers = {};
    }
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(callback);
  }

  emit(event, data) {
    if (this.eventHandlers && this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(cb => cb(data));
    }
  }

  getMetadata() {
    return {
      component: this.component,
      renderMethod: this.renderMethod,
      props: {
        ...this.props,
        refreshInterval: this.refreshInterval,
        showHeader: this.showHeader
      }
    };
  }
}

module.exports = {{PLUGIN_NAME_PASCAL}}Panel;
