# 插件市场功能文档

## 概述

插件市场（Plugin Marketplace）是 Agent Orchestra 的插件分享和发现平台，允许用户上传、下载、评价、分享、安装和更新插件。

**v2.0 新增功能：**
- ✅ 真实插件下载与安装（支持 zip/tar.gz 格式）
- ✅ 插件自动更新检测与一键更新
- ✅ 插件卸载功能（支持备份）
- ✅ 全局更新检测 API
- ✅ 更新通知生成

## 功能特性

### 核心模块

#### 1. PluginInstaller (lib/plugin-installer.js)

插件安装引擎，提供以下功能：

- `downloadPlugin(pluginUrl, destPath)` - 从 URL 下载插件包
- `extractPlugin(archivePath, destPath)` - 解压插件包
- `installPlugin(pluginId, userId, options)` - 完整安装流程
- `updatePlugin(pluginName, userId, options)` - 更新已安装插件
- `validatePlugin(pluginPath)` - 验证插件完整性
- `uninstallPlugin(pluginName, userId, options)` - 卸载插件

#### 2. PluginUpdateNotifier (lib/plugin-update-notifier.js)

更新检测与通知模块：

- `checkAllUpdates(userId)` - 检查用户所有插件的更新
- `getPendingUpdates(userId)` - 获取待更新列表
- `notifyUpdates(userId)` - 生成更新通知

### 后端 API

#### 1. 获取插件市场列表
```
GET /api/plugins/marketplace
```

**查询参数：**
- `category` - 按分类筛选（可选）
- `search` - 搜索关键词（可选）
- `sortBy` - 排序字段：`createdAt`, `rating`, `downloads`, `name`（默认：`createdAt`）
- `order` - 排序方向：`asc`, `desc`（默认：`desc`）

**响应示例：**
```json
{
  "plugins": [
    {
      "id": "auto-reporter-1711600000000-abc123",
      "name": "Auto Reporter",
      "description": "自动生成日报、周报和月报",
      "version": "1.2.0",
      "author": "OpenClaw Team",
      "category": "automation",
      "downloads": 128,
      "rating": 4.5,
      "reviews": [...],
      "createdAt": 1711600000000,
      "updatedAt": 1711900000000,
      "downloadUrl": "https://..."
    }
  ],
  "total": 5
}
```

#### 2. 获取插件详情
```
GET /api/plugins/marketplace/:id
```

**响应示例：**
```json
{
  "plugin": {
    "id": "...",
    "name": "...",
    "description": "...",
    "version": "1.0.0",
    "author": "...",
    "category": "automation",
    "downloads": 100,
    "rating": 4.5,
    "reviews": [
      {
        "userId": "user1",
        "userName": "张三",
        "rating": 5,
        "comment": "非常好用！",
        "createdAt": 1711700000000
      }
    ],
    "downloadUrl": "https://...",
    "manifest": {...}
  }
}
```

#### 3. 上传插件（需要认证）
```
POST /api/plugins/marketplace/upload
```

**请求头：**
```
Authorization: Bearer <token>
```

**请求体：**
```json
{
  "manifest": {
    "name": "My Plugin",
    "version": "1.0.0",
    "author": "Your Name",
    "category": "automation",
    "description": "Plugin description"
  },
  "downloadUrl": "https://..."
}
```

**验证规则：**
- `name`: 必需，2-50 字符
- `version`: 必需，格式 x.y.z
- `author`: 必需
- `description`: 必需
- `category`: 可选，默认为 "other"

**响应示例：**
```json
{
  "success": true,
  "plugin": { ... }
}
```

#### 4. 评分插件（需要认证）
```
POST /api/plugins/marketplace/:id/rate
```

**请求头：**
```
Authorization: Bearer <token>
```

**请求体：**
```json
{
  "rating": 5,
  "comment": "很好用的插件！"
}
```

**验证规则：**
- `rating`: 必需，1-5 的整数
- `comment`: 可选

**响应示例：**
```json
{
  "success": true,
  "rating": 4.5,
  "reviewCount": 10
}
```

#### 5. 获取分类列表
```
GET /api/plugins/marketplace/categories
```

**响应示例：**
```json
{
  "categories": [
    { "id": "automation", "name": "自动化", "icon": "⚙️" },
    { "id": "integration", "name": "集成工具", "icon": "🔌" },
    { "id": "analytics", "name": "数据分析", "icon": "📊" },
    ...
  ]
}
```

### 前端页面

访问地址：`http://localhost:3210/plugins-marketplace.html`

