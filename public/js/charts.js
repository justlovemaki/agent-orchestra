/**
 * Chart rendering - Chart.js based visualizations
 * 
 * 性能优化: 图表懒加载
 * 使用 IntersectionObserver 实现图表进入视口才渲染，减少初始加载时间
 */

import { state } from '../state.js';

let trendsChartInstance = null;
let agentUsageChartInstance = null;
let taskStatusChartInstance = null;
let agentWorkloadChartInstance = null;
let trendDetailPopup = null;
let usageTrendsChartInstance = null;
let notificationTrendsChartInstance = null;
let notificationStatsChartInstance = null;
let channelDistChartInstance = null;
let typeDistChartInstance = null;

/**
 * 图表懒加载观察器
 * 监控图表元素是否进入视口，进入后才执行渲染
 */
const chartObserverMap = new Map();
let lazyObserver = null;

function getLazyObserver() {
  if (!lazyObserver) {
    lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const chartKey = entry.target.dataset.chartKey;
          const renderFn = chartObserverMap.get(chartKey);
          if (renderFn) {
            renderFn();
            chartObserverMap.delete(chartKey);
          }
          lazyObserver.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '100px',
      threshold: 0.1
    });
  }
  return lazyObserver;
}

export function observeChartRender(chartEl, chartKey, renderFn) {
  if (!chartEl) return;
  chartEl.dataset.chartKey = chartKey;
  chartObserverMap.set(chartKey, renderFn);
  getLazyObserver().observe(chartEl);
}

export function unobserveChartRender(chartEl) {
  if (!chartEl || !lazyObserver) return;
  lazyObserver.unobserve(chartEl);
}

export function getChartElements() {
  return {
    trendsLoadingEl: document.getElementById('trendsLoading'),
    trendsEmptyEl: document.getElementById('trendsEmpty'),
    trendsChartEl: document.getElementById('trendsChart'),
    trends7dBtn: document.getElementById('trends7d'),
    trends14dBtn: document.getElementById('trends14d'),
    agentUsageLoadingEl: document.getElementById('agentUsageLoading'),
    agentUsageEmptyEl: document.getElementById('agentUsageEmpty'),
    agentUsageChartEl: document.getElementById('agentUsageChart'),
    taskStatusLoadingEl: document.getElementById('taskStatusLoading'),
    taskStatusEmptyEl: document.getElementById('taskStatusEmpty'),
    taskStatusChartEl: document.getElementById('taskStatusChart'),
    agentWorkloadLoadingEl: document.getElementById('agentWorkloadLoading'),
    agentWorkloadEmptyEl: document.getElementById('agentWorkloadEmpty'),
    agentWorkloadChartEl: document.getElementById('agentWorkloadChart'),
    taskFilterBarEl: document.getElementById('taskFilterBar')
  };
}

export function initChartListeners(onTrendsDaysChange, onTaskFilter) {
  const { trends7dBtn, trends14dBtn } = getChartElements();
  if (trends7dBtn) {
    trends7dBtn.addEventListener('click', () => onTrendsDaysChange(7));
  }
  if (trends14dBtn) {
    trends14dBtn.addEventListener('click', () => onTrendsDaysChange(14));
  }
}

