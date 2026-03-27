# Email 邮件通知插件

> Agent Orchestra 邮件通知渠道集成

---

## 功能特性

- ✅ 支持 SMTP 协议发送邮件
- ✅ 支持 SSL/TLS 加密连接
- ✅ 支持 STARTTLS 升级加密
- ✅ 支持 HTML 和纯文本格式
- ✅ 任务通知格式化（HTML 模板）
- ✅ 工作流通知格式化（HTML 模板）
- ✅ 无外部依赖（使用 Node.js 原生 net/tls 模块）
- ✅ 支持多收件人

---

## 安装

插件已包含在 `plugins/notification-email/` 目录中，无需额外安装。

---

## 配置

在 Agent Orchestra 管理界面中配置插件：

1. 进入 **系统设置** → **插件管理**
2. 找到 **Email** 插件
3. 点击 **配置**
4. 填写以下信息：

| 配置项 | 必填 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| smtpHost | ✅ | - | SMTP 服务器地址 | `smtp.gmail.com` |
| smtpPort | ✅ | 465 | SMTP 服务器端口 | `465` / `587` / `25` |
| username | ✅ | - | SMTP 认证用户名 | `your-email@gmail.com` |
| password | ✅ | - | SMTP 认证密码或 API 密钥 | `your-app-password` |
| from | ✅ | - | 发件人邮箱地址 | `noreply@example.com` |
| fromName | ❌ | - | 发件人显示名称 | `Agent Orchestra` |
| secure | ❌ | true | 是否使用 SSL/TLS 加密 | `true` |
| rejectUnauthorized | ❌ | true | 是否验证服务器证书 | `true` |

### 常用 SMTP 配置示例

#### Gmail
```json
{
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 465,
  "secure": true,
  "username": "your-email@gmail.com",
  "password": "your-app-password",
  "from": "your-email@gmail.com"
}
```

> **注意**: Gmail 需要使用[应用专用密码](https://support.google.com/accounts/answer/185833)

#### QQ 邮箱
```json
{
  "smtpHost": "smtp.qq.com",
  "smtpPort": 465,
  "secure": true,
  "username": "your-email@qq.com",
  "password": "your-auth-code",
  "from": "your-email@qq.com"
}
```

#### 企业邮箱（阿里云）
```json
{
  "smtpHost": "smtp.aliyun.com",
  "smtpPort": 465,
  "secure": true,
  "username": "your-email@aliyun.com",
  "password": "your-password",
  "from": "your-email@aliyun.com"
}
```

#### Outlook / Office 365
```json
{
  "smtpHost": "smtp.office365.com",
  "smtpPort": 587,
  "secure": false,
  "username": "your-email@outlook.com",
  "password": "your-password",
  "from": "your-email@outlook.com"
}
```

---

## 使用示例

### 1. 发送简单文本邮件

```javascript
const plugin = await context.plugins.get('notification-email');

await plugin.send({
  to: 'user@example.com',
  subject: '测试邮件',
  text: '这是一封测试邮件'
});
```

### 2. 发送 HTML 邮件

```javascript
await plugin.send({
  to: 'user@example.com',
  subject: 'HTML 邮件',
  text: '如果您无法显示 HTML，请查看纯文本版本',
  html: '<h1>标题</h1><p>内容</p>'
});
```

### 3. 发送多收件人

```javascript
await plugin.send({
  to: ['user1@example.com', 'user2@example.com'],
  subject: '群发邮件',
  text: '这是一封群发邮件'
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
  createdAt: Date.now(),
  description: '每日数据库备份任务'
};

const formatted = plugin.formatTaskNotification(task);
await plugin.send({
  to: 'admin@example.com',
  subject: formatted.subject,
  text: formatted.text,
  html: formatted.html
});

// 工作流通知
const workflow = {
  name: '每日报告生成',
  status: 'running',
  currentStep: 2,
  totalSteps: 5,
  startedAt: Date.now()
};

const step = { name: '数据收集', index: 2 };
const workflowFormatted = plugin.formatWorkflowNotification(workflow, step);
await plugin.send({
  to: 'admin@example.com',
  subject: workflowFormatted.subject,
  text: workflowFormatted.text,
  html: workflowFormatted.html
});
```

### 5. 使用快捷方法

```javascript
// 发送纯文本
await plugin.sendText('user@example.com', '主题', '内容');

// 发送 HTML
await plugin.sendHtml('user@example.com', '主题', '<h1>HTML内容</h1>', '备选纯文本');
```

---

## 测试

在插件管理界面点击 **测试** 按钮，或调用 API：

```bash
curl -X POST http://localhost:3000/api/plugins/notification-email/test \
  -H "Content-Type: application/json" \
  -d '{
    "smtpHost": "smtp.gmail.com",
    "smtpPort": 465,
    "username": "your-email@gmail.com",
    "password": "your-app-password",
    "from": "your-email@gmail.com",
    "testTo": "recipient@example.com"
  }'
```

---

## 邮件格式说明

### 支持的格式

| 格式 | 说明 | 使用场景 |
|------|------|---------|
| text | 纯文本 | 简单通知、兼容性好 |
| html | HTML 格式 | 富文本通知、美观 |

### 邮件类型

- **多部分邮件**: 同时提供 text 和 html 时，邮件客户端会优先显示 HTML
- **纯 HTML**: 仅提供 html 时，发送 HTML 邮件
- **纯文本**: 仅提供 text 时，发送纯文本邮件

---

## 常见问题

### Q: 连接失败？

A: 检查以下几点：
1. SMTP 服务器地址和端口是否正确
2. 账户密码是否正确（Gmail/QQ 等需要应用专用密码）
3. 防火墙是否允许出站连接
4. 尝试关闭 SSL (`secure: false`) 或调整端口

### Q: Gmail 发送失败？

A: Gmail 需要使用应用专用密码：
1. 访问 https://myaccount.google.com/apppasswords
2. 生成应用专用密码
3. 使用应用专用密码作为 `password`

### Q: 证书验证错误？

A: 在配置中设置 `rejectUnauthorized: false`（仅用于测试）

### Q: 如何查看发送日志？

A: 查看 Agent Orchestra 日志：
```bash
tail -f logs/app.log | grep email
```

---

## 技术细节

- **依赖**: 无（使用 Node.js 原生 net/tls 模块）
- **SMTP 命令**: EHLO, AUTH LOGIN, MAIL FROM, RCPT TO, DATA
- **编码**: UTF-8 Base64
- **连接超时**: 30 秒

### 端口说明

| 端口 | 加密 | 说明 |
|------|------|------|
| 25 | 可选 | 标准 SMTP（通常被封禁） |
| 465 | SSL | SMTPS 隐式加密 |
| 587 | TLS | STARTTLS 显式加密（推荐） |

---

## 更新日志

### v1.0.0 (2026-03-28)
- 初始版本
- 支持 SMTP 协议发送邮件
- 支持 SSL/TLS 加密
- 支持 HTML 和纯文本格式
- 任务/工作流通知格式化
- 使用原生 net/tls 模块，无外部依赖

---

## 许可证

MIT License

---

*让 Agent Orchestra 的通知直达你的邮箱！* 📧
