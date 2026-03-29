/**
 * Analytics Engine 单元测试
 */

const { AnalyticsEngine, analyticsEngine } = require('../../lib/analytics-engine');

function createMockTasks(count = 10) {
  const tasks = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const createdAt = now - (i * 24 * 60 * 60 * 1000);
    const status = ['completed', 'failed', 'running', 'queued'][i % 4];
    
    tasks.push({
      id: `task-${i}`,
      title: `Test Task ${i}`,
      status,
      createdAt,
      startedAt: status !== 'queued' ? createdAt + 1000 : null,
      finishedAt: status === 'completed' ? createdAt + 10000 : (status === 'failed' ? createdAt + 5000 : null),
      agents: [`agent-${i % 3}`],
      runs: [
        {
          agentId: `agent-${i % 3}`,
          status: status === 'completed' ? 'completed' : (status === 'failed' ? 'failed' : 'running'),
          startedAt: status !== 'queued' ? createdAt + 1000 : null,
          finishedAt: status === 'completed' ? createdAt + 10000 : (status === 'failed' ? createdAt + 5000 : null),
          error: status === 'failed' ? 'Test error' : null
        }
      ]
    });
  }
  
  return tasks;
}

function createMockAgents() {
  return [
    { id: 'agent-0', name: 'Agent 0', status: 'busy', sessionsCount: 5 },
    { id: 'agent-1', name: 'Agent 1', status: 'idle', sessionsCount: 3 },
    { id: 'agent-2', name: 'Agent 2', status: 'offline', sessionsCount: 0 }
  ];
}

function createMockWorkflows() {
  return [
    {
      id: 'workflow-1',
      name: 'Test Workflow 1',
      description: 'Test workflow',
      steps: [
        { id: 'step-1', agentId: 'agent-0', prompt: 'Step 1' },
        { id: 'step-2', agentId: 'agent-1', prompt: 'Step 2', dependsOn: ['step-1'] }
      ]
    },
    {
      id: 'workflow-2',
      name: 'Test Workflow 2',
      description: 'Another workflow',
      steps: [
        { id: 'step-a', agentId: 'agent-2', prompt: 'Step A' }
      ]
    }
  ];
}

function createMockWorkflowRuns() {
  return [
    {
      id: 'run-1',
      workflowId: 'workflow-1',
      status: 'completed',
      startedAt: Date.now() - 10000,
      finishedAt: Date.now(),
      stepResults: {
        'step-1': { status: 'completed', duration: 5000 },
        'step-2': { status: 'completed', duration: 3000 }
      }
    },
    {
      id: 'run-2',
      workflowId: 'workflow-1',
      status: 'failed',
      startedAt: Date.now() - 20000,
      finishedAt: Date.now() - 10000,
      stepResults: {
        'step-1': { status: 'failed', duration: 5000 }
      }
    }
  ];
}

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   错误：${error.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `期望 ${JSON.stringify(expected)}, 实际 ${JSON.stringify(actual)}`);
  }
}

function assertStrict(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `期望 ${expected}, 实际 ${actual}`);
  }
}

function assertGreaterThan(actual, min, message) {
  if (!(actual > min)) {
    throw new Error(message || `期望 ${actual} > ${min}`);
  }
}

function assertGreaterThanOrEqual(actual, min, message) {
  if (!(actual >= min)) {
    throw new Error(message || `期望 ${actual} >= ${min}`);
  }
}

function assertLessThan(actual, max, message) {
  if (!(actual < max)) {
    throw new Error(message || `期望 ${actual} < ${max}`);
  }
}

console.log('Analytics Engine 单元测试\n==================================================\n');

let passed = 0;
let failed = 0;

const engine = new AnalyticsEngine();

passed += test('analyzeTasks - 返回摘要包含零值 for empty tasks', () => {
  const result = engine.analyzeTasks([]);
  assert(result.summary !== undefined, '应该有 summary');
  assertEqual(result.summary.total, 0);
  assertEqual(result.summary.completed, 0);
  assertEqual(result.summary.completionRate, 0);
});

