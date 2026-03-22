const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const RECOMMENDATIONS_CACHE_FILE = path.join(DATA_DIR, 'recommendations-cache.json');

const RECOMMENDATION_TYPES = {
  FREQUENT_CO_OCCURRENCE: 'frequent_co_occurrence',
  LOAD_BALANCE: 'load_balance',
  HOT_COMBINATION_COMPLETION: 'hot_combination_completion',
  FAILURE_RATE_OPTIMIZATION: 'failure_rate_optimization'
};

const RECOMMENDATION_REASONS = {
  [RECOMMENDATION_TYPES.FREQUENT_CO_OCCURRENCE]: '这些 Agent 经常一起使用，组合使用效率更高',
  [RECOMMENDATION_TYPES.LOAD_BALANCE]: '建议将负载分散到这些 Agent，避免单点过载',
  [RECOMMENDATION_TYPES.HOT_COMBINATION_COMPLETION]: '热门 Agent 组合，当前缺少部分 Agent',
  [RECOMMENDATION_TYPES.FAILURE_RATE_OPTIMIZATION]: '这些 Agent 成功率高但使用率低，建议优先使用'
};

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(RECOMMENDATIONS_CACHE_FILE);
  } catch {
    await fs.writeFile(RECOMMENDATIONS_CACHE_FILE, JSON.stringify({
      recommendations: [],
      generatedAt: null
    }, null, 2) + '\n');
  }
}

