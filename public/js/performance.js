/**
 * Performance Monitor Frontend Module
 * Provides UI for displaying performance metrics, charts, and slow request tracking
 */

import { state } from './state.js';
import { fetchJson } from './api.js';
import { escapeHtml, formatDate, show, hide, showById, hideById } from './utils/dom.js';

let performanceCharts = {};
let refreshInterval = null;

export async function loadMetrics(timeRange = '1h') {
  return await fetchJson(`/api/metrics?timeRange=${timeRange}`);
}

export async function loadSlowRequests(timeRange = '1h', limit = 50) {
  return await fetchJson(`/api/metrics/slow-requests?timeRange=${timeRange}&limit=${limit}`);
}

export async function loadSummary() {
  return await fetchJson('/api/metrics/summary');
}

export function initPerformanceComponent() {
  const perfPanel = document.getElementById('performancePanel');
  if (!perfPanel) return;

  const timeRangeSelect = document.getElementById('performanceTimeRange');
  if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', (e) => {
      refreshPerformanceData(e.target.value);
    });
  }

  const refreshBtn = document.getElementById('refreshPerformanceBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const timeRange = timeRangeSelect?.value || '1h';
      refreshPerformanceData(timeRange);
    });
  }

  startAutoRefresh();
}

function startAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  refreshInterval = setInterval(() => {
    if (document.getElementById('performancePanel') && !document.getElementById('performancePanel').classList.contains('hidden')) {
      const timeRangeSelect = document.getElementById('performanceTimeRange');
      const timeRange = timeRangeSelect?.value || '1h';
      refreshPerformanceData(timeRange);
    }
  }, 30000);
}

export async function refreshPerformanceData(timeRange = '1h') {
  const loadingEl = document.getElementById('performanceLoading');
  const errorEl = document.getElementById('performanceError');
  const contentEl = document.getElementById('performanceContent');

  try {
    if (loadingEl) show(loadingEl);
    if (errorEl) hide(errorEl);
    if (contentEl) hide(contentEl);

    const [metrics, slowRequests, summary] = await Promise.all([
      loadMetrics(timeRange),
      loadSlowRequests(timeRange, 20),
      loadSummary()
    ]);

    renderPerformanceSummary(summary);
    renderPerformanceMetrics(metrics);
    renderSlowRequests(slowRequests);
    renderPerformanceCharts(metrics);

    if (loadingEl) hide(loadingEl);
    if (contentEl) show(contentEl);
  } catch (err) {
    console.error('Failed to load performance data:', err);
    if (loadingEl) hide(loadingEl);
    if (errorEl) {
      errorEl.textContent = `加载失败: ${err.message}`;
      show(errorEl);
    }
  }
}

function renderPerformanceSummary(summary) {
  const container = document.getElementById('performanceSummary');
  if (!container) return;

  const uptime = formatUptime(summary.uptime);
  const memoryUsage = summary.memory?.usagePercent || 0;
  const memoryUsed = formatBytes(summary.memory?.heapUsed || 0);
  const memoryTotal = formatBytes(summary.memory?.heapTotal || 0);

  container.innerHTML = `
    <div class="perf-summary-grid">
      <div class="perf-summary-card">
        <div class="perf-summary-label">运行时间</div>
        <div class="perf-summary-value">${escapeHtml(uptime)}</div>
      </div>
      <div class="perf-summary-card">
        <div class="perf-summary-label">总请求数</div>
        <div class="perf-summary-value">${summary.totalRequests || 0}</div>
      </div>
      <div class="perf-summary-card">
        <div class="perf-summary-label">近1小时请求</div>
        <div class="perf-summary-value">${summary.requestsLastHour || 0}</div>
      </div>
      <div class="perf-summary-card">
        <div class="perf-summary-label">错误率</div>
        <div class="perf-summary-value ${summary.errorRate > 5 ? 'text-error' : ''}">${summary.errorRate || 0}%</div>
      </div>
      <div class="perf-summary-card">
        <div class="perf-summary-label">平均响应</div>
        <div class="perf-summary-value">${summary.avgResponseTime || 0}ms</div>
      </div>
      <div class="perf-summary-card">
        <div class="perf-summary-label">内存使用</div>
        <div class="perf-summary-value">${memoryUsed} / ${memoryTotal} (${memoryUsage}%)</div>
      </div>
      <div class="perf-summary-card">
        <div class="perf-summary-label">慢请求数</div>
        <div class="perf-summary-value ${summary.slowRequestsCount > 0 ? 'text-warning' : ''}">${summary.slowRequestsCount || 0}</div>
      </div>
    </div>
  `;
}