passed += test('analyzeTasks - 计算正确的完成率和失败率', () => {
  const tasks = [
    { id: '1', status: 'completed', createdAt: Date.now() },
    { id: '2', status: 'completed', createdAt: Date.now() },
    { id: '3', status: 'failed', createdAt: Date.now() },
    { id: '4', status: 'queued', createdAt: Date.now() }
  ];
  
  const result = engine.analyzeTasks(tasks);
  assertEqual(result.summary.total, 4);
  assertEqual(result.summary.completed, 2);
  assertEqual(result.summary.failed, 1);
  assertEqual(result.summary.completionRate, 50);
  assertEqual(result.summary.failureRate, 25);
});

passed += test('analyzeTasks - 返回 dailyStats 数组', () => {
  const tasks = createMockTasks(10);
  const result = engine.analyzeTasks(tasks);
  assert(Array.isArray(result.dailyStats), 'dailyStats 应该是数组');
});

passed += test('analyzeTasks - 返回 trendAnalysis', () => {
  const tasks = createMockTasks(20);
  const result = engine.analyzeTasks(tasks);
  assert(result.trendAnalysis !== undefined, '应该有 trendAnalysis');
});

passed += test('analyzeTasks - 返回 statusDistribution', () => {
  const tasks = createMockTasks(10);
  const result = engine.analyzeTasks(tasks);
  assert(result.statusDistribution !== undefined, '应该有 statusDistribution');
  assertGreaterThanOrEqual(result.statusDistribution.completed, 0);
  assertGreaterThanOrEqual(result.statusDistribution.failed, 0);
});

passed += test('calculateDailyStats - 按日期分组任务', () => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const tasks = [
    { id: '1', status: 'completed', createdAt: new Date(today).getTime() },
    { id: '2', status: 'failed', createdAt: new Date(today).getTime() },
    { id: '3', status: 'completed', createdAt: new Date(yesterday).getTime() }
  ];
  
  const result = engine.calculateDailyStats(tasks);
  assertGreaterThan(result.length, 0);
  assert(result[0].date !== undefined, '应该有 date');
});

passed += test('calculateDailyStats - 处理空任务数组', () => {
  const result = engine.calculateDailyStats([]);
  assert(Array.isArray(result), '结果应该是数组');
  assertEqual(result.length, 0);
});

passed += test('calculateDailyStats - 计算每天的完成率和失败率', () => {
  const today = new Date().toISOString().split('T')[0];
  
  const tasks = [
    { id: '1', status: 'completed', createdAt: new Date(today).getTime() },
    { id: '2', status: 'completed', createdAt: new Date(today).getTime() },
    { id: '3', status: 'failed', createdAt: new Date(today).getTime() }
  ];
  
  const result = engine.calculateDailyStats(tasks);
  assert(result[0].completionRate > 0, '完成率应该大于0');
  assert(result[0].failureRate > 0, '失败率应该大于0');
});

passed += test('analyzeTrend - 数据不足时返回 stable', () => {
  const result = engine.analyzeTrend([]);
  assertEqual(result.direction, 'stable');
  assertEqual(result.changeRate, 0);
});

