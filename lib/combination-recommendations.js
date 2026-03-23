const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const RECOMMENDATIONS_CACHE_FILE = path.join(DATA_DIR, 'recommendations-cache.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'recommendation-feedback.json');

const RECOMMENDATION_TYPES = {
  FREQUENT_CO_OCCURRENCE: 'frequent_co_occurrence',
  LOAD_BALANCE: 'load_balance',
  HOT_COMBINATION_COMPLETION: 'hot_combination_completion',
  FAILURE_RATE_OPTIMIZATION: 'failure_rate_optimization',
  TASK_TYPE_OPTIMIZATION: 'task_type_optimization'
};

const RECOMMENDATION_REASONS = {
  [RECOMMENDATION_TYPES.FREQUENT_CO_OCCURRENCE]: '这些 Agent 经常一起使用，组合使用效率更高',
  [RECOMMATION_TYPES.LOAD_BALANCE]: '建议将负载分散到这些 Agent，避免单点过载',
  [RECOMMENDATION_TYPES.HOT_COMBINATION_COMPLETION]: '热门 Agent 组合，当前缺少部分 Agent',
  [RECOMMENDATION_TYPES.FAILURE_RATE_OPTIMIZATION]: '这些 Agent 成功率高但使用率低，建议优先使用',
  [RECOMMENDATION_TYPES.TASK_TYPE_OPTIMIZATION]: '此组合在特定任务类型中表现优异，推荐使用'
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

const TASK_TYPE_PATTERNS = {
  development: /code|develop|implement|build|feature|bug|fix|refactor|api|function|module|class|component/i,
  testing: /test|spec|unit|integration|e2e|specification|verify|validation|qa/i,
  documentation: /doc|document|readme|guide|manual|spec|comment|markdown|specification/i,
  deployment: /deploy|release|publish|push|install|setup|configure|provision/i,
  data_analysis: /data|analyze|analytics|metric|statistic|report|dashboard|visualization|insight/i,
  code_review: /review|review|inspect|audit|check|quality/i,
  debugging: /debug|trace|log|error|issue|problem|troubleshoot|fix/i,
  optimization: /optimize|perf|performance|efficient|speed|improve|refactor/i
};

function identifyTaskType(task) {
  const content = `${task.title || ''} ${task.description || ''} ${task.content || ''}`.toLowerCase();
  
  const typeScores = {};
  for (const [type, pattern] of Object.entries(TASK_TYPE_PATTERNS)) {
    const matches = (content.match(pattern) || []).length;
    typeScores[type] = matches;
  }
  
  const maxScore = Math.max(...Object.values(typeScores));
  if (maxScore === 0) return null;
  
  const matchedTypes = Object.entries(typeScores)
    .filter(([, score]) => score === maxScore)
    .map(([type]) => type);
  
  return matchedTypes[0];
}

function findTaskTypeBasedRecommendations(tasks, existingCombinations, agentNameMap) {
  const recommendations = [];
  
  const taskTypeAgentStats = new Map();
  const taskTypeAgentSuccess = new Map();
  
  for (const task of tasks) {
    const taskType = identifyTaskType(task);
    if (!taskType) continue;
    
    if (!taskTypeAgentStats.has(taskType)) {
      taskTypeAgentStats.set(taskType, new Map());
      taskTypeAgentSuccess.set(taskType, new Map());
    }
    
    const typeStats = taskTypeAgentStats.get(taskType);
    const typeSuccess = taskTypeAgentSuccess.get(taskType);
    
    const runs = task.runs || [];
    const taskAgents = [...new Set(runs.filter(r => r.agentId).map(r => r.agentId))];
    const taskSuccess = task.status === 'completed';
    
    for (const agentId of taskAgents) {
      typeStats.set(agentId, (typeStats.get(agentId) || 0) + 1);
      if (taskSuccess) {
        typeSuccess.set(agentId, (typeSuccess.get(agentId) || 0) + 1);
      }
    }
  }
  
  for (const [taskType, typeStats] of taskTypeAgentStats.entries()) {
    const typeSuccess = taskTypeAgentSuccess.get(taskType);
    const agentPerformance = [];
    
    for (const [agentId, count] of typeStats.entries()) {
      const successCount = typeSuccess.get(agentId) || 0;
      const successRate = count > 0 ? successCount / count : 0;
      
      if (count >= 2) {
        agentPerformance.push({
          agentId,
          agentName: agentNameMap.get(agentId) || agentId,
          taskCount: count,
          successCount,
          successRate
        });
      }
    }
    
    if (agentPerformance.length < 2) continue;
    
    agentPerformance.sort((a, b) => b.successRate - a.successRate);
    
    const topAgents = agentPerformance.slice(0, 3);
    const bestPair = [];
    
    for (let i = 0; i < topAgents.length && bestPair.length < 2; i++) {
      for (let j = i + 1; j < topAgents.length && bestPair.length < 2; j++) {
        const agent1 = topAgents[i];
        const agent2 = topAgents[j];
        
        const exists = existingCombinations.some(c =>
          c.agentIds.includes(agent1.agentId) && c.agentIds.includes(agent2.agentId)
        );
        
        if (!exists) {
          bestPair.push([agent1, agent2]);
        }
      }
    }
    
    if (bestPair.length === 0) continue;
    
    const [agent1, agent2] = bestPair[0];
    const combinedSuccessRate = (agent1.successRate + agent2.successRate) / 2;
    const successRatePercent = (combinedSuccessRate * 100).toFixed(0);
    
    const taskTypeNames = {
      development: '开发',
      testing: '测试',
      documentation: '文档',
      deployment: '部署',
      data_analysis: '数据分析',
      code_review: '代码审查',
      debugging: '调试',
      optimization: '优化'
    };
    
    const typeName = taskTypeNames[taskType] || taskType;
    
    recommendations.push({
      id: crypto.randomUUID(),
      type: RECOMMENDATION_TYPES.TASK_TYPE_OPTIMIZATION,
      agentIds: [agent1.agentId, agent2.agentId],
      agentNames: [agent1.agentName, agent2.agentName],
      reason: `此组合在${typeName}类任务中成功率达 ${successRatePercent}%`,
      confidence: Math.min(0.85, 0.5 + combinedSuccessRate * 0.3),
      taskTypeInfo: {
        taskType,
        taskTypeName: typeName,
        agent1Stats: { id: agent1.agentId, name: agent1.agentName, successRate: agent1.successRate, taskCount: agent1.taskCount },
        agent2Stats: { id: agent2.agentId, name: agent2.agentName, successRate: agent2.successRate, taskCount: agent2.taskCount },
        combinedSuccessRate
      },
      createdAt: Date.now()
    });
  }
  
  return recommendations.slice(0, 5);
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
    ...findFailureRateOptimizationRecommendations([...agentStats.values()], combinations),
    ...findTaskTypeBasedRecommendations(recentTasks, combinations, agentNameMap)
  ];
  
  recommendations.sort((a, b) => b.confidence - a.confidence);
  
  return recommendations.slice(0, 10);
}

async function getRecommendations(forceRefresh = false) {
  const cache = await loadCache();
  const cacheAge = Date.now() - (cache.generatedAt || 0);
  const cacheValid = cacheAge < 5 * 60 * 1000;
  
  let recommendations;
  let fromCache = false;
  
  if (!forceRefresh && cacheValid && cache.recommendations.length > 0) {
    recommendations = cache.recommendations;
    fromCache = true;
  } else {
    const tasks = await loadTasks();
    recommendations = await generateRecommendations(tasks, 14);
    
    await saveCache({
      recommendations,
      generatedAt: Date.now()
    });
  }
  
  // Apply feedback boost to adjust confidence scores
  const boostedRecommendations = await applyFeedbackBoost(recommendations);
  
  // Re-sort by boosted confidence
  boostedRecommendations.sort((a, b) => b.confidence - a.confidence);
  
  return {
    recommendations: boostedRecommendations,
    generatedAt: cache.generatedAt || Date.now(),
    fromCache,
    feedbackApplied: true
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

// ========== Feedback Learning Functions ==========

async function ensureFeedbackData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FEEDBACK_FILE);
  } catch {
    await fs.writeFile(FEEDBACK_FILE, JSON.stringify({
      feedbacks: [],
      applications: []
    }, null, 2) + '\n');
  }
}

