'use strict';

const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const SANDBOX_TIMEOUT_DEFAULT = 30000;
const SANDBOX_MEMORY_LIMIT_DEFAULT = 128 * 1024 * 1024;
const SANDBOX_CPU_LIMIT_DEFAULT = 5000;

class SandboxTimeoutError extends Error {
  constructor(message = 'Sandbox execution timeout') {
    super(message);
    this.name = 'SandboxTimeoutError';
    this.code = 'SANDBOX_TIMEOUT';
  }
}

class SandboxMemoryError extends Error {
  constructor(message = 'Sandbox memory limit exceeded') {
    super(message);
    this.name = 'SandboxMemoryError';
    this.code = 'SANDBOX_MEMORY_LIMIT';
  }
}

class SandboxCPULimitError extends Error {
  constructor(message = 'Sandbox CPU time limit exceeded') {
    super(message);
    this.name = 'SandboxCPULimitError';
    this.code = 'SANDBOX_CPU_LIMIT';
  }
}

class SandboxAccessDeniedError extends Error {
  constructor(message = 'Access denied by security policy') {
    super(message);
    this.name = 'SandboxAccessDeniedError';
    this.code = 'SANDBOX_ACCESS_DENIED';
  }
}

const DEFAULT_API_WHITELIST = {
  console: ['log', 'warn', 'error', 'info', 'debug'],
  JSON: ['stringify', 'parse'],
  Math: ['abs', 'ceil', 'floor', 'max', 'min', 'pow', 'random', 'round', 'sqrt'],
  Date: ['now', 'parse', 'UTC'],
  Array: ['isArray', 'from', 'of'],
  Object: ['keys', 'values', 'entries', 'assign', 'create'],
  String: ['fromCharCode', 'prototype'],
  Number: ['isFinite', 'isNaN', 'parseInt', 'parseFloat'],
  RegExp: ['prototype'],
  Promise: ['prototype'],
  Map: ['prototype'],
  Set: ['prototype']
};

function createSafeConsole() {
  const logs = [];
  const safeConsole = {
    log: (...args) => logs.push({ level: 'log', args: args.map(String), timestamp: Date.now() }),
    warn: (...args) => logs.push({ level: 'warn', args: args.map(String), timestamp: Date.now() }),
    error: (...args) => logs.push({ level: 'error', args: args.map(String), timestamp: Date.now() }),
    info: (...args) => logs.push({ level: 'info', args: args.map(String), timestamp: Date.now() }),
    debug: (...args) => logs.push({ level: 'debug', args: args.map(String), timestamp: Date.now() }),
    _getLogs: () => logs,
    _clearLogs: () => logs.length = 0
  };
  return safeConsole;
}

function createSafeGlobal(apiWhitelist, customAPI = {}) {
  const safeGlobal = {
    console: createSafeConsole(),
    JSON: DEFAULT_API_WHITELIST.JSON ? {
      stringify: JSON.stringify,
      parse: JSON.parse
    } : {},
    Math: DEFAULT_API_WHITELIST.Math ? {
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
      max: Math.max,
      min: Math.min,
      pow: Math.pow,
      random: Math.random,
      round: Math.round,
      sqrt: Math.sqrt
    } : {},
    Date: DEFAULT_API_WHITELIST.Date ? {
      now: Date.now,
      parse: Date.parse,
      UTC: Date.UTC
    } : {},
    Array: DEFAULT_API_WHITELIST.Array ? {
      isArray: Array.isArray,
      from: Array.from,
      of: Array.of
    } : {},
    Object: DEFAULT_API_WHITELIST.Object ? {
      keys: Object.keys,
      values: Object.values,
      entries: Object.entries,
      assign: Object.assign,
      create: Object.create
    } : {},
    String: DEFAULT_API_WHITELIST.String ? {
      fromCharCode: String.fromCharCode
    } : {},
    Number: DEFAULT_API_WHITELIST.Number ? {
      isFinite: Number.isFinite,
      isNaN: Number.isNaN,
      parseInt: parseInt,
      parseFloat: parseFloat
    } : {},
    RegExp: DEFAULT_API_WHITELIST.RegExp ? {
      prototype: RegExp.prototype
    } : {},
    Promise: DEFAULT_API_WHITELIST.Promise ? {
      prototype: Promise.prototype
    } : {},
    Map: DEFAULT_API_WHITELIST.Map ? {
      prototype: Map.prototype
    } : {},
    Set: DEFAULT_API_WHITELIST.Set ? {
      prototype: Set.prototype
    } : {},
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined: undefined,
    NaN: NaN,
    Infinity: Infinity,
    Symbol: Symbol,
    BigInt: BigInt,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Function,
    Error,
    TypeError,
    ReferenceError,
    SyntaxError,
    RangeError,
    URIError,
    Math,
    Date,
    JSON,
    Reflect: {},
    Proxy: {},
    ...customAPI
  };

  safeGlobal.globalThis = safeGlobal;
  safeGlobal.global = safeGlobal;
  safeGlobal.self = safeGlobal;

  return safeGlobal;
}

