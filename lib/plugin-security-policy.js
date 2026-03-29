'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const PERMISSION_LEVELS = {
  TRUSTED: 'trusted',
  RESTRICTED: 'restricted',
  SANDBOXED: 'sandboxed'
};

const PERMISSION_MATRIX = {
  [PERMISSION_LEVELS.TRUSTED]: {
    filesystem: { read: true, write: true, delete: true },
    network: { http: true, https: true, ws: true, wss: true },
    environment: { read: true, write: true },
    process: { exit: true, kill: true, fork: true },
    modules: ['*']
  },
  [PERMISSION_LEVELS.RESTRICTED]: {
    filesystem: { read: ['./data/**', './plugins/**'], write: ['./data/**'], delete: false },
    network: { http: false, https: true, ws: false, wss: true },
    environment: { read: true, write: false },
    process: { exit: false, kill: false, fork: false },
    modules: ['path', 'fs', 'crypto', 'url']
  },
  [PERMISSION_LEVELS.SANDBOXED]: {
    filesystem: { read: false, write: false, delete: false },
    network: { http: false, https: false, ws: false, wss: false },
    environment: { read: false, write: false },
    process: { exit: false, kill: false, fork: false },
    modules: []
  }
};

const DANGEROUS_PATTERNS = [
  { pattern: /process\.exit\s*\(/g, name: 'process.exit', severity: 'high' },
  { pattern: /process\.kill\s*\(/g, name: 'process.kill', severity: 'high' },
  { pattern: /child_process/g, name: 'child_process', severity: 'critical' },
  { pattern: /eval\s*\(/g, name: 'eval', severity: 'critical' },
  { pattern: /Function\s*\(/g, name: 'Function constructor', severity: 'critical' },
  { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/g, name: 'require child_process', severity: 'critical' },
  { pattern: /require\s*\(\s*['"]fs['"]\s*\)/g, name: 'require fs', severity: 'high' },
  { pattern: /__dirname/g, name: '__dirname', severity: 'medium' },
  { pattern: /__filename/g, name: '__filename', severity: 'medium' },
  { pattern: /process\.env/g, name: 'process.env', severity: 'high' },
  { pattern: /process\.cwd\s*\(\s*\)/g, name: 'process.cwd', severity: 'medium' },
  { pattern: /setTimeout\s*\(\s*['"]/g, name: 'setTimeout string', severity: 'medium' },
  { pattern: /setInterval\s*\(\s*['"]/g, name: 'setInterval string', severity: 'medium' },
  { pattern: /constructor\.prototype__defineGetter__/g, name: 'prototype pollution', severity: 'high' },
  { pattern: /constructor\.prototype__defineSetter__/g, name: 'prototype pollution', severity: 'high' },
  { pattern: /\.\.\//g, name: 'path traversal', severity: 'medium' },
  { pattern: /process\s*\./g, name: 'process access', severity: 'high' },
  { pattern: /global\./g, name: 'global access', severity: 'medium' },
  { pattern: /globalThis\./g, name: 'globalThis access', severity: 'medium' },
  { pattern: /Buffer\./g, name: 'Buffer access', severity: 'medium' }
];

class SecurityPolicy extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.permissionLevel = options.permissionLevel || PERMISSION_LEVELS.SANDBOXED;
    this.name = options.name || 'default';
    
    this.filesystemRules = options.filesystemRules || PERMISSION_MATRIX[this.permissionLevel].filesystem;
    this.networkRules = options.networkRules || PERMISSION_MATRIX[this.permissionLevel].network;
    this.environmentRules = options.environmentRules || PERMISSION_MATRIX[this.permissionLevel].environment;
    this.processRules = options.processRules || PERMISSION_MATRIX[this.permissionLevel].process;
    this.allowedModules = options.allowedModules || PERMISSION_MATRIX[this.permissionLevel].modules;
    
    this.dangerousPatternCheck = options.dangerousPatternCheck !== false;
    this.strictMode = options.strictMode !== false;
    
    this.customRules = options.customRules || [];
    this.auditLog = [];
  }

  validateCode(code, context = {}) {
    // 信任级别跳过危险模式检测
    if (this.dangerousPatternCheck && this.permissionLevel !== 'trusted') {
      this._checkDangerousPatterns(code);
    }
    
    this._checkModuleAccess(code);
    
    for (const rule of this.customRules) {
      if (!rule.validate(code, context)) {
        throw new Error(`Custom security rule failed: ${rule.name}`);
      }
    }
    
    this._logAudit('code_validated', { context });
    return true;
  }

  _checkDangerousPatterns(code) {
    const violations = [];
    
    for (const { pattern, name, severity } of DANGEROUS_PATTERNS) {
      const matches = code.match(pattern);
      if (matches) {
        violations.push({
          pattern: name,
          severity,
          count: matches.length,
          matches: matches.slice(0, 3)
        });
      }
    }
    
    if (violations.length > 0) {
      const critical = violations.filter(v => v.severity === 'critical');
      const high = violations.filter(v => v.severity === 'high');
      const medium = violations.filter(v => v.severity === 'medium');
      
      // 在 sandboxed 模式下，所有级别的违规都抛出错误
      // 在 strict 模式下，high 及以上级别抛出错误
      // 默认只阻止 critical 级别
      if (critical.length > 0 || 
          (this.strictMode && high.length > 0) ||
          (this.permissionLevel === 'sandboxed' && medium.length > 0)) {
        this._logAudit('security_violation', { violations });
        throw new Error(
          `Security violation detected: ${violations.map(v => v.pattern).join(', ')}`
        );
      }
      
      this.emit('securityWarning', { violations });
    }
    
    return violations;
  }

  _checkModuleAccess(code) {
    if (this.permissionLevel === PERMISSION_LEVELS.TRUSTED) {
      return;
    }
    
    const requireMatches = code.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    if (!requireMatches) {
      return;
    }
    
    const deniedModules = [];
    for (const match of requireMatches) {
      const moduleMatch = match.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (moduleMatch) {
        const moduleName = moduleMatch[1];
        
        if (this.allowedModules.includes('*')) {
          continue;
        }
        
        if (!this.allowedModules.includes(moduleName)) {
          const baseModule = moduleName.split('/')[0];
          if (!this.allowedModules.includes(baseModule)) {
            deniedModules.push(moduleName);
          }
        }
      }
    }
    
    if (deniedModules.length > 0) {
      throw new Error(`Module access denied: ${deniedModules.join(', ')}`);
    }
  }

  canAccessFilesystem(operation, filePath) {
    const rules = this.filesystemRules;
    
    if (rules[operation] === true) {
      return true;
    }
    
    if (rules[operation] === false) {
      return false;
    }
    
    if (Array.isArray(rules[operation])) {
      for (const allowed of rules[operation]) {
        if (this._matchPath(filePath, allowed)) {
          return true;
        }
      }
    }
    
    this._logAudit('filesystem_access_denied', { operation, filePath });
    return false;
  }

  canAccessNetwork(protocol) {
    const allowed = this.networkRules[protocol];
    
    if (allowed === true) {
      return true;
    }
    
    if (allowed === false) {
      this._logAudit('network_access_denied', { protocol });
      return false;
    }
    
    return false;
  }

  canAccessEnvironment(operation) {
    const allowed = this.environmentRules[operation];
    
    if (allowed === true) {
      return true;
    }
    
    if (allowed === false) {
      this._logAudit('environment_access_denied', { operation });
      return false;
    }
    
    return false;
  }

  canAccessProcess(operation) {
    const allowed = this.processRules[operation];
    
    if (allowed === true) {
      return true;
    }
    
    if (allowed === false) {
      this._logAudit('process_access_denied', { operation });
      return false;
    }
    
    return false;
  }

  _matchPath(filePath, pattern) {
    if (pattern === '*' || pattern === '**') {
      return true;
    }
    
    const normalizedPath = path.normalize(filePath);
    const normalizedPattern = path.normalize(pattern);
    
    if (normalizedPath.startsWith(normalizedPattern.replace('**', ''))) {
      return true;
    }
    
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    
    return new RegExp(`^${regexPattern}$`).test(normalizedPath);
  }

  getPermissionLevel() {
    return this.permissionLevel;
  }

  setPermissionLevel(level) {
    if (!Object.values(PERMISSION_LEVELS).includes(level)) {
      throw new Error(`Invalid permission level: ${level}`);
    }
    
    this.permissionLevel = level;
    const matrix = PERMISSION_MATRIX[level];
    this.filesystemRules = matrix.filesystem;
    this.networkRules = matrix.network;
    this.environmentRules = matrix.environment;
    this.processRules = matrix.process;
    this.allowedModules = matrix.modules;
    
    this._logAudit('permission_level_changed', { newLevel: level });
  }

  addCustomRule(rule) {
    this.customRules.push(rule);
  }

  removeCustomRule(ruleName) {
    this.customRules = this.customRules.filter(r => r.name !== ruleName);
  }

  getAuditLog() {
    return [...this.auditLog];
  }

  clearAuditLog() {
    this.auditLog = [];
  }

  _logAudit(action, details) {
    const entry = {
      timestamp: Date.now(),
      policyName: this.name,
      permissionLevel: this.permissionLevel,
      action,
      details
    };
    
    this.auditLog.push(entry);
    this.emit('audit', entry);
  }

  getPermissions() {
    return {
      level: this.permissionLevel,
      filesystem: this.filesystemRules,
      network: this.networkRules,
      environment: this.environmentRules,
      process: this.processRules,
      allowedModules: this.allowedModules
    };
  }

  serialize() {
    return {
      name: this.name,
      permissionLevel: this.permissionLevel,
      permissions: this.getPermissions(),
      customRulesCount: this.customRules.length,
      auditLogCount: this.auditLog.length
    };
  }

  static createFromLevel(level) {
    return new SecurityPolicy({ permissionLevel: level });
  }

  static getPermissionLevels() {
    return { ...PERMISSION_LEVELS };
  }
}

function createSecurityPolicy(options = {}) {
  return new SecurityPolicy(options);
}

module.exports = {
  SecurityPolicy,
  PERMISSION_LEVELS,
  PERMISSION_MATRIX,
  DANGEROUS_PATTERNS,
  createSecurityPolicy
};
