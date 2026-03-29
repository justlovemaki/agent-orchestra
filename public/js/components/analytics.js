/**
 * Analytics component - Analytics and insights UI and logic
 */

import { state } from '../state.js';
import { fetchJson } from '../api.js';
import { escapeHtml, formatDate, formatDuration, show, hide } from '../utils/dom.js';

let analyticsCharts = {};

export function getAnalyticsElements() {
  return {
    analyticsPanel: document.getElementById('analyticsPanel'),
    analyticsOverview: document.getElementById('analyticsOverview'),
    analyticsLoading: document.getElementById('analyticsLoading'),
    analyticsEmpty: document.getElementById('analyticsEmpty'),
    analyticsTasksChart: document.getElementById('analyticsTasksChart'),
    analyticsAgentsChart: document.getElementById('analyticsAgentsChart'),
    analyticsInsights: document.getElementById('analyticsInsights'),
    analyticsAnomalies: document.getElementById('analyticsAnomalies'),
    analyticsHealthScore: document.getElementById('analyticsHealthScore'),
    analyticsDaysSelect: document.getElementById('analyticsDaysSelect'),
    analyticsRefreshBtn: document.getElementById('analyticsRefreshBtn')
  };
}

export async function loadAnalyticsOverview() {
  const els = getAnalyticsElements();
  if (!els.analyticsPanel) return;
  
  show(els.analyticsLoading);
  hide(els.analyticsEmpty);
  hide(els.analyticsOverview);
  
  try {
    const data = await fetchJson('/api/analytics/overview');
    renderAnalyticsOverview(data);
    hide(els.analyticsLoading);
    show(els.analyticsOverview);
  } catch (err) {
    console.error('加载分析数据失败:', err);
    hide(els.analyticsLoading);
    if (els.analyticsEmpty) {
      show(els.analyticsEmpty);
      els.analyticsEmpty.textContent = '加载分析数据失败: ' + err.message;
    }
  }
}

function renderAnalyticsOverview(data) {
  const els = getAnalyticsElements();
  
  if (els.analyticsHealthScore && data.health) {
    renderHealthScore(els.analyticsHealthScore, data.health);
  }
  
  if (els.analyticsInsights && data.insights) {
    renderInsights(els.analyticsInsights, data.insights);
  }
  
  renderTaskSummary(data.taskAnalysis);
  renderAgentSummary(data.agentAnalysis);
  renderWorkflowSummary(data.workflowAnalysis);
  renderAnomalySummary(data.anomalyDetection);
}

function renderHealthScore(container, health) {
  const score = health.score;
  const status = health.status;
  
  const statusColors = {
    healthy: '#22c55e',
    good: '#84cc16',
    warning: '#f59e0b',
    critical: '#ef4444'
  };
  
  const statusLabels = {
    healthy: '健康',
    good: '良好',
    warning: '警告',
    critical: '危险'
  };
  
  container.innerHTML = `
    <div class="health-score-ring" style="--score: ${score}; --color: ${statusColors[status] || statusColors.healthy}">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" stroke-width="8"/>
        <circle cx="50" cy="50" r="45" fill="none" stroke="${statusColors[status] || statusColors.healthy}" stroke-width="8"
          stroke-dasharray="${score * 2.83} 283" stroke-linecap="round"
          transform="rotate(-90 50 50)"/>
      </svg>
      <div class="health-score-value">
        <span class="health-score-number">${score}</span>
        <span class="health-score-label">${statusLabels[status] || '未知'}</span>
      </div>
    </div>
  `;
}

function renderInsights(container, insights) {
  if (!insights || insights.length === 0) {
    container.innerHTML = '<div class="muted small">暂无洞察</div>';
    return;
  }
  
  const priorityIcons = {
    high: '⚠️',
    medium: '💡',
    low: '✓'
  };
  
  const categoryIcons = {
    performance: '📈',
    resource: '🔧',
    efficiency: '⚡',
    stability: '🔒',
    workflow: '🔄',
    general: 'ℹ️'
  };
  
  container.innerHTML = insights.map(insight => `
    <div class="insight-card insight-priority-${insight.priority}">
      <div class="insight-header">
        <span class="insight-icon">${categoryIcons[insight.category] || 'ℹ️'}</span>
        <span class="insight-title">${escapeHtml(insight.title)}</span>
        <span class="insight-badge">${priorityIcons[insight.priority] || ''}</span>
      </div>
      <div class="insight-description">${escapeHtml(insight.description)}</div>
    </div>
  `).join('');
}

