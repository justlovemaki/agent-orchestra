# Agent Orchestra

一个面向 OpenClaw 的 **Agent 管理与调度面板**。

它的目标不是只做一个“状态展示页”，而是逐步演进为：

- 查看 Agent 全局状态
- 派发与跟踪任务
- 回看执行日志
- 管理多 Agent 协作流程
- 最终成为 OpenClaw 的可视化调度中枢

当前仓库阶段：**MVP / 可演示版本**

---

## 现在能做什么

### 1. Agent 总览
读取 OpenClaw 当前运行状态，展示：
- Agent 列表
- 会话数量
- 最近活跃情况
- 模型与基础状态

### 2. 系统状态
查看：
- Gateway 基础信息
- 安全审计摘要
- 渠道概况

### 3. 任务派发
支持：
- 选择一个或多个 Agent
- 创建任务
- 串行广播 / 并行执行

### 4. 任务看板
按状态展示任务：
- 待执行
- 执行中
- 已完成
- 失败
- 已取消

### 5. 任务详情与日志
支持查看：
- 任务元信息
- 每个 run 的执行状态
- 后台日志
- 重试 / 取消操作

---

## 项目结构

```text
agent-orchestra/
├── data/
│   └── tasks.json              # 任务元数据
├── public/
│   ├── index.html              # 前端页面
│   ├── styles.css              # 前端样式
│   └── app.js                  # 前端逻辑
├── server.js                   # HTTP 服务与 API
├── task-runner.js              # 后台任务执行器
├── PROJECT_EVOLUTION.md        # 项目演进文档
├── package.json
└── README.md
```

---

## 启动方式

```bash
cd /home/node/.openclaw/workspace/agents/coding-expert/projects/agent-orchestra
npm start
```

默认地址：

- http://127.0.0.1:3210

### 端口自动探测

服务启动时，会优先使用环境变量 `PORT` 指定的端口（默认 3210）。如果该端口被占用，将自动向上递增寻找下一个可用端口。例如：3210 被占用则尝试 3211，以此类推，最多尝试 10 次。

### 运行时信息

服务启动后会生成运行时信息文件 `data/runtime.json`，包含以下字段：

- `pid`：进程 PID
- `port`：实际监听端口
- `startedAt`：启动时间（时间戳）
- `url`：服务访问地址
- `status`：运行状态（running/stopped）

进程收到 `SIGTERM` 或 `SIGINT` 信号退出时，会自动将状态更新为 `stopped`。

### API

- `GET /api/runtime`：获取当前运行时信息

---

## 任务执行机制

创建任务后，服务会后台启动 `task-runner.js`，实际调用：

```bash
openclaw agent --agent <agentId> --message "..." --json
```

日志与元数据位置：

- 任务日志：`data/task-logs/<taskId>.log`
- 任务元数据：`data/tasks.json`

---

## 当前限制

这个仓库目前仍然是 MVP，已知限制包括：

1. **服务生命周期管理还不够稳**
   - 需要更可靠的守护启动方案
   - 需要 pid / 状态文件 / 自动端口探测

2. **`/api/overview` 仍依赖多次 `openclaw` CLI 调用**
   - 虽然已做缓存优化
   - 但底层还不是最优架构

3. **任务执行模型仍较原始**
   - 当前是“每个任务一个后台 runner”
   - 还不是正式任务队列

4. **数据层较轻**
   - 当前使用 `tasks.json`
   - 后续需要升级到 SQLite

5. **日志不是实时流**
   - 当前以前端轮询为主
   - 后续应升级为 SSE / WebSocket

---

## 下一步方向

优先级更高的演进方向：

### P1：稳定性优先
- 稳定启动 / 守护
- SQLite 持久化
- 正式任务队列
- 实时日志流

### P2：调度能力增强
- Agent 分组 / 标签
- 工作流编排
- 单个 run 重试 / 改派 / 暂停 / 恢复
- sessions / subagents / ACP 管理

### P3：产品化打磨
- 更强的控制台视觉风格
- 模板与常用 Agent 组合
- 历史任务检索与审计
- 截图 / 分享链路

更完整的演进规划，请看：

- [`PROJECT_EVOLUTION.md`](./PROJECT_EVOLUTION.md)

---

## 仓库定位

**Agent Orchestra 当前不是完成品，而是一块已经立起来的调度台雏形。**

它已经能跑、能看、能派发任务，也具备继续扩展的清晰方向；接下来的关键，不是再堆页面，而是把底层调度、数据与实时能力做扎实。

---

## License

暂未单独声明，默认按仓库后续约定为准。
