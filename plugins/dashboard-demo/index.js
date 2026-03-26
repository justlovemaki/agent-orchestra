'use strict';

/**
 * Dashboard Demo Panel Plugin
 * 
 * 示例面板插件 - 展示如何在仪表板中添加自定义组件
 */

module.exports = async function(plugin, context) {
  plugin.getData = async function(options = {}) {
    return {
      demoStats: {
        totalTasks: Math.floor(Math.random() * 100),
        successRate: Math.floor(Math.random() * 30) + 70,
        avgDuration: Math.floor(Math.random() * 60) + 30
      },
      chartData: [
        { label: '周一', value: Math.floor(Math.random() * 50) },
        { label: '周二', value: Math.floor(Math.random() * 50) },
        { label: '周三', value: Math.floor(Math.random() * 50) },
        { label: '周四', value: Math.floor(Math.random() * 50) },
        { label: '周五', value: Math.floor(Math.random() * 50) }
      ],
      timestamp: Date.now()
    };
  };

  plugin.render = async function(containerId) {
    return {
      html: `<div id="${containerId}" class="demo-dashboard-panel">
        <div class="demo-stats">
          <div class="stat-card">
            <div class="stat-label">任务总数</div>
            <div class="stat-value" id="${containerId}-total">--</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">成功率</div>
            <div class="stat-value" id="${containerId}-rate">--%</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">平均耗时</div>
            <div class="stat-value" id="${containerId}-duration">--s</div>
          </div>
        </div>
      </div>`,
      styles: `.demo-dashboard-panel { padding: 16px; }
        .demo-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .stat-card { background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; }
        .stat-label { color: #64748b; font-size: 12px; margin-bottom: 8px; }
        .stat-value { color: #1e293b; font-size: 24px; font-weight: 600; }`,
      script: `async function refreshDemoPanel() {
        const data = await this.getData();
        document.getElementById('${containerId}-total').textContent = data.demoStats.totalTasks;
        document.getElementById('${containerId}-rate').textContent = data.demoStats.successRate + '%';
        document.getElementById('${containerId}-duration').textContent = data.demoStats.avgDuration + 's';
      }
      setInterval(refreshDemoPanel, ${plugin.config.refreshInterval || 30000});`
    };
  };
};
