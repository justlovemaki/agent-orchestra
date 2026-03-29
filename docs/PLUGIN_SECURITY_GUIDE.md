# Agent Orchestra 插件安全指南

> 版本：1.0.0  
> 最后更新：2026-03-29

---

## 1. 概述

本文档详细介绍 Agent Orchestra 插件系统的安全架构，包括沙箱隔离、安全策略、权限控制等核心安全机制。

### 1.1 安全目标

- **进程隔离**：插件在独立进程中运行，防止插件崩溃影响主进程
- **资源限制**：限制 CPU、内存执行时间，防止恶意插件耗尽系统资源
- **API 白名单**：只暴露安全的 API，防止访问敏感系统功能
- **审计追踪**：记录所有安全相关事件，便于安全审计

---

## 2. 沙箱架构

### 2.1 沙箱类型

| 类型 | 实现方式 | 隔离级别 | 适用场景 |
|------|----------|----------|----------|
| VM 沙箱 | Node.js vm 模块 | 中 | 快速执行、轻量隔离 |
| Worker 沙箱 | Worker Threads | 高 | 生产环境、完全隔离 |

### 2.2 沙箱执行流程

```
主进程
  │
  ├── 创建 SandboxManager
  │
  ├── 为每个插件创建独立的 PluginSandbox
  │
  ├── Worker Threads (可选)
  │   └── 在独立线程中执行插件代码
  │
  ├── 设置超时计时器
  │
  └── 收集执行结果和日志
```

### 2.3 资源限制

| 资源 | 默认值 | 可配置 |
|------|--------|--------|
| 执行超时 | 30 秒 | 是 |
| 内存限制 | 128 MB | 是 |
| CPU 时间 | 5 秒 | 是 |
| 最大沙箱数 | 20 | 是 |

---

## 3. 安全策略

### 3.1 权限级别

Agent Orchestra 提供三个预定义的权限级别：

#### sandboxed（沙箱模式）

```javascript
{
  filesystem: { read: false, write: false, delete: false },
  network: { http: false, https: false, ws: false, wss: false },
  environment: { read: false, write: false },
  process: { exit: false, kill: false, fork: false },
  modules: []
}
```

**适用场景**：不受信任的第三方插件

#### restricted（受限模式）

```javascript
{
  filesystem: { read: ['./data/**', './plugins/**'], write: ['./data/**'], delete: false },
  network: { http: false, https: true, ws: false, wss: true },
  environment: { read: true, write: false },
  process: { exit: false, kill: false, fork: false },
  modules: ['path', 'fs', 'crypto', 'url']
}
```

**适用场景**：需要读取配置文件的插件

#### trusted（信任模式）

```javascript
{
  filesystem: { read: true, write: true, delete: true },
  network: { http: true, https: true, ws: true, wss: true },
  environment: { read: true, write: true },
  process: { exit: true, kill: true, fork: true },
  modules: ['*']
}
```

**适用场景**：核心系统插件、可完全信任的插件

### 3.2 自定义安全策略

```javascript
const { SecurityPolicy } = require('./lib/plugin-security-policy');

const customPolicy = new SecurityPolicy({
  name: 'my-custom-policy',
  permissionLevel: 'restricted',
  filesystemRules: {
    read: ['./data/my-plugin/**'],
    write: false,
    delete: false
  },
  networkRules: {
    https: true
  },
  customRules: [
    {
      name: 'no-specific-domain',
      validate: (code) => !code.includes('evil.com')
    }
  ]
});
```

---

## 4. API 白名单

### 4.1 默认允许的 API

```javascript
const DEFAULT_API_WHITELIST = {
  console: ['log', 'warn', 'error', 'info', 'debug'],
  JSON: ['stringify', 'parse'],
  Math: ['abs', 'ceil', 'floor', 'max', 'min', 'pow', 'random', 'round', 'sqrt'],
  Date: ['now', 'parse', 'UTC'],
  Array: ['isArray', 'from', 'of'],
  Object: ['keys', 'values', 'entries', 'assign', 'create'],
  String: ['fromCharCode'],
  Number: ['isFinite', 'isNaN', 'parseInt', 'parseFloat']
};
```

### 4.2 禁止的 API

以下 API 在沙箱模式下完全不可用：

- `process` 对象的所有属性和方法
- `require()` 函数（除非在允许列表中）
- `eval()` 和 `Function()` 构造函数
- `child_process` 模块
- `fs` 模块（文件系统访问）
- `global` / `globalThis` 对象
- `Buffer` 对象

---

## 5. 恶意代码检测

### 5.1 危险模式检测

系统会自动扫描插件代码，检测以下危险模式：

