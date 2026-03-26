'use strict';

/**
 * API Documentation Module
 * 
 * Generates OpenAPI 3.0 specification and serves Swagger UI
 * for the Agent Orchestra API.
 */

const SWAGGER_UI_VERSION = '5.11.0';

// ─── OpenAPI 3.0 Specification ──────────────────────────────────────────────

function getOpenAPISpec(port) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Agent Orchestra API',
      description: 'OpenClaw Agent 可视化调度中枢 API 文档。提供 Agent 管理、任务调度、会话控制、工作流编排、通知系统等完整 API。',
      version: '0.1.0',
      contact: {
        name: 'Agent Orchestra',
        url: 'https://github.com/justlovemaki/agent-orchestra'
      }
    },
    servers: [
      {
        url: `http://127.0.0.1:${port || 3210}`,
        description: 'Local Development Server'
      }
    ],
    tags: [
      { name: 'System', description: '系统状态与健康检查' },
      { name: 'Tasks', description: '任务管理（创建、查询、取消、重试、暂停、恢复）' },
      { name: 'Templates', description: '任务模板管理' },
      { name: 'Sessions', description: '会话管理（列表、消息、子 Agent）' },
      { name: 'Workflows', description: '工作流编排（创建、执行、推荐）' },
      { name: 'Agent Groups', description: 'Agent 分组管理' },
      { name: 'Agent Combinations', description: 'Agent 组合（收藏、导入导出、推荐）' },
      { name: 'Notifications', description: '通知系统（渠道、模板、历史、免打扰）' },
      { name: 'Backup', description: '备份系统（全量、增量、云存储、定时）' },
      { name: 'Users', description: '用户与权限管理' },
      { name: 'Presets', description: '预设配置管理' },
      { name: 'Statistics', description: '数据统计与趋势分析' },
      { name: 'Export & Share', description: '导出与分享（飞书、钉钉、企微、Slack）' },
      { name: 'Audit', description: '审计日志' },
      { name: 'Sync', description: '同步模板与预设' },
      { name: 'Admin', description: '管理员操作（需要管理员权限）' },
      { name: 'Plugins', description: '插件系统（插件管理、启用/禁用、配置）' }
    ],
    paths: {
      // ─── System ─────────────────────────────────
      '/api/health': {
        get: {
          tags: ['System'],
          summary: '健康检查',
          description: '检查服务健康状态，包含数据目录和内存使用情况',
          operationId: 'getHealth',
          responses: {
            '200': { description: '服务健康', content: jsonContent({ type: 'object', properties: { status: { type: 'string', example: 'ok' }, checks: { type: 'object' } } }) },
            '503': { description: '服务不健康' }
          }
        }
      },
      '/api/overview': {
        get: {
          tags: ['System'],
          summary: '系统总览',
          description: '获取 Agent 状态、任务统计、系统健康等总览数据',
          operationId: 'getOverview',
          parameters: [queryParam('force', 'boolean', '是否强制刷新缓存')],
          responses: { '200': { description: '总览数据', content: jsonContent({ type: 'object' }) } }
        }
      },
      '/api/runtime': {
        get: {
          tags: ['System'],
          summary: '运行时信息',
          description: '获取当前运行时状态（端口、URL、版本等）',
          operationId: 'getRuntime',
          responses: { '200': { description: '运行时信息', content: jsonContent({ type: 'object' }) } }
        }
      },
      '/api/stats': {
        get: {
          tags: ['Statistics'],
          summary: '任务统计',
          description: '获取任务统计数据（完成率、平均耗时等）',
          operationId: 'getStats',
          responses: { '200': { description: '统计数据', content: jsonContent({ type: 'object' }) } }
        }
      },
      '/api/stats/trends': {
        get: {
          tags: ['Statistics'],
          summary: '任务趋势',
          description: '获取任务趋势数据，支持按时间范围筛选',
          operationId: 'getStatsTrends',
          parameters: [
            queryParam('days', 'integer', '天数范围', '7'),
            queryParam('agent', 'string', '按 Agent 筛选')
          ],
          responses: { '200': { description: '趋势数据', content: jsonContent({ type: 'object' }) } }
        }
      },
      '/api/agent-performance': {
        get: {
          tags: ['Statistics'],
          summary: 'Agent 性能分析',
          description: '获取各 Agent 的性能指标（成功率、响应时间等）',
          operationId: 'getAgentPerformance',
          responses: { '200': { description: '性能数据', content: jsonContent({ type: 'object' }) } }
        }
      },

      // ─── Tasks ──────────────────────────────────
      '/api/tasks': {
        get: {
          tags: ['Tasks'],
          summary: '获取任务列表',
          description: '获取所有任务，支持状态筛选、分页',
          operationId: 'listTasks',
          parameters: [
            queryParam('status', 'string', '按状态筛选（pending/running/completed/failed/cancelled）'),
            queryParam('agent', 'string', '按 Agent 筛选'),
            queryParam('limit', 'integer', '每页数量'),
            queryParam('offset', 'integer', '偏移量')
          ],
          responses: { '200': { description: '任务列表', content: jsonContent({ type: 'object', properties: { tasks: { type: 'array', items: { $ref: '#/components/schemas/Task' } } } }) } }
        },
        post: {
          tags: ['Tasks'],
          summary: '创建任务',
          description: '创建新任务并分配给指定 Agent',
          operationId: 'createTask',
          requestBody: jsonBody({
            type: 'object',
            required: ['message'],
            properties: {
              message: { type: 'string', description: '任务描述' },
              agentId: { type: 'string', description: '目标 Agent ID' },
              priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: '优先级' }
            }
          }),
          responses: {
            '200': { description: '创建成功', content: jsonContent({ type: 'object' }) },
            '400': { description: '参数错误' }
          }
        }
      },
      '/api/tasks/{taskId}': {
        get: {
          tags: ['Tasks'],
          summary: '获取单个任务',
          description: '获取指定任务的详细信息',
          operationId: 'getTask',
          parameters: [pathParam('taskId', '任务 ID')],
          responses: {
            '200': { description: '任务详情', content: jsonContent({ type: 'object', properties: { task: { $ref: '#/components/schemas/Task' } } }) },
            '404': { description: '任务不存在' }
          }
        },
        put: {
          tags: ['Tasks'],
          summary: '更新任务',
          description: '更新指定任务的信息',
          operationId: 'updateTask',
          parameters: [pathParam('taskId', '任务 ID')],
          requestBody: jsonBody({
            type: 'object',
            properties: {
              status: { type: 'string', description: '任务状态' },
              priority: { type: 'string', description: '优先级' },
              notes: { type: 'string', description: '备注' }
            }
          }),
          responses: {
            '200': { description: '更新成功', content: jsonContent({ type: 'object' }) },
            '404': { description: '任务不存在' }
          }
        },
        delete: {
          tags: ['Tasks'],
          summary: '删除任务',
          description: '删除指定任务',
          operationId: 'deleteTask',
          parameters: [pathParam('taskId', '任务 ID')],
          responses: {
            '200': { description: '删除成功', content: jsonContent({ type: 'object', properties: { success: { type: 'boolean' } } }) },
            '404': { description: '任务不存在' }
          }
        }
      },
      '/api/tasks/{taskId}/log': {
        get: {
          tags: ['Tasks'],
          summary: '获取任务日志',
          description: '获取指定任务的执行日志',
          operationId: 'getTaskLog',
          parameters: [pathParam('taskId', '任务 ID')],
          responses: { '200': { description: '任务日志', content: jsonContent({ type: 'object' }) } }
        }
      },
      '/api/tasks/{taskId}/logs/stream': {
        get: {
          tags: ['Tasks'],
          summary: '任务日志流（SSE）',
          description: '通过 Server-Sent Events 实时获取任务日志',
          operationId: 'streamTaskLogs',
          parameters: [pathParam('taskId', '任务 ID')],
          responses: { '200': { description: 'SSE 日志流', content: { 'text/event-stream': { schema: { type: 'string' } } } } }
        }
      },
      '/api/tasks/{taskId}/cancel': {
        post: {
          tags: ['Tasks'],
          summary: '取消任务',
          operationId: 'cancelTask',
          parameters: [pathParam('taskId', '任务 ID')],
          responses: { '200': { description: '取消成功' } }
        }
      },
      '/api/tasks/{taskId}/pause': {
        post: {
          tags: ['Tasks'],
          summary: '暂停任务',
          operationId: 'pauseTask',
          parameters: [pathParam('taskId', '任务 ID')],
          responses: { '200': { description: '暂停成功' } }
        }
      },
      '/api/tasks/{taskId}/resume': {
        post: {
          tags: ['Tasks'],
          summary: '恢复任务',
          operationId: 'resumeTask',
          parameters: [pathParam('taskId', '任务 ID')],
          responses: { '200': { description: '恢复成功' } }
        }
      },
      '/api/tasks/{taskId}/retry': {
        post: {
          tags: ['Tasks'],
          summary: '重试任务',
          operationId: 'retryTask',
          parameters: [pathParam('taskId', '任务 ID')],
          responses: { '200': { description: '重试成功' } }
        }
      },
      '/api/tasks/{taskId}/runs/{runId}/retry': {
        post: {
          tags: ['Tasks'],
          summary: '重试特定运行',
          operationId: 'retryTaskRun',
          parameters: [pathParam('taskId', '任务 ID'), pathParam('runId', '运行 ID')],
          responses: { '200': { description: '重试成功' } }
        }
      },
      '/api/tasks/{taskId}/reassign': {
        patch: {
          tags: ['Tasks'],
          summary: '重新指派任务',
          operationId: 'reassignTask',
          parameters: [pathParam('taskId', '任务 ID')],
          requestBody: jsonBody({ type: 'object', properties: { agentId: { type: 'string', description: '新的 Agent ID' } } }),
          responses: { '200': { description: '指派成功' } }
        }
      },
      '/api/tasks/batch-cancel': {
        post: {
          tags: ['Tasks'],
          summary: '批量取消任务',
          operationId: 'batchCancelTasks',
          requestBody: jsonBody({ type: 'object', properties: { taskIds: { type: 'array', items: { type: 'string' } } } }),
          responses: { '200': { description: '批量取消成功' } }
        }
      },
      '/api/tasks/batch-retry': {
        post: {
          tags: ['Tasks'],
          summary: '批量重试任务',
          operationId: 'batchRetryTasks',
          requestBody: jsonBody({ type: 'object', properties: { taskIds: { type: 'array', items: { type: 'string' } } } }),
          responses: { '200': { description: '批量重试成功' } }
        }
      },
      '/api/tasks/batch-priority': {
        patch: {
          tags: ['Tasks'],
          summary: '批量修改优先级',
          operationId: 'batchUpdatePriority',
          requestBody: jsonBody({ type: 'object', properties: { taskIds: { type: 'array', items: { type: 'string' } }, priority: { type: 'string' } } }),
          responses: { '200': { description: '修改成功' } }
        }
      },
      '/api/tasks/from-template/{templateId}': {
        post: {
          tags: ['Tasks'],
          summary: '从模板创建任务',
          operationId: 'createTaskFromTemplate',
          parameters: [pathParam('templateId', '模板 ID')],
          responses: { '200': { description: '创建成功' } }
        }
      },

      // ─── Templates ──────────────────────────────
      '/api/templates': {
        get: {
          tags: ['Templates'],
          summary: '获取任务模板列表',
          operationId: 'listTemplates',
          responses: { '200': { description: '模板列表', content: jsonContent({ type: 'array' }) } }
        },
        post: {
          tags: ['Templates'],
          summary: '创建任务模板',
          operationId: 'createTemplate',
          requestBody: jsonBody({ type: 'object', properties: { name: { type: 'string' }, message: { type: 'string' }, agentId: { type: 'string' } } }),
          responses: { '200': { description: '创建成功' } }
        }
      },
      '/api/templates/{templateId}': {
        put: {
          tags: ['Templates'],
          summary: '更新任务模板',
          operationId: 'updateTemplate',
          parameters: [pathParam('templateId', '模板 ID')],
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '更新成功' } }
        },
        delete: {
          tags: ['Templates'],
          summary: '删除任务模板',
          operationId: 'deleteTemplate',
          parameters: [pathParam('templateId', '模板 ID')],
          responses: { '200': { description: '删除成功' } }
        }
      },

      // ─── Sessions ───────────────────────────────
      '/api/sessions': {
        get: {
          tags: ['Sessions'],
          summary: '获取会话列表',
          description: '获取所有活跃会话及其最新消息',
          operationId: 'listSessions',
          responses: { '200': { description: '会话列表', content: jsonContent({ type: 'object' }) } }
        }
      },
      '/api/sessions/{sessionKey}/messages': {
        get: {
          tags: ['Sessions'],
          summary: '获取会话消息',
          description: '获取指定会话的消息历史',
          operationId: 'getSessionMessages',
          parameters: [
            pathParam('sessionKey', '会话 Key'),
            queryParam('limit', 'integer', '消息数量限制')
          ],
          responses: { '200': { description: '消息列表', content: jsonContent({ type: 'object' }) } }
        },
        post: {
          tags: ['Sessions'],
          summary: '发送消息到会话',
          operationId: 'sendSessionMessage',
          parameters: [pathParam('sessionKey', '会话 Key')],
          requestBody: jsonBody({ type: 'object', properties: { message: { type: 'string', description: '消息内容' } } }),
          responses: { '200': { description: '发送成功' } }
        }
      },
      '/api/sessions/spawn': {
        post: {
          tags: ['Sessions'],
          summary: '启动子 Agent',
          description: '创建新的子 Agent 会话',
          operationId: 'spawnSession',
          requestBody: jsonBody({
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'Agent ID' },
              task: { type: 'string', description: '任务描述' }
            }
          }),
          responses: { '200': { description: '启动成功' } }
        }
      },

      // ─── Workflows ──────────────────────────────
      '/api/workflows': {
        get: {
          tags: ['Workflows'],
          summary: '获取工作流列表',
          operationId: 'listWorkflows',
          responses: { '200': { description: '工作流列表', content: jsonContent({ type: 'array' }) } }
        },
        post: {
          tags: ['Workflows'],
          summary: '创建工作流',
          operationId: 'createWorkflow',
          requestBody: jsonBody({
            type: 'object',
            properties: {
              name: { type: 'string', description: '工作流名称' },
              description: { type: 'string' },
              steps: { type: 'array', items: { $ref: '#/components/schemas/WorkflowStep' } }
            }
          }),
          responses: { '200': { description: '创建成功' } }
        }
      },
      '/api/workflows/{workflowId}': {
        get: {
          tags: ['Workflows'],
          summary: '获取工作流详情',
          operationId: 'getWorkflow',
          parameters: [pathParam('workflowId', '工作流 ID')],
          responses: { '200': { description: '工作流详情' } }
        },
        put: {
          tags: ['Workflows'],
          summary: '更新工作流',
          operationId: 'updateWorkflow',
          parameters: [pathParam('workflowId', '工作流 ID')],
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '更新成功' } }
        },
        delete: {
          tags: ['Workflows'],
          summary: '删除工作流',
          operationId: 'deleteWorkflow',
          parameters: [pathParam('workflowId', '工作流 ID')],
          responses: { '200': { description: '删除成功' } }
        }
      },
      '/api/workflows/{workflowId}/run': {
        post: {
          tags: ['Workflows'],
          summary: '执行工作流',
          description: '启动工作流执行',
          operationId: 'runWorkflow',
          parameters: [pathParam('workflowId', '工作流 ID')],
          requestBody: jsonBody({ type: 'object', properties: { variables: { type: 'object', description: '运行时变量' } } }),
          responses: { '200': { description: '执行已启动' } }
        }
      },
      '/api/workflows/{workflowId}/runs': {
        get: {
          tags: ['Workflows'],
          summary: '获取工作流运行记录',
          operationId: 'getWorkflowRuns',
          parameters: [pathParam('workflowId', '工作流 ID')],
          responses: { '200': { description: '运行记录列表' } }
        }
      },
      '/api/workflow-runs/{runId}': {
        get: {
          tags: ['Workflows'],
          summary: '获取运行详情',
          operationId: 'getWorkflowRun',
          parameters: [pathParam('runId', '运行 ID')],
          responses: { '200': { description: '运行详情' } }
        }
      },
      '/api/workflows/{workflowId}/recommendations': {
        get: {
          tags: ['Workflows'],
          summary: '获取工作流 Agent 推荐',
          description: '基于工作流步骤和历史数据推荐最佳 Agent',
          operationId: 'getWorkflowRecommendations',
          parameters: [pathParam('workflowId', '工作流 ID')],
          responses: { '200': { description: '推荐列表' } }
        }
      },
      '/api/workflows/{workflowId}/analysis': {
        get: {
          tags: ['Workflows'],
          summary: '获取工作流分析',
          operationId: 'getWorkflowAnalysis',
          parameters: [pathParam('workflowId', '工作流 ID')],
          responses: { '200': { description: '分析数据' } }
        }
      },
      '/api/workflows/suggest-agents': {
        post: {
          tags: ['Workflows'],
          summary: '智能推荐 Agent',
          description: '根据任务描述推荐最合适的 Agent',
          operationId: 'suggestAgents',
          requestBody: jsonBody({ type: 'object', properties: { taskDescription: { type: 'string' } } }),
          responses: { '200': { description: '推荐结果' } }
        }
      },
      '/api/workflows/{workflowId}/apply-recommendations': {
        post: {
          tags: ['Workflows'],
          summary: '应用推荐',
          operationId: 'applyWorkflowRecommendations',
          parameters: [pathParam('workflowId', '工作流 ID')],
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '应用成功' } }
        }
      },

      // ─── Agent Groups ───────────────────────────
      '/api/agent-groups': {
        get: {
          tags: ['Agent Groups'],
          summary: '获取 Agent 分组列表',
          operationId: 'listAgentGroups',
          responses: { '200': { description: '分组列表' } }
        },
        post: {
          tags: ['Agent Groups'],
          summary: '创建 Agent 分组',
          operationId: 'createAgentGroup',
          requestBody: jsonBody({ type: 'object', properties: { name: { type: 'string' }, agents: { type: 'array', items: { type: 'string' } } } }),
          responses: { '200': { description: '创建成功' } }
        }
      },
      '/api/agent-groups/{groupId}': {
        put: {
          tags: ['Agent Groups'],
          summary: '更新 Agent 分组',
          operationId: 'updateAgentGroup',
          parameters: [pathParam('groupId', '分组 ID')],
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '更新成功' } }
        },
        delete: {
          tags: ['Agent Groups'],
          summary: '删除 Agent 分组',
          operationId: 'deleteAgentGroup',
          parameters: [pathParam('groupId', '分组 ID')],
          responses: { '200': { description: '删除成功' } }
        }
      },
      '/api/agents/{agentId}/groups': {
        put: {
          tags: ['Agent Groups'],
          summary: '更新 Agent 所属分组',
          operationId: 'updateAgentGroups',
          parameters: [pathParam('agentId', 'Agent ID')],
          requestBody: jsonBody({ type: 'object', properties: { groupIds: { type: 'array', items: { type: 'string' } } } }),
          responses: { '200': { description: '更新成功' } }
        }
      },

      // ─── Agent Combinations ─────────────────────
      '/api/agent-combinations': {
        get: {
          tags: ['Agent Combinations'],
          summary: '获取 Agent 组合列表',
          operationId: 'listAgentCombinations',
          parameters: [
            queryParam('page', 'integer', '页码'),
            queryParam('limit', 'integer', '每页数量'),
            queryParam('search', 'string', '搜索关键词'),
            queryParam('sortBy', 'string', '排序字段'),
            queryParam('sortOrder', 'string', '排序方向（asc/desc）')
          ],
          responses: { '200': { description: '组合列表' } }
        },
        post: {
          tags: ['Agent Combinations'],
          summary: '创建 Agent 组合',
          operationId: 'createAgentCombination',
          requestBody: jsonBody({
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              agents: { type: 'array', items: { type: 'string' } },
              tags: { type: 'array', items: { type: 'string' } }
            }
          }),
          responses: { '200': { description: '创建成功' } }
        }
      },
      '/api/agent-combinations/{combinationId}': {
        get: {
          tags: ['Agent Combinations'],
          summary: '获取组合详情',
          operationId: 'getAgentCombination',
          parameters: [pathParam('combinationId', '组合 ID')],
          responses: { '200': { description: '组合详情' } }
        },
        put: {
          tags: ['Agent Combinations'],
          summary: '更新 Agent 组合',
          operationId: 'updateAgentCombination',
          parameters: [pathParam('combinationId', '组合 ID')],
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '更新成功' } }
        },
        delete: {
          tags: ['Agent Combinations'],
          summary: '删除 Agent 组合',
          operationId: 'deleteAgentCombination',
          parameters: [pathParam('combinationId', '组合 ID')],
          responses: { '200': { description: '删除成功' } }
        }
      },
      '/api/agent-combinations/{combinationId}/share': {
        put: {
          tags: ['Agent Combinations'],
          summary: '分享组合',
          operationId: 'shareAgentCombination',
          parameters: [pathParam('combinationId', '组合 ID')],
          requestBody: jsonBody({ type: 'object', properties: { shared: { type: 'boolean' } } }),
          responses: { '200': { description: '分享成功' } }
        }
      },
      '/api/agent-combinations/{combinationId}/favorite': {
        put: {
          tags: ['Agent Combinations'],
          summary: '收藏/取消收藏组合',
          operationId: 'toggleFavorite',
          parameters: [pathParam('combinationId', '组合 ID')],
          requestBody: jsonBody({ type: 'object', properties: { favorite: { type: 'boolean' } } }),
          responses: { '200': { description: '操作成功' } }
        }
      },
      '/api/agent-combinations/popular': {
        get: {
          tags: ['Agent Combinations'],
          summary: '获取热门组合',
          operationId: 'getPopularCombinations',
          responses: { '200': { description: '热门组合列表' } }
        }
      },
      '/api/agent-combinations/export': {
        get: {
          tags: ['Agent Combinations'],
          summary: '导出组合',
          operationId: 'exportCombinations',
          responses: { '200': { description: '导出数据' } }
        }
      },
      '/api/agent-combinations/import': {
        post: {
          tags: ['Agent Combinations'],
          summary: '导入组合',
          operationId: 'importCombinations',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '导入成功' } }
        }
      },
      '/api/agent-combinations/{combinationId}/usage-trends': {
        get: {
          tags: ['Agent Combinations'],
          summary: '获取组合使用趋势',
          operationId: 'getCombinationUsageTrends',
          parameters: [
            pathParam('combinationId', '组合 ID'),
            queryParam('days', 'integer', '天数范围')
          ],
          responses: { '200': { description: '趋势数据' } }
        }
      },
      '/api/agent-combinations/recommendations': {
        get: {
          tags: ['Agent Combinations'],
          summary: '获取组合推荐',
          operationId: 'getCombinationRecommendations',
          responses: { '200': { description: '推荐列表' } }
        }
      },
      '/api/agent-combinations/recommendations/types': {
        get: {
          tags: ['Agent Combinations'],
          summary: '获取推荐类型',
          operationId: 'getRecommendationTypes',
          responses: { '200': { description: '推荐类型列表' } }
        }
      },
      '/api/agent-combinations/recommendations/{recommendationId}/apply': {
        post: {
          tags: ['Agent Combinations'],
          summary: '应用推荐',
          operationId: 'applyCombinationRecommendation',
          parameters: [pathParam('recommendationId', '推荐 ID')],
          responses: { '200': { description: '应用成功' } }
        }
      },
      '/api/agent-combinations/recommendations/{recommendationId}/dismiss': {
        post: {
          tags: ['Agent Combinations'],
          summary: '忽略推荐',
          operationId: 'dismissCombinationRecommendation',
          parameters: [pathParam('recommendationId', '推荐 ID')],
          responses: { '200': { description: '已忽略' } }
        }
      },
      '/api/agent-combinations/recommendations/{recommendationId}/feedback': {
        post: {
          tags: ['Agent Combinations'],
          summary: '提交推荐反馈',
          operationId: 'submitRecommendationFeedback',
          parameters: [pathParam('recommendationId', '推荐 ID')],
          requestBody: jsonBody({ type: 'object', properties: { rating: { type: 'integer' }, comment: { type: 'string' } } }),
          responses: { '200': { description: '反馈已提交' } }
        },
        get: {
          tags: ['Agent Combinations'],
          summary: '获取推荐反馈',
          operationId: 'getRecommendationFeedback',
          parameters: [pathParam('recommendationId', '推荐 ID')],
          responses: { '200': { description: '反馈列表' } }
        }
      },

      // ─── Users & Auth ───────────────────────────
      '/api/auth/register': {
        post: {
          tags: ['Users'],
          summary: '用户注册',
          operationId: 'register',
          requestBody: jsonBody({ type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' } } }),
          responses: { '200': { description: '注册成功' } }
        }
      },
      '/api/auth/login': {
        post: {
          tags: ['Users'],
          summary: '用户登录',
          operationId: 'login',
          requestBody: jsonBody({ type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' } } }),
          responses: { '200': { description: '登录成功' } }
        }
      },
      '/api/auth/logout': {
        post: {
          tags: ['Users'],
          summary: '用户登出',
          operationId: 'logout',
          responses: { '200': { description: '登出成功' } }
        }
      },
      '/api/auth/me': {
        get: {
          tags: ['Users'],
          summary: '获取当前用户信息',
          operationId: 'getCurrentUser',
          responses: { '200': { description: '用户信息' } }
        }
      },
      '/api/users': {
        get: {
          tags: ['Users'],
          summary: '获取用户列表',
          operationId: 'listUsers',
          responses: { '200': { description: '用户列表' } }
        }
      },
      '/api/users/{userId}/role': {
        get: {
          tags: ['Users'],
          summary: '获取用户角色',
          operationId: 'getUserRole',
          parameters: [pathParam('userId', '用户 ID')],
          responses: { '200': { description: '角色信息' } }
        },
        put: {
          tags: ['Users'],
          summary: '更新用户角色',
          operationId: 'updateUserRole',
          parameters: [pathParam('userId', '用户 ID')],
          requestBody: jsonBody({ type: 'object', properties: { role: { type: 'string' } } }),
          responses: { '200': { description: '更新成功' } }
        }
      },
      '/api/admin/users/{userId}/group': {
        put: {
          tags: ['Users'],
          summary: '更新用户组',
          operationId: 'updateUserGroup',
          parameters: [pathParam('userId', '用户 ID')],
          requestBody: jsonBody({ type: 'object', properties: { groupId: { type: 'string' } } }),
          responses: { '200': { description: '更新成功' } }
        }
      },
      '/api/users/me/permissions': {
        get: {
          tags: ['Users'],
          summary: '获取当前用户权限',
          operationId: 'getMyPermissions',
          responses: { '200': { description: '权限列表' } }
        }
      },
      '/api/users/{userId}/groups': {
        get: {
          tags: ['Users'],
          summary: '获取用户所属组',
          operationId: 'getUserGroups',
          parameters: [pathParam('userId', '用户 ID')],
          responses: { '200': { description: '用户组列表' } }
        }
      },

      // ─── Presets ────────────────────────────────
      '/api/presets': {
        get: {
          tags: ['Presets'],
          summary: '获取预设列表',
          operationId: 'listPresets',
          responses: { '200': { description: '预设列表' } }
        },
        post: {
          tags: ['Presets'],
          summary: '创建预设',
          operationId: 'createPreset',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '创建成功' } }
        }
      },
      '/api/presets/{presetId}': {
        put: {
          tags: ['Presets'],
          summary: '更新预设',
          operationId: 'updatePreset',
          parameters: [pathParam('presetId', '预设 ID')],
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '更新成功' } }
        },
        delete: {
          tags: ['Presets'],
          summary: '删除预设',
          operationId: 'deletePreset',
          parameters: [pathParam('presetId', '预设 ID')],
          responses: { '200': { description: '删除成功' } }
        }
      },
      '/api/presets/export': {
        get: {
          tags: ['Presets'],
          summary: '导出预设',
          operationId: 'exportPresets',
          responses: { '200': { description: '导出数据' } }
        }
      },
      '/api/presets/import': {
        post: {
          tags: ['Presets'],
          summary: '导入预设',
          operationId: 'importPresets',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '导入成功' } }
        }
      },

      // ─── Audit ──────────────────────────────────
      '/api/audit': {
        post: {
          tags: ['Audit'],
          summary: '记录审计日志',
          operationId: 'createAuditLog',
          requestBody: jsonBody({ type: 'object', properties: { action: { type: 'string' }, details: { type: 'object' } } }),
          responses: { '200': { description: '记录成功' } }
        },
        get: {
          tags: ['Audit'],
          summary: '查询审计日志',
          operationId: 'listAuditLogs',
          parameters: [
            queryParam('type', 'string', '日志类型'),
            queryParam('startDate', 'string', '开始日期'),
            queryParam('endDate', 'string', '结束日期'),
            queryParam('page', 'integer', '页码'),
            queryParam('limit', 'integer', '每页数量')
          ],
          responses: { '200': { description: '审计日志列表' } }
        }
      },
      '/api/audit/types': {
        get: {
          tags: ['Audit'],
          summary: '获取审计日志类型',
          operationId: 'getAuditTypes',
          responses: { '200': { description: '类型列表' } }
        }
      },

      // ─── Export & Share ─────────────────────────
      '/api/export/snapshot': {
        get: {
          tags: ['Export & Share'],
          summary: '导出系统快照',
          description: '导出当前系统状态的完整快照（JSON）',
          operationId: 'exportSnapshot',
          responses: { '200': { description: '快照数据' } }
        }
      },
      '/api/export/task-report': {
        post: {
          tags: ['Export & Share'],
          summary: '生成任务报告',
          operationId: 'exportTaskReport',
          requestBody: jsonBody({ type: 'object', properties: { taskId: { type: 'string' }, format: { type: 'string', enum: ['json', 'markdown'] } } }),
          responses: { '200': { description: '报告数据' } }
        }
      },
      '/api/export/dashboard': {
        get: {
          tags: ['Export & Share'],
          summary: '导出仪表板数据',
          operationId: 'exportDashboard',
          responses: { '200': { description: '仪表板数据' } }
        }
      },
      '/api/export/screenshot': {
        post: {
          tags: ['Export & Share'],
          summary: '生成截图',
          operationId: 'exportScreenshot',
          requestBody: jsonBody({ type: 'object', properties: { imageBase64: { type: 'string' } } }),
          responses: { '200': { description: '截图数据' } }
        }
      },
      '/api/share/feishu': {
        post: {
          tags: ['Export & Share'],
          summary: '分享到飞书',
          operationId: 'shareToFeishu',
          requestBody: jsonBody({ type: 'object', properties: { type: { type: 'string' }, chatId: { type: 'string' }, imageBase64: { type: 'string' } } }),
          responses: { '200': { description: '分享成功' } }
        }
      },
      '/api/share/dingtalk': {
        post: {
          tags: ['Export & Share'],
          summary: '分享到钉钉',
          operationId: 'shareToDingtalk',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '分享成功' } }
        }
      },
      '/api/share/wecom': {
        post: {
          tags: ['Export & Share'],
          summary: '分享到企业微信',
          operationId: 'shareToWecom',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '分享成功' } }
        }
      },
      '/api/share/slack': {
        post: {
          tags: ['Export & Share'],
          summary: '分享到 Slack',
          operationId: 'shareToSlack',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '分享成功' } }
        }
      },

      // ─── IM Config ──────────────────────────────
      '/api/feishu/config': {
        get: {
          tags: ['Export & Share'],
          summary: '获取飞书配置',
          operationId: 'getFeishuConfig',
          responses: { '200': { description: '配置信息' } }
        },
        post: {
          tags: ['Export & Share'],
          summary: '保存飞书配置',
          operationId: 'saveFeishuConfig',
          requestBody: jsonBody({ type: 'object', properties: { appId: { type: 'string' }, appSecret: { type: 'string' } } }),
          responses: { '200': { description: '保存成功' } }
        }
      },
      '/api/dingtalk/config': {
        get: {
          tags: ['Export & Share'],
          summary: '获取钉钉配置',
          operationId: 'getDingtalkConfig',
          responses: { '200': { description: '配置信息' } }
        },
        post: {
          tags: ['Export & Share'],
          summary: '保存钉钉配置',
          operationId: 'saveDingtalkConfig',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '保存成功' } }
        }
      },
      '/api/wecom/config': {
        get: {
          tags: ['Export & Share'],
          summary: '获取企微配置',
          operationId: 'getWecomConfig',
          responses: { '200': { description: '配置信息' } }
        },
        post: {
          tags: ['Export & Share'],
          summary: '保存企微配置',
          operationId: 'saveWecomConfig',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '保存成功' } }
        }
      },
      '/api/slack/config': {
        get: {
          tags: ['Export & Share'],
          summary: '获取 Slack 配置',
          operationId: 'getSlackConfig',
          responses: { '200': { description: '配置信息' } }
        },
        post: {
          tags: ['Export & Share'],
          summary: '保存 Slack 配置',
          operationId: 'saveSlackConfig',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '保存成功' } }
        }
      },

      // ─── Sync ───────────────────────────────────
      '/api/sync/templates': {
        get: {
          tags: ['Sync'],
          summary: '获取同步模板列表',
          operationId: 'listSyncTemplates',
          responses: { '200': { description: '同步模板列表' } }
        },
        post: {
          tags: ['Sync'],
          summary: '创建同步模板',
          operationId: 'createSyncTemplate',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '创建成功' } }
        }
      },
      '/api/sync/templates/{templateId}': {
        put: {
          tags: ['Sync'],
          summary: '更新同步模板',
          operationId: 'updateSyncTemplate',
          parameters: [pathParam('templateId', '模板 ID')],
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '更新成功' } }
        },
        delete: {
          tags: ['Sync'],
          summary: '删除同步模板',
          operationId: 'deleteSyncTemplate',
          parameters: [pathParam('templateId', '模板 ID')],
          responses: { '200': { description: '删除成功' } }
        }
      },
      '/api/sync/presets': {
        get: {
          tags: ['Sync'],
          summary: '获取同步预设列表',
          operationId: 'listSyncPresets',
          responses: { '200': { description: '同步预设列表' } }
        },
        post: {
          tags: ['Sync'],
          summary: '创建同步预设',
          operationId: 'createSyncPreset',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '创建成功' } }
        }
      },
      '/api/sync/presets/{presetId}': {
        put: {
          tags: ['Sync'],
          summary: '更新同步预设',
          operationId: 'updateSyncPreset',
          parameters: [pathParam('presetId', '预设 ID')],
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '更新成功' } }
        },
        delete: {
          tags: ['Sync'],
          summary: '删除同步预设',
          operationId: 'deleteSyncPreset',
          parameters: [pathParam('presetId', '预设 ID')],
          responses: { '200': { description: '删除成功' } }
        }
      },

      // ─── Admin: User Groups ─────────────────────
      '/api/admin/users': {
        get: {
          tags: ['Users'],
          summary: '管理员获取用户列表',
          operationId: 'adminListUsers',
          responses: { '200': { description: '用户列表' } }
        }
      },
      '/api/admin/stats': {
        get: {
          tags: ['Users'],
          summary: '管理员统计面板',
          operationId: 'adminStats',
          responses: { '200': { description: '统计数据' } }
        }
      },
      '/api/admin/presets/{presetId}': {
        delete: {
          tags: ['Presets'],
          summary: '管理员删除预设',
          operationId: 'adminDeletePreset',
          parameters: [pathParam('presetId', '预设 ID')],
          responses: { '200': { description: '删除成功' } }
        }
      },
      '/api/admin/presets/{presetId}/permissions': {
        put: {
          tags: ['Presets'],
          summary: '管理员修改预设权限',
          operationId: 'adminUpdatePresetPermissions',
          parameters: [pathParam('presetId', '预设 ID')],
          requestBody: jsonBody({ type: 'object', properties: { permissions: { type: 'object' } } }),
          responses: { '200': { description: '权限已更新' } }
        }
      },
      '/api/admin/user-groups': {
        get: {
          tags: ['Users'],
          summary: '获取用户组列表',
          operationId: 'adminListUserGroups',
          responses: { '200': { description: '用户组列表' } }
        },
        post: {
          tags: ['Users'],
          summary: '创建用户组',
          operationId: 'adminCreateUserGroup',
          requestBody: jsonBody({ type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } }),
          responses: { '200': { description: '创建成功' } }
        }
      },
      '/api/admin/user-groups/{groupId}': {
        put: {
          tags: ['Users'],
          summary: '更新用户组',
          operationId: 'adminUpdateUserGroup',
          parameters: [pathParam('groupId', '用户组 ID')],
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '更新成功' } }
        },
        delete: {
          tags: ['Users'],
          summary: '删除用户组',
          operationId: 'adminDeleteUserGroup',
          parameters: [pathParam('groupId', '用户组 ID')],
          responses: { '200': { description: '删除成功' } }
        }
      },
      '/api/admin/user-groups/{groupId}/members': {
        post: {
          tags: ['Users'],
          summary: '添加用户组成员',
          operationId: 'adminAddUserGroupMember',
          parameters: [pathParam('groupId', '用户组 ID')],
          requestBody: jsonBody({ type: 'object', properties: { userId: { type: 'string' } } }),
          responses: { '200': { description: '添加成功' } }
        }
      },
      '/api/admin/user-groups/{groupId}/members/{memberId}': {
        delete: {
          tags: ['Users'],
          summary: '移除用户组成员',
          operationId: 'adminRemoveUserGroupMember',
          parameters: [pathParam('groupId', '用户组 ID'), pathParam('memberId', '成员 ID')],
          responses: { '200': { description: '移除成功' } }
        }
      },

      // ─── Admin: Quiet Hours ─────────────────────
      '/api/admin/quiet-hours/config': {
        get: {
          tags: ['Notifications'],
          summary: '获取免打扰配置',
          operationId: 'getQuietHoursConfig',
          responses: { '200': { description: '免打扰配置' } }
        },
        put: {
          tags: ['Notifications'],
          summary: '更新免打扰配置',
          operationId: 'updateQuietHoursConfig',
          requestBody: jsonBody({ type: 'object', properties: { enabled: { type: 'boolean' }, startHour: { type: 'integer' }, endHour: { type: 'integer' } } }),
          responses: { '200': { description: '更新成功' } }
        }
      },
      '/api/admin/quiet-hours/status': {
        get: {
          tags: ['Notifications'],
          summary: '获取免打扰状态',
          operationId: 'getQuietHoursStatus',
          responses: { '200': { description: '当前状态' } }
        }
      },
      '/api/admin/quiet-hours/queue': {
        get: {
          tags: ['Notifications'],
          summary: '获取排队通知',
          operationId: 'getQuietHoursQueue',
          responses: { '200': { description: '排队通知列表' } }
        },
        delete: {
          tags: ['Notifications'],
          summary: '清空排队通知',
          operationId: 'clearQuietHoursQueue',
          responses: { '200': { description: '已清空' } }
        }
      },
      '/api/admin/quiet-hours/queue/process': {
        post: {
          tags: ['Notifications'],
          summary: '立即处理排队通知',
          operationId: 'processQuietHoursQueue',
          responses: { '200': { description: '处理完成' } }
        }
      },

      // ─── Admin: Backup ──────────────────────────
      '/api/admin/backup/status': {
        get: {
          tags: ['Backup'],
          summary: '获取备份状态',
          operationId: 'getBackupStatus',
          responses: { '200': { description: '备份状态' } }
        }
      },
      '/api/admin/backup': {
        get: {
          tags: ['Backup'],
          summary: '获取备份列表',
          operationId: 'listBackups',
          responses: { '200': { description: '备份列表' } }
        }
      },
      '/api/admin/restore': {
        post: {
          tags: ['Backup'],
          summary: '恢复备份',
          operationId: 'restoreBackup',
          requestBody: jsonBody({ type: 'object', properties: { backupId: { type: 'string' } } }),
          responses: { '200': { description: '恢复成功' } }
        }
      },
      '/api/admin/restore/selective': {
        post: {
          tags: ['Backup'],
          summary: '选择性恢复',
          operationId: 'selectiveRestore',
          requestBody: jsonBody({ type: 'object', properties: { backupId: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } } }),
          responses: { '200': { description: '恢复成功' } }
        }
      },
      '/api/admin/backup/{backupId}/tag': {
        post: {
          tags: ['Backup'],
          summary: '标记备份',
          operationId: 'tagBackup',
          parameters: [pathParam('backupId', '备份 ID')],
          requestBody: jsonBody({ type: 'object', properties: { tag: { type: 'string' } } }),
          responses: { '200': { description: '标记成功' } }
        }
      },
      '/api/admin/backup/compare': {
        get: {
          tags: ['Backup'],
          summary: '比较备份',
          operationId: 'compareBackups',
          parameters: [queryParam('backupId1', 'string', '备份1 ID'), queryParam('backupId2', 'string', '备份2 ID')],
          responses: { '200': { description: '比较结果' } }
        }
      },
      '/api/admin/backup/versions': {
        get: {
          tags: ['Backup'],
          summary: '获取备份版本列表',
          operationId: 'listBackupVersions',
          responses: { '200': { description: '版本列表' } }
        }
      },

      // ─── Admin: Workload Alerts ─────────────────
      '/api/admin/workload-alerts/config': {
        get: {
          tags: ['System'],
          summary: '获取负载告警配置',
          operationId: 'getWorkloadAlertsConfig',
          responses: { '200': { description: '配置信息' } }
        },
        put: {
          tags: ['System'],
          summary: '更新负载告警配置',
          operationId: 'updateWorkloadAlertsConfig',
          requestBody: jsonBody({ type: 'object', properties: { enabled: { type: 'boolean' }, thresholds: { type: 'object' } } }),
          responses: { '200': { description: '更新成功' } }
        }
      },
      '/api/admin/workload-alerts/check': {
        post: {
          tags: ['System'],
          summary: '手动触发负载检查',
          operationId: 'checkWorkload',
          responses: { '200': { description: '检查结果' } }
        }
      },
      '/api/admin/workload-alerts/history': {
        get: {
          tags: ['System'],
          summary: '获取负载告警历史',
          operationId: 'getWorkloadAlertHistory',
          parameters: [queryParam('limit', 'integer', '数量限制')],
          responses: { '200': { description: '告警历史' } }
        }
      },

      // ─── Admin: Task/Workflow Completion ─────────
      '/api/admin/task-completion/config': {
        get: {
          tags: ['Notifications'],
          summary: '获取任务完成通知配置',
          operationId: 'getTaskCompletionConfig',
          responses: { '200': { description: '配置信息' } }
        },
        put: {
          tags: ['Notifications'],
          summary: '更新任务完成通知配置',
          operationId: 'updateTaskCompletionConfig',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '更新成功' } }
        }
      },
      '/api/admin/workflow-completion/config': {
        get: {
          tags: ['Notifications'],
          summary: '获取工作流完成通知配置',
          operationId: 'getWorkflowCompletionConfig',
          responses: { '200': { description: '配置信息' } }
        },
        put: {
          tags: ['Notifications'],
          summary: '更新工作流完成通知配置',
          operationId: 'updateWorkflowCompletionConfig',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '更新成功' } }
        }
      },

      // ─── Admin: Notification Channels ───────────
      '/api/admin/notification-channels': {
        get: {
          tags: ['Notifications'],
          summary: '获取通知渠道列表',
          operationId: 'listNotificationChannels',
          responses: { '200': { description: '渠道列表' } }
        },
        post: {
          tags: ['Notifications'],
          summary: '创建通知渠道',
          operationId: 'createNotificationChannel',
          requestBody: jsonBody({ type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, config: { type: 'object' } } }),
          responses: { '200': { description: '创建成功' } }
        }
      },
      '/api/admin/notification-channels/{channelId}': {
        put: {
          tags: ['Notifications'],
          summary: '更新通知渠道',
          operationId: 'updateNotificationChannel',
          parameters: [pathParam('channelId', '渠道 ID')],
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '更新成功' } }
        },
        delete: {
          tags: ['Notifications'],
          summary: '删除通知渠道',
          operationId: 'deleteNotificationChannel',
          parameters: [pathParam('channelId', '渠道 ID')],
          responses: { '200': { description: '删除成功' } }
        }
      },
      '/api/admin/notification-channels/{channelId}/test': {
        post: {
          tags: ['Notifications'],
          summary: '测试通知渠道',
          operationId: 'testNotificationChannel',
          parameters: [pathParam('channelId', '渠道 ID')],
          responses: { '200': { description: '测试结果' } }
        }
      },
      '/api/admin/notification-channels/{channelId}/toggle': {
        put: {
          tags: ['Notifications'],
          summary: '启用/禁用通知渠道',
          operationId: 'toggleNotificationChannel',
          parameters: [pathParam('channelId', '渠道 ID')],
          requestBody: jsonBody({ type: 'object', properties: { enabled: { type: 'boolean' } } }),
          responses: { '200': { description: '操作成功' } }
        }
      },
      '/api/admin/notification-channels/{channelId}/priority': {
        patch: {
          tags: ['Notifications'],
          summary: '修改通知渠道优先级',
          operationId: 'updateChannelPriority',
          parameters: [pathParam('channelId', '渠道 ID')],
          requestBody: jsonBody({ type: 'object', properties: { priority: { type: 'integer' } } }),
          responses: { '200': { description: '更新成功' } }
        }
      },
      '/api/admin/notification-channels/reorder': {
        post: {
          tags: ['Notifications'],
          summary: '重新排序通知渠道',
          operationId: 'reorderNotificationChannels',
          requestBody: jsonBody({ type: 'object', properties: { channelIds: { type: 'array', items: { type: 'string' } } } }),
          responses: { '200': { description: '排序成功' } }
        }
      },

      // ─── Admin: Notification History ────────────
      '/api/admin/notification-history': {
        get: {
          tags: ['Notifications'],
          summary: '获取通知历史',
          operationId: 'listNotificationHistory',
          parameters: [
            queryParam('page', 'integer', '页码'),
            queryParam('limit', 'integer', '每页数量'),
            queryParam('status', 'string', '状态筛选'),
            queryParam('channelId', 'string', '渠道筛选')
          ],
          responses: { '200': { description: '通知历史列表' } }
        }
      },
      '/api/admin/notification-history/{notificationId}/retry': {
        post: {
          tags: ['Notifications'],
          summary: '重试发送通知',
          operationId: 'retryNotification',
          parameters: [pathParam('notificationId', '通知 ID')],
          responses: { '200': { description: '重试结果' } }
        }
      },
      '/api/admin/notification-history/stats': {
        get: {
          tags: ['Notifications'],
          summary: '通知统计',
          operationId: 'getNotificationStats',
          responses: { '200': { description: '统计数据' } }
        }
      },
      '/api/admin/notification-history/trends': {
        get: {
          tags: ['Notifications'],
          summary: '通知趋势',
          operationId: 'getNotificationTrends',
          parameters: [queryParam('days', 'integer', '天数')],
          responses: { '200': { description: '趋势数据' } }
        }
      },
      '/api/admin/notification-history/chart-stats': {
        get: {
          tags: ['Notifications'],
          summary: '通知图表统计',
          operationId: 'getNotificationChartStats',
          responses: { '200': { description: '图表统计数据' } }
        }
      },

      // ─── Admin: Notification Templates ──────────
      '/api/admin/notification-templates': {
        get: {
          tags: ['Notifications'],
          summary: '获取通知模板列表',
          operationId: 'listNotificationTemplates',
          responses: { '200': { description: '模板列表' } }
        },
        put: {
          tags: ['Notifications'],
          summary: '更新通知模板',
          operationId: 'updateNotificationTemplate',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '更新成功' } }
        }
      },
      '/api/admin/notification-templates/{templateType}/reset': {
        post: {
          tags: ['Notifications'],
          summary: '重置通知模板',
          operationId: 'resetNotificationTemplate',
          parameters: [pathParam('templateType', '模板类型')],
          responses: { '200': { description: '重置成功' } }
        }
      },
      '/api/admin/notification-templates/reset-all': {
        post: {
          tags: ['Notifications'],
          summary: '重置所有通知模板',
          operationId: 'resetAllNotificationTemplates',
          responses: { '200': { description: '全部重置成功' } }
        }
      },

      // ─── Admin: Channel Health Check ────────────
      '/api/admin/channel-health/config': {
        get: {
          tags: ['Notifications'],
          summary: '获取渠道健康检查配置',
          operationId: 'getChannelHealthConfig',
          responses: { '200': { description: '配置信息' } }
        },
        put: {
          tags: ['Notifications'],
          summary: '更新渠道健康检查配置',
          operationId: 'updateChannelHealthConfig',
          requestBody: jsonBody({ type: 'object', properties: { enabled: { type: 'boolean' }, intervalMinutes: { type: 'integer' } } }),
          responses: { '200': { description: '更新成功' } }
        }
      },
      '/api/admin/channel-health/check': {
        post: {
          tags: ['Notifications'],
          summary: '手动执行全部渠道健康检查',
          operationId: 'runChannelHealthCheck',
          responses: { '200': { description: '检查结果' } }
        }
      },
      '/api/admin/channel-health/check/{channelId}': {
        post: {
          tags: ['Notifications'],
          summary: '检查单个渠道健康',
          operationId: 'checkSingleChannelHealth',
          parameters: [pathParam('channelId', '渠道 ID')],
          responses: { '200': { description: '检查结果' } }
        }
      },
      '/api/admin/channel-health/status': {
        get: {
          tags: ['Notifications'],
          summary: '获取渠道健康状态',
          operationId: 'getChannelHealthStatus',
          responses: { '200': { description: '健康状态' } }
        }
      },
      '/api/admin/channel-health/history/{channelId}': {
        get: {
          tags: ['Notifications'],
          summary: '获取渠道健康检查历史',
          operationId: 'getChannelHealthHistory',
          parameters: [pathParam('channelId', '渠道 ID')],
          responses: { '200': { description: '检查历史' } }
        }
      },

      // ─── Admin: Scheduled Backup ────────────────
      '/api/admin/scheduled-backup/config': {
        get: {
          tags: ['Backup'],
          summary: '获取定时备份配置',
          operationId: 'getScheduledBackupConfig',
          responses: { '200': { description: '配置信息' } }
        },
        put: {
          tags: ['Backup'],
          summary: '更新定时备份配置',
          operationId: 'updateScheduledBackupConfig',
          requestBody: jsonBody({ type: 'object', properties: { enabled: { type: 'boolean' }, intervalHours: { type: 'integer' }, maxBackups: { type: 'integer' } } }),
          responses: { '200': { description: '更新成功' } }
        }
      },
      '/api/admin/scheduled-backup/history': {
        get: {
          tags: ['Backup'],
          summary: '获取定时备份历史',
          operationId: 'getScheduledBackupHistory',
          responses: { '200': { description: '备份历史' } }
        }
      },
      '/api/admin/scheduled-backup/run': {
        post: {
          tags: ['Backup'],
          summary: '手动触发备份',
          operationId: 'runScheduledBackup',
          responses: { '200': { description: '备份完成' } }
        }
      },
      '/api/admin/scheduled-backup-notification/config': {
        get: {
          tags: ['Backup'],
          summary: '获取备份通知配置',
          operationId: 'getBackupNotificationConfig',
          responses: { '200': { description: '配置信息' } }
        },
        put: {
          tags: ['Backup'],
          summary: '更新备份通知配置',
          operationId: 'updateBackupNotificationConfig',
          requestBody: jsonBody({ type: 'object' }),
          responses: { '200': { description: '更新成功' } }
        }
      },

      // ─── Admin: Cloud Storage ───────────────────
      '/api/admin/cloud-storage/config': {
        get: {
          tags: ['Backup'],
          summary: '获取云存储配置',
          operationId: 'getCloudStorageConfig',
          responses: { '200': { description: '配置信息' } }
        },
        post: {
          tags: ['Backup'],
          summary: '保存云存储配置',
          operationId: 'saveCloudStorageConfig',
          requestBody: jsonBody({ type: 'object', properties: { provider: { type: 'string' }, bucket: { type: 'string' }, region: { type: 'string' }, credentials: { type: 'object' } } }),
          responses: { '200': { description: '保存成功' } }
        }
      },
      '/api/admin/backup/cloud': {
        post: {
          tags: ['Backup'],
          summary: '上传备份到云端',
          operationId: 'uploadBackupToCloud',
          requestBody: jsonBody({ type: 'object', properties: { backupId: { type: 'string' } } }),
          responses: { '200': { description: '上传成功' } }
        }
      },
      '/api/admin/backup/cloud/list': {
        get: {
          tags: ['Backup'],
          summary: '获取云端备份列表',
          operationId: 'listCloudBackups',
          responses: { '200': { description: '云端备份列表' } }
        }
      },
      '/api/admin/backup/cloud/restore': {
        post: {
          tags: ['Backup'],
          summary: '从云端恢复备份',
          operationId: 'restoreCloudBackup',
          requestBody: jsonBody({ type: 'object', properties: { key: { type: 'string' } } }),
          responses: { '200': { description: '恢复成功' } }
        }
      },
      '/api/admin/backup/cloud/test': {
        post: {
          tags: ['Backup'],
          summary: '测试云存储连接',
          operationId: 'testCloudStorage',
          responses: { '200': { description: '测试结果' } }
        }
      },
      '/api/admin/backup/cloud/lifecycle': {
        get: {
          tags: ['Backup'],
          summary: '获取云端备份生命周期配置',
          operationId: 'getCloudLifecycle',
          responses: { '200': { description: '生命周期配置' } }
        }
      },
      '/api/admin/backup/cloud/cleanup': {
        post: {
          tags: ['Backup'],
          summary: '清理云端过期备份',
          operationId: 'cleanupCloudBackups',
          responses: { '200': { description: '清理结果' } }
        }
      },

      // ─── Plugins ─────────────────────────────────
      '/api/plugins': {
        get: {
          tags: ['Plugins'],
          summary: '获取所有已加载插件列表',
          operationId: 'listPlugins',
          responses: {
            '200': { description: '插件列表', content: jsonContent({ type: 'object', properties: { plugins: { type: 'array', items: { $ref: '#/components/schemas/Plugin' } } } }) }
          }
        }
      },
      '/api/plugins/{name}': {
        get: {
          tags: ['Plugins'],
          summary: '获取指定插件详情',
          operationId: 'getPlugin',
          parameters: [pathParam('name', '插件名称')],
          responses: {
            '200': { description: '插件详情', content: jsonContent({ type: 'object' }) },
            '404': { description: '插件不存在' }
          }
        }
      },
      '/api/plugins/{name}/enable': {
        post: {
          tags: ['Plugins'],
          summary: '启用插件',
          operationId: 'enablePlugin',
          parameters: [pathParam('name', '插件名称')],
          responses: {
            '200': { description: '启用成功', content: jsonContent({ type: 'object', properties: { success: { type: 'boolean' } } }) },
            '400': { description: '启用失败' }
          }
        }
      },
      '/api/plugins/{name}/disable': {
        post: {
          tags: ['Plugins'],
          summary: '禁用插件',
          operationId: 'disablePlugin',
          parameters: [pathParam('name', '插件名称')],
          responses: {
            '200': { description: '禁用成功', content: jsonContent({ type: 'object', properties: { success: { type: 'boolean' } } }) },
            '400': { description: '禁用失败' }
          }
        }
      },
      '/api/plugins/{name}/config': {
        get: {
          tags: ['Plugins'],
          summary: '获取插件配置',
          operationId: 'getPluginConfig',
          parameters: [pathParam('name', '插件名称')],
          responses: {
            '200': { description: '插件配置', content: jsonContent({ type: 'object' }) },
            '404': { description: '插件不存在' }
          }
        },
        put: {
          tags: ['Plugins'],
          summary: '更新插件配置',
          operationId: 'updatePluginConfig',
          parameters: [pathParam('name', '插件名称')],
          requestBody: jsonBody({ type: 'object', description: '插件配置对象' }),
          responses: {
            '200': { description: '更新成功', content: jsonContent({ type: 'object' }) },
            '400': { description: '更新失败' }
          }
        }
      },
      '/api/plugins/type/{type}': {
        get: {
          tags: ['Plugins'],
          summary: '按类型获取插件列表',
          operationId: 'listPluginsByType',
          parameters: [pathParam('type', '插件类型 (panel/notification/datasource)')],
          responses: {
            '200': { description: '插件列表', content: jsonContent({ type: 'object' }) }
          }
        }
      },
      '/api/plugins/{name}/reload': {
        post: {
          tags: ['Plugins'],
          summary: '重载插件',
          operationId: 'reloadPlugin',
          parameters: [pathParam('name', '插件名称')],
          responses: {
            '200': { description: '重载成功', content: jsonContent({ type: 'object' }) },
            '400': { description: '重载失败' }
          }
        }
      },
      '/api/plugins/{name}/call': {
        post: {
          tags: ['Plugins'],
          summary: '调用插件方法',
          operationId: 'callPluginMethod',
          parameters: [pathParam('name', '插件名称')],
          requestBody: jsonBody({
            type: 'object',
            properties: {
              method: { type: 'string', description: '要调用的方法名' },
              args: { type: 'object', description: '方法参数' }
            }
          }),
          responses: {
            '200': { description: '调用结果', content: jsonContent({ type: 'object' }) },
            '400': { description: '调用失败' }
          }
        }
      }
    },

    components: {
      schemas: {
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '任务 ID' },
            message: { type: 'string', description: '任务描述' },
            agentId: { type: 'string', description: '执行 Agent ID' },
            status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'paused'], description: '任务状态' },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: '优先级' },
            createdAt: { type: 'string', format: 'date-time', description: '创建时间' },
            startedAt: { type: 'string', format: 'date-time', description: '开始时间' },
            completedAt: { type: 'string', format: 'date-time', description: '完成时间' },
            result: { type: 'object', description: '执行结果' }
          }
        },
        WorkflowStep: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '步骤 ID' },
            name: { type: 'string', description: '步骤名称' },
            agentId: { type: 'string', description: '执行 Agent' },
            message: { type: 'string', description: '步骤任务描述' },
            dependsOn: { type: 'array', items: { type: 'string' }, description: '依赖的步骤 ID' }
          }
        },
        Plugin: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '插件名称' },
            version: { type: 'string', description: '插件版本' },
            description: { type: 'string', description: '插件描述' },
            type: { type: 'string', enum: ['panel', 'notification', 'datasource'], description: '插件类型' },
            author: { type: 'string', description: '插件作者' },
            state: { type: 'string', enum: ['unloaded', 'loaded', 'enabled', 'disabled', 'error'], description: '插件状态' },
            configSchema: { type: 'object', description: '配置项定义' },
            pluginPath: { type: 'string', description: '插件路径' },
            error: { type: 'string', description: '错误信息' }
          }
        }
      }
    }
  };
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function queryParam(name, type, description, example) {
  const param = { name, in: 'query', schema: { type }, description };
  if (example) param.schema.example = example;
  return param;
}