class PluginSandbox extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.id = options.id || crypto.randomBytes(8).toString('hex');
    this.pluginName = options.pluginName || 'unknown';
    this.timeout = options.timeout || SANDBOX_TIMEOUT_DEFAULT;
    this.memoryLimit = options.memoryLimit || SANDBOX_MEMORY_LIMIT_DEFAULT;
    this.cpuLimit = options.cpuLimit || SANDBOX_CPU_LIMIT_DEFAULT;
    this.apiWhitelist = { ...DEFAULT_API_WHITELIST, ...options.apiWhitelist };
    this.customAPI = options.customAPI || {};
    this.useWorkerThreads = options.useWorkerThreads !== false;
    this.enableLogging = options.enableLogging !== false;
    
    this.worker = null;
    this.executionContext = null;
    this.isRunning = false;
    this.startTime = null;
    this.logs = [];
    this.securityPolicy = options.securityPolicy || null;
    
    this.timeoutTimer = null;
    this.healthCheckTimer = null;
  }

  initialize() {
    if (this.useWorkerThreads) {
      return this._initializeWorker();
    } else {
      return this._initializeVM();
    }
  }

  _initializeWorker() {
    const workerCode = `
      const { parentPort, workerData } = require('worker_threads');
      
      parentPort.on('message', async (message) => {
        try {
          const { code, apiWhitelist, customAPI, context } = message;
          
          const safeGlobal = (function() {
            const whitelist = apiWhitelist || {};
            const custom = customAPI || {};
            
            const allowed = {
              console: {
                log: console.log.bind(console),
                warn: console.warn.bind(console),
                error: console.error.bind(console),
                info: console.info.bind(console),
                debug: console.debug.bind(console)
              },
              JSON: { stringify: JSON.stringify, parse: JSON.parse },
              Math: { abs: Math.abs, ceil: Math.ceil, floor: Math.floor, max: Math.max, min: Math.min, pow: Math.pow, random: Math.random, round: Math.round, sqrt: Math.sqrt },
              Date: { now: Date.now, parse: Date.parse, UTC: Date.UTC },
              Array: { isArray: Array.isArray, from: Array.from, of: Array.of },
              Object: { keys: Object.keys, values: Object.values, entries: Object.entries, assign: Object.assign, create: Object.create },
              parseInt, parseFloat, isNaN, isFinite,
              undefined, NaN, Infinity,
              Symbol, BigInt, Array, Object, String, Number, Boolean, Function,
              Error, TypeError, ReferenceError, SyntaxError, RangeError, URIError,
              Math, JSON, Reflect, Proxy
            };
            
            return new Proxy(allowed, {
              get(target, prop) {
                if (prop in target) return target[prop];
                if (prop === 'global' || prop === 'globalThis' || prop === 'self') return allowed;
                return undefined;
              }
            });
          })();
          
          const vmContext = vm.createContext(safeGlobal);
          
          let result;
          try {
            const script = new vm.Script(code, { filename: 'plugin-sandbox.js' });
            result = script.runInContext(vmContext, { timeout: workerData.timeout || 30000 });
          } catch (vmError) {
            parentPort.postMessage({ error: { message: vmError.message, name: vmError.name } });
            return;
          }
          
          if (result && typeof result.then === 'function') {
            result = await result;
          }
          
          parentPort.postMessage({ result });
        } catch (error) {
          parentPort.postMessage({ error: { message: error.message, name: error.name, stack: error.stack } });
        }
      });
    `;

    const workerPath = path.join(__dirname, 'sandbox-worker-' + this.id + '.js');
    fs.writeFileSync(workerPath, workerCode);
    this.workerScriptPath = workerPath;

    return Promise.resolve();
  }

  _initializeVM() {
    this.executionContext = vm.createContext(createSafeGlobal(this.apiWhitelist, this.customAPI));
    return Promise.resolve();
  }

  async execute(code, context = {}) {
    if (this.isRunning) {
      throw new Error('Sandbox is already executing');
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.logs = [];

    const safeContext = createSafeGlobal(this.apiWhitelist, {
      ...this.customAPI,
      _context: context
    });

    if (this.securityPolicy) {
      this.securityPolicy.validateCode(code);
    }

    return new Promise((resolve, reject) => {
      if (this.useWorkerThreads) {
        this._executeInWorker(code, context, resolve, reject);
      } else {
        this._executeInVM(code, context, safeContext, resolve, reject);
      }
    });
  }

  _executeInWorker(code, context, resolve, reject) {
    if (!this.worker) {
      try {
        this.worker = new Worker(this.workerScriptPath);
        this.worker.on('error', (error) => {
          this.isRunning = false;
          reject(error);
        });
        this.worker.on('exit', (code) => {
          if (code !== 0 && this.isRunning) {
            this.isRunning = false;
            reject(new Error(`Worker exited with code ${code}`));
          }
        });
      } catch (error) {
        this.isRunning = false;
        reject(error);
        return;
      }
    }

    this.timeoutTimer = setTimeout(() => {
      if (this.isRunning) {
        this.terminate();
        reject(new SandboxTimeoutError(`Execution timeout after ${this.timeout}ms`));
      }
    }, this.timeout);

    const messageHandler = (message) => {
      clearTimeout(this.timeoutTimer);
      this.isRunning = false;
      
      if (message.error) {
        const error = new Error(message.error.message);
        error.name = message.error.name;
        error.stack = message.error.stack;
        this.emit('error', error);
        reject(error);
      } else {
        resolve({
          result: message.result,
          logs: this.logs,
          executionTime: Date.now() - this.startTime
        });
      }
      
      this.worker.off('message', messageHandler);
    };

    this.worker.on('message', messageHandler);

    this.worker.postMessage({
      code,
      apiWhitelist: this.apiWhitelist,
      customAPI: this.customAPI,
      context,
      timeout: this.timeout
    });
  }

  _executeInVM(code, context, safeContext, resolve, reject) {
    this.timeoutTimer = setTimeout(() => {
      if (this.isRunning) {
        this.isRunning = false;
        reject(new SandboxTimeoutError(`Execution timeout after ${this.timeout}ms`));
      }
    }, this.timeout);

    try {
      const script = new vm.Script(code, {
        filename: `plugin-${this.pluginName}.js`
      });

      const result = script.runInContext(safeContext, {
        timeout: this.timeout,
        displayErrors: true
      });

      clearTimeout(this.timeoutTimer);
      this.isRunning = false;

      if (result && typeof result.then === 'function') {
        result.then(
          (asyncResult) => {
            resolve({
              result: asyncResult,
              logs: this.logs,
              executionTime: Date.now() - this.startTime
            });
          },
          (asyncError) => {
            reject(asyncError);
          }
        );
      } else {
        resolve({
          result,
          logs: this.logs,
          executionTime: Date.now() - this.startTime
        });
      }
    } catch (error) {
      clearTimeout(this.timeoutTimer);
      this.isRunning = false;
      
      if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        const timeoutError = new SandboxTimeoutError();
        this.emit('error', timeoutError);
        reject(timeoutError);
      } else {
        this.emit('error', error);
        reject(error);
      }
    }
  }

  addLog(level, message, data = {}) {
    const logEntry = {
      timestamp: Date.now(),
      level,
      message,
      pluginId: this.id,
      pluginName: this.pluginName,
      ...data
    };
    this.logs.push(logEntry);
    
    if (this.enableLogging) {
      console.log(`[Sandbox:${this.pluginName}] ${level}: ${message}`, data);
    }
    
    this.emit('log', logEntry);
    
    return logEntry;
  }

  getLogs() {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  getHealth() {
    return {
      id: this.id,
      pluginName: this.pluginName,
      isRunning: this.isRunning,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      timeout: this.timeout,
      memoryLimit: this.memoryLimit,
      cpuLimit: this.cpuLimit,
      workerThreads: this.useWorkerThreads
    };
  }

  terminate() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (this.workerScriptPath && fs.existsSync(this.workerScriptPath)) {
      try {
        fs.unlinkSync(this.workerScriptPath);
      } catch {}
    }

    this.isRunning = false;
    this.addLog('info', 'Sandbox terminated');
  }

  static create(options = {}) {
    const sandbox = new PluginSandbox(options);
    sandbox.initialize();
    return sandbox;
  }
}

module.exports = {
  PluginSandbox,
  SandboxTimeoutError,
  SandboxMemoryError,
  SandboxCPULimitError,
  SandboxAccessDeniedError,
  DEFAULT_API_WHITELIST,
  createSafeGlobal,
  createSafeConsole,
  SANDBOX_TIMEOUT_DEFAULT,
  SANDBOX_MEMORY_LIMIT_DEFAULT,
  SANDBOX_CPU_LIMIT_DEFAULT
};