function renderPerformanceMetrics(metrics) {
  const container = document.getElementById('performanceMetrics');
  if (!container) return;

  const { requestRate, errorRate, responseTime, memory, statusCodeCounts } = metrics;

  container.innerHTML = `
    <div class="perf-metrics-grid">
      <div class="perf-metric-section">
        <h4>请求速率</h4>
        <div class="perf-metric-row">
          <span>每分钟请求</span>
          <span class="perf-metric-value">${requestRate?.requestsPerMinute || 0}</span>
        </div>
        <div class="perf-metric-row">
          <span>时间范围内请求</span>
          <span class="perf-metric-value">${requestRate?.requests || 0}</span>
        </div>
      </div>
      <div class="perf-metric-section">
        <h4>错误率</h4>
        <div class="perf-metric-row">
          <span>总错误率</span>
          <span class="perf-metric-value ${errorRate?.errorRate > 5 ? 'text-error' : ''}">${errorRate?.errorRate || 0}%</span>
        </div>
        <div class="perf-metric-row">
          <span>客户端错误 (4xx)</span>
          <span class="perf-metric-value">${errorRate?.clientErrorRate || 0}%</span>
        </div>
        <div class="perf-metric-row">
          <span>服务端错误 (5xx)</span>
          <span class="perf-metric-value ${errorRate?.serverErrorRate > 1 ? 'text-error' : ''}">${errorRate?.serverErrorRate || 0}%</span>
        </div>
      </div>
      <div class="perf-metric-section">
        <h4>响应时间</h4>
        <div class="perf-metric-row">
          <span>平均</span>
          <span class="perf-metric-value">${responseTime?.avg || 0}ms</span>
        </div>
        <div class="perf-metric-row">
          <span>P50</span>
          <span class="perf-metric-value">${responseTime?.p50 || 0}ms</span>
        </div>
        <div class="perf-metric-row">
          <span>P90</span>
          <span class="perf-metric-value">${responseTime?.p90 || 0}ms</span>
        </div>
        <div class="perf-metric-row">
          <span>P99</span>
          <span class="perf-metric-value">${responseTime?.p99 || 0}ms</span>
        </div>
      </div>
      <div class="perf-metric-section">
        <h4>内存</h4>
        <div class="perf-metric-row">
          <span>堆使用</span>
          <span class="perf-metric-value">${formatBytes(memory?.heapUsed || 0)}</span>
        </div>
        <div class="perf-metric-row">
          <span>堆总量</span>
          <span class="perf-metric-value">${formatBytes(memory?.heapTotal || 0)}</span>
        </div>
        <div class="perf-metric-row">
          <span>使用率</span>
          <span class="perf-metric-value ${memory?.usagePercent > 80 ? 'text-warning' : ''}">${memory?.usagePercent || 0}%</span>
        </div>
        <div class="perf-metric-row">
          <span>RSS</span>
          <span class="perf-metric-value">${formatBytes(memory?.rss || 0)}</span>
        </div>
      </div>
    </div>
    <div class="perf-metrics-status-codes">
      <h4>状态码分布</h4>
      <div class="status-code-bars">
        <div class="status-code-item">
          <span class="status-code-label text-success">2xx</span>
          <div class="status-code-bar"><div class="status-code-fill text-success" style="width: ${getStatusBarWidth(statusCodeCounts?.['2xx'] || 0, metrics.summary?.totalRequests || 1)}%"></div></div>
          <span class="status-code-count">${statusCodeCounts?.['2xx'] || 0}</span>
        </div>
        <div class="status-code-item">
          <span class="status-code-label">3xx</span>
          <div class="status-code-bar"><div class="status-code-fill" style="width: ${getStatusBarWidth(statusCodeCounts?.['3xx'] || 0, metrics.summary?.totalRequests || 1)}%"></div></div>
          <span class="status-code-count">${statusCodeCounts?.['3xx'] || 0}</span>
        </div>
        <div class="status-code-item">
          <span class="status-code-label text-warning">4xx</span>
          <div class="status-code-bar"><div class="status-code-fill text-warning" style="width: ${getStatusBarWidth(statusCodeCounts?.['4xx'] || 0, metrics.summary?.totalRequests || 1)}%"></div></div>
          <span class="status-code-count">${statusCodeCounts?.['4xx'] || 0}</span>
        </div>
        <div class="status-code-item">
          <span class="status-code-label text-error">5xx</span>
          <div class="status-code-bar"><div class="status-code-fill text-error" style="width: ${getStatusBarWidth(statusCodeCounts?.['5xx'] || 0, metrics.summary?.totalRequests || 1)}%"></div></div>
          <span class="status-code-count">${statusCodeCounts?.['5xx'] || 0}</span>
        </div>
      </div>
    </div>
  `;
}

