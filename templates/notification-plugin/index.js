'use strict';

class {{PLUGIN_NAME_PASCAL}}Plugin {
  constructor(config = {}) {
    this.config = config;
    this.channelName = config.channelName || '{{PLUGIN_NAME_PASCAL}}';
    this.webhookUrl = config.webhookUrl;
    this.channel = config.channel || 'general';
    this.username = config.username || 'Agent Orchestra';
    this.initialized = false;
  }

  async initialize() {
    if (!this.webhookUrl) {
      throw new Error('webhookUrl is required');
    }
    this.initialized = true;
    return this;
  }

  async send(message, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const payload = {
      text: message,
      channel: options.channel || this.channel,
      username: options.username || this.username,
      icon_emoji: options.icon || ':robot:'
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        messageId: `msg_${Date.now()}`,
        channel: payload.channel
      };
    } catch (error) {
      throw new Error(`Failed to send notification: ${error.message}`);
    }
  }

  async test(config = {}) {
    const testConfig = { ...this.config, ...config };
    const testPlugin = new {{PLUGIN_NAME_PASCAL}}Plugin(testConfig);
    
    await testPlugin.initialize();
    
    const result = await testPlugin.send('🔔 Test notification from Agent Orchestra plugin', {
      channel: testConfig.channel || 'test'
    });
    
    return {
      success: true,
      message: 'Test notification sent successfully',
      details: result
    };
  }

  getChannelInfo() {
    return {
      channelName: this.channelName,
      supportedFormats: ['text', 'markdown'],
      capabilities: ['dm', 'channel', 'webhook'],
      maxMessageLength: 4000
    };
  }
}

module.exports = function(config) {
  return new {{PLUGIN_NAME_PASCAL}}Plugin(config);
};

module.exports.{{PLUGIN_NAME_PASCAL}}Plugin = {{PLUGIN_NAME_PASCAL}}Plugin;
