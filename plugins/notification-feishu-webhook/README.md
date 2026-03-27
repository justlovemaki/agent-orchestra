# 飞书 Webhook 通知插件

> Agent Orchestra 飞书 Webhook 通知渠道集成

---

## 功能特性

- ✅ 支持飞书机器人 Webhook
- ✅ 签名验证（安全加强）
- ✅ 多种消息格式（text、post）
- ✅ 任务通知格式化
- ✅ 工作流通知格式化
- ✅ 降级支持（无需 node-fetch，使用原生 https）

---

## 安装

插件已包含在 `plugins/notification-feishu-webhook/` 目录中，无需额外安装。

---

## 配置

在 Agent Orchestra 管理界面中配置插件：

1. 进入 **系统设置** → **插件管理**
2. 找到 **飞书** 插件
3. 点击 **配置**
4. 填写以下信息：

| 配置项 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| webhookUrl | ✅ | 飞书机器人 Webhook 地址 | `https://open.feishu.cn/open-apis/bot/v2/hook/xxx` |
| secret | ❌ | 签名密钥（用于签名验证） | `SECxxx` |
| userId | ❌ | 指定接收用户 ID | `ou_xxx` |
| departmentId | ❌ | 指定接收部门 ID | `dept_xxx` |

### 获取 Webhook 地址

1. 在飞书群聊中添加自定义机器人：
   - 打开飞书群聊 → 设置 → 群机器人
   - 点击 "添加机器人" → 选择 "自定义机器人"
   - 设置机器人名称（如：Agent Orchestra）
   - 复制 Webhook 地址

2. （可选）开启签名校验：
   - 在机器人设置中启用 "签名校验"
   - 复制密钥（secret）

---

## 使用示例

### 1. 发送简单文本消息

```javascript
const plugin = await context.plugins.get('notification-feishu-webhook');
await plugin.send('Hello from Agent Orchestra!');
```

### 2. 使用签名验证发送消息

```javascript
await plugin.send('带有签名验证的消息', {
  secret: 'SECxxxxxxxx'
});
```

### 3. 使用格式化方法

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
await plugin.send(formattedMessage);

// 工作流通知
const workflow = {
  name: '每日报告生成',
  status: 'running',
  currentStep: 2,
  totalSteps: 5
};

const step = { name: '数据收集', index: 2 };
const workflowMessage = plugin.formatWorkflowNotification(workflow, step);
await plugin.send(workflowMessage);
```

### 4. 使用快捷方法

```javascript
// 发送文本
await plugin.sendText('简单消息');

// 发送富文本卡片
await plugin.sendPost('这是富文本内容', '通知标题');
```

---

## 测试

在插件管理界面点击 **测试** 按钮，或调用 API：

```bash
curl -X POST http://localhost:3000/api/plugins/notification-feishu-webhook/test \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx"}'
```

---

## 消息格式说明

### 支持的格式

| 类型 | 说明 | 使用场景 |
|------|------|---------|
| text | 纯文本 | 简单通知 |
| post | 富文本卡片 | 结构化消息、卡片 |

### 签名验证原理

飞书 webhook 签名验证步骤：

1. 构造签名字符串：`timestamp + "\n" + secret`
2. 使用 HMAC-SHA256 计算签名
3. Base64 编码签名
4. URL 编码后附加到 URL 参数

---

## 常见问题

### Q: 消息发送失败？

A: 检查以下几点：
1. Webhook 地址是否正确
2. 机器人是否已启用
3. 如果开启了签名校验，确保 secret 正确
4. 查看 Agent Orchestra 日志：`tail -f logs/app.log`

### Q: 如何@某人？

A: 在消息中使用 `<at id=all></at>` 全体通知，或使用 user_id：
```javascript
await plugin.send('任务已完成，请查看 <at id=ou_xxx></at>');
```

### Q: 签名验证失败？

A: 检查以下几点：
1. timestamp 是否为秒级时间戳（10位数字）
2. 签名字符串格式是否正确：`timestamp + "\n" + secret`
3. secret 是否与飞书后台配置一致

---

## 技术细节

- **依赖**: 无（使用原生 https）
- **兼容性**: 飞书开放平台 API v1
- **超时时间**: 10 秒

---

## 更新日志

### v1.0.0 (2026-03-27)
- 初始版本
- 支持文本消息发送
- 支持签名验证
- 任务/工作流通知格式化
- 降级支持原生 https

---

## 许可证

MIT License

---

*让 Agent Orchestra 的通知直达你的飞书群聊！* 📱