async function loadFeedback() {
  await ensureFeedbackData();
  const data = await fs.readFile(FEEDBACK_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveFeedback(feedbackData) {
  await ensureFeedbackData();
  await fs.writeFile(FEEDBACK_FILE, JSON.stringify(feedbackData, null, 2) + '\n');
}

/**
 * Record user feedback on a recommendation
 * @param {string} recommendationId - Recommendation ID
 * @param {boolean} isHelpful - Whether the recommendation is helpful
 * @returns {Promise<object>} The recorded feedback
 */
async function recordFeedback(recommendationId, isHelpful) {
  const feedbackData = await loadFeedback();
  
  const feedback = {
    recommendationId,
    isHelpful,
    timestamp: Date.now()
  };
  
  feedbackData.feedbacks.push(feedback);
  
  await saveFeedback(feedbackData);
  
  return feedback;
}

/**
 * Record when a recommendation is applied
 * @param {string} recommendationId - Recommendation ID
 * @returns {Promise<void>}
 */
async function recordApplication(recommendationId) {
  const feedbackData = await loadFeedback();
  
  feedbackData.applications.push({
    recommendationId,
    timestamp: Date.now()
  });
  
  await saveFeedback(feedbackData);
}

/**
 * Get feedback statistics for a specific recommendation
 * @param {string} recommendationId - Recommendation ID
 * @returns {Promise<object>} Feedback stats for the recommendation
 */
async function getFeedbackStats(recommendationId) {
  const feedbackData = await loadFeedback();
  
  const feedbacks = feedbackData.feedbacks.filter(f => f.recommendationId === recommendationId);
  const applications = feedbackData.applications.filter(a => a.recommendationId === recommendationId);
  
  const helpfulCount = feedbacks.filter(f => f.isHelpful === true).length;
  const notHelpfulCount = feedbacks.filter(f => f.isHelpful === false).length;
  
  return {
    helpful: helpfulCount,
    notHelpful: notHelpfulCount,
    applied: applications.length,
    total: feedbacks.length
  };
}

/**
 * Get all feedback stats for all recommendations
 * @returns {Promise<object>} All feedback stats by recommendation ID
 */
async function getAllFeedbackStats() {
  const feedbackData = await loadFeedback();
  const stats = {};
  
  for (const feedback of feedbackData.feedbacks) {
    if (!stats[feedback.recommendationId]) {
      stats[feedback.recommendationId] = { helpful: 0, notHelpful: 0, applied: 0, total: 0 };
    }
    if (feedback.isHelpful) {
      stats[feedback.recommendationId].helpful++;
    } else {
      stats[feedback.recommendationId].notHelpful++;
    }
    stats[feedback.recommendationId].total++;
  }
  
  for (const application of feedbackData.applications) {
    if (!stats[application.recommendationId]) {
      stats[application.recommendationId] = { helpful: 0, notHelpful: 0, applied: 0, total: 0 };
    }
    stats[application.recommendationId].applied++;
  }
  
  return stats;
}

/**
 * Boost recommendations based on feedback
 * @param {Array} recommendations - Original recommendations
 * @returns {Array} Recommendations with adjusted confidence scores
 */
async function applyFeedbackBoost(recommendations) {
  const feedbackStats = await getAllFeedbackStats();
  
  return recommendations.map(rec => {
    const stats = feedbackStats[rec.id];
    if (!stats) return rec;
    
    let boostedRec = { ...rec };
    
    if (stats.helpful > 0) {
      boostedRec.confidence = Math.min(0.99, rec.confidence + (stats.helpful * 0.05));
      boostedRec.feedbackScore = stats.helpful - stats.notHelpful;
    }
    
    if (stats.notHelpful > 0) {
      boostedRec.confidence = Math.max(0.1, rec.confidence - (stats.notHelpful * 0.1));
    }
    
    if (stats.applied >= 3) {
      boostedRec.proven = true;
      boostedRec.confidence = Math.min(0.99, boostedRec.confidence + 0.1);
    }
    
    return boostedRec;
  });
}

module.exports = {
  getRecommendations,
  dismissRecommendation,
  getDismissedRecommendations,
  getRecommendationTypes,
  generateRecommendations,
  recordFeedback,
  recordApplication,
  getFeedbackStats,
  getAllFeedbackStats,
  applyFeedbackBoost,
  RECOMMENDATION_TYPES,
  RECOMMENDATION_REASONS
};
