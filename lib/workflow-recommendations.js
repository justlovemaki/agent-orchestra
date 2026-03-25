const fs = require('fs').promises;
const path = require('path');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');

// ── helpers ──────────────────────────────────────────────────────────
async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const TASK_TYPE_KEYWORDS = {
  development: ['开发', '实现', '编写', '代码', 'develop', 'implement', 'code', 'build', 'create', 'feature'],
  testing: ['测试', '验证', 'test', 'verify', 'qa', 'check', 'validate'],
  documentation: ['文档', '说明', 'doc', 'readme', 'document', 'write doc', 'specification'],
  deployment: ['部署', '发布', '上线', 'deploy', 'release', 'publish', 'ci/cd', 'pipeline'],
  review: ['审查', '评审', 'review', 'audit', 'inspect', 'pr review'],
  optimization: ['优化', '性能', '重构', 'optimize', 'refactor', 'performance', 'improve'],
  debugging: ['调试', '修复', 'bug', 'debug', 'fix', 'hotfix', 'patch', 'issue'],
  analysis: ['分析', '统计', '数据', 'analyze', 'analysis', 'data', 'report', 'metrics']
};

function detectTaskType(text) {
  if (!text) return 'general';
  const lower = text.toLowerCase();
  let best = 'general';
  let bestScore = 0;
  for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
    const score = keywords.filter(k => lower.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = type; }
  }
  return best;
}

// ── analyzeWorkflowHistory ──────────────────────────────────────────
async function analyzeWorkflowHistory(workflowId) {
  const runs = await readJson(path.join(DATA_DIR, 'workflow-runs.json'), []);
  const workflows = await readJson(path.join(DATA_DIR, 'workflows.json'), []);
  const workflow = workflows.find(w => w.id === workflowId);
  if (!workflow) return null;

  const wfRuns = runs.filter(r => r.workflowId === workflowId && r.steps && r.steps.length > 0);

  // build per-step per-agent stats
  const stepMap = {}; // stepIndex -> agentId -> { runs, success, fail, durations }
  for (const run of wfRuns) {
    for (const step of run.steps) {
      const idx = step.stepIndex ?? 0;
      if (!stepMap[idx]) stepMap[idx] = {};
      const aid = step.agentId || 'unknown';
      if (!stepMap[idx][aid]) stepMap[idx][aid] = { runs: 0, success: 0, fail: 0, durations: [] };
      const s = stepMap[idx][aid];
      s.runs++;
      if (step.status === 'completed') s.success++;
      else s.fail++;
      if (step.duration) s.durations.push(step.duration);
    }
  }

  const stepAnalysis = Object.keys(stepMap).sort((a, b) => a - b).map(idx => {
    const agents = stepMap[idx];
    return {
      stepIndex: Number(idx),
      stepPrompt: (workflow.steps[idx] || {}).prompt || '',
      currentAgent: (workflow.steps[idx] || {}).agentId || '',
      agentStats: Object.entries(agents).map(([agentId, s]) => ({
        agentId,
        runCount: s.runs,
        successCount: s.success,
        failCount: s.fail,
        successRate: s.runs > 0 ? Math.round(s.success / s.runs * 100) : 0,
        avgDuration: s.durations.length > 0 ? Math.round(s.durations.reduce((a, b) => a + b, 0) / s.durations.length) : 0
      })).sort((a, b) => b.successRate - a.successRate || a.avgDuration - b.avgDuration)
    };
  });

  return {
    workflowId,
    workflowName: workflow.name,
    totalRuns: wfRuns.length,
    stepAnalysis
  };
}

// ── getAgentRecommendationsForWorkflow ───────────────────────────────
async function getAgentRecommendationsForWorkflow(workflowId) {
  const analysis = await analyzeWorkflowHistory(workflowId);
  const workflows = await readJson(path.join(DATA_DIR, 'workflows.json'), []);
  const workflow = workflows.find(w => w.id === workflowId);
  if (!workflow) return null;

  const globalPerf = await getGlobalAgentPerformance();

  const recommendations = (workflow.steps || []).map((step, idx) => {
    const stepData = analysis ? analysis.stepAnalysis.find(s => s.stepIndex === idx) : null;

    let recommendedAgent = null;
    let reason = '';
    let confidence = 0;
    let alternatives = [];

    if (stepData && stepData.agentStats.length > 0) {
      // use workflow-specific data
      const sorted = [...stepData.agentStats].sort((a, b) => {
        // priority: success rate > speed > usage
        if (b.successRate !== a.successRate) return b.successRate - a.successRate;
        if (a.avgDuration !== b.avgDuration) return a.avgDuration - b.avgDuration;
        return b.runCount - a.runCount;
      });

      const best = sorted[0];
      recommendedAgent = best.agentId;
      confidence = Math.min(0.95, 0.5 + (best.successRate / 200) + Math.min(best.runCount * 0.05, 0.2));
      reason = `在此步骤中成功率 ${best.successRate}%，平均耗时 ${Math.round(best.avgDuration / 1000)}s（基于 ${best.runCount} 次执行）`;
      alternatives = sorted.slice(1, 4).map(a => ({
        agentId: a.agentId,
        successRate: a.successRate,
        avgDuration: a.avgDuration,
        runCount: a.runCount
      }));
    } else {
      // fallback to global performance + task type matching
      const taskType = detectTaskType(step.prompt);
      const candidates = globalPerf
        .filter(a => a.totalTasks > 0)
        .map(a => {
          let score = a.successRate;
          if (a.bestTaskTypes.includes(taskType)) score += 15;
          return { ...a, score };
        })
        .sort((a, b) => b.score - a.score);

      if (candidates.length > 0) {
        const best = candidates[0];
        recommendedAgent = best.agentId;
        confidence = Math.min(0.7, 0.3 + (best.successRate / 300));
        reason = `全局成功率 ${best.successRate}%` + (best.bestTaskTypes.includes(taskType) ? `，擅长${taskType}类任务` : '') + `（基于 ${best.totalTasks} 次任务）`;
        alternatives = candidates.slice(1, 4).map(a => ({
          agentId: a.agentId,
          successRate: a.successRate,
          avgDuration: a.avgDuration,
          totalTasks: a.totalTasks
        }));
      } else {
        reason = '暂无足够数据生成推荐';
        confidence = 0;
      }
    }

    return {
      stepIndex: idx,
      stepPrompt: step.prompt || '',
      currentAgent: step.agentId || '',
      recommendedAgent,
      reason,
      confidence: Math.round(confidence * 100) / 100,
      alternatives
    };
  });

  return {
    workflowId,
    workflowName: workflow.name,
    totalHistoricalRuns: analysis ? analysis.totalRuns : 0,
    recommendations
  };
}

