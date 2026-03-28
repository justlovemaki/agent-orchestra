# Agent Orchestra 插件开发指南

> 版本：1.0.0  
> 最后更新：2026-03-27

---

## 1. 概述

Agent Orchestra 插件系统允许开发者扩展核心功能，无需修改主程序代码。插件系统支持三种类型：

| 类型 | 用途 | 示例 |
|------|------|------|
| **panel** | 在仪表板中添加自定义组件 | 统计面板、图表组件 |
| **notification** | 新增通知渠道 | 钉钉、Slack、企业微信 |
| **datasource** | 接入外部数据源 | 天气、股票、监控数据 |

---

## 2. 插件结构

```
my-plugin/
├── manifest.json      # 插件元数据（必填）
├── index.js           # 插件主逻辑（必填）
├── README.md          # 使用说明（推荐）
└── assets/            # 静态资源（可选）
    ├── styles.css
    └── images/
```

### 2.1 manifest.json

```json
{
  "name": "plugin-unique-name",
  "version": "1.0.0",
  "description": "插件描述",
  "type": "panel|notification|datasource",
  "author": "Your Name",
  "license": "MIT",
  "homepage": "https://github.com/your/repo",
  
  "configSchema": {
    "apiKey": {
      "type": "string",
      "required": true,
      "description": "API 密钥"
    },
    "refreshInterval": {
      "type": "number",
      "required": false,
      "default": 30000,
      "description": "刷新间隔（毫秒）"
    }
  },
  
  "面板插件特有字段": {
    "component": "my-panel",
    "renderMethod": "default",
    "props": {
      "title": "我的面板",
      "icon": "📊"
    }
  },
  
  "通知插件特有字段": {
    "channelName": "My Channel",
    "supportedFormats": ["text", "markdown", "html"]
  },
  
  "数据源插件特有字段": {
    "schema": {
      "fields": [
        { "name": "field1", "type": "string", "description": "字段描述" }
      ]
    }
  }
}
```

### 2.2 manifest 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ✅ | 插件唯一标识（小写字母 + 连字符） |
| version | string | ✅ | 语义化版本号（major.minor.patch） |
| description | string | ❌ | 插件描述 |
| type | string | ✅ | 插件类型（panel/notification/datasource） |
| author | string | ❌ | 作者信息 |
| license | string | ❌ | 开源许可证 |
| configSchema | object | ❌ | 配置项定义 |

---

## 3. 插件类型详解

### 3.1 Panel 插件（面板插件）

用于在仪表板中显示自定义组件。

#### index.js 模板

```javascript
'use strict';

module.exports = async function(plugin, context) {
  /**
   * 获取面板数据
   * @returns {Promise<object>} 面板数据
   */
  plugin.getData = async function(options = {}) {
    // 实现数据获取逻辑
    return {
      stats: { total: 100, success: 95 },
      timestamp: Date.now()
    };
  };

  /**
   * 渲染面板 HTML
   * @param {string} containerId - 容器 ID
   * @returns {Promise<object>} 包含 html、styles、script 的对象
   */
  plugin.render = async function(containerId) {
    return {
      html: `<div id="${containerId}" class="my-panel">
        <h3>${plugin.manifest.props.title}</h3>
        <div class="content">加载中...</div>
      </div>`,
      styles: `.my-panel { padding: 16px; }
        .my-panel h3 { margin: 0 0 16px; color: #1e293b; }
        .content { color: #64748b; }`,
      script: `async function refreshPanel() {
        const data = await this.getData();
        const content = document.getElementById('${containerId} .content');
        content.textContent = JSON.stringify(data);
      }
      refreshPanel();
      setInterval(refreshPanel, ${plugin.config.refreshInterval || 30000});`
    };
  };
};
```

#### 生命周期方法

| 方法 | 说明 | 返回值 |
|------|------|------|
| getData(options) | 获取面板数据 | Promise\<object\> |
| render(containerId) | 渲染面板 HTML | Promise\<{html, styles, script}\> |

---

### 3.2 Notification 插件（通知插件）

用于扩展通知渠道。

#### index.js 模板

```javascript
'use strict';