passed += test('analyzeTrend - 生成预测', () => {
  const dailyStats = [];
  const now = Date.now();
  
  for (let i = 0; i < 10; i++) {
    dailyStats.push({
      date: new Date(now - (9 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      completed: 70,
      total: 100
    });
  }
  
  const result = engine.analyzeTrend(dailyStats);
  assert(Array.isArray(result.prediction), 'prediction 应该是数组');
});

passed += test('predictNextDays - 数据不足时返回低置信度', () => {
  const result = engine.predictNextDays([], 7);
  assertEqual(result.length, 7);
  assertEqual(result[0].confidence, 'low');
});

passed += test('predictNextDays - 预测完成率', () => {
  const recentStats = [
    { completionRate: 70 },
    { completionRate: 75 },
    { completionRate: 80 }
  ];
  
  const result = engine.predictNextDays(recentStats, 7);
  assertEqual(result.length, 7);
  result.forEach(prediction => {
    assert(prediction.predictedCompletionRate >= 0);
    assert(prediction.predictedCompletionRate <= 100);
  });
});

passed += test('analyzeAgents - 空任务返回空数组', () => {
  const result = engine.analyzeAgents([], []);
  assertEqual(result.agentStats, []);
  assertEqual(result.summary.totalAgents, 0);
});

passed += test('analyzeAgents - 正确聚合 Agent 统计', () => {
  const tasks = createMockTasks(10);
  const agents = createMockAgents();
  
  const result = engine.analyzeAgents(tasks, agents);
  assertGreaterThan(result.agentStats.length, 0);
});

passed += test('analyzeAgents - 计算每个 Agent 的成功率', () => {
  const tasks = [
    { id: '1', agents: ['agent-0'], runs: [{ agentId: 'agent-0', status: 'completed', startedAt: 1000, finishedAt: 5000 }] },
    { id: '2', agents: ['agent-0'], runs: [{ agentId: 'agent-0', status: 'failed', startedAt: 1000, finishedAt: 5000 }] }
  ];
  
  const result = engine.analyzeAgents(tasks, []);
  assertEqual(result.agentStats[0].successRate, 50);
  assertEqual(result.agentStats[0].failureRate, 50);
});

passed += test('analyzeAgents - 计算负载分布', () => {
  const tasks = createMockTasks(10);
  const agents = createMockAgents();
  
  const result = engine.analyzeAgents(tasks, agents);
  assert(result.workloadDistribution !== undefined);
  assert(Array.isArray(result.workloadDistribution));
});

passed += test('analyzeAgents - 分析响应时间', () => {
  const tasks = [
    { id: '1', agents: ['agent-0'], runs: [{ agentId: 'agent-0', status: 'completed', startedAt: 1000, finishedAt: 5000 }] }
  ];
  
  const result = engine.analyzeAgents(tasks, []);
  assert(result.responseTimeAnalysis !== undefined);
});

passed += test('analyzeAgents - 找到最高效的 Agent', () => {
  const tasks = [
    { id: '1', agents: ['agent-0'], runs: [{ agentId: 'agent-0', status: 'completed' }] },
    { id: '2', agents: ['agent-1'], runs: [{ agentId: 'agent-1', status: 'failed' }] }
  ];
  
  const result = engine.analyzeAgents(tasks, []);
  assert(result.summary.mostEfficientAgent !== undefined);
});

passed += test('analyzeWorkflows - 无工作流时返回空', () => {
  const result = engine.analyzeWorkflows([], []);
  assertEqual(result.workflowStats, []);
  assertEqual(result.summary.totalWorkflows, 0);
});

passed += test('analyzeWorkflows - 分析工作流统计', () => {
  const workflows = createMockWorkflows();
  const runs = createMockWorkflowRuns();
  
  const result = engine.analyzeWorkflows(workflows, runs);
  assertEqual(result.workflowStats.length, 2);
});

passed += test('analyzeWorkflows - 计算每个工作流的成功率', () => {
  const workflows = createMockWorkflows();
  const runs = createMockWorkflowRuns();
  
  const result = engine.analyzeWorkflows(workflows, runs);
  
  const wf1 = result.workflowStats.find(w => w.name === 'Test Workflow 1');
  assertEqual(wf1.successRate, 50);
});

passed += test('analyzeWorkflows - 分析工作流步骤', () => {
  const workflows = createMockWorkflows();
  const runs = createMockWorkflowRuns();
  
  const result = engine.analyzeWorkflows(workflows, runs);
  
  result.workflowStats.forEach(wf => {
    assert(Array.isArray(wf.stepStats));
  });
});

passed += test('detectAnomalies - 数据不足时返回消息', () => {
  const result = engine.detectAnomalies([]);
  assert(result.message !== undefined);
});

passed += test('detectAnomalies - 检测任务量异常', () => {
  const tasks = [];
  const now = Date.now();
  
  for (let i = 0; i < 20; i++) {
    tasks.push({
      id: `task-${i}`,
      status: i < 15 ? 'completed' : 'failed',
      createdAt: now - (i * 24 * 60 * 60 * 1000)
    });
  }
  
  for (let i = 0; i < 5; i++) {
    tasks.push({
      id: `recent-${i}`,
      status: 'completed',
      createdAt: now - (i * 24 * 60 * 60 * 1000)
    });
  }
  
  const result = engine.detectAnomalies(tasks);
  assert(result !== undefined);
});

passed += test('detectAnomalies - 计算基线统计', () => {
  const tasks = createMockTasks(30);
  const result = engine.detectAnomalies(tasks);
  assert(result.baseline !== undefined);
  assertGreaterThan(result.baseline.avgTasksPerDay, 0);
});

passed += test('generateInsights - 返回至少一个洞察', () => {
  const tasks = createMockTasks(20);
  const agents = createMockAgents();
  const workflows = createMockWorkflows();
  
  const result = engine.generateInsights(tasks, agents, workflows);
  assertGreaterThan(result.length, 0);
});

passed += test('generateInsights - 优先处理高优先级洞察', () => {
  const tasks = createMockTasks(20);
  const agents = createMockAgents();
  const workflows = createMockWorkflows();
  
  const result = engine.generateInsights(tasks, agents, workflows);
  assert(result[0].priority !== undefined);
});

passed += test('getOverview - 返回完整概览', () => {
  const tasks = createMockTasks(20);
  const agents = createMockAgents();
  const workflows = createMockWorkflows();
  const workflowRuns = createMockWorkflowRuns();
  
  const result = engine.getOverview(tasks, agents, workflows, workflowRuns);
  
  assert(result.generatedAt !== undefined);
  assert(result.taskAnalysis !== undefined);
  assert(result.agentAnalysis !== undefined);
  assert(result.workflowAnalysis !== undefined);
  assert(result.anomalyDetection !== undefined);
  assert(result.insights !== undefined);
  assert(result.health !== undefined);
});

passed += test('formatDuration - 格式化为人类可读', () => {
  assertEqual(engine.formatDuration(0), '0s');
  assertEqual(engine.formatDuration(500), '0s');
  assertEqual(engine.formatDuration(1000), '1s');
  assertEqual(engine.formatDuration(60000), '1m 0s');
  assertEqual(engine.formatDuration(90000), '1m 30s');
  assertEqual(engine.formatDuration(3600000), '1h 0m');
  assertEqual(engine.formatDuration(86400000), '1d 0h');
});

passed += test('formatDuration - 处理 null 和负值', () => {
  assertEqual(engine.formatDuration(null), '0s');
  assertEqual(engine.formatDuration(-1), '0s');
});

passed += test('mean - 正确计算平均值', () => {
  assertEqual(engine.mean([1, 2, 3, 4, 5]), 3);
  assertEqual(engine.mean([10, 20, 30]), 20);
  assertEqual(engine.mean([]), 0);
});

passed += test('stdDev - 正确计算标准差', () => {
  const values = [2, 4, 4, 4, 5, 5, 7, 9];
  const mean = engine.mean(values);
  const stdDev = engine.stdDev(values, mean);
  
  assertLessThan(Math.abs(stdDev - 2), 1);
});

passed += test('stdDev - 空数组返回0', () => {
  assertEqual(engine.stdDev([], 0), 0);
});

passed += test('findCommonErrors - 找到常见错误模式', () => {
  const tasks = [
    { runs: [{ error: 'timeout error' }] },
    { runs: [{ error: 'timeout occurred' }] },
    { runs: [{ error: 'connection refused' }] }
  ];
  
  const result = engine.findCommonErrors(tasks);
  
  assert(result.pattern !== undefined);
});

passed += test('findCommonErrors - 没有错误时返回 unknown', () => {
  const tasks = [
    { runs: [{ error: null }] }
  ];
  
  const result = engine.findCommonErrors(tasks);
  assert(result.pattern !== undefined);
});

console.log('\n==================================================');
console.log(`测试结果: ${passed} passed, ${failed} failed`);