**功能：**
- 🔍 搜索插件（支持名称和描述）
- 🏷️ 按分类筛选
- 📊 多种排序方式（最新发布、评分最高、下载最多、名称）
- 📝 上传插件（需登录）
- ⭐ 评分和评价插件（需登录）
- 📥 下载插件

**界面组成：**
1. **头部控制栏** - 搜索框、分类筛选、排序选择、上传按钮
2. **插件卡片网格** - 展示插件基本信息（名称、版本、分类、描述、评分、下载量）
3. **详情弹窗** - 完整插件信息、用户评价、评分表单
4. **上传表单弹窗** - 插件信息填写

### 数据结构

数据存储位置：`data/plugins-marketplace.json`

**插件对象结构：**
```typescript
interface Plugin {
  id: string;              // 唯一标识
  name: string;            // 插件名称
  description: string;     // 描述
  version: string;         // 版本号 (x.y.z)
  author: string;          // 作者
  category: string;        // 分类 ID
  downloads: number;       // 下载次数
  rating: number;          // 平均评分 (0-5)
  reviews: Review[];       // 评价列表
  createdAt: number;       // 创建时间戳
  updatedAt: number;       // 更新时间戳
  downloadUrl: string;     // 下载地址
  manifest: object;        // 插件清单
  uploadedBy: string;      // 上传者 ID
  uploadedByName: string;  // 上传者名称
}

interface Review {
  userId: string;          // 用户 ID
  userName: string;        // 用户名称
  rating: number;          // 评分 (1-5)
  comment: string;         // 评价内容
  createdAt: number;       // 创建时间戳
  updatedAt?: number;      // 更新时间戳（如果修改过）
}
```

**分类对象结构：**
```typescript
interface Category {
  id: string;    // 分类 ID
  name: string;  // 分类名称
  icon: string;  // 分类图标
}
```

## 安全考虑

### 认证要求
- 上传插件：需要登录（Bearer Token）
- 评分插件：需要登录（Bearer Token）
- 浏览插件：无需认证

### 数据验证
- 插件名称：2-50 字符，防止过长或过短
- 版本号：必须符合语义化版本格式 (x.y.z)
- 评分：必须在 1-5 范围内
- 分类：必须是预定义的分类 ID

### 防止重复
- 同名插件不允许重复上传
- 同一用户对同一插件只能评分一次（可修改）

## 集成到现有系统

### 导航入口
在主页面 (`index.html`) 的头部添加了"🔌 插件市场"按钮，点击后跳转到插件市场页面。

### 与插件系统集成
插件市场与现有的插件系统 (`lib/plugin-system/`) 是独立的：
- **插件系统**：管理已安装插件的加载、启用、配置
- **插件市场**：管理插件的分享、发现、评价

未来可以扩展功能，实现从市场直接安装插件到本地插件系统。

## 使用示例

### 1. 浏览所有插件
```bash
curl http://localhost:3210/api/plugins/marketplace
```

### 2. 搜索自动化类插件
```bash
curl "http://localhost:3210/api/plugins/marketplace?category=automation&sortBy=rating&order=desc"
```

### 3. 上传插件
```bash
curl -X POST http://localhost:3210/api/plugins/marketplace/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": {
      "name": "My Awesome Plugin",
      "version": "1.0.0",
      "author": "Your Name",
      "category": "utility",
      "description": "An awesome plugin for Agent Orchestra"
    },
    "downloadUrl": "https://github.com/yourname/my-plugin"
  }'
```

### 4. 评分插件
```bash
curl -X POST http://localhost:3210/api/plugins/marketplace/auto-reporter-1711600000000-abc123/rate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "comment": "非常好用的插件！"
  }'
```

## 扩展建议

### 短期优化
1. 添加插件截图/预览图支持
2. 实现插件安装功能（从市场直接安装到本地）
3. 添加插件版本历史
4. 实现插件依赖管理

### 长期规划
1. 支持插件审核流程
2. 添加插件作者认证
3. 实现插件推荐算法
4. 支持付费插件
5. 添加插件使用统计

## 故障排查

### 常见问题

**Q: 上传插件时提示"请先登录"**
A: 确保请求头中包含有效的 `Authorization: Bearer <token>`

**Q: 评分时提示"评分必须在 1-5 星之间"**
A: 检查 `rating` 字段是否为 1-5 的整数

**Q: 插件列表为空**
A: 检查 `data/plugins-marketplace.json` 文件是否存在且有数据

**Q: 服务器启动失败**
A: 检查 `routes/plugins-marketplace.js` 语法是否正确：
```bash
node -c routes/plugins-marketplace.js
```

