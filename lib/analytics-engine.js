const crypto = require('crypto');

class AnalyticsEngine {
  constructor() {
    this.taskHistory = [];
    this.agentMetrics = new Map();
    this.workflowMetrics = new Map();
    this.anomalyThreshold = 2.0;
  }

  analyzeTasks(tasks, options = {}) {
    const { days = 30 } = options;
    const now = Date.now();
    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    
    const filteredTasks = tasks.filter(t => t.createdAt && t.createdAt >= cutoff);
    
    const completedTasks = filteredTasks.filter(t => t.status === 'completed');
    const failedTasks = filteredTasks.filter(t => t.status === 'failed');
    const runningTasks = filteredTasks.filter(t => t.status === 'running');
    const queuedTasks = filteredTasks.filter(t => t.status === 'queued');
    
    const completionRate = filteredTasks.length > 0 
      ? (completedTasks.length / filteredTasks.length) * 100 
      : 0;
    const failureRate = filteredTasks.length > 0 
      ? (failedTasks.length / filteredTasks.length) * 100 
      : 0;
    
    const durations = completedTasks
      .filter(t => t.startedAt && t.finishedAt)
      .map(t => t.finishedAt - t.startedAt);
    
    const avgDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;
    
    const dailyStats = this.calculateDailyStats(filteredTasks);
    
    const trendAnalysis = this.analyzeTrend(dailyStats);
    
    return {
      summary: {
        total: filteredTasks.length,
        completed: completedTasks.length,
        failed: failedTasks.length,
        running: runningTasks.length,
        queued: queuedTasks.length,
        completionRate: Math.round(completionRate * 100) / 100,
        failureRate: Math.round(failureRate * 100) / 100,
        avgDurationMs: Math.round(avgDuration),
        avgDurationLabel: this.formatDuration(avgDuration)
      },
      dailyStats,
      trendAnalysis,
      statusDistribution: {
        completed: completedTasks.length,
        failed: failedTasks.length,
        running: runningTasks.length,
        queued: queuedTasks.length
      }
    };
  }