function pathParam(name, description) {
  return { name, in: 'path', required: true, schema: { type: 'string' }, description };
}

function jsonContent(schema) {
  return { 'application/json': { schema } };
}

function jsonBody(schema) {
  return { required: true, content: { 'application/json': { schema } } };
}

// ─── Swagger UI HTML ────────────────────────────────────────────────────────

function getSwaggerUIHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Orchestra API Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css">
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 30px 0; }
    .swagger-ui .info .title { font-size: 28px; }
    .api-docs-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; padding: 20px 40px; display: flex; align-items: center; gap: 16px;
    }
    .api-docs-header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .api-docs-header .badge { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 12px; font-size: 13px; }
    .api-docs-header .back-link { color: white; text-decoration: none; margin-left: auto; opacity: 0.8; }
    .api-docs-header .back-link:hover { opacity: 1; }
  </style>
</head>
<body>
  <div class="api-docs-header">
    <h1>🎼 Agent Orchestra API</h1>
    <span class="badge">OpenAPI 3.0</span>
    <a href="/" class="back-link">← 返回面板</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/docs/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true
    });
  </script>
</body>
</html>`;
}

// ─── Request Handler ────────────────────────────────────────────────────────

function handleApiDocsRequest(pathname, req, res, port) {
  if (pathname === '/api-docs' || pathname === '/api-docs/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getSwaggerUIHtml());
    return true;
  }

  if (pathname === '/api/docs/openapi.json') {
    const spec = getOpenAPISpec(port);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(spec, null, 2));
    return true;
  }

  return false;
}

module.exports = { handleApiDocsRequest, getOpenAPISpec };