module.exports = async function(plugin, context) {
  /**
   * 发送通知
   * @param {string} message - 消息内容
   * @param {object} options - 发送选项
   * @returns {Promise<object>} 发送结果
   */
  plugin.send = async function(message, options = {}) {
    const config = { ...plugin.config, ...options };
    
    if (!config.webhookUrl) {
      throw new Error('Webhook URL 未配置');
    }

    // 实现发送逻辑
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });

    return { success: true, response };
  };

  /**
   * 测试通知
   * @param {object} testConfig - 测试配置
   * @returns {Promise<object>} 测试结果
   */
  plugin.test = async function(testConfig) {
    return await plugin.send('🔔 Agent Orchestra 测试消息', testConfig);
  };

  /**
   * 格式化任务通知（可选）
   * @param {object} task - 任务对象
   * @returns {string} 格式化后的消息
   */
  plugin.formatTaskNotification = function(task) {
    const statusEmoji = {
      completed: '✅',
      failed: '❌',
      running: '🔄',
      queued: '⏳'
    };
    
    return `## 任务通知\n\n` +
      `**${statusEmoji[task.status]} ${task.title}**\n\n` +
      `- 状态：${task.status}\n` +
      `- Agent: ${task.agents?.join(', ') || '-'}`;
  };
};
```

#### 必需方法

| 方法 | 说明 |
|------|------|
| send(message, options) | 发送通知（必填） |
| test(testConfig) | 测试通知（必填） |

#### 可选方法

| 方法 | 说明 |
|------|------|
| formatTaskNotification(task) | 格式化任务通知 |
| formatWorkflowNotification(workflow) | 格式化工作流通知 |

---

### 3.3 Datasource 插件（数据源插件）

用于接入外部数据源。

#### index.js 模板

```javascript
'use strict';