export async function loadTrends(days = state.trendsDays, loadTrendsFn, renderFns) {
  const { 
    trendsLoadingEl, trendsEmptyEl, trendsChartEl,
    agentUsageLoadingEl, agentUsageEmptyEl, agentUsageChartEl,
    taskStatusLoadingEl, taskStatusEmptyEl, taskStatusChartEl,
    agentWorkloadLoadingEl, agentWorkloadEmptyEl, agentWorkloadChartEl
  } = getChartElements();

  if (trendsLoadingEl) {
    trendsLoadingEl.classList.remove('hidden');
    trendsEmptyEl?.classList.add('hidden');
    if (trendsChartEl) trendsChartEl.style.display = 'none';
  }
  if (agentUsageLoadingEl) {
    agentUsageLoadingEl.classList.remove('hidden');
    agentUsageEmptyEl?.classList.add('hidden');
    if (agentUsageChartEl) agentUsageChartEl.style.display = 'none';
  }
  if (taskStatusLoadingEl) {
    taskStatusLoadingEl.classList.remove('hidden');
    taskStatusEmptyEl?.classList.add('hidden');
    if (taskStatusChartEl) taskStatusChartEl.style.display = 'none';
  }
  if (agentWorkloadLoadingEl) {
    agentWorkloadLoadingEl.classList.remove('hidden');
    agentWorkloadEmptyEl?.classList.add('hidden');
    if (agentWorkloadChartEl) agentWorkloadChartEl.style.display = 'none';
  }

  try {
    const res = await loadTrendsFn(days);
    state.trends = res.trends || [];
    state.trendsDays = res.days || days;
    state.agentUsage = res.agentUsage || [];
    state.taskStatusDistribution = res.taskStatusDistribution || [];
    state.agentWorkloadDistribution = res.agentWorkloadDistribution || [];
    
    if (trendsChartEl) {
      observeChartRender(trendsChartEl, 'trends', () => {
        if (renderFns?.renderTrends) renderFns.renderTrends();
      });
    }
    if (agentUsageChartEl) {
      observeChartRender(agentUsageChartEl, 'agentUsage', () => {
        if (renderFns?.renderAgentUsage) renderFns.renderAgentUsage();
      });
    }
    if (taskStatusChartEl) {
      observeChartRender(taskStatusChartEl, 'taskStatus', () => {
        if (renderFns?.renderTaskStatusDistribution) renderFns.renderTaskStatusDistribution();
      });
    }
    if (agentWorkloadChartEl) {
      observeChartRender(agentWorkloadChartEl, 'agentWorkload', () => {
        if (renderFns?.renderAgentWorkloadDistribution) renderFns.renderAgentWorkloadDistribution();
      });
    }
  } catch (err) {
    state.trends = [];
    state.agentUsage = [];
    state.taskStatusDistribution = [];
    state.agentWorkloadDistribution = [];
    if (renderFns?.renderTrends) renderFns.renderTrends();
    if (renderFns?.renderAgentUsage) renderFns.renderAgentUsage();
    if (renderFns?.renderTaskStatusDistribution) renderFns.renderTaskStatusDistribution();
    if (renderFns?.renderAgentWorkloadDistribution) renderFns.renderAgentWorkloadDistribution();
  }
}

export function handleLegendToggle(event, legendItem, legend) {
  const index = legendItem.datasetIndex;
  const ci = legend.chart;
  const meta = ci.getDatasetMeta(index);
  
  meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
  ci.update();
}

export function handleTrendsChartClick(event, elements, showPopupFn) {
  if (elements.length === 0) return;
  
  const element = elements[0];
  const dataIndex = element.index;
  const trend = state.trends[dataIndex];
  if (!trend) return;
  
  const date = new Date(trend.date);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  
  const completionRate = trend.total > 0 ? ((trend.completed / trend.total) * 100).toFixed(1) : '0.0';
  const failRate = trend.total > 0 ? ((trend.failed / trend.total) * 100).toFixed(1) : '0.0';
  
  const timeFromValue = `${dateStr}T00:00`;
  const timeToValue = `${dateStr}T23:59`;
  
  const popupContent = `
    <div class="trend-detail-popup">
      <div class="trend-detail-header">${dateStr} 详细统计</div>
      <div class="trend-detail-row">
        <span class="trend-detail-label">总任务</span>
        <span class="trend-detail-value">${trend.total}</span>
      </div>
      <div class="trend-detail-row">
        <span class="trend-detail-label" style="color: #44d19f;">完成</span>
        <span class="trend-detail-value">${trend.completed} (${completionRate}%)</span>
      </div>
      <div class="trend-detail-row">
        <span class="trend-detail-label" style="color: #ff718d;">失败</span>
        <span class="trend-detail-value">${trend.failed} (${failRate}%)</span>
      </div>
      <div class="trend-detail-row">
        <span class="trend-detail-label" style="color: #7aa2ff;">进行中</span>
        <span class="trend-detail-value">${trend.running || 0}</span>
      </div>
      <div class="trend-detail-actions">
        <button class="trend-detail-btn" data-time-from="${timeFromValue}" data-time-to="${timeToValue}">查看该日期任务</button>
      </div>
      <div class="trend-detail-footer">点击图例可显示/隐藏对应数据线</div>
    </div>
  `;
  
  showPopupFn(event, popupContent);
}

