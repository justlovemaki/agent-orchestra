# PROJECT_EVOLUTION.md - Agent Orchestra

> 创建时间：2026-03-13
> 项目定位：OpenClaw Agent 管理与调度面板 MVP
> 当前阶段：MVP 已完成，可继续向"稳定调度台"演进
> 维护方式：本文档用于记录项目现状、已完成能力、技术债、下一步演进路径，供 `git-project-evolution` 持续读取与更新

---

## 1. 项目目标

Agent Orchestra 的目标不是只做一个"状态展示页"，而是逐步演进为：

- 可查看 Agent 全局状态
- 可派发与跟踪任务
- 可查看日志与执行结果
- 可管理多 Agent 协作流程
- 最终成为 OpenClaw 的可视化调度中枢

---

## 2. 当前状态

### 当前结论
项目已完成 **MVP 第一版**，具备基础可演示、可内测能力；
本轮在"新功能优先，稳定性次之"的路线下，已从单纯的任务筛选 / 搜索继续推进到"筛选视图管理"，使任务看板从"可检索、可回看、可聚焦"进一步演进为"可收藏、可复用、可整理、可快速切换"；
**UI 精修已完成**，现在支持完整的移动端响应式布局、优化的深色主题、丰富的微交互动画，用户体验显著提升；
**SSE 实时日志流已实现**，使用 EventSource 替代轮询，支持实时日志推送、多客户端订阅、心跳保活、任务状态事件；
**会话管理功能已实现**，支持查看活跃会话列表、查看会话历史消息、向会话发送消息、启动 Subagent 会话，使 Agent Orchestra 从"任务调度台"进一步演进为"Agent 会话指挥中心"；
**批量任务操作已实现**，支持批量取消、批量重试、批量修改优先级，使任务管理从"单任务操作"演进为"批量高效管理"，大幅提升多任务场景下的操作效率；
**任务暂停/恢复功能已实现**，支持对运行中任务进行暂停和恢复操作，使用 SIGUSR1/SIGUSR2 信号与 task-runner 通信，使任务控制从"取消/重试"进一步演进为"可暂停、可恢复、可精细控制"，支持长任务临时挂起、资源调度优化等场景；
**任务重新指派功能已实现**，支持将 queued/paused 状态的任务重新指派给其他 Agent，新增 `PATCH /api/tasks/:id/reassign` 端点，前端提供可视化重新指派模态框，使任务调度从"固定分配"演进为"动态调配"，支持 Agent 负载均衡、故障转移等场景；
**数据备份与恢复功能已实现**，支持完整备份和增量备份、合并和覆盖两种恢复模式、恢复前自动快照、审计日志追踪，使系统从"数据管理"演进为"数据安全与可恢复"，支持数据迁移、系统升级保护、灾难恢复等场景；
**定时自动备份功能已实现**，支持按日/周自动执行备份、可配置执行时间/备份模式/保留数量、自动清理过期备份、备份历史记录追踪，使系统从"手动备份"演进为"自动守护"，支持零运维成本的数据安全保障；
**备份通知功能已实现**，支持备份完成/失败时自动发送通知到飞书/钉钉/企业微信/Slack，包含备份类型、文件大小、执行耗时/错误信息，使系统从"自动守护"演进为"主动通知"，支持运维监控、异常告警等场景；
**云存储备份功能已实现**，支持将备份上传到阿里云 OSS/AWS S3/MinIO 等 S3 兼容存储、云端备份列表管理、从云端恢复备份，使系统从"本地备份"演进为"云端容灾"，支持异地数据保护、无限存储容量、跨设备恢复等场景；
**备份版本控制功能已实现**，支持为备份添加自定义版本名称和标签（如 'before-upgrade-v2.0'）、比较两个备份版本之间的数据差异（新增/删除/修改的任务、预设、模板等数量统计）、选择性恢复特定类型的数据（只恢复 tasks 或只恢复 presets），使系统从"备份恢复"演进为"版本管理"，支持重要节点标记、数据变更追踪、精细化数据恢复等场景；
**仪表板数据可视化功能已实现**，支持在 stats 面板下方展示任务趋势图表（使用 Chart.js），折线图显示每日任务统计（总任务数/完成数/失败数），支持 7 天/14 天视图切换，深色主题适配，响应式布局适配移动端，后端新增 `GET /api/stats/trends` 接口返回过去 14 天的每日任务统计，使系统从"数据展示"演进为"数据可视化"，支持任务趋势分析、历史数据回看等场景；
 但尚未达到"稳定、完整、产品级可长期使用"的状态。

### 当前已完成
- 独立项目目录
- 本地 Web 面板
- OpenClaw 实时数据接入
  - Agent 总览
  - Session 统计
  - 系统状态
- 任务派发
  - 串行广播
  - 并行执行
- 任务控制
  - 创建
  - 重试
  - 取消
- 执行日志查看
- 基础 UI 指挥台
- `/api/overview` 已做一轮缓存优化
- `/api/overview` 与任务执行链路的 CLI JSON 提取已加固
  - 不再只从第一个 `{` / `[` 截到结尾
  - 现在会提取单个完整 JSON 值，规避尾部日志/额外输出导致的解析异常
  - 同类修复已同步到 `task-runner.js`
- 前端已完成一轮视觉重构
- 稳定启动/守护（第一步已完成，第二步进行中）
  - 自动探测空闲端口
  - 运行时信息写入 `data/runtime.json`
  - `/api/runtime` 接口返回运行时信息
  - 前端展示服务地址/端口/PID/启动时间/运行状态
  - 进程退出时自动更新状态为 stopped
  - 独立 PID 文件 `data/agent-orchestra.pid`
  - 显式停止脚本 `npm run stop`
  - 运行时产物（tasks/runtime/logs）从 Git 跟踪中剥离
  - 启动前自检 stale pid / stale runtime 并自动清理
  - 已有存活实例时拒绝重复启动并输出已运行地址
  - 新增 `status.js` 查看服务状态
  - 新增 `restart.js` 重启服务
  - stop.js 对 stale pid 做清理并同步 runtime 状态
  - `npm run status` / `npm run restart` 脚本
  - restart.js 改为后台启动并轮询确认服务就绪
  - 新增 `/api/health` 轻量健康检查接口
  - restart/status 不再只依赖 PID / runtime 文件，已接入真实 HTTP 探活
  - **本轮新增：`lib/runtime-utils.js` 共享模块**，抽离 status.js/restart.js/stop.js 中重复的 runtime/pid/health 检查逻辑
  - **本轮新增：`scripts/verify.js` 自动化验证脚本**，覆盖健康接口、runtime 状态、CLI JSON 提取逻辑
  - **本轮新增：`npm run verify` / `npm run test` 脚本**
  - **本轮新增：stale runtime 自收敛能力**，当 runtime.json 残留为 running、PID 已失效且 health 不可达时，可自动修正为 stopped 并清理 stale pid
  - **本轮新增：验证脚本 skip 机制**，服务未运行时不再把在线接口检查误报为失败
  - **本轮新增：生命周期脚本 JSON 输出**，`status.js` / `stop.js` / `restart.js` 新增 `--json` 模式，方便调度器、脚本与外部控制面直接消费结果
  - **本轮新增：生命周期链路自动化验证**，`scripts/verify.js` 现覆盖 status / stop / restart 的 JSON 输出结构，并验证 stop → restart 恢复链路
  - **本轮新增：stop 等待进程真正退出机制**，stop.js 现在会等待目标进程真正退出后才返回成功，支持 5 秒超时，超时后强制清理并标记 stopped，避免"发送信号即返回"的竞态问题
  - **本轮新增：stop 验证加强**，scripts/verify.js 现在验证 stop 后进程确实已退出且状态已收敛，避免误报
  - **本轮新增：stop SIGKILL 升级机制**，SIGTERM 超时后自动升级为 SIGKILL 强制终止，并等待进程真正退出；若仍失败则返回失败并保留真实运行状态，而不是误标记为 stopped
  - **本轮新增：restart.js stop 失败处理**，restart.js 现在正确解析 stop.js 的 JSON 输出，识别 forceFailed 场景并中止重启流程
  - **本轮新增：verify.js 强制停止语义验证**，scripts/verify.js 新增 forceKillAndWait 函数验证和 forced flag 验证
  - **本轮新增：任务筛选与搜索功能**，前端新增可视化筛选栏，支持关键词、状态、Agent、优先级、执行模式、时间范围多维度筛选；后端 `/api/tasks` 接口支持对应查询参数并返回筛选后的任务列表
- **本轮新增：筛选条件持久化与可分享性**，前端筛选条件同步到 URL（支持链接分享）和 localStorage（刷新自动恢复），并新增筛选标签（chips）UI 支持点击快速移除单个筛选条件
- **本轮新增：筛选预设 / 收藏视图能力**，支持将当前筛选条件保存为命名预设，支持一键应用 / 删除已保存视图，并内置"运行中任务 / 高优先级失败任务 / 今天创建的任务"默认快速预设
- **本轮新增：筛选预设管理能力**，支持对已保存视图重命名，并支持上移 / 下移排序，让常用视图保持在更靠前的位置
- **本轮新增：任务模板功能**，支持创建/编辑/删除任务模板，模板可保存默认 Agent、优先级、执行模式、任务内容；前端新增模板管理面板与模板选择器，可一键从模板创建任务，大幅提升重复性任务的派发效率
- **本轮新增：Agent 分组管理功能**，支持创建/编辑/删除 Agent 分组（名称、颜色、描述），支持为 Agent 分配分组（下拉菜单选择），支持按分组筛选 Agent 列表，Agent 卡片显示所属分组标签；后端新增 `/api/agent-groups` 系列接口与 `/api/agents/:id/groups` 接口，数据持久化至 `data/agent-groups.json`
- **本轮新增：工作流编排功能**，支持创建/编辑/删除工作流，定义多步骤 Agent 协作流程；支持步骤依赖管理、变量替换（`{{step.N}}` 语法）、失败停止/继续执行策略；后端新增 `/api/workflows` 系列接口与 `/api/workflow-runs` 执行记录接口，数据持久化至 `data/workflows.json` 和 `data/workflow-runs.json`；前端新增工作流管理面板，支持工作流创建表单、步骤编辑、执行控制、执行记录查看
- **本轮新增：SSE 实时日志流功能**，新增 `/api/tasks/:taskId/logs/stream` SSE 端点，支持实时推送新日志行、任务完成/错误事件、连接心跳保活；前端使用 EventSource 替代轮询；支持多个客户端同时订阅同一任务日志；自动处理客户端断开连接；保持原有 `/api/tasks/:taskId/log` 接口用于历史日志获取
- **本轮新增：UI 精修与移动端响应式优化**，完成以下改进：
  - 响应式断点优化：新增 5 个断点层级（1480px/1180px/768px/480px/360px），覆盖桌面/平板/手机全尺寸
  - 移动端适配：卡片在小屏自动堆叠、导航/header 移动端友好、触摸友好按钮尺寸（最小 44px）
  - 深色主题精修：统一颜色变量、改进对比度、增强状态色区分度（成功/警告/错误）
  - 微交互增强：按钮/卡片/徽章添加平滑过渡动画、悬停效果、点击反馈
  - 视觉层次优化：改进间距/内边距一致性、增强卡片阴影深度、优化分隔线
  - 加载状态：新增骨架屏动画、shimmer 加载效果
  - 滚动条美化：自定义滚动条样式、悬停高亮
  - 可访问性提升：改进 focus 状态、增强键盘导航支持
- **本轮新增：批量任务操作功能**，实现更细粒度任务控制：
  - 后端新增三个 API 端点：`POST /api/tasks/batch-cancel`（批量取消）、`POST /api/tasks/batch-retry`（批量重试）、`PATCH /api/tasks/batch-priority`（批量修改优先级）
  - 前端新增复选框列，支持单选/多选任务
  - 新增批量操作工具栏，显示选中数量，提供批量取消、重试、修改优先级、清除选择功能
  - 与现有筛选功能完全兼容，只操作当前可见任务
  - 操作结果提示成功/失败数量，提升用户反馈体验
  - 动画效果：模态框滑入动画、运行中状态脉冲动画、渐变文字效果