function renderTaskSummary(summary) {
  const container = document.getElementById('taskAnalyticsSummary');
  if (!container || !summary) return;
  
  container.innerHTML = `
    <div class="analytics-stat-card">
      <div class="stat-label">总任务数</div>
      <div class="stat-value">${summary.total}</div>
    </div>
    <div class="analytics-stat-card">
      <div class="stat-label">完成率</div>
      <div class="stat-value ${summary.completionRate >= 70 ? 'stat-good' : (summary.completionRate >= 50 ? 'stat-warning' : 'stat-danger')}">${summary.completionRate}%</div>
    </div>
    <div class="analytics-stat-card">
      <div class="stat-label">失败率</div>
      <div class="stat-value ${summary.failureRate <= 10 ? 'stat-good' : (summary.failureRate <= 30 ? 'stat-warning' : 'stat-danger')}">${summary.failureRate}%</div>
    </div>
    <div class="analytics-stat-card">
      <div class="stat-label">平均耗时</div>
      <div class="stat-value">${summary.avgDurationLabel || 'N/A'}</div>
    </div>
  `;
}

function renderAgentSummary(summary) {
  const container = document.getElementById('agentAnalyticsSummary');
  if (!container || !summary) return;
  
  container.innerHTML = `
    <div class="analytics-stat-card">
      <div class="stat-label">Agent 总数</div>
      <div class="stat-value">${summary.totalAgents}</div>
    </div>
    <div class="analytics-stat-card">
      <div class="stat-label">最活跃 Agent</div>
      <div class="stat-value stat-small">${escapeHtml(summary.mostActiveAgent || 'N/A')}</div>
    </div>
    <div class="analytics-stat-card">
      <div class="stat-label">最高效 Agent</div>
      <div class="stat-value stat-small">${escapeHtml(summary.mostEfficientAgent || 'N/A')}</div>
    </div>
    <div class="analytics-stat-card">
      <div class="stat-label">平均成功率</div>
      <div class="stat-value ${summary.averageSuccessRate >= 70 ? 'stat-good' : (summary.averageSuccessRate >= 50 ? 'stat-warning' : 'stat-danger')}">${summary.averageSuccessRate}%</div>
    </div>
  `;
}

function renderWorkflowSummary(summary) {
  const container = document.getElementById('workflowAnalyticsSummary');
  if (!container || !summary) return;
  
  container.innerHTML = `
    <div class="analytics-stat-card">
      <div class="stat-label">工作流总数</div>
      <div class="stat-value">${summary.totalWorkflows}</div>
    </div>
    <div class="analytics-stat-card">
      <div class="stat-label">最常用工作流</div>
      <div class="stat-value stat-small">${escapeHtml(summary.mostUsedWorkflow || 'N/A')}</div>
    </div>
    <div class="analytics-stat-card">
      <div class="stat-label">平均成功率</div>
      <div class="stat-value ${summary.averageSuccessRate >= 70 ? 'stat-good' : (summary.averageSuccessRate >= 50 ? 'stat-warning' : 'stat-danger')}">${summary.averageSuccessRate}%</div>
    </div>
  `;
}