## 文件清单

```
agent-orchestra/
├── routes/
│   └── plugins-marketplace.js      # 插件市场 API 路由
├── public/
│   └── plugins-marketplace.html    # 插件市场前端页面
├── data/
│   └── plugins-marketplace.json    # 插件市场数据
└── server.js                       # 主服务器（已集成路由）
```

#### 10. 安装插件（需要认证）— v2.0 新增
```
POST /api/plugins/marketplace/:id/install
```

**功能：** 从市场真实下载并安装插件到 `plugins/` 目录

**响应示例：**
```json
{
  "success": true,
  "plugin": { ... },
  "installResult": {
    "pluginName": "my-plugin",
    "version": "1.0.0",
    "installedPath": "/path/to/plugins/my-plugin",
    "validated": true
  },
  "message": "插件安装成功"
}
```

#### 11. 更新插件（需要认证）— v2.0 新增
```
POST /api/plugins/marketplace/:id/update
```

**功能：** 更新已安装插件到最新版本

**响应示例：**
```json
{
  "success": true,
  "updateResult": {
    "pluginName": "my-plugin",
    "oldVersion": "1.0.0",
    "newVersion": "1.2.0",
    "backupPath": "/path/to/backups/my-plugin-1.0.0"
  },
  "message": "插件已更新至 1.2.0 版本"
}
```

#### 12. 卸载插件（需要认证）— v2.0 新增
```
POST /api/plugins/marketplace/:id/uninstall
```

**功能：** 卸载已安装插件（可选择保留备份）

**响应示例：**
```json
{
  "success": true,
  "uninstallResult": {
    "pluginName": "my-plugin",
    "backupCreated": true,
    "backupPath": "/path/to/backups/my-plugin"
  },
  "message": "插件卸载成功"
}
```

#### 13. 检查插件更新（需要认证）— v2.0 新增
```
GET /api/plugins/marketplace/:id/check-updates
```

**响应示例：**
```json
{
  "pluginId": "xxx",
  "pluginName": "my-plugin",
  "currentVersion": "1.0.0",
  "latestVersion": "1.2.0",
  "hasUpdate": true,
  "downloadUrl": "https://..."
}
```

#### 14. 获取所有可用更新（需要认证）— v2.0 新增
```
GET /api/plugins/updates
```

**功能：** 检查用户所有已安装插件的可用更新

**响应示例：**
```json
{
  "hasUpdates": true,
  "updates": [
    {
      "pluginId": "xxx",
      "pluginName": "my-plugin",
      "currentVersion": "1.0.0",
      "latestVersion": "1.2.0",
      "updateType": "minor",
      "updateReason": "新功能和性能改进"
    }
  ],
  "count": 1
}
```

#### 15. 生成更新通知（需要认证）— v2.0 新增
```
POST /api/plugins/updates/notify
```

**功能：** 生成更新通知消息（可集成到通知系统）

**响应示例：**
```json
{
  "hasUpdates": true,
  "count": 2,
  "notification": {
    "title": "插件更新通知",
    "message": "您有 2 个插件可以更新：my-plugin (1.0.0 → 1.2.0), other-plugin (2.0.0 → 2.1.0)"
  }
}
```

## 更新日志

### v2.0.0 (2026-03-28) — 🚀 大演进
- ✅ **PluginInstaller 模块** — 真实插件下载、解压、安装、验证、卸载引擎
- ✅ **PluginUpdateNotifier 模块** — 更新检测与通知生成
- ✅ **安装 API** — POST /api/plugins/marketplace/:id/install
- ✅ **更新 API** — POST /api/plugins/marketplace/:id/update
- ✅ **卸载 API** — POST /api/plugins/marketplace/:id/uninstall
- ✅ **检查更新 API** — GET /api/plugins/marketplace/:id/check-updates
- ✅ **全局更新检测** — GET /api/plugins/updates
- ✅ **更新通知** — POST /api/plugins/updates/notify
- ✅ **52 个单元测试** — 覆盖安装器、更新检测器核心功能
- ✅ **npm 依赖** — 添加 tar 包用于解压

从"有市场原型"到"有完整插件生态"的维度跃迁，支持真实的插件下载、安装、更新、卸载全流程。

### v1.0.0 (2026-03-28)
- ✅ 实现插件市场核心 API
- ✅ 实现前端页面和交互
- ✅ 支持插件上传、浏览、搜索、筛选
- ✅ 支持插件评分和评价
- ✅ 集成到主导航
- ✅ 添加示例数据

---

*插件市场 - 让插件分享更简单* 🔌