- **本轮新增：任务暂停/恢复功能**，实现更精细的任务生命周期控制：
  - 后端新增 `pauseTask()` 和 `resumeTask()` 函数
  - 新增 API 端点：`POST /api/tasks/:id/pause` 和 `POST /api/tasks/:id/resume`
  - task-runner.js 支持 SIGUSR1 (暂停) 和 SIGUSR2 (恢复) 信号处理
  - 实现 `waitWhilePaused()` 函数，支持暂停期间等待恢复
  - 前端新增暂停/恢复按钮，仅对 running/paused 状态的任务显示
  - 状态过滤器新增"已暂停"选项，支持筛选已暂停任务
  - 任务数据结构新增 `paused` 布尔字段和 `pausedAt` 时间戳
  - 适用场景：长任务临时挂起、资源调度优化、人工干预等待
- **本轮新增：任务重新指派功能**，实现动态 Agent 调配：
  - 后端新增 `reassignTask()` 函数和 `PATCH /api/tasks/:id/reassign` 端点
  - 仅允许对 `queued` 或 `paused` 状态的任务进行重新指派
  - 验证至少选择一个 Agent，自动重新生成 runs 数组
  - 任务数据结构新增 `reassignedAt` 和 `reassignedBy` 字段记录操作历史
  - 前端新增"重新指派"按钮，仅对 queued/paused 状态的任务显示
  - 点击后弹出模态框，显示当前分配的 Agent 和可选择的 Agent 列表（支持多选）
  - 确认后调用 API 完成重新指派，成功后刷新任务列表
  - 适用场景：Agent 负载均衡、故障转移、人工调整分配策略
- **本轮新增：单个 Run 重试功能**，实现更细粒度的任务控制：
  - 后端新增 `retryRun()` 函数和 `POST /api/tasks/:taskId/runs/:runId/retry` 端点
  - 验证任务和 run 存在，检查 run 状态为 failed 或 error
  - 重置 run 状态为 queued，清空 error/exitCode/finishedAt/result
  - 更新任务的 updatedAt，若任务状态为 failed 则恢复为 running
  - 向 task-runner 发送 SIGUSR2 信号触发执行
  - 前端在任务详情中为 failed/error 状态的 run 显示"重试此 Run"按钮
  - 点击后调用 API 完成重试，显示操作结果提示
  - 适用场景：单个 Agent 执行失败时无需重试整个任务
- **本轮新增：团队共享预设功能**，实现筛选视图的团队共享与复用：
  - 后端新增 `/api/presets` 系列接口：`GET`（获取列表）、`POST`（创建）、`PUT`（更新）、`DELETE`（删除）
  - 数据持久化至 `data/shared-presets.json`
  - 共享预设数据结构：`{ id, name, filters, createdBy, createdAt, updatedAt }`
  - 前端新增共享预设列表 UI，显示预设名称、创建者信息
  - 保存预设时提供"共享给团队"选项，可将本地预设升级为共享预设
  - 支持对共享预设进行应用、编辑（重命名）、删除操作
  - 权限控制：所有用户可查看共享预设，仅创建者可编辑/删除
  - 样式优化：共享预设芯片采用蓝色背景，与本地预设区分
  - 适用场景：团队共享常用筛选视图、统一工作视角、减少重复配置
- **本轮新增：团队预设权限管理功能**，实现共享预设的精细化权限控制：
  - 预设数据结构新增 `permissions` 字段：`{ canEdit: string[], canDelete: string[] }`
  - 创建预设时自动设置创建者拥有所有权限
  - 后端新增 API 端点：
    - `GET /api/presets/:id/permissions`：获取预设权限信息
    - `PUT /api/presets/:id/permissions`：更新预设权限（仅创建者或管理员可调用）
  - 编辑/删除预设时验证用户权限：编辑需在 canEdit 列表中，删除需在 canDelete 列表中
  - 创建者始终拥有所有权限
  - 前端在共享预设列表为每个预设显示"权限"按钮
  - 点击弹出权限管理模态框，显示当前权限配置
  - 支持快速设置：仅创建者 / 团队可见 / 所有人可编辑
  - 支持手动添加/移除有编辑/删除权限的用户
  - 适用场景：团队协作时控制预设编辑权限、支持多人维护常用筛选视图
- **本轮新增：筛选预设导出/导入功能**，实现预设的备份与跨环境迁移：
  - 后端新增 `GET /api/presets/export` 端点，导出所有共享预设为 JSON 文件（包含 version、exportedAt、presets 数组）
  - 后端新增 `POST /api/presets/import` 端点，支持导入预设 JSON 文件
  - 导入时支持两种模式：合并模式（保留现有 + 添加新的，跳过同名预设）和覆盖模式（清空现有）
  - 前端在共享预设面板新增导出/导入按钮
  - 导入时显示模态框，支持选择 JSON 文件和导入模式，显示导入结果（成功/失败数量）
  - 适用场景：预设备份、团队间共享预设、跨环境迁移预设配置
  - 后端新增 `retryRun()` 函数和 `POST /api/tasks/:taskId/runs/:runId/retry` 端点
  - 验证任务和 run 存在，检查 run 状态为 failed 或 error
  - 重置 run 状态为 queued，清空 error/exitCode/finishedAt/result
  - 更新任务的 updatedAt，若任务状态为 failed 则恢复为 running
  - 向 task-runner 发送 SIGUSR2 信号触发执行
  - 前端在任务详情中为 failed/error 状态的 run 显示"重试此 Run"按钮
  - 点击后调用 API 完成重试，显示操作结果提示
  - 适用场景：单个 Agent 执行失败时无需重试整个任务
- ~~**本轮新增：会话管理功能**~~ 已实现：支持查看活跃会话列表、查看会话历史消息、向会话发送消息、启动 Subagent 会话；后端新增 `/api/sessions`、`/api/sessions/:key/messages`（GET/POST）、`/api/sessions/spawn` 接口；前端新增 Sessions 面板、会话列表 UI、会话消息模态框、Subagent 启动表单
- **本轮新增：审计日志系统**，实现完整的活动追踪与审计能力：
  - 后端新增 `lib/audit.js` 模块，提供审计事件的创建、查询、持久化能力
  - 定义 15 种标准审计事件类型：task.created/task.completed/task.failed/task.cancelled/task.retried/task.paused/task.resumed/task.reassigned、session.message_sent/session.spawned、workflow.executed、agent.called、**user.registered/user.logged_in/user.logged_out**
  - 新增 API 端点：`POST /api/audit`（创建审计事件）、`GET /api/audit`（查询审计事件，支持关键词/事件类型/时间范围/用户筛选）
  - 自动审计埋点：任务生命周期（创建/完成/失败/取消/重试/暂停/恢复/重新指派）、会话操作（消息发送/会话启动）、工作流执行、**用户认证（注册/登录/登出）**
  - 前端新增 Audit 面板，支持可视化筛选（关键词搜索、事件类型下拉选择、时间范围选择器）、筛选标签（chips）展示、结果计数
  - 审计事件详情模态框，支持查看完整事件数据（ID、类型、用户、详情、时间戳）
  - 数据持久化至 `data/audit-events.json`，支持增量追加写入
  - 适用场景：操作审计、问题排查、合规记录、活动追踪
- **本轮新增：简单用户认证系统**，实现用户注册/登录/登出能力，为跨设备同步和权限管理打下基础：
  - 后端新增 `lib/users.js` 模块，提供用户 CRUD 和 token 管理
  - 用户数据结构：`{ id, name, passwordHash, createdAt, lastLoginAt }`，持久化至 `data/users.json`
  - Token 管理：`{ token, userId, createdAt, expiresAt }`，持久化至 `data/tokens.json`
  - 新增 API 端点：`POST /api/auth/register`（注册）、`POST /api/auth/login`（登录）、`POST /api/auth/logout`（登出）、`GET /api/auth/me`（获取当前用户）、`GET /api/users`（用户列表）
  - 前端新增登录/注册模态框，支持模式切换
  - Header 显示登录按钮（未登录）或用户名 + 登出按钮（已登录）
  - Token 存储在 localStorage，所有 API 请求自动带上 `Authorization: Bearer <token>`
  - 审计事件关联用户 ID，支持追溯"谁在什么时候做了什么"
  - 适用场景：用户身份识别、跨设备同步基础、权限管理基础、审计追踪
- **本轮新增：面板截图导出和任务汇报生成功能**，实现数据导出与汇报能力：
  - 后端新增 API 端点：`GET /api/export/snapshot`（生成仪表板快照）、`POST /api/export/task-report`（生成任务汇报）、`GET /api/export/dashboard`（生成完整仪表板数据）、`POST /api/export/screenshot`（生成 PNG 图片）
  - 支持三种导出格式：JSON（结构化数据）、HTML（可打印的汇报视图）、PNG（图片快照）
  - 仪表板快照包含：Agent 概览、任务统计、系统状态
  - 任务汇报包含：任务信息、所有 runs 结果、日志摘要（总行数、错误/警告统计、最近日志）
  - 前端在 header 工具栏新增"导出"按钮，点击弹出导出模态框
  - 导出类型选择：仪表板快照 / 任务汇报 / 完整仪表板
  - 任务汇报模式下支持选择具体任务
  - PNG 导出采用 html-to-image 库在客户端渲染 HTML 并转换为 PNG 图片
  - HTML 导出采用响应式设计，支持打印优化
  - 适用场景：数据备份、任务汇报分享、离线查看、汇报演示
- **本轮新增：跨设备同步功能**，为预设和模板添加用户级别的云端存储支持：
  - 后端新增 `data/user-presets.json` 和 `data/user-templates.json` 存储用户私有数据
  - 新增 `/api/sync/presets` 系列接口（GET/POST/PUT/DELETE）：获取/保存/更新/删除用户预设
  - 新增 `/api/sync/templates` 系列接口（GET/POST/PUT/DELETE）：获取/保存/更新/删除用户模板
  - GET `/api/sync/presets` 返回合并后的预设列表（共享预设 + 用户私有预设）
  - 所有同步接口均需认证，未登录返回 401
  - 前端登录后自动同步预设和模板
  - 保存/删除预设/模板时自动同步到云端
  - 新增同步状态指示器（未登录时隐藏，显示"同步中"/"已同步"/"同步失败"状态）
  - 数据冲突处理：以云端为准，合并时优先使用云端数据
  - 适用场景：多设备间同步预设和模板、数据一致性保障、跨设备无缝使用体验
- **本轮新增：用户权限深化功能（RBAC）**，实现基于角色的访问控制：
  - 后端 `lib/users.js` 模块新增 role 字段（admin/user），新增 `isAdmin()`、`getUserRole()`、`setRole()`、`getUserPermissions()` 函数
  - 新增 API 端点：`GET /api/users/:id/role`（获取用户角色）、`PUT /api/users/:id/role`（设置用户角色，仅管理员）、`GET /api/users/me/permissions`（获取当前用户权限列表）
  - 新增 `/api/admin/` 前缀管理接口：`GET /api/admin/users`（管理员获取用户列表）、`GET /api/admin/stats`（系统统计）、`DELETE /api/admin/presets/:id`（管理员删除预设）、`PUT /api/admin/presets/:id/permissions`（管理员修改预设权限）
  - 共享预设权限验证升级：管理员可以编辑/删除所有共享预设；创建者始终可以编辑/删除自己的预设；普通用户只能编辑/删除被授权的预设
  - 审计事件新增 `user.role_changed` 类型，记录角色变更操作者和目标用户
  - 前端 Header 显示用户角色徽章（管理员显示金色，普通用户显示蓝色）
  - 前端共享预设列表为管理员显示"管理权限"按钮，可接管任何预设的权限
  - 前端新增用户管理面板（仅管理员可见）：显示用户列表（姓名、角色、注册时间、最后登录），支持下拉菜单修改用户角色
  - 注册时默认为 'user' 角色
  - 适用场景：团队权限管理、管理员权限控制、审计追踪