module.exports = async function(plugin, context) {
  /**
   * 查询数据
   * @param {string} queryString - 查询语句
   * @param {object} options - 查询选项
   * @returns {Promise<object>} 查询结果
   */
  plugin.query = async function(queryString, options = {}) {
    const config = { ...plugin.config, ...options };
    
    // 解析查询语句
    const query = parseQuery(queryString);
    
    // 实现数据获取逻辑
    const response = await fetch(`https://api.example.com/data?city=${query.city}`, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` }
    });
    
    const data = await response.json();
    
    return {
      fields: plugin.manifest.schema.fields,
      rows: [data],
      timestamp: Date.now()
    };
  };

  /**
   * 测试数据源
   * @param {object} testConfig - 测试配置
   * @returns {Promise<object>} 测试结果
   */
  plugin.test = async function(testConfig) {
    return await plugin.query('SELECT * LIMIT 1', testConfig);
  };

  function parseQuery(queryString) {
    // 简单的查询解析器
    const match = queryString.match(/city\s*=\s*['"]?(\w+)['"]?/i);
    return { city: match ? match[1] : 'Beijing' };
  }
};
```

#### 必需方法

| 方法 | 说明 |
|------|------|
| query(queryString, options) | 查询数据（必填） |
| test(testConfig) | 测试数据源（必填） |

---

## 4. 开发流程

### 4.1 创建插件

```bash
# 1. 在 plugins/ 目录下创建插件文件夹
mkdir plugins/my-plugin

# 2. 创建 manifest.json
cat > plugins/my-plugin/manifest.json << 'EOF'
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "我的插件",
  "type": "panel",
  "author": "Your Name"
}
EOF

# 3. 创建 index.js（参考上面模板）

# 4. 重启 Agent Orchestra 或热重载插件
curl http://localhost:3000/api/plugins/reload
```

### 4.2 调试插件

```bash
# 查看插件日志
tail -f logs/app.log | grep my-plugin

# 查看插件状态
curl http://localhost:3000/api/plugins | jq '.[] | select(.name=="my-plugin")'

# 测试插件 API
curl -X POST http://localhost:3000/api/plugins/my-plugin/test \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "test-key"}'
```

### 4.3 发布插件

1. **代码审查**
   - 确保遵循本指南的接口规范
   - 添加必要的错误处理
   - 编写 README.md 说明使用方法

2. **版本管理**
   - 使用语义化版本（SemVer）
   - 在 CHANGELOG.md 中记录变更

3. **分享插件**
   - 发布到 GitHub
   - 在 Agent Orchestra 社区插件市场提交（待建）

---

## 5. 最佳实践

### 5.1 错误处理

```javascript
plugin.send = async function(message, options = {}) {
  try {
    // 实现发送逻辑
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`[${plugin.name}] Send failed:`, error.message);
    throw new Error(`发送失败：${error.message}`);
  }
};
```

### 5.2 配置验证

```javascript
// 在 manifest.json 中定义 configSchema
"configSchema": {
  "apiKey": {
    "type": "string",
    "required": true,
    "description": "API 密钥",
    "minLength": 10
  },
  "timeout": {
    "type": "number",
    "required": false,
    "default": 5000,
    "minimum": 1000,
    "maximum": 30000
  }
}
```

### 5.3 性能优化

```javascript
// 使用缓存避免频繁请求
const cache = new Map();
const CACHE_TTL = 60000; // 1 分钟

plugin.getData = async function(options = {}) {
  const cacheKey = JSON.stringify(options);
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchData(options);
  cache.set(cacheKey, { data, timestamp: Date.now() });
  
  // 定期清理过期缓存
  if (cache.size > 100) {
    for (const [key, value] of cache.entries()) {
      if (Date.now() - value.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }
  }
  
  return data;
};
```

### 5.4 日志记录

```javascript
const debug = require('debug')('agent-orchestra:my-plugin');

plugin.send = async function(message, options = {}) {
  debug('Sending message:', { message, options });
  
  try {
    const result = await doSend(message, options);
    debug('Send successful:', result);
    return result;
  } catch (error) {
    debug('Send failed:', error);
    throw error;
  }
};
```

---

## 6. 示例插件参考

| 插件 | 路径 | 类型 | 说明 |
|------|------|------|------|
| Dashboard Demo | `plugins/dashboard-demo/` | panel | 面板插件示例 |
| DingTalk | `plugins/notification-dingtalk/` | notification | 钉钉通知渠道 |
| Weather | `plugins/datasource-weather/` | datasource | 天气数据源 |

---

## 7. API 参考

### 7.1 插件管理 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/plugins` | GET | 获取所有插件列表 |
| `/api/plugins/:name` | GET | 获取指定插件详情 |
| `/api/plugins/:name/enable` | POST | 启用插件 |
| `/api/plugins/:name/disable` | POST | 禁用插件 |
| `/api/plugins/:name/config` | PUT | 更新插件配置 |
| `/api/plugins/:name/test` | POST | 测试插件 |
| `/api/plugins/reload` | POST | 重新加载所有插件 |

### 7.2 Plugin 对象属性

```javascript
{
  name: string,           // 插件名称
  version: string,        // 版本号
  description: string,    // 描述
  type: string,           // 类型
  author: string,         // 作者
  state: string,          // 状态 (unloaded/loaded/enabled/disabled/error)
  config: object,         // 当前配置
  configSchema: object,   // 配置模式
  manifest: object,       // 完整 manifest
  pluginPath: string      // 插件路径
}
```

---

## 8. 常见问题

### Q: 插件加载失败怎么办？

A: 检查以下几点：
1. manifest.json 格式是否正确
2. index.js 是否导出正确的函数
3. 查看日志中的错误信息：`tail -f logs/app.log`

### Q: 如何调试面板插件？

A: 在浏览器开发者工具中：
1. 打开 Console 查看 JavaScript 错误
2. 在 Network 面板查看 API 请求
3. 使用 `debug` 模式查看详细日志

### Q: 插件可以访问数据库吗？

A: 可以。插件运行在主进程中，可以访问所有 Node.js 模块和数据库连接。但建议通过 context 参数访问，保持解耦。

### Q: 如何发布插件到社区？

A: 目前插件市场正在建设中。可以先发布到 GitHub，然后在 Agent Orchestra 社区分享链接。

---

## 9. 更新日志

### v1.0.0 (2026-03-27)
- 初始版本
- 支持 panel、notification、datasource 三种插件类型
- 提供完整的开发模板和示例

---

## 10. 事件系统 (Event System)

### 10.1 概述

事件系统允许插件订阅和响应系统级事件。插件可以通过在 manifest 中声明感兴趣的事件类型来注册事件处理器。

### 10.2 支持的事件类型

| 事件类型 | 说明 | 事件 payload |
|----------|------|-------------|
| `task.created` | 任务创建时触发 | `{ taskId, title, agents, mode, priority, createdBy }` |
| `task.completed` | 任务完成时触发 | `{ taskId, title, agents, runs, finishedAt }` |
| `task.failed` | 任务失败时触发 | `{ taskId, title, agents, runs, status, error, finishedAt }` |
| `workflow.started` | 工作流开始执行时触发 | `{ workflowRunId, workflowId, workflowName, status, startedAt, steps }` |
| `workflow.completed` | 工作流完成时触发 | `{ workflowRunId, workflowId, workflowName, status, startedAt, finishedAt, steps, error }` |
| `agent.status_changed` | Agent 状态变化时触发 | `{ agentId, status, ...metadata }` |
| `session.message_sent` | 会话消息发送时触发 | `{ sessionId, message, ...metadata }` |
| `notification.sent` | 通知发送成功时触发 | `{ channelId, channelName, channelType, source, status }` |

### 10.3 在 manifest 中声明事件类型

```json
{
  "name": "my-event-handler",
  "version": "1.0.0",
  "description": "任务事件处理插件",
  "type": "panel",
  "author": "Your Name",
  
  "eventTypes": [
    "task.created",
    "task.completed",
    "task.failed"
  ]
}
```

### 10.4 实现事件处理器

```javascript
'use strict';

module.exports = async function(plugin, context) {
  /**
   * 处理系统事件
   * @param {string} eventType - 事件类型
   * @param {object} payload - 事件数据
   * @returns {Promise<object>} 处理结果
   */
  plugin.onEvent = async function(eventType, payload) {
    console.log(`[${plugin.name}] Received event: ${eventType}`, payload);
    
    switch (eventType) {
      case 'task.created':
        return await handleTaskCreated(payload);
      case 'task.completed':
        return await handleTaskCompleted(payload);
      case 'task.failed':
        return await handleTaskFailed(payload);
      default:
        console.log(`[${plugin.name}] Unhandled event type: ${eventType}`);
        return { handled: false };
    }
  };
  
  async function handleTaskCreated(payload) {
    console.log(`[${plugin.name}] New task created: ${payload.title}`);
    return { handled: true, action: 'logged' };
  }
  
  async function handleTaskCompleted(payload) {
    console.log(`[${plugin.name}] Task completed: ${payload.title}`);
    return { handled: true, action: 'notified' };
  }
  
  async function handleTaskFailed(payload) {
    console.log(`[${plugin.name}] Task failed: ${payload.title}, error: ${payload.error}`);
    return { handled: true, action: 'alerted' };
  }
};
```

### 10.5 事件系统 API

#### 获取事件系统实例

```javascript
const { getEventSystem } = require('./lib/plugin-event-system');

const eventSystem = getEventSystem();
```

#### 手动注册事件处理器

```javascript
const { getEventSystem } = require('./lib/plugin-event-system');

const eventSystem = getEventSystem();

eventSystem.registerPlugin({
  name: 'my-plugin',
  manifest: {
    name: 'my-plugin',
    version: '1.0.0',
    type: 'panel',
    eventTypes: ['task.created']
  },
  onEvent: async (eventType, payload) => {
    console.log('Event received:', eventType, payload);
  }
});
```

#### 获取事件日志

```javascript
const { getEventSystem } = require('./lib/plugin-event-system');

const eventSystem = getEventSystem();

// 获取所有事件日志
const logs = eventSystem.getEventLog();

// 按事件类型过滤
const taskLogs = eventSystem.getEventLog({ eventType: 'task.created' });

// 按插件名称过滤
const pluginLogs = eventSystem.getEventLog({ pluginName: 'my-plugin' });
```

### 10.6 事件系统特性

- **异步处理**：事件处理器以异步方式执行，不会阻塞主流程
- **错误隔离**：单个处理器错误不会影响其他处理器或主流程
- **敏感信息脱敏**：密码、token 等敏感字段在日志中自动脱敏
- **事件日志**：记录所有事件触发和处理情况，便于调试

### 10.7 最佳实践

```javascript
plugin.onEvent = async function(eventType, payload) {
  try {
    switch (eventType) {
      case 'task.created':
        return await handleTaskCreated(payload);
      case 'task.completed':
        return await handleTaskCompleted(payload);
      case 'task.failed':
        return await handleTaskFailed(payload);
      default:
        return { handled: false };
    }
  } catch (error) {
    console.error(`[${plugin.name}] Event handling error:`, error.message);
    return { handled: false, error: error.message };
  }
};
```

---

*构建丰富的插件生态，让 Agent Orchestra 更强大！* 🧩