export function showTrendDetailPopup(event, content) {
  removeTrendDetailPopup();
  
  const { trendsChartEl } = getChartElements();
  if (!trendsChartEl) return;
  
  const popup = document.createElement('div');
  popup.id = 'trendDetailPopup';
  popup.className = 'trend-detail-container';
  popup.innerHTML = content;
  
  const chartRect = trendsChartEl.getBoundingClientRect();
  const x = event.clientX - chartRect.left + 10;
  const y = event.clientY - chartRect.top - 10;
  
  popup.style.left = `${Math.min(x, chartRect.width - 200)}px`;
  popup.style.top = `${Math.max(y - 100, 0)}px`;
  
  trendsChartEl.parentElement.appendChild(popup);
  trendDetailPopup = popup;
  
  const viewTasksBtn = popup.querySelector('.trend-detail-btn');
  if (viewTasksBtn) {
    viewTasksBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const timeFrom = viewTasksBtn.dataset.timeFrom;
      const timeTo = viewTasksBtn.dataset.timeTo;
      const filterTimeFromEl = document.getElementById('filterTimeFrom');
      const filterTimeToEl = document.getElementById('filterTimeTo');
      const { taskFilterBarEl } = getChartElements();
      if (filterTimeFromEl) filterTimeFromEl.value = timeFrom;
      if (filterTimeToEl) filterTimeToEl.value = timeTo;
      removeTrendDetailPopup();
      taskFilterBarEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  
  setTimeout(() => {
    document.addEventListener('click', handlePopupOutsideClick, { once: true });
  }, 10);
}

export function removeTrendDetailPopup() {
  if (trendDetailPopup) {
    trendDetailPopup.remove();
    trendDetailPopup = null;
  }
}

function handlePopupOutsideClick(event) {
  const { trendsChartEl } = getChartElements();
  if (trendDetailPopup && !trendDetailPopup.contains(event.target) && !trendsChartEl?.contains(event.target)) {
    removeTrendDetailPopup();
  }
}

export function renderTrends(elements) {
  const { trendsLoadingEl, trendsEmptyEl, trendsChartEl } = elements || getChartElements();
  
  if (trendsLoadingEl) trendsLoadingEl.classList.add('hidden');
  
  if (!state.trends || state.trends.length === 0) {
    if (trendsEmptyEl) trendsEmptyEl.classList.remove('hidden');
    if (trendsChartEl) trendsChartEl.style.display = 'none';
    if (trendsChartInstance) {
      trendsChartInstance.destroy();
      trendsChartInstance = null;
    }
    return;
  }
  
  if (trendsEmptyEl) trendsEmptyEl.classList.add('hidden');
  if (trendsChartEl) trendsChartEl.style.display = 'block';
  
  const labels = state.trends.map(t => {
    const d = new Date(t.date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  
  const totalData = state.trends.map(t => t.total);
  const completedData = state.trends.map(t => t.completed);
  const failedData = state.trends.map(t => t.failed);
  
  if (trendsChartInstance) {
    trendsChartInstance.destroy();
  }
  
  if (!trendsChartEl) return;
  
  const ctx = trendsChartEl.getContext('2d');
  trendsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '总任务',
          data: totalData,
          borderColor: '#7aa2ff',
          backgroundColor: 'rgba(122, 162, 255, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          label: '完成',
          data: completedData,
          borderColor: '#44d19f',
          backgroundColor: 'rgba(68, 209, 159, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          label: '失败',
          data: failedData,
          borderColor: '#ff718d',
          backgroundColor: 'rgba(255, 113, 141, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      onClick: (event, elements) => handleTrendsChartClick(event, elements, showTrendDetailPopup),
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#95a5c6',
            usePointStyle: true,
            padding: 16
          },
          onClick: handleLegendToggle
        },
        tooltip: {
          backgroundColor: 'rgba(11, 20, 36, 0.95)',
          titleColor: '#eff4ff',
          bodyColor: '#c5d0e8',
          borderColor: 'rgba(144, 168, 220, 0.24)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(144, 168, 220, 0.08)',
            drawBorder: false
          },
          ticks: {
            color: '#6f81a8'
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(144, 168, 220, 0.08)',
            drawBorder: false
          },
          ticks: {
            color: '#6f81a8',
            stepSize: 1
          }
        }
      }
    }
  });
}

