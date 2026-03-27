# Slack 通知插件

> Agent Orchestra Slack 通知渠道集成

---

## 功能特性

- ✅ 支持 Slack Incoming Webhook
- ✅ 多种消息格式（text、markdown、blocks、attachments）
- ✅ 自定义用户名和图标
- ✅ 任务通知格式化
- ✅ 工作流通知格式化
- ✅ 降级支持（无需 node-fetch，使用原生 https）

---

## 安装

插件已包含在 `plugins/notification-slack/` 目录中，无需额外安装。

---

## 配置

在 Agent Orchestra 管理界面中配置插件：

1. 进入 **系统设置** → **插件管理**
2. 找到 **Slack** 插件
3. 点击 **配置**
4. 填写以下信息：

| 配置项 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| webhookUrl | ✅ | Slack Incoming Webhook URL | `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX` |
| username | ❌ | 发送者用户名 | `Agent Orchestra` |
| iconEmoji | ❌ | 表情图标 | `:robot_face:` |
| iconUrl | ❌ | 图标 URL（与 iconEmoji 二选一） | `https://example.com/icon.png` |
| defaultChannel | ❌ | 默认频道（覆盖 Webhook 设置） | `#alerts` |

### 获取 Webhook URL

1. 在 Slack 中创建一个新的 Incoming Webhook：
   - 访问 https://your-workspace.slack.com/apps/manage/custom-integrations
   - 搜索 "Incoming Webhooks"
   - 点击 "Add Configuration"
   - 选择频道
   - 复制 Webhook URL

2. 将 URL 粘贴到插件配置中

---

## 使用示例

### 1. 发送简单文本消息

```javascript
const plugin = await context.plugins.get('notification-slack');
await plugin.send('Hello from Agent Orchestra!');
```

### 2. 发送 Markdown 消息

```javascript
await plugin.send('*Bold text*\n_Italic text_\n• List item', {
  msgType: 'markdown'
});
```

### 3. 发送结构化消息（Blocks）

```javascript
await plugin.send([
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: '🎉 任务完成通知'
    }
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '任务 *数据备份* 已成功完成！'
    }
  }
], {
  msgType: 'blocks'
});
```

### 4. 使用格式化方法

```javascript
// 任务通知
const task = {
  title: '数据备份',
  status: 'completed',
  priority: '高',
  agents: ['backup-agent', 'storage-agent'],
  createdAt: Date.now()
};

const formattedMessage = plugin.formatTaskNotification(task);
await plugin.send(formattedMessage, { msgType: 'blocks' });

// 工作流通知
const workflow = {
  name: '每日报告生成',
  status: 'running',
  currentStep: 2,
  totalSteps: 5
};

const step = { name: '数据收集', index: 2 };
const workflowMessage = plugin.formatWorkflowNotification(workflow, step);
await plugin.send(workflowMessage, { msgType: 'blocks' });
```

### 5. 使用快捷方法

```javascript
// 发送文本
await plugin.sendText('简单消息');

// 发送 Markdown
await plugin.sendMarkdown('*加粗* _斜体_');

// 发送 Blocks
await plugin.sendBlocks([{ type: 'section', text: { type: 'mrkdwn', text: 'Hello' } }]);
```

---

## 测试

在插件管理界面点击 **测试** 按钮，或调用 API：

```bash
curl -X POST http://localhost:3000/api/plugins/notification-slack/test \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://hooks.slack.com/services/xxx"}'
```

---

## 消息格式说明

### Slack Blocks 构建器

使用官方 Blocks 构建器预览消息效果：
https://app.slack.com/block-kit-builder

### 支持的格式

| 类型 | 说明 | 使用场景 |
|------|------|---------|
| text | 纯文本 | 简单通知 |
| markdown | Markdown 格式 | 富文本通知 |
| blocks | Slack Blocks | 结构化消息、卡片 |
| attachment | Slack Attachments | 带颜色条的消息 |

---

## 常见问题

### Q: 消息发送失败？

A: 检查以下几点：
1. Webhook URL 是否正确
2. Webhook 是否已启用
3. 查看 Agent Orchestra 日志：`tail -f logs/app.log`

### Q: 如何@某人？

A: 在消息中使用 `<@USER_ID>` 格式：
```javascript
await plugin.send('任务已完成，请查看 <@U12345678>');
```

### Q: 如何@频道？

A: 使用 `<!channel>`、`<!here>` 或 `<!everyone>`：
```javascript
await plugin.send('<!channel> 紧急通知！');
```

### Q: 支持上传文件吗？

A: 当前版本不支持。如需上传文件，请使用 Slack Files API。

---

## 技术细节

- **依赖**: 无（优先使用 node-fetch，降级使用原生 https）
- **兼容性**: Slack API v1
- **速率限制**: 遵循 Slack API 限制（每秒 1 条消息）

---

## 更新日志

### v1.0.0 (2026-03-27)
- 初始版本
- 支持所有 Slack 消息格式
- 任务/工作流通知格式化
- 降级支持原生 https

---

## 许可证

MIT License

---

*让 Agent Orchestra 的通知直达你的 Slack 频道！* 💬
