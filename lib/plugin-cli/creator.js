'use strict';

const fs = require('fs').promises;
const path = require('path');

class PluginCreator {
  constructor(options = {}) {
    this.templatesDir = options.templatesDir || path.join(__dirname, '../../templates');
    this.outputDir = options.outputDir || process.cwd();
  }

  async createPlugin(name, templateType, options = {}) {
    if (!name || !this.isValidPluginName(name)) {
      throw new Error(`Invalid plugin name: ${name}. Use lowercase letters, numbers, and hyphens only.`);
    }

    const templateDir = path.join(this.templatesDir, `${templateType}-plugin`);
    
    try {
      await fs.access(templateDir);
    } catch {
      throw new Error(`Template not found: ${templateType}-plugin`);
    }

    const pluginDir = path.join(this.outputDir, name);
    
    try {
      await fs.access(pluginDir);
      throw new Error(`Plugin directory already exists: ${name}`);
    } catch {
      if (options.force) {
        await fs.rm(pluginDir, { recursive: true, force: true });
      } else {
      }
    }

    await fs.mkdir(pluginDir, { recursive: true });
    await this.copyTemplate(templateDir, pluginDir, name, options);

    return {
      success: true,
      pluginDir,
      name,
      template: templateType
    };
  }

  isValidPluginName(name) {
    return /^[a-z0-9-]+$/.test(name) && name.length >= 3;
  }

  async copyTemplate(srcDir, destDir, pluginName, options) {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      
      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await this.copyTemplate(srcPath, destPath, pluginName, options);
      } else {
        let content = await fs.readFile(srcPath, 'utf-8');
        content = this.processTemplate(content, pluginName, options);
        await fs.writeFile(destPath, content, 'utf-8');
      }
    }
  }

  processTemplate(content, pluginName, options) {
    const date = new Date().toISOString().split('T')[0];
    const author = options.author || 'Plugin Developer';
    
    return content
      .replace(/\{\{PLUGIN_NAME\}\}/g, pluginName)
      .replace(/\{\{PLUGIN_NAME_CAMEL\}\}/g, this.toCamelCase(pluginName))
      .replace(/\{\{PLUGIN_NAME_PASCAL\}\}/g, this.toPascalCase(pluginName))
      .replace(/\{\{AUTHOR\}\}/g, author)
      .replace(/\{\{DATE\}\}/g, date)
      .replace(/\{\{VERSION\}\}/g, options.version || '1.0.0');
  }

  toCamelCase(str) {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  toPascalCase(str) {
    return str.replace(/(^|-)([a-z])/g, (_, dash, letter) => letter.toUpperCase());
  }

  async listTemplates() {
    const templates = [];
    const entries = await fs.readdir(this.templatesDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.endsWith('-plugin')) {
        const templateName = entry.name.replace('-plugin', '');
        const manifestPath = path.join(this.templatesDir, entry.name, 'manifest.json');
        
        try {
          const manifestContent = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(manifestContent);
          templates.push({
            name: templateName,
            description: manifest.description || '',
            type: manifest.type || 'unknown'
          });
        } catch {
          templates.push({
            name: templateName,
            description: 'Template files',
            type: 'unknown'
          });
        }
      }
    }
    
    return templates;
  }
}

module.exports = PluginCreator;