| 模式 | 严重级别 | 描述 |
|------|----------|------|
| `process.exit()` | 高 | 强制退出进程 |
| `child_process` | 严重 | 子进程执行 |
| `eval()` | 严重 | 动态代码执行 |
| `Function()` | 严重 | 函数构造器 |
| `require('fs')` | 高 | 文件系统访问 |
| `require('child_process')` | 严重 | 子进程访问 |
| `process.env` | 高 | 环境变量访问 |
| `__dirname` | 中 | 目录路径泄露 |
| `../` | 中 | 路径遍历攻击 |
| `setTimeout(string)` | 中 | 字符串定时器 |

### 5.2 检测结果处理

- **严重级别**：直接拒绝插件加载
- **高级别**：在严格模式下拒绝，非严格模式下警告
- **中级别**：生成警告日志

---

## 6. 插件间隔离

### 6.1 通信隔离

默认情况下，插件之间无法相互访问：

```javascript
const manager = new SandboxManager({
  interPluginCommunication: true
});

// 显式隔离插件
manager.isolatePlugin('untrusted-plugin');
```

### 6.2 API 隔离

每个插件只能访问自己被授权的 API：

```javascript
// 为特定插件添加 API
manager.setPluginAPI('my-plugin', 'myAPI', {
  doSomething: () => { /* ... */ }
});
```

---

## 7. 安全日志

### 7.1 日志类型

| 事件类型 | 记录内容 |
|----------|----------|
| `sandboxCreated` | 沙箱创建信息 |
| `sandboxDestroyed` | 沙箱销毁信息 |
| `sandboxError` | 沙箱执行错误 |
| `timeout` | 执行超时事件 |
| `security_violation` | 安全违规事件 |
| `healthCheck` | 健康检查结果 |

### 7.2 查看日志

```javascript
const { getEventSystem } = require('./lib/plugin-event-system');

const eventSystem = getEventSystem();

eventSystem.on('security_violation', (event) => {
  console.log('Security violation detected:', event.details);
});
```

---

## 8. 最佳实践

### 8.1 插件开发安全建议

1. **使用默认沙箱级别**：除非必要，不要请求更高权限
2. **避免敏感操作**：不要在插件中存储或传输敏感信息
3. **错误处理**：始终捕获并处理可能的错误
4. **最小权限**：只请求插件功能所需的最小权限

### 8.2 部署安全建议

1. **启用沙箱**：始终在生产环境启用沙箱
2. **定期审计**：定期审查插件的安全级别和权限
3. **监控日志**：持续监控安全日志，及时发现异常
4. **更新策略**：及时更新插件以获取安全修复

---

## 9. API 参考

### 9.1 SandboxManager

```javascript
const { SandboxManager } = require('./lib/plugin-sandbox-manager');

const manager = new SandboxManager({
  maxSandboxes: 20,
  defaultTimeout: 30000,
  defaultMemoryLimit: 128 * 1024 * 1024,
  defaultPermissionLevel: 'sandboxed'
});

// 创建沙箱
const sandbox = manager.createSandbox('my-plugin', {
  timeout: 60000,
  memoryLimit: 256 * 1024 * 1024
});

// 执行代码
const result = await manager.executeInSandbox('my-plugin', code, context);

// 获取统计
const stats = manager.getStats();

// 健康检查
const health = manager.performHealthCheck();
```

### 9.2 SecurityPolicy

```javascript
const { SecurityPolicy } = require('./lib/plugin-security-policy');

const policy = new SecurityPolicy({
  permissionLevel: 'sandboxed',
  dangerousPatternCheck: true,
  strictMode: true
});

// 验证代码
policy.validateCode(code);

// 检查权限
policy.canAccessFilesystem('read', '/path/to/file');
policy.canAccessNetwork('https');
```

### 9.3 PluginSystem 集成

```javascript
const { PluginSystem } = require('./lib/plugin-system');

const pluginSystem = new PluginSystem('./plugins', null, {
  sandboxEnabled: true,
  sandboxOptions: {
    defaultPermissionLevel: 'sandboxed'
  }
});

// 在沙箱中执行
const result = await pluginSystem.executeInSandbox('my-plugin', code, context);

// 获取沙箱统计
const stats = pluginSystem.getSandboxStats();
```

---

## 10. 故障排除

### 10.1 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `SandboxTimeoutError` | 执行超时 | 增加超时时间或优化代码 |
| `SandboxMemoryError` | 内存超限 | 增加内存限制或优化代码 |
| `Security violation` | 检测到危险代码 | 移除危险代码模式 |
| `Module access denied` | 访问未授权模块 | 调整权限级别 |

### 10.2 调试技巧

```javascript
// 启用详细日志
const sandbox = new PluginSandbox({
  pluginName: 'my-plugin',
  enableLogging: true
});

// 查看执行日志
const logs = sandbox.getLogs();
console.log(logs);
```

---

## 11. 更新日志

### v1.0.0 (2026-03-29)
- 初始版本
- 支持沙箱隔离执行
- 三级权限控制
- 危险代码检测
- 完整的安全审计日志

---

*确保插件安全，保护系统完整性！* 🔒
