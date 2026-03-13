# Agent Orchestra

OpenClaw Agent 管理与调度面板 MVP。

## 已实现

- Agent 总览：读取 `openclaw status --json` 与 `openclaw sessions --all-agents --json`
- 任务派发：选择一个或多个 Agent，下发真实任务
- 任务看板：待执行 / 执行中 / 已完成 / 失败
- 日志查看：查看每个任务的后台执行日志
- 独立目录运行，不污染现有 Agent 工作区结构

## 启动

```bash
cd /home/node/.openclaw/workspace/agent-orchestra
npm start
```

默认地址：

- http://127.0.0.1:3210

## 任务执行机制

创建任务后，服务会后台启动 `task-runner.js`，实际调用：

```bash
openclaw agent --agent <agentId> --message "..." --json
```

每个任务的执行日志保存在：

- `data/task-logs/<taskId>.log`

任务元数据保存在：

- `data/tasks.json`

## 下一步建议

- 接入真正的会话级控制：暂停 / 终止 / 重试
- 增加“工作流”与“依赖任务”
- 增加 Agent 能力标签与权限展示
- 增加 WebSocket / SSE 实时流式日志
- 接入更细粒度的 sessions / subagents / ACP 管理