// ── getGlobalAgentPerformance ───────────────────────────────────────
async function getGlobalAgentPerformance() {
  const tasks = await readJson(path.join(DATA_DIR, 'tasks.json'), []);
  const runs = await readJson(path.join(DATA_DIR, 'workflow-runs.json'), []);
  const groups = await readJson(path.join(DATA_DIR, 'agent-groups.json'), []);

  const agentMap = {}; // agentId -> { tasks, success, fail, durations, taskTypes, wfSteps }

  function ensure(aid) {
    if (!agentMap[aid]) agentMap[aid] = { tasks: 0, success: 0, fail: 0, durations: [], taskTypes: {}, wfSteps: 0 };
    return agentMap[aid];
  }

  // from tasks
  for (const task of tasks) {
    const taskType = detectTaskType(task.prompt || task.title || '');
    if (task.runs && Array.isArray(task.runs)) {
      for (const r of task.runs) {
        const s = ensure(r.agentId || 'unknown');
        s.tasks++;
        if (r.status === 'completed') s.success++;
        else if (r.status === 'failed' || r.status === 'error') s.fail++;
        if (r.duration) s.durations.push(r.duration);
        s.taskTypes[taskType] = (s.taskTypes[taskType] || 0) + 1;
      }
    }
  }

  // from workflow runs
  for (const run of runs) {
    for (const step of (run.steps || [])) {
      const s = ensure(step.agentId || 'unknown');
      s.wfSteps++;
      s.tasks++;
      if (step.status === 'completed') s.success++;
      else if (step.status === 'failed') s.fail++;
      if (step.duration) s.durations.push(step.duration);
    }
  }

  // build agent group lookup
  const agentGroupMap = {};
  for (const g of groups) {
    for (const aid of (g.agents || [])) {
      if (!agentGroupMap[aid]) agentGroupMap[aid] = [];
      agentGroupMap[aid].push(g.name);
    }
  }

  return Object.entries(agentMap).map(([agentId, s]) => {
    // find top task types
    const sortedTypes = Object.entries(s.taskTypes).sort((a, b) => b[1] - a[1]);
    const bestTaskTypes = sortedTypes.slice(0, 3).map(([t]) => t);

    return {
      agentId,
      totalTasks: s.tasks,
      successCount: s.success,
      failCount: s.fail,
      successRate: s.tasks > 0 ? Math.round(s.success / s.tasks * 100) : 0,
      avgDuration: s.durations.length > 0 ? Math.round(s.durations.reduce((a, b) => a + b, 0) / s.durations.length) : 0,
      workflowStepCount: s.wfSteps,
      bestTaskTypes,
      groups: agentGroupMap[agentId] || []
    };
  }).sort((a, b) => b.successRate - a.successRate || b.totalTasks - a.totalTasks);
}

// ── suggestWorkflowAgents ───────────────────────────────────────────
async function suggestWorkflowAgents(steps) {
  const globalPerf = await getGlobalAgentPerformance();

  return (steps || []).map((step, idx) => {
    const taskType = detectTaskType(step.prompt || '');
    const candidates = globalPerf
      .filter(a => a.totalTasks > 0)
      .map(a => {
        let score = a.successRate;
        if (a.bestTaskTypes.includes(taskType)) score += 20;
        // speed bonus (faster = higher score, max 10 pts)
        if (a.avgDuration > 0) score += Math.max(0, 10 - a.avgDuration / 60000);
        return { agentId: a.agentId, score, reason: buildSuggestionReason(a, taskType), confidence: Math.min(0.9, score / 130) };
      })
      .sort((a, b) => b.score - a.score);

    return {
      stepIndex: idx,
      taskType,
      suggestedAgents: candidates.slice(0, 5).map(c => ({
        agentId: c.agentId,
        reason: c.reason,
        confidence: Math.round(c.confidence * 100) / 100
      }))
    };
  });
}

function buildSuggestionReason(agent, taskType) {
  const parts = [];
  parts.push(`全局成功率 ${agent.successRate}%`);
  if (agent.bestTaskTypes.includes(taskType)) {
    parts.push(`擅长${taskType}类任务`);
  }
  if (agent.avgDuration > 0) {
    parts.push(`平均耗时 ${Math.round(agent.avgDuration / 1000)}s`);
  }
  parts.push(`共 ${agent.totalTasks} 次执行`);
  return parts.join('，');
}

module.exports = {
  analyzeWorkflowHistory,
  getAgentRecommendationsForWorkflow,
  getGlobalAgentPerformance,
  suggestWorkflowAgents
};
