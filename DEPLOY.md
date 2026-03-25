# Agent Orchestra 部署指南

## 快速开始

### 前置要求

- Docker >= 20.10
- Docker Compose >= 2.0

### 构建并运行

```bash
# 构建镜像
docker build -t agent-orchestra .

# 运行容器
docker run -d -p 3210:3210 -v $(pwd)/data:/app/data agent-orchestra
```

访问 http://localhost:3210

## Docker Compose 部署

### 启动服务

```bash
docker-compose up -d
```

### 查看日志

```bash
docker-compose logs -f
```

### 停止服务

```bash
docker-compose down
```

### 重启服务

```bash
docker-compose restart
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3210 | 服务端口 |
| `NODE_ENV` | production | 运行环境 |
| `OPENCLAW_API_URL` | http://localhost:8080 | OpenClaw API 地址 |
| `OPENCLAW_API_TOKEN` | - | OpenClaw API 令牌 |

### 配置环境变量

创建 `.env` 文件：

```bash
OPENCLAW_API_URL=http://localhost:8080
OPENCLAW_API_TOKEN=your-token-here
```

## 数据持久化

数据目录 `data/` 通过 Docker 卷挂载持久化：

- `data/tasks.json` - 任务数据
- `data/templates.json` - 模板数据
- `data/runtime.json` - 运行时状态
- `data/agent-groups.json` - Agent 分组
- `data/shared-presets.json` - 共享预设
- `data/user-presets.json` - 用户预设
- `data/user-templates.json` - 用户模板
- `data/agent-combinations.json` - Agent 组合
- `data/task-logs/` - 任务日志

首次启动时会自动创建必要的目录和文件。

## 健康检查

### API 端点

```bash
curl http://localhost:3210/api/health
```

响应示例（健康）：

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 3600000,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "checks": {
    "data_dir": { "status": "ok" },
    "memory": { "status": "ok", "used": "120MB", "total": "512MB" }
  }
}
```

### Docker 健康状态

```bash
docker inspect agent-orchestra --format='{{.State.Health.Status}}'
```

## 自动更新（可选）

启用 Watchtower 自动更新：

1. 取消 `docker-compose.yml` 中 watchtower 服务的注释
2. 重新启动：

```bash
docker-compose up -d
```

Watchtower 会在每天凌晨 4 点自动检查并更新容器。

## 常见问题

### 端口被占用

修改 `.env` 或环境变量：

```bash
PORT=3211
```

### 数据目录权限问题

确保挂载的目录有写权限：

```bash
chmod -R 777 data
```

### 容器内无法访问外部服务

检查网络配置，确保容器可以访问 `OPENCLAW_API_URL`。

### 查看容器状态

```bash
docker-compose ps
```

### 进入容器调试

```bash
docker-compose exec agent-orchestra sh
```