export function handleAgentChartClick(event, elements) {
  if (elements.length === 0) return;
  const dataIndex = elements[0].index;
  const agent = state.agentUsage[dataIndex];
  if (!agent) return;
  
  const agentName = agent.agentName;
  const { taskFilterBarEl } = getChartElements();
  
  state.filters = { ...state.filters, agent: agentName };
  populateFilterInputs(state.filters);
  
  taskFilterBarEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function renderAgentUsage(elements) {
  const { agentUsageLoadingEl, agentUsageEmptyEl, agentUsageChartEl } = elements || getChartElements();
  
  if (agentUsageLoadingEl) agentUsageLoadingEl.classList.add('hidden');
  
  if (!state.agentUsage || state.agentUsage.length === 0) {
    if (agentUsageEmptyEl) agentUsageEmptyEl.classList.remove('hidden');
    if (agentUsageChartEl) agentUsageChartEl.style.display = 'none';
    if (agentUsageChartInstance) {
      agentUsageChartInstance.destroy();
      agentUsageChartInstance = null;
    }
    return;
  }
  
  if (agentUsageEmptyEl) agentUsageEmptyEl.classList.add('hidden');
  if (agentUsageChartEl) agentUsageChartEl.style.display = 'block';
  
  const labels = state.agentUsage.map(a => a.agentName);
  const successData = state.agentUsage.map(a => a.successCount);
  const failData = state.agentUsage.map(a => a.failCount);
  
  if (agentUsageChartInstance) {
    agentUsageChartInstance.destroy();
  }
  
  if (!agentUsageChartEl) return;
  
  const ctx = agentUsageChartEl.getContext('2d');
  agentUsageChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '成功',
          data: successData,
          backgroundColor: '#44d19f',
          borderRadius: 4
        },
        {
          label: '失败',
          data: failData,
          backgroundColor: '#ff718d',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      onClick: handleAgentChartClick,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#95a5c6',
            usePointStyle: true,
            padding: 16
          }
        },
        tooltip: {
          backgroundColor: 'rgba(11, 20, 36, 0.95)',
          titleColor: '#eff4ff',
          bodyColor: '#c5d0e8',
          borderColor: 'rgba(144, 168, 220, 0.24)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const dataIndex = context.dataIndex;
              const agent = state.agentUsage[dataIndex];
              const total = agent.taskCount;
              const percentage = ((context.raw / total) * 100).toFixed(1);
              return `${context.dataset.label}: ${context.raw} (${percentage}%)`;
            },
            footer: function(tooltipItems) {
              const dataIndex = tooltipItems[0].dataIndex;
              const agent = state.agentUsage[dataIndex];
              return `总计: ${agent.taskCount} 次`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            color: 'rgba(144, 168, 220, 0.08)',
            drawBorder: false
          },
          ticks: {
            color: '#6f81a8',
            maxRotation: 45,
            minRotation: 0
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: {
            color: 'rgba(144, 168, 220, 0.08)',
            drawBorder: false
          },
          ticks: {
            color: '#6f81a8',
            stepSize: 1
          }
        }
      }
    }
  });
}

export function handleTaskStatusChartClick(event, elements) {
  if (elements.length === 0) return;
  
  const dataIndex = elements[0].index;
  const statusData = state.taskStatusDistribution[dataIndex];
  if (!statusData) return;
  
  const statusMap = {
    pending: 'queued',
    running: 'running',
    completed: 'completed',
    failed: 'failed',
    paused: 'paused',
    cancelled: 'canceled'
  };
  const statusValue = statusMap[statusData.status] || statusData.status;
  
  const filterStatusEl = document.getElementById('filterStatus');
  state.filters = { ...state.filters, status: statusValue };
  if (filterStatusEl) filterStatusEl.value = statusValue;
  populateFilterInputs(state.filters);
  
  const { taskFilterBarEl } = getChartElements();
  taskFilterBarEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function renderTaskStatusDistribution(elements) {
  const { taskStatusLoadingEl, taskStatusEmptyEl, taskStatusChartEl } = elements || getChartElements();
  
  if (taskStatusLoadingEl) taskStatusLoadingEl.classList.add('hidden');
  
  if (!state.taskStatusDistribution || state.taskStatusDistribution.length === 0) {
    if (taskStatusEmptyEl) taskStatusEmptyEl.classList.remove('hidden');
    if (taskStatusChartEl) taskStatusChartEl.style.display = 'none';
    if (taskStatusChartInstance) {
      taskStatusChartInstance.destroy();
      taskStatusChartInstance = null;
    }
    return;
  }
  
  if (taskStatusEmptyEl) taskStatusEmptyEl.classList.add('hidden');
  if (taskStatusChartEl) taskStatusChartEl.style.display = 'block';
  
  const labels = state.taskStatusDistribution.map(s => {
    const labelMap = {
      pending: '待执行',
      running: '执行中',
      completed: '已完成',
      failed: '失败',
      paused: '已暂停',
      cancelled: '已取消'
    };
    return labelMap[s.status] || s.status;
  });
  const data = state.taskStatusDistribution.map(s => s.count);
  const colors = ['#7aa2ff', '#44d19f', '#ff718d', '#ffa726', '#ab47bc', '#90a4ae'];
  
  if (taskStatusChartInstance) {
    taskStatusChartInstance.destroy();
  }
  
  if (!taskStatusChartEl) return;
  
  const ctx = taskStatusChartEl.getContext('2d');
  taskStatusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: handleTaskStatusChartClick,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#95a5c6',
            usePointStyle: true,
            padding: 12
          }
        },
        tooltip: {
          backgroundColor: 'rgba(11, 20, 36, 0.95)',
          titleColor: '#eff4ff',
          bodyColor: '#c5d0e8',
          borderColor: 'rgba(144, 168, 220, 0.24)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8
        }
      }
    }
  });
}