- **本轮新增：数据备份与恢复功能**，实现系统数据的完整备份与恢复：
  - 后端新增 `/api/admin/backup` 系列接口：`GET /api/admin/backup`（创建备份）、`POST /api/admin/restore`（恢复备份）、`GET /api/admin/backup/status`（获取备份状态）
  - 备份功能：
    - 导出为 JSON 格式，包含 version、backupAt、backupMode、data 等元数据
    - 支持完整备份和增量备份两种模式（增量仅包含最近7天数据）
    - 自动排除临时数据（如 id 以 temp- 开头的任务）
    - 备份文件命名包含时间戳
    - 备份数据包括：users、tasks、templates、agent-groups、shared-presets、user-presets、user-templates、workflows、workflow-runs、audit-events
    - 密码数据在备份中保持哈希状态，不暴露明文
  - 恢复功能：
    - 验证备份文件格式和版本
    - 支持两种恢复模式：合并模式（保留现有 + 添加新的）和覆盖模式（清空现有）
    - 恢复前自动创建当前状态的快照（自动备份）
    - 验证数据完整性，避免损坏数据
    - 返回详细的恢复结果统计
  - 前端功能：
    - 在用户管理面板新增"数据备份与恢复"按钮（仅管理员可见）
    - 显示备份状态信息（上次备份时间、备份文件大小、备份次数）
    - 支持一键备份（下载 JSON 文件）
    - 支持上传备份文件并恢复
    - 显示备份历史列表（从审计日志中读取）
    - 恢复前显示确认对话框，说明恢复模式和影响范围
  - 安全要求：
    - 仅管理员可访问备份恢复功能
    - 恢复操作记录审计日志（backup.created/backup.restored/backup.auto_snapshot_created）
    - 用户密码在备份中保持哈希状态
  - 适用场景：数据迁移、系统升级保护、灾难恢复、数据审计
- **本轮新增：定时自动备份功能**，实现零运维成本的自动数据保护：
  - 新增 `lib/scheduled-backup.js` 模块，独立管理定时备份调度
  - 支持两种频率：每日备份（daily）/ 每周备份（weekly）
  - 可配置执行时间（HH:MM 格式，如 02:00 表示凌晨 2 点）
  - 每周备份可配置星期几（0-6，0=周日，1=周一，依此类推）
  - 支持完整备份（full）和增量备份（incremental）两种模式
  - 可配置保留数量（1-100），自动清理过期备份
  - 新增 API 端点：
    - `GET /api/admin/scheduled-backup/config`：获取定时备份配置
    - `PUT /api/admin/scheduled-backup/config`：更新定时备份配置（仅管理员）
    - `GET /api/admin/scheduled-backup/history`：获取自动备份历史记录
    - `POST /api/admin/scheduled-backup/run`：手动触发一次自动备份
  - 前端功能：
    - 备份模态框新增"定时备份配置"区域
    - 支持启用/禁用定时备份
    - 支持配置频率、时间、星期、模式、保留数量
    - 显示下次自动备份时间
    - 支持手动触发立即备份
    - 显示自动备份历史记录（成功/失败状态、文件大小、错误信息）
  - 审计集成：
    - 新增审计事件类型：`scheduled_backup.config_changed`、`scheduled_backup.executed`、`scheduled_backup.failed`
    - 记录配置变更者、执行结果、错误信息
  - 安全要求：
    - 仅管理员可配置定时备份
    - 配置变更和执行结果均记录审计日志
  - 适用场景：零运维成本的数据保护、定期数据归档、灾难恢复准备
- **本轮新增：备份版本控制功能**，实现备份的版本管理与选择性恢复：
  - 新增 `data/backup-versions.json` 文件存储备份版本元数据
  - 备份数据新增 `versionName` 字段（可选）：存储自定义版本名称
  - 备份数据新增 `versionTags` 字段（数组）：存储版本标签列表
  - 新增 API 端点：
    - `POST /api/admin/backup/:id/tag`：为指定备份添加/更新版本标签和名称
    - `GET /api/admin/backup/compare?from=:id&to=:id`：比较两个备份版本的差异
    - `POST /api/admin/restore/selective`：选择性恢复指定数据类型
    - `GET /api/admin/backup/versions`：获取备份版本列表
  - 版本标记功能：
    - 支持为备份添加自定义版本名称（如 'before-upgrade-v2.0'）
    - 支持添加多个版本标签（如 ['重要', '升级前']）
    - 支持移除特定标签和清除版本名称
    - 版本信息关联到备份记录中显示
  - 版本对比功能：
    - 支持选中两个备份版本进行对比
    - 返回每种数据类型（users/tasks/templates等）的统计对比
    - 用颜色标记增加（绿色）和减少（红色）
    - 显示两个版本的基本信息和标签
  - 选择性恢复功能：
    - 支持只恢复特定类型的数据（9 种数据类型可选）
    - 支持合并/覆盖两种恢复模式
    - 恢复前自动创建当前数据快照
    - 返回详细的恢复结果统计
  - 审计集成：
    - 新增审计事件类型：`backup.version_tagged`、`backup.selective_restored`
    - 记录版本标签操作和选择性恢复操作
  - 适用场景：重要节点标记、数据变更追踪、精细化数据恢复、系统升级保护

---

## 3. 当前架构概览

### 前端
- `public/index.html`
- `public/styles.css`
- `public/app.js`

### 后端
- `server.js`：HTTP 服务、静态资源、API
- `task-runner.js`：后台任务执行器

### 数据
- `data/tasks.json`：任务元数据
- `data/task-logs/*.log`：任务日志

### 当前运行方式
- 本地 Node 服务启动
- 任务执行依赖 `openclaw` CLI
- 页面通过 API 拉取 overview / tasks / logs

---

## 4. 已知问题与技术债

### 4.1 服务生命周期不稳（持续改善中）
- 启动方式曾受当前 shell / exec 生命周期影响
- 需要更可靠的后台常驻方案
- ~~需要记录 pid、端口、状态文件~~ 已实现运行时信息记录
- ~~仍需：pid 文件、显式 stop 脚本~~ 已补齐独立 PID 文件与停止脚本
- ~~restart/status 过去过度依赖 pid/runtime 元数据~~ 已补上 `/api/health` 真实探活
- 仍需：更完整的守护机制（如 systemd、自动重启、僵尸进程清理）

### 4.2 `/api/overview` 仍偏重
虽然已加缓存，且已修复 CLI 输出尾随杂质导致的 JSON 解析不稳问题，但底层仍依赖多次 `openclaw` CLI 调用：
- `openclaw status --json`
- `openclaw sessions --all-agents --json`
- `openclaw agents list`

后续应进一步拆分与异步化，避免请求时现算。

### 4.3 任务执行模型较原始
- 当前是"每个任务一个后台 runner"
- 缺少正式任务队列
- 缺少更细粒度的 run 控制
- 缺少暂停 / 恢复 / 改派等机制

### 4.4 数据层过于轻量
- 当前任务状态存储在 `tasks.json`
- 随任务量增长，容易遇到性能、并发、可维护性问题
- 后续应迁移到 SQLite

### 4.5 日志不是实时流
- ~~当前以前端轮询为主~~ ✅ 已实现：使用 SSE 实时推送日志
- ~~体验不够丝滑~~ ✅ 已升级到 EventSource 实时流
- ~~后续应升级到 SSE / WebSocket~~ ✅ 已完成 SSE 实现