  calculateDailyStats(tasks) {
    const dailyMap = new Map();
    
    tasks.forEach(task => {
      if (!task.createdAt) return;
      const date = new Date(task.createdAt).toISOString().split('T')[0];
      
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { date, total: 0, completed: 0, failed: 0, running: 0, queued: 0, avgDuration: 0, durations: [] });
      }
      
      const day = dailyMap.get(date);
      day.total++;
      
      if (task.status === 'completed') {
        day.completed++;
        if (task.startedAt && task.finishedAt) {
          day.durations.push(task.finishedAt - task.startedAt);
        }
      } else if (task.status === 'failed') {
        day.failed++;
      } else if (task.status === 'running') {
        day.running++;
      } else if (task.status === 'queued') {
        day.queued++;
      }
    });
    
    const dailyStats = Array.from(dailyMap.values()).map(day => {
      const avgDuration = day.durations.length > 0 
        ? day.durations.reduce((a, b) => a + b, 0) / day.durations.length 
        : 0;
      return {
        date: day.date,
        total: day.total,
        completed: day.completed,
        failed: day.failed,
        running: day.running,
        queued: day.queued,
        completionRate: day.total > 0 ? Math.round((day.completed / day.total) * 10000) / 100 : 0,
        failureRate: day.total > 0 ? Math.round((day.failed / day.total) * 10000) / 100 : 0,
        avgDurationMs: Math.round(avgDuration),
        avgDurationLabel: this.formatDuration(avgDuration)
      };
    });
    
    return dailyStats.sort((a, b) => a.date.localeCompare(b.date));
  }

  analyzeTrend(dailyStats) {
    if (dailyStats.length < 2) {
      return { direction: 'stable', changeRate: 0, prediction: [] };
    }
    
    const recent = dailyStats.slice(-7);
    const previous = dailyStats.slice(-14, -7);
    
    if (recent.length === 0 || previous.length === 0) {
      return { direction: 'stable', changeRate: 0, prediction: [] };
    }
    
    const recentAvg = recent.reduce((a, b) => a + b.completionRate, 0) / recent.length;
    const previousAvg = previous.reduce((a, b) => a + b.completionRate, 0) / previous.length;
    
    const changeRate = previousAvg > 0 
      ? ((recentAvg - previousAvg) / previousAvg) * 100 
      : 0;
    
    let direction = 'stable';
    if (changeRate > 10) direction = 'improving';
    else if (changeRate < -10) direction = 'declining';
    
    const prediction = this.predictNextDays(recent, 7);
    
    return {
      direction,
      changeRate: Math.round(changeRate * 100) / 100,
      recentAvgCompletionRate: Math.round(recentAvg * 100) / 100,
      previousAvgCompletionRate: Math.round(previousAvg * 100) / 100,
      prediction
    };
  }

  predictNextDays(recentStats, days) {
    if (recentStats.length < 3) {
      return Array(days).fill({ predictedCompletionRate: 0, confidence: 'low' });
    }
    
    const values = recentStats.map(s => s.completionRate);
    const n = values.length;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    
    const slope = n > 0 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0 : 0;
    const intercept = n > 0 ? (sumY - slope * sumX) / n : 0;
    
    const predictions = [];
    for (let i = 1; i <= days; i++) {
      const predictedValue = Math.max(0, Math.min(100, intercept + slope * (n + i)));
      const confidence = this.calculateConfidence(n, Math.abs(slope));
      predictions.push({
        day: i,
        predictedCompletionRate: Math.round(predictedValue * 100) / 100,
        confidence
      });
    }
    
    return predictions;
  }

  calculateConfidence(dataPoints, slope) {
    if (dataPoints < 3) return 'low';
    if (dataPoints < 7) return slope > 5 ? 'medium' : 'low';
    return slope > 3 ? 'high' : 'medium';
  }

  analyzeAgents(tasks, overviewAgents) {
    const agentMap = new Map();
    
    tasks.forEach(task => {
      if (!task.agents || !Array.isArray(task.agents)) return;
      
      task.agents.forEach(agentId => {
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, {
            agentId,
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            totalDuration: 0,
            durations: []
          });
        }
        
        const agent = agentMap.get(agentId);
        agent.totalTasks++;
        
        const run = task.runs?.find(r => r.agentId === agentId);
        if (run) {
          if (run.status === 'completed') {
            agent.completedTasks++;
            if (run.startedAt && run.finishedAt) {
              const duration = run.finishedAt - run.startedAt;
              agent.totalDuration += duration;
              agent.durations.push(duration);
            }
          } else if (run.status === 'failed') {
            agent.failedTasks++;
          }
        }
      });
    });
    
    const agentStats = Array.from(agentMap.values()).map(agent => ({
      agentId: agent.agentId,
      totalTasks: agent.totalTasks,
      completedTasks: agent.completedTasks,
      failedTasks: agent.failedTasks,
      successRate: agent.totalTasks > 0 
        ? Math.round((agent.completedTasks / agent.totalTasks) * 10000) / 100 
        : 0,
      failureRate: agent.totalTasks > 0 
        ? Math.round((agent.failedTasks / agent.totalTasks) * 10000) / 100 
        : 0,
      avgDurationMs: agent.durations.length > 0 
        ? Math.round(agent.totalDuration / agent.durations.length) 
        : 0,
      avgDurationLabel: agent.durations.length > 0 
        ? this.formatDuration(agent.totalDuration / agent.durations.length) 
        : 'N/A'
    }));
    
    agentStats.sort((a, b) => b.totalTasks - a.totalTasks);
    
    const workloadDistribution = this.calculateWorkloadDistribution(agentStats, overviewAgents);
    
    const responseTimeAnalysis = this.analyzeResponseTime(agentStats);
    
    return {
      agentStats,
      workloadDistribution,
      responseTimeAnalysis,
      summary: {
        totalAgents: agentStats.length,
        mostActiveAgent: agentStats[0]?.agentId || 'N/A',
        mostEfficientAgent: this.findMostEfficient(agentStats),
        averageSuccessRate: agentStats.length > 0 
          ? Math.round(agentStats.reduce((a, b) => a + b.successRate, 0) / agentStats.length * 100) / 100 
          : 0
      }
    };
  }

  calculateWorkloadDistribution(agentStats, overviewAgents) {
    const totalTasks = agentStats.reduce((a, b) => a + b.totalTasks, 0);
    
    if (totalTasks === 0) return [];
    
    const knownAgentIds = new Set(overviewAgents?.map(a => a.id) || []);
    
    return agentStats.map(agent => ({
      agentId: agent.agentId,
      taskCount: agent.totalTasks,
      percentage: Math.round((agent.totalTasks / totalTasks) * 10000) / 100,
      status: knownAgentIds.has(agent.agentId) 
        ? (overviewAgents.find(a => a.id === agent.agentId)?.status || 'unknown') 
        : 'unknown'
    })).sort((a, b) => b.taskCount - a.taskCount);
  }

  analyzeResponseTime(agentStats) {
    const withDuration = agentStats.filter(a => a.avgDurationMs > 0);
    
    if (withDuration.length === 0) {
      return { fastest: null, slowest: null, average: 0 };
    }
    
    withDuration.sort((a, b) => a.avgDurationMs - b.avgDurationMs);
    
    const avgResponseTime = withDuration.reduce((a, b) => a + b.avgDurationMs, 0) / withDuration.length;
    
    return {
      fastest: {
        agentId: withDuration[0].agentId,
        avgDurationMs: withDuration[0].avgDurationMs,
        avgDurationLabel: withDuration[0].avgDurationLabel
      },
      slowest: {
        agentId: withDuration[withDuration.length - 1].agentId,
        avgDurationMs: withDuration[withDuration.length - 1].avgDurationMs,
        avgDurationLabel: withDuration[withDuration.length - 1].avgDurationLabel
      },
      average: Math.round(avgResponseTime),
      averageLabel: this.formatDuration(avgResponseTime)
    };
  }

  findMostEfficient(agentStats) {
    const withTasks = agentStats.filter(a => a.totalTasks >= 3);
    if (withTasks.length === 0) return agentStats[0]?.agentId || 'N/A';
    
    withTasks.sort((a, b) => b.successRate - a.successRate);
    return withTasks[0].agentId;
  }

  analyzeWorkflows(workflows, workflowRuns) {
    const workflowStats = new Map();
    
    workflows.forEach(workflow => {
      const runs = workflowRuns?.filter(r => r.workflowId === workflow.id) || [];
      
      const completedRuns = runs.filter(r => r.status === 'completed');
      const failedRuns = runs.filter(r => r.status === 'failed');
      
      const durations = completedRuns
        .filter(r => r.startedAt && r.finishedAt)
        .map(r => r.finishedAt - r.startedAt);
      
      const avgDuration = durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0;
      
      const stepStats = this.analyzeWorkflowSteps(workflow, runs);
      
      workflowStats.set(workflow.id, {
        workflowId: workflow.id,
        name: workflow.name,
        description: workflow.description,
        stepCount: workflow.steps?.length || 0,
        totalRuns: runs.length,
        completedRuns: completedRuns.length,
        failedRuns: failedRuns.length,
        successRate: runs.length > 0 
          ? Math.round((completedRuns.length / runs.length) * 10000) / 100 
          : 0,
        avgDurationMs: Math.round(avgDuration),
        avgDurationLabel: this.formatDuration(avgDuration),
        stepStats,
        bottleneck: this.findBottleneck(stepStats)
      });
    });
    
    const sortedStats = Array.from(workflowStats.values())
      .sort((a, b) => b.totalRuns - a.totalRuns);
    
    return {
      workflowStats: sortedStats,
      summary: {
        totalWorkflows: sortedStats.length,
        mostUsedWorkflow: sortedStats[0]?.name || 'N/A',
        mostEfficientWorkflow: this.findMostEfficientWorkflow(sortedStats),
        averageSuccessRate: sortedStats.length > 0 
          ? Math.round(sortedStats.reduce((a, b) => a + b.successRate, 0) / sortedStats.length * 100) / 100 
          : 0
      }
    };
  }

  analyzeWorkflowSteps(workflow, runs) {
    if (!workflow.steps || workflow.steps.length === 0) return [];
    
    return workflow.steps.map((step, index) => {
      const stepRuns = runs.filter(r => r.stepResults?.[step.id]);
      
      const completedStepRuns = stepRuns.filter(r => r.stepResults?.[step.id]?.status === 'completed');
      const failedStepRuns = stepRuns.filter(r => r.stepResults?.[step.id]?.status === 'failed');
      
      const durations = completedStepRuns
        .map(r => r.stepResults?.[step.id]?.duration || 0)
        .filter(d => d > 0);
      
      const avgDuration = durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0;
      
      return {
        stepId: step.id,
        stepIndex: index,
        agentId: step.agentId,
        totalExecutions: stepRuns.length,
        completed: completedStepRuns.length,
        failed: failedStepRuns.length,
        successRate: stepRuns.length > 0 
          ? Math.round((completedStepRuns.length / stepRuns.length) * 10000) / 100 
          : 0,
        avgDurationMs: Math.round(avgDuration),
        avgDurationLabel: this.formatDuration(avgDuration)
      };
    });
  }

  findBottleneck(stepStats) {
    if (stepStats.length === 0) return null;
    
    const withFailures = stepStats.filter(s => s.totalExecutions > 0);
    if (withFailures.length === 0) return null;
    
    withFailures.sort((a, b) => {
      const aScore = (a.failed / a.totalExecutions) * 100 + (a.avgDurationMs > 60000 ? 20 : 0);
      const bScore = (b.failed / b.totalExecutions) * 100 + (b.avgDurationMs > 60000 ? 20 : 0);
      return bScore - aScore;
    });
    
    const bottleneck = withFailures[0];
    if ((bottleneck.failed / bottleneck.totalExecutions) < 0.1 && bottleneck.avgDurationMs < 60000) {
      return null;
    }
    
    return {
      stepId: bottleneck.stepId,
      agentId: bottleneck.agentId,
      failureRate: Math.round((bottleneck.failed / bottleneck.totalExecutions) * 10000) / 100,
      avgDurationMs: bottleneck.avgDurationMs,
      avgDurationLabel: bottleneck.avgDurationLabel,
      reason: bottleneck.failed > 0 ? 'high_failure_rate' : 'slow_execution'
    };
  }

  findMostEfficientWorkflow(workflowStats) {
    const withRuns = workflowStats.filter(w => w.totalRuns >= 3);
    if (withRuns.length === 0) return workflowStats[0]?.name || 'N/A';
    
    withRuns.sort((a, b) => b.successRate - a.successRate);
    return withRuns[0].name;
  }

  detectAnomalies(tasks, options = {}) {
    const { sensitivity = 2.0 } = options;
    const anomalies = [];
    
    const dailyStats = this.calculateDailyStats(tasks);
    if (dailyStats.length < 7) {
      return { anomalies: [], message: '数据不足，无法进行异常检测' };
    }
    
    const recentWeek = dailyStats.slice(-7);
    const previousData = dailyStats.slice(-14, -7);
    
    if (previousData.length < 3) {
      return { anomalies: [], message: '历史数据不足，无法进行异常检测' };
    }
    
    const totalRates = previousData.map(d => d.total);
    const completedRates = previousData.map(d => d.completed);
    const failedRates = previousData.map(d => d.failed);
    
    const totalMean = this.mean(totalRates);
    const completedMean = this.mean(completedRates);
    const failedMean = this.mean(failedRates);
    
    const totalStdDev = this.stdDev(totalRates, totalMean);
    const completedStdDev = this.stdDev(completedRates, completedMean);
    const failedStdDev = this.stdDev(failedRates, failedMean);
    
    recentWeek.forEach(day => {
      if (Math.abs(day.total - totalMean) > sensitivity * totalStdDev && totalStdDev > 0) {
        anomalies.push({
          type: 'task_volume',
          severity: Math.abs(day.total - totalMean) > sensitivity * 2 * totalStdDev ? 'high' : 'medium',
          date: day.date,
          description: `任务量异常: 当日 ${day.total} 个任务，与历史均值 ${totalMean.toFixed(1)} 偏差 ${((day.total - totalMean) / totalMean * 100).toFixed(1)}%`,
          deviation: Math.round((day.total - totalMean) / totalMean * 100),
          threshold: sensitivity
        });
      }
      
      if (failedMean > 0 && Math.abs(day.failed - failedMean) > sensitivity * failedStdDev && failedStdDev > 0) {
        anomalies.push({
          type: 'failure_rate',
          severity: day.failureRate > 50 ? 'high' : (day.failureRate > 30 ? 'medium' : 'low'),
          date: day.date,
          description: `失败率异常: 当日失败率 ${day.failureRate}%，历史均值 ${(failedMean / (completedMean + failedMean) * 100 || 0).toFixed(1)}%`,
          deviation: Math.round(day.failureRate - (failedMean / (completedMean + failedMean) * 100 || 0)),
          threshold: sensitivity
        });
      }
      
      if (day.completed === 0 && day.total > 0) {
        anomalies.push({
          type: 'zero_completion',
          severity: 'high',
          date: day.date,
          description: `零完成日: 当日 ${day.total} 个任务无任何完成`,
          deviation: -100,
          threshold: sensitivity
        });
      }
    });
    
    const agentAnomalies = this.detectAgentAnomalies(tasks, sensitivity);
    anomalies.push(...agentAnomalies);
    
    return {
      anomalies,
      summary: {
        totalAnomalies: anomalies.length,
        highSeverity: anomalies.filter(a => a.severity === 'high').length,
        mediumSeverity: anomalies.filter(a => a.severity === 'medium').length,
        lowSeverity: anomalies.filter(a => a.severity === 'low').length,
        types: [...new Set(anomalies.map(a => a.type))]
      },
      baseline: {
        avgTasksPerDay: Math.round(totalMean * 100) / 100,
        avgCompletionRate: Math.round((completedMean / (totalMean || 1)) * 10000) / 100,
        avgFailureRate: Math.round((failedMean / (totalMean || 1)) * 10000) / 100,
        stdDevTasks: Math.round(totalStdDev * 100) / 100
      }
    };
  }

  detectAgentAnomalies(tasks, sensitivity) {
    const anomalies = [];
    const agentMap = new Map();
    
    tasks.forEach(task => {
      if (!task.agents || !Array.isArray(task.agents)) return;
      
      task.agents.forEach(agentId => {
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, { total: 0, failed: 0, durations: [] });
        }
        
        const agent = agentMap.get(agentId);
        agent.total++;
        
        const run = task.runs?.find(r => r.agentId === agentId);
        if (run?.status === 'failed') {
          agent.failed++;
        }
        if (run?.startedAt && run?.finishedAt) {
          agent.durations.push(run.finishedAt - run.startedAt);
        }
      });
    });
    
    const agentStats = Array.from(agentMap.values());
    if (agentStats.length < 3) return anomalies;
    
    const failureRates = agentStats.map(a => a.total > 0 ? a.failed / a.total : 0);
    const failureRateMean = this.mean(failureRates);
    const failureRateStdDev = this.stdDev(failureRates, failureRateMean);
    
    if (failureRateStdDev > 0) {
      agentStats.forEach(agent => {
        const rate = agent.total > 0 ? agent.failed / agent.total : 0;
        if (rate > failureRateMean + sensitivity * failureRateStdDev && agent.total >= 5) {
          anomalies.push({
            type: 'agent_failure_rate',
            severity: rate > 0.5 ? 'high' : 'medium',
            agentId: Array.from(agentMap.entries()).find(([, v]) => v === agent)?.[0],
            description: `Agent 失败率异常: 失败率 ${(rate * 100).toFixed(1)}%，高于均值 ${(failureRateMean * 100).toFixed(1)}%`,
            deviation: Math.round((rate - failureRateMean) * 10000) / 100,
            threshold: sensitivity
          });
        }
      });
    }
    
    return anomalies;
  }

  generateInsights(tasks, agents, workflows) {
    const insights = [];
    
    const taskAnalysis = this.analyzeTasks(tasks);
    if (taskAnalysis.trendAnalysis.direction === 'declining') {
      insights.push({
        category: 'performance',
        priority: 'high',
        title: '任务完成率下降',
        description: `过去7天平均完成率为 ${taskAnalysis.trendAnalysis.recentAvgCompletionRate}%，较前7天下降 ${Math.abs(taskAnalysis.trendAnalysis.changeRate)}%。建议检查失败任务原因。`,
        metric: 'completionRate',
        value: taskAnalysis.trendAnalysis.recentAvgCompletionRate,
        recommendation: 'review_failures'
      });
    }
    
    if (taskAnalysis.trendAnalysis.direction === 'improving') {
      insights.push({
        category: 'performance',
        priority: 'low',
        title: '任务完成率提升',
        description: `完成率较上周提升 ${taskAnalysis.trendAnalysis.changeRate}%，继续保持当前工作模式。`,
        metric: 'completionRate',
        value: taskAnalysis.trendAnalysis.recentAvgCompletionRate,
        recommendation: 'maintain'
      });
    }
    
    const agentAnalysis = this.analyzeAgents(tasks, agents);
    const underutilizedAgents = agentAnalysis.agentStats.filter(a => 
      a.totalTasks > 0 && a.successRate > 80 && 
      agentAnalysis.workloadDistribution.find(w => w.agentId === a.agentId)?.percentage < 10
    );
    
    if (underutilizedAgents.length > 0) {
      insights.push({
        category: 'resource',
        priority: 'medium',
        title: '存在未充分利用的 Agent',
        description: `${underutilizedAgents.map(a => a.agentId).join(', ')} 等 Agent 成功率较高但任务分配较少，建议增加使用。`,
        metric: 'agentUtilization',
        agents: underutilizedAgents.map(a => a.agentId),
        recommendation: 'increase_workload'
      });
    }
    
    const overloadedAgents = agentAnalysis.workloadDistribution.filter(w => w.percentage > 40);
    if (overloadedAgents.length > 0) {
      insights.push({
        category: 'resource',
        priority: 'medium',
        title: 'Agent 负载不均衡',
        description: `${overloadedAgents.map(a => a.agentId).join(', ')} 承担了超过 40% 的任务，建议将部分任务分配给其他 Agent。`,
        metric: 'workloadBalance',
        agents: overloadedAgents.map(a => a.agentId),
        recommendation: 'redistribute_tasks'
      });
    }
    
    if (taskAnalysis.summary.avgDurationMs > 300000) {
      insights.push({
        category: 'efficiency',
        priority: 'medium',
        title: '任务平均耗时较长',
        description: `当前平均任务耗时 ${taskAnalysis.summary.avgDurationLabel}，建议优化任务设计或升级 Agent 配置。`,
        metric: 'avgDuration',
        value: taskAnalysis.summary.avgDurationMs,
        recommendation: 'optimize_tasks'
      });
    }
    
    const failedTasks = tasks.filter(t => t.status === 'failed');
    if (failedTasks.length > 0) {
      const recentFailures = failedTasks.slice(-10);
      const commonErrors = this.findCommonErrors(recentFailures);
      
      if (commonErrors.pattern) {
        insights.push({
          category: 'stability',
          priority: 'high',
          title: '发现重复错误模式',
          description: `检测到 "${commonErrors.pattern}" 错误重复出现 ${commonErrors.count} 次，建议优先解决此问题。`,
          metric: 'errorPattern',
          pattern: commonErrors.pattern,
          count: commonErrors.count,
          recommendation: 'fix_common_error'
        });
      }
    }
    
    const workflowAnalysis = this.analyzeWorkflows(workflows, []);
    const failingWorkflows = workflowAnalysis.workflowStats.filter(w => w.successRate < 50 && w.totalRuns > 0);
    if (failingWorkflows.length > 0) {
      insights.push({
        category: 'workflow',
        priority: 'high',
        title: '工作流成功率较低',
        description: `${failingWorkflows.map(w => w.name).join(', ')} 工作流成功率低于 50%，需要检查工作流配置。`,
        metric: 'workflowSuccessRate',
        workflows: failingWorkflows.map(w => ({ name: w.name, successRate: w.successRate })),
        recommendation: 'review_workflows'
      });
    }
    
    if (insights.length === 0) {
      insights.push({
        category: 'general',
        priority: 'low',
        title: '系统运行正常',
        description: '所有指标均在正常范围内，未发现明显问题。',
        recommendation: 'maintain'
      });
    }
    
    return this.prioritizeInsights(insights);
  }

  findCommonErrors(tasks) {
    const errorCounts = new Map();
    
    tasks.forEach(task => {
      const run = task.runs?.find(r => r.status === 'failed');
      if (run?.error) {
        const pattern = this.extractErrorPattern(run.error);
        errorCounts.set(pattern, (errorCounts.get(pattern) || 0) + 1);
      }
    });
    
    let maxCount = 0;
    let maxPattern = null;
    
    errorCounts.forEach((count, pattern) => {
      if (count > maxCount) {
        maxCount = count;
        maxPattern = pattern;
      }
    });
    
    return { pattern: maxPattern, count: maxCount };
  }

  extractErrorPattern(error) {
    if (!error) return 'unknown';
    
    if (error.includes('timeout')) return 'timeout';
    if (error.includes('connection')) return 'connection_error';
    if (error.includes('authentication') || error.includes('auth')) return 'authentication_error';
    if (error.includes('memory')) return 'memory_error';
    if (error.includes('disk') || error.includes('space')) return 'disk_error';
    if (error.includes('permission')) return 'permission_error';
    
    return error.substring(0, 50);
  }

  prioritizeInsights(insights) {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    
    return insights.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.category.localeCompare(b.category);
    });
  }

  getOverview(tasks, agents, workflows, workflowRuns) {
    const taskAnalysis = this.analyzeTasks(tasks);
    const agentAnalysis = this.analyzeAgents(tasks, agents);
    const workflowAnalysis = this.analyzeWorkflows(workflows, workflowRuns);
    const anomalyDetection = this.detectAnomalies(tasks);
    const insights = this.generateInsights(tasks, agents, workflows);
    
    return {
      generatedAt: Date.now(),
      taskAnalysis: taskAnalysis.summary,
      agentAnalysis: agentAnalysis.summary,
      workflowAnalysis: workflowAnalysis.summary,
      anomalyDetection: anomalyDetection.summary,
      insights: insights.slice(0, 5),
      health: this.calculateHealthScore(taskAnalysis, agentAnalysis, anomalyDetection)
    };
  }

  calculateHealthScore(taskAnalysis, agentAnalysis, anomalyDetection) {
    let score = 100;
    
    if (taskAnalysis.completionRate < 50) score -= 30;
    else if (taskAnalysis.completionRate < 70) score -= 15;
    else if (taskAnalysis.completionRate < 85) score -= 5;
    
    if (agentAnalysis.averageSuccessRate < 50) score -= 20;
    else if (agentAnalysis.averageSuccessRate < 70) score -= 10;
    else if (agentAnalysis.averageSuccessRate < 85) score -= 3;
    
    score -= anomalyDetection.highSeverity * 10;
    score -= anomalyDetection.mediumSeverity * 3;
    score -= anomalyDetection.lowSeverity * 1;
    
    score = Math.max(0, Math.min(100, score));
    
    let status = 'healthy';
    if (score < 50) status = 'critical';
    else if (score < 70) status = 'warning';
    else if (score < 85) status = 'good';
    
    return { score, status };
  }

  mean(values) {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  stdDev(values, mean) {
    if (values.length === 0) return 0;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  formatDuration(ms) {
    if (!ms || ms <= 0) return '0s';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

const analyticsEngine = new AnalyticsEngine();

module.exports = {
  AnalyticsEngine,
  analyticsEngine
};