async function loadCache() {
  await ensureData();
  const data = await fs.readFile(RECOMMENDATIONS_CACHE_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveCache(cache) {
  await ensureData();
  await fs.writeFile(RECOMMENDATIONS_CACHE_FILE, JSON.stringify(cache, null, 2) + '\n');
}

async function loadTasks() {
  const tasksFile = path.join(DATA_DIR, 'tasks.json');
  try {
    const data = await fs.readFile(tasksFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function loadAgentCombinations() {
  const combinationsFile = path.join(DATA_DIR, 'agent-combinations.json');
  try {
    const data = await fs.readFile(combinationsFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function loadUsageHistory() {
  const usageFile = path.join(DATA_DIR, 'agent-combinations-usage.json');
  try {
    const data = await fs.readFile(usageFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function buildCoOccurrenceMatrix(tasks) {
  const coOccurrence = new Map();
  
  for (const task of tasks) {
    const runs = task.runs || [];
    const agentIds = runs.filter(r => r.agentId).map(r => r.agentId);
    const uniqueAgents = [...new Set(agentIds)];
    
    if (uniqueAgents.length < 2) continue;
    
    for (let i = 0; i < uniqueAgents.length; i++) {
      for (let j = i + 1; j < uniqueAgents.length; j++) {
        const pair = [uniqueAgents[i], uniqueAgents[j]].sort().join('|');
        coOccurrence.set(pair, (coOccurrence.get(pair) || 0) + 1);
      }
    }
  }
  
  return coOccurrence;
}

function findFrequentCoOccurrenceRecommendations(coOccurrence, existingCombinations, agentNameMap) {
  const recommendations = [];
  const existingPairs = new Set();
  
  for (const combo of existingCombinations) {
    const agents = [...combo.agentIds].sort();
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        existingPairs.add([agents[i], agents[j]].sort().join('|'));
      }
    }
  }
  
  const sortedPairs = Array.from(coOccurrence.entries())
    .filter(([pair]) => !existingPairs.has(pair))
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  for (const [pair, count] of sortedPairs) {
    const [agent1, agent2] = pair.split('|');
    const name1 = agentNameMap.get(agent1) || agent1;
    const name2 = agentNameMap.get(agent2) || agent2;
    
    recommendations.push({
      id: crypto.randomUUID(),
      type: RECOMMENDATION_TYPES.FREQUENT_CO_OCCURRENCE,
      agentIds: [agent1, agent2],
      agentNames: [name1, name2],
      reason: RECOMMENDATION_REASONS[RECOMMENDATION_TYPES.FREQUENT_CO_OCCURRENCE],
      confidence: Math.min(0.9, 0.5 + count * 0.1),
      coOccurrenceCount: count,
      createdAt: Date.now()
    });
  }
  
  return recommendations;
}

function findLoadBalanceRecommendations(agentStats, existingCombinations) {
  const recommendations = [];
  
  if (agentStats.length < 2) return recommendations;
  
  const totalTasks = agentStats.reduce((sum, s) => sum + s.taskCount, 0);
  const avgTasks = totalTasks / agentStats.length;
  
  const highLoadAgents = agentStats.filter(s => s.taskCount > avgTasks * 1.5);
  const lowLoadAgents = agentStats.filter(s => s.taskCount < avgTasks * 0.5 && s.successRate > 0.7);
  
  if (highLoadAgents.length > 0 && lowLoadAgents.length > 0) {
    const highLoad = highLoadAgents[0];
    const lowLoad = lowLoadAgents[0];
    
    const existingPair = existingCombinations.some(c => 
      c.agentIds.includes(highLoad.agentId) && c.agentIds.includes(lowLoad.agentId)
    );
    
    if (!existingPair) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: RECOMMENDATION_TYPES.LOAD_BALANCE,
        agentIds: [highLoad.agentId, lowLoad.agentId],
        agentNames: [highLoad.agentName, lowLoad.agentName],
        reason: `${highLoad.agentName} 负载较高（${highLoad.taskCount} 任务），建议与 ${lowLoad.agentName}（${lowLoad.taskCount} 任务）组合使用分散负载`,
        confidence: 0.7,
        loadInfo: {
          highLoadAgent: { id: highLoad.agentId, name: highLoad.agentName, tasks: highLoad.taskCount },
          lowLoadAgent: { id: lowLoad.agentId, name: lowLoad.agentName, tasks: lowLoad.taskCount }
        },
        createdAt: Date.now()
      });
    }
  }
  
  return recommendations.slice(0, 3);
}

function findHotCombinationCompletionRecommendations(usageHistory, agentCombinations, agentNameMap) {
  const recommendations = [];
  
  const comboUsage = [];
  for (const combo of agentCombinations) {
    const history = usageHistory[combo.id];
    const recentUsage = history?.records?.length || 0;
    if (recentUsage > 0) {
      comboUsage.push({ combo, recentUsage });
    }
  }
  
  comboUsage.sort((a, b) => b.recentUsage - a.recentUsage);
  
  const topCombos = comboUsage.slice(0, 3).map(c => c.combo);
  
  for (const combo of topCombos) {
    if (combo.agentIds.length < 3) continue;
    
    const otherAgents = combo.agentIds.slice(0, -1);
    
    for (const combo2 of agentCombinations) {
      if (combo2.id === combo.id) continue;
      
      const newAgents = combo2.agentIds.filter(id => !combo.agentIds.includes(id));
      if (newAgents.length === 1 && otherAgents.length >= 1) {
        const existing = agentCombinations.some(c =>
          c.agentIds.includes(otherAgents[0]) && c.agentIds.includes(newAgents[0])
        );
        
        if (!existing) {
          recommendations.push({
            id: crypto.randomUUID(),
            type: RECOMMENDATION_TYPES.HOT_COMBINATION_COMPLETION,
            agentIds: [...otherAgents, newAgents[0]],
            agentNames: [agentNameMap.get(otherAgents[0]) || otherAgents[0], agentNameMap.get(newAgents[0]) || newAgents[0]],
            reason: `${combo.name} 组合热门，建议添加 ${agentNameMap.get(newAgents[0]) || newAgents[0]} 组成更完整的团队`,
            confidence: 0.65,
            basedOn: { combinationId: combo.id, combinationName: combo.name },
            createdAt: Date.now()
          });
        }
      }
    }
  }
  
  return recommendations.slice(0, 2);
}

function findFailureRateOptimizationRecommendations(agentStats, existingCombinations) {
  const recommendations = [];
  
  const sortedBySuccessRate = [...agentStats]
    .filter(s => s.taskCount >= 3)
    .sort((a, b) => b.successRate - a.successRate);
  
  const topPerformers = sortedBySuccessRate.slice(0, 3);
  const underutilized = agentStats.filter(s => 
    s.taskCount < 5 && 
    s.successRate > 0.7 &&
    !topPerformers.includes(s)
  );
  
  if (topPerformers.length > 0 && underutilized.length > 0) {
    for (const performer of topPerformers.slice(0, 2)) {
      for (const unused of underutilized.slice(0, 2)) {
        if (performer.agentId === unused.agentId) continue;
        
        const exists = existingCombinations.some(c =>
          c.agentIds.includes(performer.agentId) && c.agentIds.includes(unused.agentId)
        );
        
        if (!exists) {
          recommendations.push({
            id: crypto.randomUUID(),
            type: RECOMMENDATION_TYPES.FAILURE_RATE_OPTIMIZATION,
            agentIds: [performer.agentId, unused.agentId],
            agentNames: [performer.agentName, unused.agentName],
            reason: `${unused.agentName} 成功率高（${unused.successRateText}）但使用率低，建议与 ${performer.agentName} 组合使用提升整体效率`,
            confidence: 0.6,
            performanceInfo: {
              performer: { id: performer.agentId, name: performer.agentName, successRate: performer.successRate },
              underutilized: { id: unused.agentId, name: unused.agentName, successRate: unused.successRate }
            },
            createdAt: Date.now()
          });
        }
      }
    }
  }
  
  return recommendations.slice(0, 3);
}

async function generateRecommendations(tasks, days = 14) {
  const combinations = await loadAgentCombinations();
  const usageHistory = await loadUsageHistory();
  
  const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;
  const recentTasks = tasks.filter(t => t.createdAt >= cutoffDate);
  
  const agentNameMap = new Map();
  const agentStats = new Map();
  
  for (const task of recentTasks) {
    for (const run of task.runs || []) {
      if (!run.agentId) continue;
      
      if (!agentNameMap.has(run.agentId)) {
        agentNameMap.set(run.agentId, run.agentId);
      }
      
      if (!agentStats.has(run.agentId)) {
        agentStats.set(run.agentId, {
          agentId: run.agentId,
          agentName: agentNameMap.get(run.agentId),
          taskCount: 0,
          successCount: 0,
          failCount: 0,
          successRate: 0
        });
      }
      
      const stats = agentStats.get(run.agentId);
      stats.taskCount++;
      if (run.status === 'completed') stats.successCount++;
      else if (run.status === 'failed' || run.status === 'error') stats.failCount++;
    }
  }
  
  for (const stats of agentStats.values()) {
    stats.successRate = stats.taskCount > 0 ? stats.successCount / stats.taskCount : 0;
    stats.successRateText = `${(stats.successRate * 100).toFixed(1)}%`;
  }
  
  const coOccurrence = buildCoOccurrenceMatrix(recentTasks);
  
  const recommendations = [
    ...findFrequentCoOccurrenceRecommendations(coOccurrence, combinations, agentNameMap),
    ...findLoadBalanceRecommendations([...agentStats.values()], combinations),
    ...findHotCombinationCompletionRecommendations(usageHistory, combinations, agentNameMap),
    ...findFailureRateOptimizationRecommendations([...agentStats.values()], combinations)
  ];
  
  recommendations.sort((a, b) => b.confidence - a.confidence);
  
  return recommendations.slice(0, 10);
}

async function getRecommendations(forceRefresh = false) {
  const cache = await loadCache();
  const cacheAge = Date.now() - (cache.generatedAt || 0);
  const cacheValid = cacheAge < 5 * 60 * 1000;
  
  if (!forceRefresh && cacheValid && cache.recommendations.length > 0) {
    return {
      recommendations: cache.recommendations,
      generatedAt: cache.generatedAt,
      fromCache: true
    };
  }
  
  const tasks = await loadTasks();
  const recommendations = await generateRecommendations(tasks, 14);
  
  await saveCache({
    recommendations,
    generatedAt: Date.now()
  });
  
  return {
    recommendations,
    generatedAt: Date.now(),
    fromCache: false
  };
}

async function dismissRecommendation(recommendationId) {
  const cache = await loadCache();
  const index = cache.recommendations.findIndex(r => r.id === recommendationId);
  
  if (index === -1) {
    return null;
  }
  
  const dismissed = cache.recommendations.splice(index, 1)[0];
  dismissed.dismissedAt = Date.now();
  
  if (!cache.dismissed) {
    cache.dismissed = [];
  }
  cache.dismissed.push(dismissed);
  
  await saveCache(cache);
  
  return dismissed;
}

async function getDismissedRecommendations() {
  const cache = await loadCache();
  return cache.dismissed || [];
}

function getRecommendationTypes() {
  return Object.entries(RECOMMENDATION_TYPES).map(([key, value]) => ({
    key,
    value,
    reason: RECOMMENDATION_REASONS[value]
  }));
}

module.exports = {
  getRecommendations,
  dismissRecommendation,
  getDismissedRecommendations,
  getRecommendationTypes,
  generateRecommendations,
  RECOMMENDATION_TYPES,
  RECOMMENDATION_REASONS
};