function renderAnomalySummary(summary) {
  const container = document.getElementById('anomalyAnalyticsSummary');
  if (!container || !summary) return;
  
  container.innerHTML = `
    <div class="analytics-stat-card">
      <div class="stat-label">异常总数</div>
      <div class="stat-value ${summary.totalAnomalies === 0 ? 'stat-good' : (summary.totalAnomalies <= 3 ? 'stat-warning' : 'stat-danger')}">${summary.totalAnomalies}</div>
    </div>
    <div class="analytics-stat-card">
      <div class="stat-label">高危</div>
      <div class="stat-value ${summary.highSeverity === 0 ? 'stat-good' : 'stat-danger'}">${summary.highSeverity}</div>
    </div>
    <div class="analytics-stat-card">
      <div class="stat-label">中危</div>
      <div class="stat-value ${summary.mediumSeverity === 0 ? 'stat-good' : 'stat-warning'}">${summary.mediumSeverity}</div>
    </div>
    <div class="analytics-stat-card">
      <div class="stat-label">低危</div>
      <div class="stat-value">${summary.lowSeverity}</div>
    </div>
  `;
}

export async function loadTaskAnalytics(days = 30) {
  try {
    const data = await fetchJson(`/api/analytics/tasks?days=${days}`);
    return data;
  } catch (err) {
    console.error('加载任务分析失败:', err);
    return null;
  }
}

export async function loadAgentAnalytics() {
  try {
    const data = await fetchJson('/api/analytics/agents');
    return data;
  } catch (err) {
    console.error('加载 Agent 分析失败:', err);
    return null;
  }
}

export async function loadWorkflowAnalytics() {
  try {
    const data = await fetchJson('/api/analytics/workflows');
    return data;
  } catch (err) {
    console.error('加载工作流分析失败:', err);
    return null;
  }
}

export async function loadInsights() {
  try {
    const data = await fetchJson('/api/analytics/insights');
    return data.insights;
  } catch (err) {
    console.error('加载洞察失败:', err);
    return [];
  }
}

export async function loadAnomalies(sensitivity = 2.0) {
  try {
    const data = await fetchJson(`/api/analytics/anomalies?sensitivity=${sensitivity}`);
    return data;
  } catch (err) {
    console.error('加载异常检测失败:', err);
    return null;
  }
}

export function renderAnalyticsCharts(taskData) {
  if (!taskData || !taskData.dailyStats) return;
  
  const canvas = document.getElementById('analyticsTasksChart');
  if (!canvas) return;
  
  if (analyticsTasksChart) {
    analyticsTasksChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  const dailyStats = taskData.dailyStats.slice(-14);
  
  analyticsTasksChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dailyStats.map(d => d.date.slice(5)),
      datasets: [
        {
          label: '完成率',
          data: dailyStats.map(d => d.completionRate),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.3
        },
        {
          label: '失败率',
          data: dailyStats.map(d => d.failureRate),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}

export function renderAgentWorkloadChart(agentData) {
  if (!agentData || !agentData.workloadDistribution) return;
  
  const canvas = document.getElementById('analyticsAgentsChart');
  if (!canvas) return;
  
  if (analyticsAgentsChart) {
    analyticsAgentsChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  const workload = agentData.workloadDistribution.slice(0, 8);
  
  analyticsAgentsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: workload.map(w => w.agentId),
      datasets: [{
        data: workload.map(w => w.taskCount),
        backgroundColor: [
          '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
          '#ec4899', '#14b8a6', '#64748b'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right'
        }
      }
    }
  });
}

export function initAnalyticsComponent() {
  const els = getAnalyticsElements();
  
  if (els.analyticsRefreshBtn) {
    els.analyticsRefreshBtn.addEventListener('click', () => {
      loadAnalyticsOverview();
    });
  }
  
  if (els.analyticsDaysSelect) {
    els.analyticsDaysSelect.addEventListener('change', async (e) => {
      const days = parseInt(e.target.value) || 30;
      const taskData = await loadTaskAnalytics(days);
      if (taskData) {
        renderAnalyticsCharts(taskData);
      }
    });
  }
  
  loadAnalyticsOverview();
  
  return {
    loadAnalyticsOverview,
    loadTaskAnalytics,
    loadAgentAnalytics,
    loadWorkflowAnalytics,
    loadInsights,
    loadAnomalies
  };
}

if (typeof window !== 'undefined') {
  window.initAnalyticsComponent = initAnalyticsComponent;
}
