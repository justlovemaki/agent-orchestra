'use strict';

const fs = require('fs').promises;
const path = require('path');

class TemplateManager {
  constructor(options = {}) {
    this.templatesDir = options.templatesDir || path.join(__dirname, '../../templates');
  }

  async listTemplates() {
    const templates = [];
    
    try {
      const entries = await fs.readdir(this.templatesDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.endsWith('-plugin')) {
          const templateName = entry.name.replace('-plugin', '');
          const templateDir = path.join(this.templatesDir, entry.name);
          
          const info = await this.getTemplateInfo(templateDir, templateName);
          templates.push(info);
        }
      }
    } catch (err) {
      throw new Error(`Failed to list templates: ${err.message}`);
    }
    
    return templates;
  }

  async getTemplateInfo(templateDir, templateName) {
    const info = {
      name: templateName,
      dir: templateDir,
      description: '',
      type: '',
      files: []
    };

    const manifestPath = path.join(templateDir, 'manifest.json');
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);
      info.description = manifest.description || `${templateName} plugin template`;
      info.type = manifest.type || 'unknown';
    } catch {
      info.description = `${templateName} plugin template`;
    }

    try {
      const files = await fs.readdir(templateDir);
      info.files = files.filter(f => !f.startsWith('.'));
    } catch {
    }

    return info;
  }

  async getTemplate(templateName) {
    const templateDir = path.join(this.templatesDir, `${templateName}-plugin`);
    
    try {
      await fs.access(templateDir);
    } catch {
      throw new Error(`Template not found: ${templateName}`);
    }

    return this.getTemplateInfo(templateDir, templateName);
  }

  async templateExists(templateName) {
    const templateDir = path.join(this.templatesDir, `${templateName}-plugin`);
    
    try {
      await fs.access(templateDir);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = TemplateManager;