export function renderAgentWorkloadDistribution(elements) {
  const { agentWorkloadLoadingEl, agentWorkloadEmptyEl, agentWorkloadChartEl } = elements || getChartElements();
  
  if (agentWorkloadLoadingEl) agentWorkloadLoadingEl.classList.add('hidden');
  
  if (!state.agentWorkloadDistribution || state.agentWorkloadDistribution.length === 0) {
    if (agentWorkloadEmptyEl) agentWorkloadEmptyEl.classList.remove('hidden');
    if (agentWorkloadChartEl) agentWorkloadChartEl.style.display = 'none';
    if (agentWorkloadChartInstance) {
      agentWorkloadChartInstance.destroy();
      agentWorkloadChartInstance = null;
    }
    return;
  }
  
  if (agentWorkloadEmptyEl) agentWorkloadEmptyEl.classList.add('hidden');
  if (agentWorkloadChartEl) agentWorkloadChartEl.style.display = 'block';
  
  const labels = state.agentWorkloadDistribution.map(a => a.agentName);
  const data = state.agentWorkloadDistribution.map(a => a.running + a.queued);
  const colors = ['#7aa2ff', '#44d19f', '#ff718d', '#ffa726', '#26a69a', '#ab47bc', '#42a5f5', '#66bb6a'];
  
  if (agentWorkloadChartInstance) {
    agentWorkloadChartInstance.destroy();
  }
  
  if (!agentWorkloadChartEl) return;
  
  const ctx = agentWorkloadChartEl.getContext('2d');
  agentWorkloadChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#95a5c6',
            usePointStyle: true,
            padding: 12
          }
        },
        tooltip: {
          backgroundColor: 'rgba(11, 20, 36, 0.95)',
          titleColor: '#eff4ff',
          bodyColor: '#c5d0e8',
          borderColor: 'rgba(144, 168, 220, 0.24)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8
        }
      }
    }
  });
}

function populateFilterInputs(filters) {
  const filterKeywordEl = document.getElementById('filterKeyword');
  const filterStatusEl = document.getElementById('filterStatus');
  const filterPriorityEl = document.getElementById('filterPriority');
  const filterModeEl = document.getElementById('filterMode');
  
  if (filterKeywordEl && filters.keyword) filterKeywordEl.value = filters.keyword;
  if (filterStatusEl && filters.status) filterStatusEl.value = filters.status;
  if (filterPriorityEl && filters.priority) filterPriorityEl.value = filters.priority;
  if (filterModeEl && filters.mode) filterModeEl.value = filters.mode;
}

export function updateTrendsButtons(days) {
  const { trends7dBtn, trends14dBtn } = getChartElements();
  if (trends7dBtn && trends14dBtn) {
    trends7dBtn.classList.toggle('filter-btn-active', days === 7);
    trends14dBtn.classList.toggle('filter-btn-active', days === 14);
  }
}

export function destroyAllCharts() {
  if (trendsChartInstance) { trendsChartInstance.destroy(); trendsChartInstance = null; }
  if (agentUsageChartInstance) { agentUsageChartInstance.destroy(); agentUsageChartInstance = null; }
  if (taskStatusChartInstance) { taskStatusChartInstance.destroy(); taskStatusChartInstance = null; }
  if (agentWorkloadChartInstance) { agentWorkloadChartInstance.destroy(); agentWorkloadChartInstance = null; }
  if (usageTrendsChartInstance) { usageTrendsChartInstance.destroy(); usageTrendsChartInstance = null; }
  if (notificationTrendsChartInstance) { notificationTrendsChartInstance.destroy(); notificationTrendsChartInstance = null; }
  if (notificationStatsChartInstance) { notificationStatsChartInstance.destroy(); notificationStatsChartInstance = null; }
  if (channelDistChartInstance) { channelDistChartInstance.destroy(); channelDistChartInstance = null; }
  if (typeDistChartInstance) { typeDistChartInstance.destroy(); typeDistChartInstance = null; }
  
  chartObserverMap.clear();
  const { trendsChartEl, agentUsageChartEl, taskStatusChartEl, agentWorkloadChartEl } = getChartElements();
  [trendsChartEl, agentUsageChartEl, taskStatusChartEl, agentWorkloadChartEl].forEach(el => {
    if (el) unobserveChartRender(el);
  });
}