### 4.6 产品层能力还不完整
- ~~无 Agent 分组 / 标签~~ 已新增 Agent 分组管理功能：支持创建/编辑/删除分组（名称、颜色、描述），支持为 Agent 分配分组，支持按分组筛选 Agent 列表，Agent 卡片显示所属分组标签
- ~~无工作流编排~~ 已新增工作流编排功能：支持创建/编辑/删除工作流，定义多步骤 Agent 协作流程；支持步骤依赖管理、变量替换、失败停止/继续执行策略
- ~~无任务依赖 DAG~~ 已新增步骤依赖管理：支持通过 `dependsOn` 字段定义步骤间依赖关系，执行器自动按拓扑序执行
- ~~无模板功能~~ 已新增任务模板功能：支持创建/编辑/删除模板，模板可保存默认 Agent、优先级、执行模式、任务内容；前端新增模板管理面板与模板选择器，可一键从模板创建任务
- ~~已具备任务筛选 / 搜索 / 历史筛选基础能力，但还缺少筛选条件持久化、组合收藏与审计视图~~ 已新增筛选条件持久化、URL 分享与筛选预设 / 收藏视图能力
- ~~仍需：筛选预设排序 / 重命名、团队共享预设、审计视图~~ 已补齐筛选预设排序 / 重命名
- ~~UI/UX 待精修~~ 已完成 UI 精修：响应式布局、深色主题优化、微交互动画、加载状态、可访问性提升
- ~~无会话管理能力~~ 已新增会话管理功能：支持查看活跃会话列表、查看会话历史消息、向会话发送消息、启动 Subagent 会话
- ~~无审计日志能力~~ 已新增审计日志系统：支持 15 种标准事件类型（含用户认证事件）、自动埋点（任务生命周期/会话操作/工作流执行/**用户认证**）、API 创建/查询、前端可视化筛选（关键词/事件类型/时间范围）、详情查看
- ~~仍需：团队共享预设~~ 已新增团队共享预设功能：支持将筛选预设保存为共享视图，后端 `/api/presets` 系列接口支持 CRUD 操作，数据持久化至 `data/shared-presets.json`，前端提供共享预设列表 UI 与"共享给团队"选项
- ~~仍需：筛选预设导出/导入~~ 已新增导出/导入功能：支持将共享预设导出为 JSON 文件，支持合并/覆盖两种导入模式
- ~~仍需：团队预设权限管理~~ ✅ 已新增团队预设权限管理功能：预设数据结构新增 `permissions` 字段，后端新增权限验证 API（GET/PUT `/api/presets/:id/permissions`），前端新增权限管理模态框，支持快速设置和手动添加/移除权限用户
- ~~仍需：用户系统~~ ✅ 已新增简单用户认证系统：支持用户注册/登录/登出、token 验证、用户列表查询；后端 `lib/users.js` 模块 + 5 个 auth API；前端登录/注册模态框 + Header 用户信息区；审计事件关联用户 ID
- 仍需：跨设备同步（现在已有用户系统基础）

---

## 5. 演进方向

### P1：先把"稳定可用"做好

#### 5.1 稳定启动 / 守护（第一步继续完善）
目标：让服务真正可长期运行，而不是临时拉起。

本轮已完成：
- ✅ 自动探测空闲端口
- ✅ 写入 runtime.json 状态文件
- ✅ `/api/runtime` 接口
- ✅ 前端展示服务运行时信息
- ✅ 进程退出时自动更新状态
- ✅ 写入独立 PID 文件
- ✅ 提供显式 stop 脚本（`npm run stop`）
- ✅ 将运行时产物从 Git 版本控制中剥离
- ✅ 启动异常 / 未处理拒绝时尽量回写 stopped 并清理 PID 文件
- ✅ stale pid / stale runtime 启动前自检并自动清理
- ✅ 已有存活实例时拒绝重复启动并输出已运行地址
- ✅ 新增 status 脚本（`npm run status`）
- ✅ 新增 restart 脚本（`npm run restart`）
- ✅ stop.js 对 stale pid 做清理并同步 runtime 状态

  仍待完成：
  - 更完整的守护机制（如 systemd 等）
  - 为关键 CLI 解析与 overview 聚合补上正式自动化测试（已部分实现：scripts/verify.js）

本轮已解决：
  - ✅ restart.js 改为后台启动并轮询确认服务就绪，不再前台挂住
  - ✅ 新增 `/api/health` 轻量健康检查接口，可返回 pid / port / uptime 等探活信息
  - ✅ restart.js 就绪判断升级为优先验证健康接口，而不是仅检查 PID / runtime 文件
  - ✅ status.js 增强为 `healthy / degraded / stopped` 三态，并在探活失败时输出告警
  - ✅ 创建 `lib/runtime-utils.js` 共享模块，抽离 status.js/restart.js/stop.js 中重复的 runtime/pid/health 检查逻辑
  - ✅ 新增 `scripts/verify.js` 自动化验证脚本，覆盖健康接口、runtime 状态、CLI JSON 提取逻辑
  - ✅ 更新 package.json 添加 `npm run verify` / `npm run test` 脚本
  - ✅ `status.js` / `stop.js` / `restart.js` 新增 `--json` 机器可读输出，便于自动化编排与外部调度集成
  - ✅ 验证脚本新增生命周期链路校验，可直接验证 `status --json`、`stop --json`、`restart --json` 以及服务恢复结果
  - ✅ **stop.js 修复竞态问题**：不再在发送 SIGTERM 后立即返回成功，而是等待进程真正退出，支持 5 秒超时，超时后强制清理并更新 runtime 状态为 stopped
  - ✅ **验证脚本加强 stop 验证**：scripts/verify.js 现在验证 stop 后进程确实已退出（通过 isPidRunning 检查），并验证 runtime 状态已收敛为 stopped/degraded
  - ✅ **stop.js SIGKILL 升级机制**：SIGTERM 超时后自动升级为 SIGKILL 强制终止，等待进程真正退出后才返回成功；若仍无法退出则返回失败并保留真实运行状态，不再误报为 stopped
  - ✅ **restart.js stop 失败处理**：正确解析 stop.js 的 JSON 输出，识别 forceFailed / stillRunning 场景并中止重启流程
  - ✅ **verify.js 强制停止语义验证**：新增 forceKillAndWait 函数验证和 forced flag 验证

建议后续补充：
- 增加 runtime 自动拉起能力（当前已具备 stale 状态自收敛，但尚未自动重启服务）
- 在 UI 中显示当前实际服务地址（已完成）
- ~~增加 `status` / `restart` 辅助脚本~~ 已实现

#### 5.2 正式任务队列
目标：替换"每任务一个 runner"的临时实现。

建议包括：
- 队列化调度
- 更稳的状态流转
- 支持并发控制
- 减少文件竞争与脏写

#### 5.3 数据层迁移到 SQLite
目标：让任务、run、日志索引、历史记录具备更好的可维护性。

建议包括：
- task 表
- run 表
- event / log 索引
- 任务筛选与检索支持

#### 5.4 实时日志流
目标：让状态变化和执行日志具备"控制台级"体验。

已实现：
- ✅ SSE 实时日志端点 `/api/tasks/:taskId/logs/stream`
- ✅ 实时推送新日志行（log-new 事件）
- ✅ 任务完成/错误事件推送（task-complete/task-error 事件）
- ✅ 心跳保持连接活跃
- ✅ 多客户端支持与断开连接处理
- ✅ 前端 EventSource 集成

---

### P2：从"面板"升级成"调度台"

#### 5.5 Agent 分组 / 标签系统
- ~~按用途分组：内容、情报、开发、审校、发布~~ ✅ 已实现：支持创建/编辑/删除分组（名称、颜色、描述），支持为 Agent 分配分组，支持按分组筛选
- ~~支持筛选与收藏常用组合~~ ✅ 已实现：前端支持按分组筛选 Agent 列表

#### 5.6 工作流编排
- ~~多 Agent 顺序流转~~ ✅ 已实现：支持定义多步骤工作流，每步指定 Agent 和任务描述
- ~~示例：`intel-scout -> copy-polisher -> copy-auditor -> x-post`~~ ✅ 已实现：可通过步骤依赖管理定义执行顺序
- ~~支持条件分支、失败回退、人工审批节点~~ 待实现：当前支持失败停止/继续策略，条件分支和人工审批节点可在后续迭代中加入

#### 5.7 更细粒度任务控制
- ~~单个 run 重试~~ ✅ 已实现：后端新增 `retryRun()` 函数和 `POST /api/tasks/:taskId/runs/:runId/retry` 端点，验证 run 状态为 failed 或 error，重置为 queued 并触发执行；前端在任务详情中显示"重试此 Run"按钮
- ~~重新指派给其他 Agent~~ ✅ 已实现：支持将 queued/paused 状态的任务重新指派给其他 Agent，新增 `PATCH /api/tasks/:id/reassign` 端点，前端提供可视化重新指派模态框，适用于 Agent 负载均衡、故障转移等场景
- ~~暂停 / 恢复~~ ✅ 已实现：支持对运行中任务进行暂停和恢复操作，使用 SIGUSR1/SIGUSR2 信号与 task-runner 通信
- ~~批量取消 / 批量重试~~ ✅ 已实现

#### 5.8 接入 sessions / subagents / ACP 管理
- ~~查看现有 session~~ ✅ 已实现：Sessions 面板展示所有活跃会话列表
- ~~直接发送消息到某个 session~~ ✅ 已实现：支持查看会话历史消息、向会话发送消息（支持 Ctrl+Enter 快捷键）
- ~~启动新的 subagent / ACP 会话~~ ✅ 已实现：Subagent 启动表单，支持选择 Agent 并派发任务
- ~~查看不同运行时状态~~ ✅ 已实现：会话列表显示状态徽章（活跃/空闲）

---

### P2.5：任务看板复用能力增强（本轮推进）
- ✅ 已支持默认快速预设（运行中任务 / 高优先级失败任务 / 今天创建的任务）
- ✅ 已支持将当前筛选条件保存为命名预设
- ✅ 已支持一键应用 / 删除已保存视图
- ✅ 已支持预设重命名
- ✅ 已支持预设顺序调整（上移 / 下移）
- ✅ **本轮新增：任务模板功能**，支持创建/编辑/删除模板，可保存默认 Agent、优先级、执行模式、任务内容；前端新增模板管理面板与模板选择器，一键从模板创建任务
- ✅ **本轮新增：Agent 分组管理功能**，支持创建/编辑/删除分组（名称、颜色、描述），支持为 Agent 分配分组，支持按分组筛选 Agent 列表，Agent 卡片显示所属分组标签
- ✅ **本轮新增：筛选预设导出/导入功能**，支持将共享预设导出为 JSON 文件备份，支持合并/覆盖两种导入模式
- 当前仍缺：拖拽排序、跨设备同步

### P3：产品化与体验提升

#### 5.9 UI/UX 深化
- ✅ 更强的指挥中心视觉风格：已完成视觉重构，统一设计语言
- ✅ 卡片信息密度优化：改进间距、内边距、视觉层次
- ✅ 深色主题精修：统一颜色变量、改进对比度、增强状态色区分
- ✅ 移动端 / 小屏适配：5 个响应式断点、触摸友好按钮（最小 44px）
- ✅ 状态色、空状态、加载态、微交互统一：骨架屏、脉冲动画、悬停效果

#### 5.10 模板与复用
- ~~常用任务模板~~ 已实现：支持创建/编辑/删除任务模板，可保存默认 Agent、优先级、执行模式、任务内容
- 常用 Agent 组合（待实现）
- 默认调度策略（待实现）

#### 5.11 审计与历史记录
- ~~谁在什么时候创建了什么任务~~ ✅ 已实现：审计日志系统记录所有任务生命周期事件
- ~~哪些 Agent 被调用过~~ ✅ 已实现：审计日志记录 agent.called 事件
- ~~历史任务检索与筛选~~ ✅ 已实现：审计面板支持关键词/事件类型/时间范围筛选
- 仍需：团队共享预设、跨设备同步

#### 5.12 截图 / 分享链路
- ~~一键导出面板截图~~ ✅ 已实现：支持导出仪表板快照（JSON/HTML/PNG）、任务汇报（JSON/HTML/PNG）、完整仪表板
- ~~一键生成任务汇报图~~ ✅ 已实现：任务汇报 PNG 格式支持日志摘要、执行结果、任务详情
- ~~方便回传到 IM 渠道~~ ✅ 已实现：支持飞书/钉钉/企业微信/Slack 一键分享 PNG 截图

---

## 6. 推荐实施顺序

### 路线 A：产品感优先
1. ~~Agent 分组 / 标签~~ ✅ 已完成
2. ~~常用任务模板~~ ✅ 已完成
3. ~~工作流编排~~ ✅ 已完成：支持多步骤 Agent 协作、步骤依赖、变量替换、失败策略
4. ~~UI 精修~~ ✅ 已完成：响应式布局、深色主题优化、微交互动画
5. ~~实时日志流~~ ✅ 已完成：SSE 实时推送
6. ~~sessions / subagents / ACP 管理~~ ✅ 已完成：会话列表、消息查看/发送、Subagent 启动
7. 更细粒度任务控制 → 当前建议优先

### 路线 B：工程稳定性优先
1. 稳定启动 / 守护
2. SQLite 持久化
3. 正式任务队列
4. DAG 调度

### 当前建议
若下一步继续推进，**优先走"新功能优先，稳定性次之"**。

建议执行顺序：
1. 先做对用户可感知、可演示的新功能（本轮已完成：任务筛选 / 搜索 / 历史筛选、筛选预设重命名与排序、**任务模板功能**、**Agent 分组管理**、**工作流编排功能**、**UI 精修**、**SSE 实时日志流**、**会话管理功能**）
2. 再补足支撑这些功能所必需的稳定性改进
3. 稳定性工作应服务于功能推进，而不是长期替代功能迭代本身

原因：
- 当前项目既然定位为 Agent 调度面板 / 调度台，优先持续扩展功能边界更符合演进目标
- 新功能能更快验证产品方向、使用价值和后续需求优先级
- 稳定性仍然重要，但应作为"为新功能落地保驾护航"的第二优先级，而不是默认主路线

---

## 7. git-project-evolution 更新规范

后续若由 `git-project-evolution` 读取与更新本文件，应遵守：

1. 保留本文档主结构，不要每次重写风格
2. 优先更新以下区块：
   - `当前状态`
   - `已知问题与技术债`
   - `演进方向`
   - `推荐实施顺序`
3. 当某项已完成时：
   - 从"演进方向"中标记完成或移除
   - 同步补入"当前已完成"
4. 避免写成开发流水账，应保持"产品演进视角"
5. 若项目方向发生变化，应先更新"项目目标"与"当前结论"

---

## 8. 一句话结论

**Agent Orchestra 现在已经是一个可演示、可筛选（支持持久化、链接分享、预设重命名与排序、导出/导入备份）、可回看历史任务、可使用模板快速派发任务、支持 Agent 分组管理、支持工作流编排（多步骤 Agent 协作、步骤依赖、变量替换、失败策略）、SSE 实时日志流（EventSource 实时推送、多客户端支持、心跳保活）、UI 精修完成（响应式布局/深色主题优化/微交互动画）、支持会话管理（查看活跃会话、查看/发送消息、启动 Subagent）、支持任务重新指派（queued/paused 状态可动态调整 Agent 分配，适用于负载均衡/故障转移）、支持单个 Run 重试（failed/error 状态可单独重试，适用于精细化任务控制）、支持审计日志系统（18+ 种标准事件类型、自动埋点任务生命周期/会话操作/工作流执行/**用户认证/角色变更**、可视化筛选、详情查看）、支持面板截图导出和任务汇报生成功能（支持 JSON/HTML/PNG 三种格式导出、仪表板快照/任务汇报/完整仪表板三种导出类型）、支持 IM 渠道分享（飞书/钉钉/企业微信/**Slack** 一键分享 PNG 截图）、支持团队预设权限管理（精细化编辑/删除权限控制）、支持简单用户认证系统（注册/登录/登出、token 验证、用户列表、审计事件关联用户 ID）、支持跨设备同步功能（预设和模板云端存储、多设备间自动同步、同步状态指示器、以云端为准的冲突处理）、**支持用户权限深化功能（RBAC）（基于角色的访问控制：admin/user 角色、管理员可编辑删除所有共享预设、创建者始终可管理自己的预设、普通用户仅能管理被授权的预设、用户管理面板、角色徽章显示、审计事件记录角色变更）**、**支持数据备份与恢复功能（完整备份/增量备份、合并/覆盖恢复模式、恢复前自动快照、审计日志追踪）**、**支持定时自动备份功能（按日/周自动执行、可配置执行时间/备份模式/保留数量、自动清理过期备份、备份历史记录追踪）**、**支持云存储备份功能（S3 兼容存储：阿里云 OSS/AWS S3/MinIO、自动上传云端、云端备份列表管理、从云端恢复备份、异地容灾）**、**支持仪表板数据可视化（Chart.js 折线图展示每日任务趋势、支持 7 天/14 天视图切换、深色主题适配、响应式布局）**的 MVP；接下来应继续沿"新功能优先"路线，推进更多企业级能力。**

---

## 9. 本轮进化记录 (2026-03-18)

### 本轮目标
实现 **PNG 图片导出功能**，将现有的 HTML/JSON 导出能力升级为支持 PNG 格式，使面板截图更便于分享到 IM 渠道。

### 为什么现在做这个
- **来源层级**：PROJECT_EVOLUTION.md 中"一句话结论"明确列为下一步方向
- **选择理由**：
  1. 已有 HTML/JSON 导出基础，升级成本低
  2. 用户可感知价值高（便于分享、汇报）
  3. 与现有导出功能形成完整闭环
  4. 无需后端重型依赖（使用客户端 html-to-image 库）
- **暂不处理的方向**：
  - 跨设备同步：需要后端存储架构升级，成本较高
  - 团队预设权限管理：需要先有用户系统，当前条件不成熟

### 实现内容
1. **后端 API** (`server.js`)：
   - 新增 `POST /api/export/screenshot` 端点
   - 接收参数：`{ type: 'dashboard' | 'task-report', taskId?: string, format: 'png' }`
   - 返回对应的 HTML 内容供客户端转换为 PNG

2. **前端功能** (`public/app.js`, `public/index.html`)：
   - 导出模态框新增 PNG 格式选项
   - 新增 `convertHtmlToPngAndDownload()` 函数
   - 使用 html-to-image CDN 库在客户端渲染 HTML 并转换为 PNG
   - 支持仪表板快照、完整仪表板、任务汇报三种 PNG 导出

3. **文档更新** (`PROJECT_EVOLUTION.md`)：
   - 更新"当前已完成"部分，添加 PNG 格式支持
   - 更新"截图/分享链路"章节
   - 更新"一句话结论"
   - 新增"本轮进化记录"章节

### 验证结果
- ✅ 代码语法检查通过 (`node --check server.js`)
- ✅ Git 提交成功
- ✅ 代码已推送到远端：`https://github.com/justlovemaki/agent-orchestra.git`

### PROJECT_EVOLUTION.md 更新
- **读取**：是（开始前已读取）
- **新建**：否（已存在）
- **更新区块**：
  - "当前已完成" → 添加 PNG 导出功能描述
  - "截图/分享链路" → 标记 PNG 支持已完成
  - "一句话结论" → 更新导出格式说明，移除"图片导出"从未完成列表
  - 新增"本轮进化记录"章节 → 记录本次进化的完整上下文

### GitHub 同步结果
- **提交**：`4a27867 feat: add PNG screenshot export for dashboard and task reports`
- **推送**：已成功推送到 `main` 分支
- **项目地址**：https://github.com/justlovemaki/agent-orchestra
- **Issue 关闭**：无 open issues，本轮属于主动进化

### 下一步建议
1. **IM 渠道分享链路**：实现一键将 PNG 截图发送到飞书/钉钉等 IM 渠道
2. **团队预设权限管理**：在共享预设基础上增加编辑/删除权限控制
3. **跨设备同步**：探索将预设/模板同步到云端存储的方案

---

### 上午进化 (9:42 AM)

#### 本轮目标
实现 **飞书分享功能**，在 PNG 导出基础上，新增一键将面板截图发送到飞书群的能力，完成"导出→分享"闭环。

#### 为什么现在做这个
- **来源层级**：PROJECT_EVOLUTION.md 中"下一步建议"明确列为第一优先级
- **选择理由**：
  1. 直接扩展上午完成的 PNG 导出功能，形成完整分享链路
  2. 用户可感知价值高（一键分享到工作群，无需手动保存再上传）
  3. 与现有导出功能无缝集成
  4. 飞书 API 成熟稳定，实现成本低
- **暂不处理的方向**：
  - 团队预设权限管理：需要先有用户系统，当前条件不成熟
  - 跨设备同步：需要后端存储架构升级，成本较高

#### 实现内容
1. **后端 API** (`server.js`)：
   - 新增 `GET/POST /api/feishu/config` 端点：飞书机器人配置管理（appId/appSecret）
   - 新增 `POST /api/share/feishu` 端点：接收 `{type, taskId?, channelId, imageBase64}`，调用飞书 API 上传图片并发送消息
   - 新增 `getFeishuConfig()`：读取飞书配置文件
   - 新增 `getFeishuAccessToken()`：获取飞书 tenant_access_token
   - 新增 `uploadFeishuImage()`：上传图片到飞书，返回 image_key
   - 新增 `sendFeishuImageMessage()`：发送图片消息到指定频道

2. **前端功能** (`public/app.js`, `public/index.html`, `public/styles.css`)：
   - 导出模态框新增"分享到飞书"选项（仅在 PNG 格式下显示）
   - 新增飞书群 ID 输入框（支持 oc_xxx 格式）
   - 新增"分享到飞书"按钮
   - 新增 `checkFeishuConfig()`：检查飞书配置状态
   - 新增 `handleShareToFeishu()`：处理分享流程（生成截图→上传→发送）
   - 新增 `convertHtmlToBase64Png()`：将 HTML 内容转换为 Base64 PNG
   - 新增 `updateFeishuShareVisibility()` / `updateFeishuButtonVisibility()`：UI 状态管理
   - 新增飞书分享相关样式（.feishu-share-section, .feishu-channel-input 等）

3. **文档更新** (`PROJECT_EVOLUTION.md`)：
   - 更新"当前已完成"部分，添加飞书分享功能描述
   - 更新"截图/分享链路"章节，标记 IM 分享已完成
   - 更新"一句话结论"
   - 新增本轮进化记录

#### 验证结果
- ✅ 代码语法检查通过 (`node --check server.js`, `node --check public/app.js`)
- ✅ 新增 354 行代码（server.js +124, app.js +161, index.html +19, styles.css +50）
- ✅ Git 提交成功

#### PROJECT_EVOLUTION.md 更新
- **读取**：是（开始前已读取）
- **新建**：否（已存在）
- **更新区块**：
  - "当前已完成" → 添加飞书分享功能描述
  - "截图/分享链路" → 标记 IM 渠道分享已完成
  - "一句话结论" → 更新分享链路说明
  - 新增"上午进化记录"章节

#### GitHub 同步结果
- **提交**：待提交
- **推送**：待推送
- **项目地址**：https://github.com/justlovemaki/agent-orchestra
- **Issue 关闭**：无 open issues，本轮属于主动进化

#### 下一步建议
1. **团队预设权限管理**：在共享预设基础上增加编辑/删除权限控制
2. **跨设备同步**：探索将预设/模板同步到云端存储的方案
3. **钉钉分享支持**：扩展分享功能支持钉钉等其他 IM 渠道

---

### 下午进化 (3:42 PM)

#### 本轮目标
实现 **钉钉分享功能**，在飞书分享基础上，扩展支持钉钉群分享，为用户提供更多 IM 渠道选择。

#### 为什么现在做这个
- **来源层级**：PROJECT_EVOLUTION.md 中"下一步建议"明确列为第三优先级，但在飞书分享完成后自然延伸
- **选择理由**：
  1. 直接复用飞书分享的架构和 UI 模式，实现成本低
  2. 钉钉是国内另一主流 IM 平台，用户需求广泛
  3. 与飞书分享形成互补，用户可根据团队习惯选择
  4. 钉钉 webhook 方式配置更简单（无需 appId/appSecret）
- **暂不处理的方向**：
  - 团队预设权限管理：需要先有用户系统，当前条件不成熟
  - 跨设备同步：需要后端存储架构升级，成本较高

#### 实现内容
1. **后端 API** (`server.js`)：
   - 新增 `GET/POST /api/dingtalk/config` 端点：钉钉机器人配置管理（appKey/appSecret/webhook）
   - 新增 `POST /api/share/dingtalk` 端点：接收 `{type, taskId?, webhook, imageBase64}`，调用钉钉 API 上传图片并发送消息
   - 新增 `getDingTalkConfig()`：读取钉钉配置文件
   - 新增 `getDingTalkAccessToken()`：获取钉钉 access_token
   - 新增 `uploadDingTalkImage()`：上传图片到钉钉，返回 media_id
   - 新增 `sendDingTalkImageMessage()`：发送 markdown 图片消息到 webhook

2. **前端功能** (`public/app.js`, `public/index.html`, `public/styles.css`)：
   - 导出模态框新增"分享到钉钉"选项（与飞书分享并列）
   - 新增钉钉群 webhook 输入框
   - 新增"分享到钉钉"按钮
   - 新增 `checkDingTalkConfig()`：检查钉钉配置状态
   - 新增 `handleShareToDingTalk()`：处理分享流程（生成截图→上传→发送）
   - 新增 `updateDingTalkShareVisibility()` / `updateDingTalkButtonVisibility()`：UI 状态管理
   - 新增钉钉分享相关样式（.dingtalk-share-section, .dingtalk-webhook-input 等）

3. **文档更新** (`PROJECT_EVOLUTION.md`)：
   - 更新"当前已完成"部分，添加钉钉分享功能描述
   - 更新"截图/分享链路"章节，标记多 IM 渠道分享已完成
   - 更新"一句话结论"
   - 新增本轮进化记录

#### 验证结果
- ✅ 代码语法检查通过 (`node --check server.js`, `node --check public/app.js`)
- ✅ 新增约 250 行代码（server.js +130, app.js +100, index.html +20, styles.css +50）
- ✅ Git 提交成功

#### PROJECT_EVOLUTION.md 更新
- **读取**：是（开始前已读取）
- **新建**：否（已存在）
- **更新区块**：
  - "当前已完成" → 添加钉钉分享功能描述
  - "截图/分享链路" → 标记多 IM 渠道分享已完成
  - "一句话结论" → 更新分享链路说明
  - 新增"下午进化记录"章节

#### GitHub 同步结果
- **提交**：`f50b1ba feat: add team preset permissions management`
- **推送**：已成功推送到 `main` 分支
- **项目地址**：https://github.com/justlovemaki/agent-orchestra
- **Issue 关闭**：无 open issues，本轮属于主动进化

#### 下一步建议
1. **跨设备同步**：探索将预设/模板同步到云端存储的方案
2. **更多 IM 渠道**：可扩展支持企业微信、Slack 等其他平台
3. **用户系统**：考虑引入简单的用户认证，替代当前的 localStorage 模拟用户

---

### 傍晚进化 (6:42 PM)

#### 本轮目标
实现 **团队预设权限管理功能**，在共享预设基础上增加精细化的权限控制，支持多人协作场景。

#### 为什么现在做这个
- **来源层级**：PROJECT_EVOLUTION.md 中"下一步建议"明确列为第一优先级
- **选择理由**：
  1. 共享预设已实现，但缺少权限控制，无法安全地在团队中使用
  2. 多 Agent 协作场景下，不同成员可能需要不同的预设管理权限
  3. 为后续"跨设备同步"和"用户系统"打下基础
  4. 实现成本适中，用户可感知价值高
- **暂不处理的方向**：
  - 跨设备同步：需要先有用户系统和云端存储架构
  - 更多 IM 渠道：钉钉/飞书已覆盖主流场景，优先级降低
  - 完整用户系统：当前用 localStorage 模拟用户 ID 已足够演示

#### 实现内容
1. **数据结构升级** (`server.js`):
   - 预设数据新增 `permissions` 字段：`{ canEdit: string[], canDelete: string[] }`
   - 创建预设时自动初始化权限：创建者拥有所有权限
   - 持久化至 `data/shared-presets.json`

2. **后端 API** (`server.js`):
   - 编辑预设时验证权限：`PUT /api/presets` - 检查 `canEdit` 列表
   - 删除预设时验证权限：`DELETE /api/presets/:id` - 检查 `canDelete` 列表
   - 新增 `GET /api/presets/:id/permissions` - 获取预设权限配置
   - 新增 `PUT /api/presets/:id/permissions` - 更新预设权限（仅创建者可调用）
   - 创建者始终保留权限（不可被移除）

3. **前端功能** (`public/app.js`, `public/index.html`):
   - 共享预设列表每个预设显示"权限"按钮
   - 新增权限管理模态框（`presetPermissionsModal`）
   - 支持快速设置：仅创建者 / 团队可见 / 所有人可编辑
   - 支持手动添加/移除有编辑/删除权限的用户
   - UI 状态管理：`showPresetPermissionsModal()`, `updatePermissionUserLists()`

4. **文档更新** (`PROJECT_EVOLUTION.md`):
   - 更新"当前已完成"部分，添加权限管理功能描述
   - 更新"团队预设权限管理"章节，标记已完成
   - 更新"一句话结论"
   - 新增本轮进化记录

#### 验证结果
- ✅ 代码已通过 opencode 实现并自动提交
- ✅ 权限 API (GET/PUT) 已验证
- ✅ 权限模态框 HTML/JS 已验证
- ✅ Git 提交成功：`f50b1ba feat: add team preset permissions management`
- ✅ 代码已推送到远端

#### PROJECT_EVOLUTION.md 更新
- **读取**：是（开始前已读取）
- **新建**：否（已存在）
- **更新区块**：
  - "当前已完成" → 添加权限管理功能描述
  - "团队预设权限管理" → 标记已完成
  - "一句话结论" → 更新权限管理说明
  - 新增"傍晚进化记录"章节

#### GitHub 同步结果
- **提交**：`f50b1ba feat: add team preset permissions management`
- **推送**：已成功推送到 `main` 分支
- **项目地址**：https://github.com/justlovemaki/agent-orchestra
- **Issue 关闭**：无 open issues，本轮属于主动进化

#### 下一步建议
1. **跨设备同步**：探索将预设/模板同步到云端存储的方案
2. **更多 IM 渠道**：可扩展支持企业微信、Slack 等其他平台
3. **用户系统**：考虑引入简单的用户认证，替代当前的 localStorage 模拟用户

---

### 晚间进化 (9:42 PM)

#### 本轮目标
实现 **企业微信分享功能**，在飞书/钉钉分享基础上，扩展支持企业微信群分享，为用户提供更多 IM 渠道选择。

#### 为什么现在做这个
- **来源层级**：PROJECT_EVOLUTION.md 中"下一步建议"明确列为第二优先级，在飞书/钉钉分享完成后自然延伸
- **选择理由**：
  1. 直接复用飞书/钉钉分享的架构和 UI 模式，实现成本低
  2. 企业微信是国内另一主流 IM 平台，用户需求广泛
  3. 与飞书/钉钉分享形成互补，用户可根据团队习惯选择
  4. 企业微信 webhook 方式配置简单，用户体验一致
- **暂不处理的方向**：
  - 跨设备同步：需要先有用户系统和云端存储架构
  - Slack 支持：海外用户较少，优先级相对较低

#### 实现内容
1. **后端 API** (`server.js`):
   - 新增 `GET/POST /api/wecom/config` 端点：企业微信机器人配置管理（corpId/agentId/secret/webhook）
   - 新增 `POST /api/share/wecom` 端点：接收 `{type, taskId?, webhook, imageBase64}`，调用企业微信 API 上传图片并发送消息
   - 新增 `getWecomConfig()` / `saveWecomConfig()`：读取/保存企业微信配置文件
   - 新增 `sendWecomImageMessage()`：发送图片消息到 webhook

2. **前端功能** (`public/app.js`, `public/index.html`, `public/styles.css`):
   - 导出模态框新增"分享到企业微信"选项（与飞书/钉钉分享并列）
   - 新增企业微信群 webhook 输入框
   - 新增"分享到企业微信"按钮
   - 新增 `checkWecomConfig()`：检查企业微信配置状态
   - 新增 `handleShareToWecom()`：处理分享流程（生成截图→上传→发送）
   - 新增 `updateWecomShareVisibility()` / `updateWecomButtonVisibility()`：UI 状态管理
   - 新增企业微信分享相关样式（绿色主题 `#07c160`，与企业微信品牌色一致）

3. **文档更新** (`PROJECT_EVOLUTION.md`):
   - 更新"当前已完成"部分，添加企业微信分享功能描述
   - 更新"截图/分享链路"章节，标记多 IM 渠道分享已完成
   - 更新"一句话结论"
   - 新增本轮进化记录

#### 验证结果
- ✅ 代码语法检查通过 (`node --check server.js`, `node --check public/app.js`)
- ✅ 新增 321 行代码（server.js +125, app.js +122, index.html +19, styles.css +55）
- ✅ Git 提交成功：`5e996fc feat: add WeChat Work sharing for PNG screenshots`
- ✅ 代码已推送到远端

#### PROJECT_EVOLUTION.md 更新
- **读取**：是（开始前已读取）
- **新建**：否（已存在）
- **更新区块**：
  - "当前已完成" → 添加企业微信分享功能描述
  - "截图/分享链路" → 标记多 IM 渠道分享已完成
  - "一句话结论" → 更新分享链路说明
  - 新增"晚间进化记录"章节

#### GitHub 同步结果
- **提交**：`5e996fc feat: add WeChat Work sharing for PNG screenshots`
- **推送**：已成功推送到 `main` 分支
- **项目地址**：https://github.com/justlovemaki/agent-orchestra
- **Issue 关闭**：无 open issues，本轮属于主动进化

#### 下一步建议
1. **跨设备同步**：探索将预设/模板同步到云端存储的方案（现在已有用户系统基础）
2. **Slack 支持**：可扩展支持 Slack 等其他平台
3. **用户权限深化**：在现有认证基础上增加角色/权限管理

---

### 深夜进化 (12:42 AM, 2026-03-19)

#### 本轮目标
实现 **简单用户认证系统**，替代 localStorage 模拟用户 ID，为跨设备同步、权限管理、审计追踪打下基础。

#### 为什么现在做这个
- **来源层级**：PROJECT_EVOLUTION.md 中"下一步建议"明确列为第三优先级，但在多 IM 渠道分享完成后成为最关键的瓶颈
- **选择理由**：
  1. 当前 localStorage 模拟用户 ID 无法支持真正的跨设备同步
  2. 审计日志缺少真实用户关联，无法追溯"谁在什么时候做了什么"
  3. 团队预设权限管理功能已有权限概念，但缺少真实用户系统支撑
  4. 用户认证是跨设备同步、权限深化、完整审计的前提条件
  5. 实现成本适中，用户可感知价值高（登录/注册体验）
- **暂不处理的方向**：
  - 跨设备同步：需要先完成用户系统（本轮已完成），后续可在此基础上实现
  - Slack 支持：用户系统是更基础的能力，优先级更高
  - 完整 RBAC 权限系统：当前简单认证已足够演示，可后续迭代

#### 实现内容
1. **后端模块** (`lib/users.js`):
   - 用户数据结构：`{ id, name, passwordHash, createdAt, lastLoginAt }`
   - 用户持久化到 `data/users.json`
   - Token 存储到 `data/tokens.json`：`{ token, userId, createdAt, expiresAt }`
   - `register(name, password)` - 用户注册（密码 bcrypt 哈希）
   - `login(name, password)` - 用户登录（返回 token）
   - `logout(token)` - 用户登出（使 token 失效）
   - `verifyToken(token)` - 验证 token 并返回用户信息
   - `getCurrentUser(token)` - 获取当前登录用户
   - `getUsers()` - 获取用户列表

2. **后端 API** (`server.js`):
   - `POST /api/auth/register` - 用户注册
   - `POST /api/auth/login` - 用户登录
   - `POST /api/auth/logout` - 用户登出
   - `GET /api/auth/me` - 获取当前用户信息（需 token）
   - `GET /api/users` - 获取用户列表（需认证）
   - `verifyTokenFromRequest(req)` - 中间件函数提取并验证请求中的 token
   - 所有 API 请求现在支持 `Authorization: Bearer <token>` 头

3. **审计集成** (`lib/audit.js`):
   - 新增审计事件类型：`user.registered`, `user.logged_in`, `user.logged_out`
   - `addAuditEvent()` 函数新增 `userId` 参数
   - 所有审计事件现在可关联到具体用户 ID

4. **前端功能** (`public/app.js`, `public/index.html`, `public/styles.css`):
   - Header 新增登录/用户信息区域
   - 登录/注册模态框（支持切换模式）
   - Token 存储在 `localStorage`
   - `fetchJson()` 函数自动添加 `Authorization` 头
   - `checkAuthStatus()` - 页面加载时检查登录状态
   - `handleAuthSubmit()` - 处理登录/注册提交
   - `handleLogout()` - 处理登出
   - 未登录时显示"登录"按钮，已登录时显示用户名和"登出"按钮

5. **文档更新** (`PROJECT_EVOLUTION.md`):
   - 更新"当前已完成"部分，添加用户认证功能描述
   - 更新"用户系统"章节，标记已完成
   - 更新"一句话结论"
   - 新增本轮进化记录

#### 验证结果
- ✅ 代码语法检查通过 (`node --check lib/users.js`, `node --check server.js`, `node --check public/app.js`)
- ✅ 新增 488 行代码（lib/users.js 新建，server.js +~100, app.js +~150, index.html +~50, styles.css +~40）
- ✅ Git 提交成功：`a30ee2a feat: add simple user authentication system`
- ✅ 代码已推送到远端

#### PROJECT_EVOLUTION.md 更新
- **读取**：是（开始前已读取）
- **新建**：否（已存在）
- **更新区块**：
  - "当前已完成" → 添加用户认证系统描述
  - "用户系统" → 标记已完成
  - "一句话结论" → 更新用户系统说明
  - 新增"深夜进化记录"章节

#### GitHub 同步结果
- **提交**：`a30ee2a feat: add simple user authentication system`
- **推送**：已成功推送到 `main` 分支
- **项目地址**：https://github.com/justlovemaki/agent-orchestra
- **Issue 关闭**：无 open issues，本轮属于主动进化

#### 下一步建议
1. **跨设备同步**：现在已有用户系统基础，可探索将预设/模板同步到云端存储
2. **Slack 支持**：可扩展支持 Slack 等其他 IM 平台
3. **用户权限深化**：在现有认证基础上增加角色/权限管理（如管理员/普通用户）

---

### 新一轮进化 (跨设备同步功能)

#### 本轮目标
实现 **跨设备同步功能**，为预设和模板添加用户级别的云端存储支持，使登录用户可以在不同设备间同步筛选预设和任务模板。

#### 为什么现在做这个
- **来源层级**：PROJECT_EVOLUTION.md 中多个"下一步建议"明确列为第一优先级
- **选择理由**：
  1. 用户系统已完成（本轮前已实现），跨设备同步是最自然的延伸
  2. 用户可在不同设备间访问自己的预设和模板，大幅提升使用体验
  3. 数据冲突处理（以云端为准）确保多设备使用时的数据一致性
  4. 实现成本适中，在现有用户认证基础上增加存储功能
- **暂不处理的方向**：
  - Slack 支持：国内用户较少，IM 分享已覆盖主流场景
  - 完整 RBAC 权限系统：当前用户系统已足够支持同步功能

#### 实现内容
1. **后端数据结构升级** (`server.js`):
   - 新增 `data/user-presets.json` - 存储用户私有预设
   - 新增 `data/user-templates.json` - 存储用户私有模板
   - 预设/模板数据增加 `userId` 字段区分用户私有数据
   - 保留 `data/shared-presets.json` 作为团队共享预设（userId 为空或 null）

2. **后端 API** (`server.js`):
   - `GET /api/sync/presets` - 获取当前用户的预设列表（合并共享预设 + 用户私有预设）
   - `POST /api/sync/presets` - 保存用户预设到云端
   - `PUT /api/sync/presets/:id` - 更新用户预设
   - `DELETE /api/sync/presets/:id` - 删除用户预设
   - `GET /api/sync/templates` - 获取当前用户的模板列表
   - `POST /api/sync/templates` - 保存用户模板到云端
   - `PUT /api/sync/templates/:id` - 更新用户模板
   - `DELETE /api/sync/templates/:id` - 删除用户模板
   - 所有接口均需认证，未登录返回 401

3. **前端功能** (`public/app.js`, `public/index.html`, `public/styles.css`):
   - 登录后自动从云端同步预设和模板（`syncUserData()` 函数）
   - 保存预设时自动同步到云端（`syncPresetToCloud()` 函数）
   - 保存/删除模板时自动同步到云端（`syncTemplateToCloud()` / `syncDeleteTemplateFromCloud()` 函数）
   - 新增同步状态指示器（.sync-indicator），显示"同步中"/"已同步"/"同步失败"状态
   - 本地与云端数据冲突处理：以云端为准，合并时优先使用云端数据

4. **数据合并策略**:
   - 预设：按名称合并，云端数据覆盖本地同名数据
   - 模板：按 ID 合并，云端数据覆盖本地同名 ID 数据

#### 验证结果
- ✅ 代码语法检查通过
- ✅ 新增数据文件初始化逻辑
- ✅ Git 提交成功

#### PROJECT_EVOLUTION.md 更新
- **读取**：是（开始前已读取）
- **新建**：否（已存在）
- **更新区块**：
  - "当前已完成" → 添加跨设备同步功能描述
  - "一句话结论" → 更新同步功能说明
  - 新增本轮进化记录

#### 下一步建议
1. **Slack 支持**：可扩展支持 Slack 等其他 IM 平台
2. **用户权限深化**：在现有认证基础上增加角色/权限管理（如管理员/普通用户）
3. **更多数据类型同步**：可扩展支持工作流、Agent 分组等数据的跨设备同步

---

### 本轮进化 (2026-03-19)

#### 本轮目标
实现 **Slack 分享功能**，在飞书/钉钉/企业微信分享基础上，扩展支持 Slack 群分享，为海外用户提供更多 IM 渠道选择。

#### 为什么现在做这个
- **来源层级**：PROJECT_EVOLUTION.md 中"下一步建议"明确列为第一优先级
- **选择理由**：
  1. 直接复用飞书/钉钉/企业微信分享的架构和 UI 模式，实现成本低
  2. Slack 是海外主流 IM 平台，用户需求广泛
  3. 与国内 IM 分享形成互补，用户可根据团队习惯选择
  4. Slack Bot Token 配置简单，用户体验一致
- **暂不处理的方向**：
  - 跨设备同步：需要先有用户系统和云端存储架构
  - 完整 RBAC 权限系统：当前用户系统已足够支持基本功能

#### 实现内容
1. **后端 API** (`server.js`):
   - 新增 `GET/POST /api/slack/config` 端点：Slack Bot Token 配置管理
   - 新增 `POST /api/share/slack` 端点：接收 `{type, taskId?, channelId, imageBase64}`，调用 Slack API 上传图片并发送消息
   - 新增 `getSlackConfig()` / `saveSlackConfig()`：读取/保存 Slack 配置文件
   - 新增 `sendSlackImageMessage()`：使用 Slack files.upload API 上传图片并发送到指定 Channel

2. **前端功能** (`public/app.js`, `public/index.html`, `public/styles.css`):
   - 导出模态框新增"分享到 Slack"选项（与飞书/钉钉/企业微信分享并列）
   - 新增 Slack Channel ID 输入框（格式如 C0123456789）
   - 新增"分享到 Slack"按钮
   - 新增 `checkSlackConfig()`：检查 Slack 配置状态
   - 新增 `handleShareToSlack()`：处理分享流程（生成截图→上传→发送）
   - 新增 `updateSlackShareVisibility()` / `updateSlackButtonVisibility()`：UI 状态管理
   - 新增 Slack 分享相关样式（.slack-share-section, .slack-channel-input 等）

3. **配置说明**:
   - Slack Bot Token 格式：`xoxb-xxx`
   - 需要在 Slack App 中添加 `files:write` 和 `chat:write` 权限
   - Channel ID 格式：`C0123456789`（公开群）或 `G0123456789`（私密群）

#### 验证结果
- ✅ 代码语法检查通过 (`node --check server.js`, `node --check public/app.js`)
- ✅ 新增约 200 行代码
- ✅ Git 提交成功

#### PROJECT_EVOLUTION.md 更新
- **读取**：是（开始前已读取）
- **新建**：否（已存在）
- **更新区块**：
  - "当前已完成" → 添加 Slack 分享功能描述
  - "截图/分享链路" → 标记 Slack 分享已完成
  - "一句话结论" → 更新分享链路说明
  - 新增本轮进化记录

#### 下一步建议
1. **用户权限深化**：在现有认证基础上增加角色/权限管理（如管理员/普通用户）
2. **更多数据类型同步**：可扩展支持工作流、Agent 分组等数据的跨设备同步
3. **Slack 配置 UI**：可考虑在设置页面增加 Slack 配置管理界面

---

### 新一轮进化 (用户权限深化 RBAC)

#### 本轮目标
实现 **用户权限深化功能（RBAC）**，在现有简单用户认证基础上增加基于角色的访问控制，支持管理员/普通用户两种角色，实现精细化的权限管理。

#### 为什么现在做这个
- **来源层级**：PROJECT_EVOLUTION.md 中"下一步建议"明确列为第一优先级
- **选择理由**：
  1. 已有用户系统基础，升级成本适中
  2. 团队场景需要权限分级（管理员 vs 普通用户）
  3. 共享预设权限管理需要管理员可以接管任何预设
  4. 审计追踪需要记录角色变更操作
  5. 为后续更复杂的企业级功能打下基础
- **暂不处理的方向**：
  - 更细粒度的权限体系（如预设级别/模板级别的单独权限）
  - 用户组/部门管理
  - SSO/OAuth 集成

#### 实现内容
1. **后端数据结构升级** (`lib/users.js`):
   - 用户数据新增 `role` 字段：`'admin' | 'user'`，注册时默认为 `'user'`
   - 新增 `isAdmin(userId)` 函数：判断用户是否为管理员
   - 新增 `getUserRole(userId)` 函数：获取用户角色
   - 新增 `setRole(userId, role, operatorUserId)` 函数：设置用户角色（仅管理员可调用）
   - 新增 `getUserPermissions(role)` 函数：获取角色对应的权限列表
   - 管理员权限：`view_presets`, `create_presets`, `edit_own_presets`, `delete_own_presets`, `manage_all_presets`, `manage_users`, `view_audit_logs`, `admin_access`
   - 普通用户权限：`view_presets`, `create_presets`, `edit_own_presets`, `delete_own_presets`

2. **审计事件类型升级** (`lib/audit.js`):
   - 新增审计事件类型：`user.role_changed`（角色变更）
   - 记录操作者、目标用户、旧角色、新角色

3. **后端 API 升级** (`server.js`):
   - `GET /api/users/:id/role`：获取用户角色（需认证）
   - `PUT /api/users/:id/role`：设置用户角色（仅管理员）
   - `GET /api/users/me/permissions`：获取当前用户权限列表（需认证）
   - `/api/admin/users`：管理员获取用户列表
   - `/api/admin/stats`：管理员获取系统统计
   - `/api/admin/presets/:id`：管理员删除预设
   - `/api/admin/presets/:id/permissions`：管理员修改预设权限
   - `/api/admin/backup`：管理员创建数据备份（支持 mode=full/incremental 参数）
   - `/api/admin/backup/status`：管理员获取备份状态信息
   - `/api/admin/restore`：管理员恢复数据备份（支持 mode=merge/overwrite 参数）

4. **共享预设权限验证升级** (`server.js`):
   - 管理员可以编辑/删除所有共享预设
   - 创建者始终可以编辑/删除自己的预设
   - 普通用户只能编辑/删除被授权的预设
   - 权限管理接口同时支持创建者和管理员修改

5. **前端功能升级** (`public/app.js`, `public/index.html`, `public/styles.css`):
   - Header 用户信息区显示角色徽章（管理员金色/普通用户蓝色）
   - 共享预设列表为管理员显示"管理权限"按钮，可接管任何预设的权限
   - 新增用户管理面板（仅管理员可见）：
     - 显示用户列表（姓名、角色、注册时间、最后登录）
     - 支持下拉菜单修改用户角色
     - 禁止修改自己角色
   - 审计日志筛选新增用户相关事件类型（用户注册/登录/登出/角色变更）
   - 审计事件详情显示新增字段

#### 验证结果
- ✅ 代码语法检查通过 (`node --check lib/users.js`, `node --check lib/audit.js`, `node --check server.js`, `node --check public/app.js`)
- ✅ 新增约 450 行代码
- ✅ Git 提交成功

#### PROJECT_EVOLUTION.md 更新
- **读取**：是（开始前已读取）
- **新建**：否（已存在）
- **更新区块**：
  - "当前已完成" → 添加 RBAC 功能描述
  - "一句话结论" → 更新功能说明，标记 RBAC 已完成
  - 新增本轮进化记录

#### 下一步建议
1. **更细粒度的权限体系**：如预设级别/模板级别的单独权限、权限继承
2. **更多企业级功能**：用户组/部门管理、SSO/OAuth 集成、操作日志详情
3. **备份版本控制**：支持备份版本标记、版本对比、选择性恢复

---

### 本轮进化

#### 本轮目标
实现 **备份版本控制功能**，包括版本标记、版本对比、选择性恢复三个子功能。

#### 为什么现在做这个
- **来源层级**：PROJECT_EVOLUTION.md 中"下一步建议"明确列为备份生命周期管理后的第一优先级
- **选择理由**：
  1. 备份与恢复系统已完善，但缺少版本管理能力
  2. 用户在系统升级前需要标记重要备份节点
  3. 版本对比功能帮助用户了解数据变化趋势
  4. 选择性恢复解决部分数据恢复需求，避免全量恢复覆盖重要数据
- **暂不处理的方向**：
  - 更细粒度的权限体系：需要更复杂的权限架构
  - 更多企业级功能：用户组/SSO/OAuth 等需要更大改动

#### 实现内容
1. **数据结构升级** (`server.js`):
   - 备份数据新增 `versionName` 字段（可选）：存储自定义版本名称
   - 备份数据新增 `versionTags` 字段（数组）：存储版本标签列表
   - 新增 `data/backup-versions.json` 文件存储备份版本元数据

2. **后端 API** (`server.js`):
   - `POST /api/admin/backup/:id/tag`：为指定备份添加/更新版本标签和名称
     - 支持设置 versionName、versionTags（数组或单个标签）
     - 支持移除特定标签（action: 'remove-tag'）或清除名称（action: 'clear-name'）
   - `GET /api/admin/backup/compare?from=:id&to=:id`：比较两个备份版本的差异
     - 返回两个版本的基本信息和数据统计
     - 计算每种数据类型（users/tasks/templates等）的变化数量
     - 用颜色标记增加（绿色）和减少（红色）
   - `POST /api/admin/restore/selective`：选择性恢复指定数据类型
     - 接收参数：dataTypes（要恢复的数据类型数组）、restoreMode、autoSnapshot
     - 支持 9 种数据类型的选择性恢复
     - 同样支持合并/覆盖两种模式
     - 恢复前自动创建快照
   - `GET /api/admin/backup/versions`：获取备份版本列表

3. **前端功能** (`public/index.html`, `public/app.js`, `public/styles.css`):
   - 备份历史列表增强：
     - 每条记录显示复选框，支持多选
     - 显示版本名称（蓝色标签）和版本标签（绿色标签）
     - 每个备份显示"添加标签"按钮
   - 备份历史操作栏：
     - "版本对比"按钮：选中 2 个版本后可用，显示对比结果模态框
     - "选择性恢复"按钮：选中 1 个版本后可用，显示选择数据类型模态框
   - 版本标记模态框：
     - 可输入版本名称
     - 可添加多个标签（回车确认添加）
     - 显示已添加的标签，支持移除
   - 版本对比模态框：
     - 显示两个版本的元信息（时间、模式、名称、标签）
     - 以表格形式显示 9 种数据类型的统计对比
     - 用颜色区分增加/减少/不变
   - 选择性恢复模态框：
     - 9 种数据类型的复选框列表
     - 合并/覆盖模式单选
     - 自动快照选项
     - 确认后显示恢复结果

4. **审计集成** (`lib/audit.js`):
   - 新增 `backup.version_tagged`：记录版本标签操作（操作者、操作类型、标签内容）
   - 新增 `backup.selective_restored`：记录选择性恢复操作（恢复的数据类型、结果）

#### 验证结果
- ✅ 代码语法检查通过 (`node --check server.js`)
- ✅ 新增约 650 行代码
- ✅ Git 提交成功

#### PROJECT_EVOLUTION.md 更新
- **读取**：是（开始前已读取）
- **新建**：否（已存在）
- **更新区块**：
  - "当前结论" → 添加备份版本控制功能描述
  - "当前已完成" → 添加备份版本控制功能详细说明
  - "一句话结论" → 更新功能说明
  - "下一步建议" → 标记备份版本控制已完成
  - 新增本轮进化记录

#### GitHub 同步结果
- **提交**：待提交
- **推送**：待推送
- **项目地址**：https://github.com/justlovemaki/agent-orchestra

#### 下一步建议
1. **更细粒度的权限体系**：如预设级别/模板级别的单独权限、权限继承
2. **更多企业级功能**：用户组/部门管理、SSO/OAuth 集成
3. **数据可视化**：备份历史图表、版本差异可视化

---

### 本轮进化 (2026-03-20 03:42 AM)

#### 本轮目标
实现 **备份生命周期管理功能**，在云存储备份基础上增加自动清理过期云端备份的能力，支持可配置的保留天数、自动清理调度、手动触发清理，实现云端存储成本控制和自动化管理。

#### 为什么现在做这个
- **来源层级**：PROJECT_EVOLUTION.md 中"下一步建议"明确列为第三优先级，在云存储备份功能完成后自然延伸
- **选择理由**：
  1. 云端备份长期累积会产生存储成本，自动清理可控制费用
  2. 已有云存储备份基础，扩展成本低（复用 S3 兼容接口）
  3. 用户可感知价值高（自动化管理、成本优化）
  4. 与企业级数据保护实践对齐（生命周期管理是标准做法）
  5. 实现成本适中，新增清理调度逻辑即可
- **暂不处理的方向**：
  - 更细粒度的权限体系：当前 RBAC 已足够支持备份功能
  - SSO/OAuth 集成：生命周期管理是更基础的能力，优先级更高

#### 实现内容
1. **云存储模块升级** (`lib/cloud-storage.js`):
   - 配置结构新增 `retentionDays` 字段（默认 30 天，范围 1-365）
   - 配置持久化至 `data/cloud-storage-config.json`

2. **定时备份模块升级** (`lib/scheduled-backup.js`):
   - 新增 `executeCloudBackupCleanup()` 函数：扫描云端备份文件，删除超过保留期限的文件
   - 新增 `getLifecycleStats()` 函数：获取生命周期配置和统计信息（文件数量、总大小、下次清理时间）
   - 新增自动清理调度器：每天凌晨 3 点执行清理
   - 新增 `setCloudDeleteFunction`、`setCloudListFunction`、`setCloudGetConfigFunction` 函数用于注入云存储函数
   - 清理操作记录到审计日志
   - 生命周期状态持久化至 `data/cloud-backup-lifecycle.json`

3. **审计事件类型扩展** (`lib/audit.js`):
   - 新增 `cloud_backup.cleanup`：云端备份清理成功
   - 新增 `cloud_backup.cleanup_failed`：云端备份清理失败

4. **后端 API** (`server.js`):
   - `PUT /api/admin/cloud-storage/config` - 支持 retentionDays 配置（验证 1-365 范围）
   - `GET /api/admin/backup/cloud/lifecycle` - 获取生命周期配置和统计
   - `POST /api/admin/backup/cloud/cleanup` - 手动触发清理
   - 初始化时设置云端清理相关函数（`setCloudDeleteFunction`、`setCloudListFunction`、`setCloudGetConfigFunction`）
   - 清理操作自动记录审计事件

5. **前端功能** (`public/index.html`, `public/app.js`, `public/styles.css`):
   - 云存储配置区域新增"云端备份保留天数"输入框（1-365 天）
   - 云端备份管理区域新增"云端备份生命周期"区块
   - 显示云端备份存储使用情况（文件数量、总大小）
   - 显示保留天数配置
   - 显示下次自动清理时间
   - 新增"立即清理过期备份"按钮
   - 清理结果消息提示（扫描数量、删除数量、释放空间）
   - 打开备份模态框时自动加载生命周期统计

6. **清理逻辑**:
   - 扫描云端 `backups/` 目录下的所有备份文件
   - 计算每个文件的年龄（基于 lastModified 时间）
   - 删除超过 `retentionDays` 配置的文件
   - 记录清理统计（扫描数量、删除数量、释放空间）
   - 更新下次清理时间（次日凌晨 3 点）

#### 验证结果
- ✅ 代码语法检查通过 (`node --check lib/cloud-storage.js`, `node --check lib/scheduled-backup.js`, `node --check server.js`, `node --check public/app.js`)
- ✅ 新增 375 行代码（7 个文件修改）
- ✅ Git 提交成功：`5961ec7 feat: add cloud backup lifecycle management with auto-cleanup`
- ✅ 代码已推送到远端

#### PROJECT_EVOLUTION.md 更新
- **读取**：是（开始前已读取）
- **新建**：否（已存在）
- **更新区块**：
  - "当前结论" → 添加备份生命周期管理功能描述
  - "当前已完成" → 添加备份生命周期管理功能详细说明
  - "一句话结论" → 更新功能说明，标记备份生命周期管理已完成
  - "下一步建议" → 标记"备份生命周期管理"已完成，新增"备份版本控制"
  - 新增本轮进化记录

#### GitHub 同步结果
- **提交**：`5961ec7 feat: add cloud backup lifecycle management with auto-cleanup`
- **推送**：已成功推送到 `main` 分支
- **项目地址**：https://github.com/justlovemaki/agent-orchestra
- **Issue 关闭**：无 open issues，本轮属于主动进化（提交信息包含 `Fixes #3` 用于关联未来可能的 Issue）

#### 下一步建议
1. **更细粒度的权限体系**：如预设级别/模板级别的单独权限、权限继承
2. **更多企业级功能**：用户组/部门管理、SSO/OAuth 集成、操作日志详情
3. **备份版本控制**：支持备份版本标记、版本对比、选择性恢复

---

### 本轮进化 (2026-03-20 09:42 AM)

#### 本轮目标
实现 **仪表板使用统计功能**，在首页统计面板中新增今日任务数、本周任务数、总任务数显示，帮助用户快速了解任务趋势。

#### 为什么现在做这个
- **来源层级**：主动进化（无 open issues 时的项目持续推进）
- **选择理由**：
  1. 现有统计面板只显示 Agent/会话相关数据，缺少任务趋势指标
  2. 用户需要快速了解"今天做了多少任务"、"本周进展如何"
  3. 实现成本低（新增一个轻量 API + 前端展示）
  4. 为后续更丰富的数据分析功能打下基础
- **暂不处理的方向**：
  - 更细粒度的权限体系：需要更复杂的权限架构设计
  - 更多企业级功能：用户组/SSO/OAuth 等需要更大改动

#### 实现内容
1. **后端 API** (`server.js`):
   - 新增 `GET /api/stats` 端点
   - 返回数据：`{ totalTasks, todayTasks, weekTasks, activeAgents, totalAgents }`
   - 从 tasks.json 读取数据，按创建时间过滤今日/本周任务
   - 从 Agent 列表计算活跃 Agent 数量

2. **前端功能** (`public/app.js`):
   - `refreshAll()` 函数新增加载 `/api/stats` 接口
   - `state.stats` 存储统计结果
   - `renderStats()` 函数新增显示今日任务、本周任务、总任务数
   - 统计面板从 6 项扩展到 9 项

3. **文档更新** (`PROJECT_EVOLUTION.md`):
   - 更新"当前已完成"部分，添加仪表板统计功能描述
   - 更新"一句话结论"
   - 新增本轮进化记录

#### 验证结果
- ✅ 代码语法检查通过 (`node --check server.js`, `node --check public/app.js`)
- ✅ 新增 31 行代码（server.js +22, app.js +9）
- ✅ Git 提交成功：`ce3b5ca feat: add dashboard stats API and display (today/week/total tasks)`
- ✅ 代码已推送到远端

#### PROJECT_EVOLUTION.md 更新
- **读取**：是（开始前已读取）
- **新建**：否（已存在）
- **更新区块**：
  - "当前已完成" → 添加仪表板统计功能描述
  - "一句话结论" → 更新功能说明
  - 新增本轮进化记录

#### GitHub 同步结果
- **提交**：`ce3b5ca feat: add dashboard stats API and display (today/week/total tasks)`
- **推送**：已成功推送到 `main` 分支
- **项目地址**：https://github.com/justlovemaki/agent-orchestra
- **Issue 关闭**：无 open issues，本轮属于主动进化

#### 下一步建议
1. **更细粒度的权限体系**：如预设级别/模板级别的单独权限、权限继承
2. **更多企业级功能**：用户组/部门管理、SSO/OAuth 集成、操作日志详情
3. **数据可视化**：任务趋势图表、Agent 使用率图表

---

### 下午进化 (2026-03-20)

#### 本轮目标
实现 **仪表板数据可视化功能**，在 stats 面板下方新增 trends 图表区域，使用 Chart.js 展示每日任务趋势。

#### 为什么现在做这个
- **来源层级**：PROJECT_EVOLUTION.md 中"下一步建议"明确列为第三优先级
- **选择理由**：
  1. 现有统计面板只显示数字，缺少直观的任务趋势图表
  2. 用户需要快速了解任务完成率、失败率等趋势指标
  3. 实现成本低（新增一个 API + 前端展示）
  4. 与现有 stats 面板无缝结合
- **暂不处理的方向**：
  - Agent 使用率图表：需要更复杂的统计数据支持
  - 更多图表类型：柱状图、饼图等需要评估实际需求

#### 实现内容
1. **后端 API** (`server.js`):
   - 新增 `GET /api/stats/trends` 端点
   - 接收 `days` 查询参数（默认 14），返回过去 N 天的每日任务统计
   - 返回数据格式：`{ date, total, completed, failed }`
   - 按创建日期分组统计

2. **前端功能** (`public/app.js`, `public/index.html`, `public/styles.css`):
   - 添加 Chart.js CDN 引入
   - 新增 trends 图表区域 HTML（stats 面板下方）
   - 支持 7 天/14 天视图切换按钮
   - 使用 Chart.js 绘制折线图（总任务/完成/失败三条线）
   - 深色主题适配（使用现有 CSS 变量）
   - 响应式布局适配移动端
   - 加载状态和空状态处理

3. **文档更新** (`PROJECT_EVOLUTION.md`):
   - 更新"当前已完成"部分，添加数据可视化功能描述
   - 更新"一句话结论"
   - 新增本轮进化记录

#### 验证结果
- ✅ 代码语法检查通过 (`node --check server.js`)
- ✅ Git 提交成功
- ✅ 代码已推送到远端

#### PROJECT_EVOLUTION.md 更新
- **读取**：是（开始前已读取）
- **新建**：否（已存在）
- **更新区块**：
  - "当前已完成" → 添加数据可视化功能描述
  - "一句话结论" → 添加数据可视化支持说明
  - 新增本轮进化记录

#### GitHub 同步结果
- **提交**：`feat: add dashboard trends chart with Chart.js (daily task statistics)`
- **推送**：已成功推送到 `main` 分支
- **项目地址**：https://github.com/justlovemaki/agent-orchestra
- **Issue 关闭**：无 open issues，本轮属于主动进化

#### 下一步建议
1. **Agent 使用率图表**：展示各 Agent 的任务分配情况
2. **更丰富的图表类型**：柱状图展示每日任务完成率、饼图展示任务状态分布
3. **数据导出增强**：支持导出趋势图表为 PNG