function renderSlowRequests(slowRequests) {
  const container = document.getElementById('performanceSlowRequests');
  if (!container) return;

  if (!slowRequests?.slowRequests || slowRequests.slowRequests.length === 0) {
    container.innerHTML = '<div class="perf-empty">暂无慢请求</div>';
    return;
  }

  const rows = slowRequests.slowRequests.map(req => `
    <tr>
      <td><span class="method-badge method-${escapeHtml(req.method?.toLowerCase() || 'get')}">${escapeHtml(req.method || 'GET')}</span></td>
      <td class="path-cell" title="${escapeHtml(req.path + (req.query ? '?' + req.query : ''))}">${escapeHtml(req.path)}</td>
      <td class="duration-cell ${req.duration > 2000 ? 'text-error' : ''}">${req.duration}ms</td>
      <td><span class="status-badge status-${Math.floor(req.statusCode / 100)}xx">${req.statusCode}</span></td>
      <td class="time-cell">${formatDate(req.timestamp)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="perf-slow-requests-table">
      <thead>
        <tr>
          <th>方法</th>
          <th>路径</th>
          <th>耗时</th>
          <th>状态</th>
          <th>时间</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function renderPerformanceCharts(metrics) {
  if (typeof Chart === 'undefined') return;

  const { aggregated } = metrics;
  if (!aggregated?.hour || aggregated.hour.length === 0) return;

  renderResponseTimeChart(aggregated.hour);
  renderRequestRateChart(aggregated.hour);
  renderErrorRateChart(aggregated.hour);
}

function renderResponseTimeChart(data) {
  const ctx = document.getElementById('perfResponseTimeChart');
  if (!ctx) return;

  if (performanceCharts.responseTime) {
    performanceCharts.responseTime.destroy();
  }

  const labels = data.map(d => new Date(d.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
  const avgDurations = data.map(d => d.avgDuration);

  performanceCharts.responseTime = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '平均响应时间 (ms)',
        data: avgDurations,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: '响应时间趋势' }
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'ms' } }
      }
    }
  });
}

function renderRequestRateChart(data) {
  const ctx = document.getElementById('perfRequestRateChart');
  if (!ctx) return;

  if (performanceCharts.requestRate) {
    performanceCharts.requestRate.destroy();
  }

  const labels = data.map(d => new Date(d.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
  const requests = data.map(d => d.requests);

  performanceCharts.requestRate = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '请求数',
        data: requests,
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: '#10b981',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: '请求速率' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function renderErrorRateChart(data) {
  const ctx = document.getElementById('perfErrorRateChart');
  if (!ctx) return;

  if (performanceCharts.errorRate) {
    performanceCharts.errorRate.destroy();
  }

  const labels = data.map(d => new Date(d.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
  const errorRates = data.map(d => d.errorRate);
  const serverErrors = data.map(d => d.serverErrorCount);

  performanceCharts.errorRate = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '错误率 (%)',
          data: errorRates,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          label: '5xx 错误数',
          data: serverErrors,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          type: 'bar',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom' },
        title: { display: true, text: '错误率趋势' }
      },
      scales: {
        y: {
          beginAtZero: true,
          position: 'left',
          title: { display: true, text: '%' }
        },
        y1: {
          beginAtZero: true,
          position: 'right',
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天 ${hours % 24}小时`;
  if (hours > 0) return `${hours}小时 ${minutes % 60}分钟`;
  if (minutes > 0) return `${minutes}分钟 ${seconds % 60}秒`;
  return `${seconds}秒`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getStatusBarWidth(count, total) {
  if (total === 0) return 0;
  return Math.max(0.5, (count / total) * 100);
}

export function cleanup() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  Object.values(performanceCharts).forEach(chart => {
    if (chart && chart.destroy) chart.destroy();
  });
  performanceCharts = {};
}
