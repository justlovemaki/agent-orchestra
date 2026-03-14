# PROJECT_EVOLUTION.md - Agent Orchestra

> 创建时间：2026-03-13
> 项目定位：OpenClaw Agent 管理与调度面板 MVP
> 当前阶段：MVP 已完成，可继续向“稳定调度台”演进
> 维护方式：本文档用于记录项目现状、已完成能力、技术债、下一步演进路径，供 `git-project-evolution` 持续读取与更新

---

## 1. 项目目标

Agent Orchestra 的目标不是只做一个“状态展示页”，而是逐步演进为：

- 可查看 Agent 全局状态
- 可派发与跟踪任务
- 可查看日志与执行结果
- 可管理多 Agent 协作流程
- 最终成为 OpenClaw 的可视化调度中枢

---

## 2. 当前状态

### 当前结论
项目已完成 **MVP 第一版**，具备基础可演示、可内测能力；
本轮在“新功能优先，稳定性次之”的路线下，已补上一个用户可直接感知的任务筛选 / 搜索能力，使任务看板从“仅能看”进一步演进为“可检索、可回看、可聚焦”；
但尚未达到“稳定、完整、产品级可长期使用”的状态。

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
- 当前是“每个任务一个后台 runner”
- 缺少正式任务队列
- 缺少更细粒度的 run 控制
- 缺少暂停 / 恢复 / 改派等机制

### 4.4 数据层过于轻量
- 当前任务状态存储在 `tasks.json`
- 随任务量增长，容易遇到性能、并发、可维护性问题
- 后续应迁移到 SQLite

### 4.5 日志不是实时流
- 当前以前端轮询为主
- 体验不够丝滑
- 后续应升级到 SSE / WebSocket

### 4.6 产品层能力还不完整
- 无 Agent 分组 / 标签
- 无工作流编排
- 无任务依赖 DAG
- 无模板功能
- 已具备任务筛选 / 搜索 / 历史筛选基础能力，但还缺少筛选条件持久化、组合收藏与审计视图

---

## 5. 演进方向

### P1：先把“稳定可用”做好

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
目标：替换“每任务一个 runner”的临时实现。

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
目标：让状态变化和执行日志具备“控制台级”体验。

建议包括：
- SSE 或 WebSocket
- 任务进度追加显示
- 状态变化实时推送

---

### P2：从“面板”升级成“调度台”

#### 5.5 Agent 分组 / 标签系统
- 按用途分组：内容、情报、开发、审校、发布
- 支持筛选与收藏常用组合

#### 5.6 工作流编排
- 多 Agent 顺序流转
- 示例：`intel-scout -> copy-polisher -> copy-auditor -> x-post`
- 支持条件分支、失败回退、人工审批节点

#### 5.7 更细粒度任务控制
- 单个 run 重试
- 重新指派给其他 Agent
- 暂停 / 恢复
- 批量取消 / 批量重试

#### 5.8 接入 sessions / subagents / ACP 管理
- 查看现有 session
- 直接发送消息到某个 session
- 启动新的 subagent / ACP 会话
- 查看不同运行时状态

---

### P3：产品化与体验提升

#### 5.9 UI/UX 深化
- 更强的指挥中心视觉风格
- 卡片信息密度优化
- 深色主题精修
- 移动端 / 小屏适配
- 状态色、空状态、加载态、微交互统一

#### 5.10 模板与复用
- 常用任务模板
- 常用 Agent 组合
- 默认调度策略

#### 5.11 审计与历史记录
- 谁在什么时候创建了什么任务
- 哪些 Agent 被调用过
- 历史任务检索与筛选

#### 5.12 截图 / 分享链路
- 一键导出面板截图
- 一键生成任务汇报图
- 方便回传到 IM 渠道

---

## 6. 推荐实施顺序

### 路线 A：产品感优先
1. Agent 分组 / 标签
2. 常用任务模板
3. 工作流编排
4. UI 精修
5. 实时日志流

### 路线 B：工程稳定性优先
1. 稳定启动 / 守护
2. SQLite 持久化
3. 正式任务队列
4. 实时日志流
5. sessions / subagents / ACP 管理
6. DAG 调度

### 当前建议
若下一步继续推进，**优先走“新功能优先，稳定性次之”**。

建议执行顺序：
1. 先做对用户可感知、可演示的新功能（本轮已完成：任务筛选 / 搜索 / 历史筛选）
2. 再补足支撑这些功能所必需的稳定性改进
3. 稳定性工作应服务于功能推进，而不是长期替代功能迭代本身

原因：
- 当前项目既然定位为 Agent 调度面板 / 调度台，优先持续扩展功能边界更符合演进目标
- 新功能能更快验证产品方向、使用价值和后续需求优先级
- 稳定性仍然重要，但应作为“为新功能落地保驾护航”的第二优先级，而不是默认主路线

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
   - 从“演进方向”中标记完成或移除
   - 同步补入“当前已完成”
4. 避免写成开发流水账，应保持“产品演进视角”
5. 若项目方向发生变化，应先更新“项目目标”与“当前结论”

---

## 8. 一句话结论

**Agent Orchestra 现在已经是一个可演示、可筛选、可回看历史任务的 MVP；接下来应继续沿“新功能优先”路线，把 Agent 分组 / 模板 / 轻量编排等更强的调度能力做出来。**
