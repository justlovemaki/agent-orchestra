/**
 * Performance Monitor Module
 * Provides API performance tracking, memory monitoring, and metrics aggregation
 */

class PerformanceMonitor {
  constructor(options = {}) {
    this.slowRequestThreshold = options.slowRequestThreshold || 1000;
    this.maxRequestRecords = options.maxRequestRecords || 10000;
    this.requestRecords = [];
    this.startTime = Date.now();
    this.statusCodeCounts = {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0
    };
    this.methodCounts = {
      GET: 0,
      POST: 0,
      PUT: 0,
      DELETE: 0,
      PATCH: 0,
      OPTIONS: 0,
      HEAD: 0
    };
    this.pathCounts = {};
  }

  createMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const originalEnd = res.end;
      const path = req.url.split('?')[0];

      res.end = (chunk, encoding) => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        this.recordRequest({
          path,
          method: req.method,
          statusCode,
          duration,
          timestamp: Date.now(),
          query: req.url.split('?')[1] || ''
        });

        originalEnd.call(res, chunk, encoding);
      };

      next();
    };
  }

  recordRequest(record) {
    this.requestRecords.push(record);

    if (this.requestRecords.length > this.maxRequestRecords) {
      this.requestRecords = this.requestRecords.slice(-this.maxRequestRecords);
    }

    const statusCategory = this.getStatusCategory(record.statusCode);
    this.statusCodeCounts[statusCategory]++;

    if (this.methodCounts[record.method] !== undefined) {
      this.methodCounts[record.method]++;
    }

    this.pathCounts[record.path] = (this.pathCounts[record.path] || 0) + 1;
  }

  getStatusCategory(statusCode) {
    if (statusCode >= 200 && statusCode < 300) return '2xx';
    if (statusCode >= 300 && statusCode < 400) return '3xx';
    if (statusCode >= 400 && statusCode < 500) return '4xx';
    if (statusCode >= 500) return '5xx';
    return 'unknown';
  }

  getMemoryUsage() {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
      arrayBuffers: mem.arrayBuffers,
      usagePercent: Math.round((mem.heapUsed / mem.heapTotal) * 100 * 100) / 100
    };
  }

  getRequestRate(timeRangeMs = 60000) {
    const now = Date.now();
    const cutoff = now - timeRangeMs;
    const recentRequests = this.requestRecords.filter(r => r.timestamp >= cutoff);
    const minutes = timeRangeMs / 60000;
    return {
      requests: recentRequests.length,
      requestsPerMinute: Math.round((recentRequests.length / minutes) * 100) / 100
    };
  }

  getErrorRate(timeRangeMs = 60000) {
    const now = Date.now();
    const cutoff = now - timeRangeMs;
    const recentRequests = this.requestRecords.filter(r => r.timestamp >= cutoff);

    if (recentRequests.length === 0) {
      return {
        totalRequests: 0,
        errorCount: 0,
        errorRate: 0,
        clientErrorRate: 0,
        serverErrorRate: 0
      };
    }

    const errorCount = recentRequests.filter(r => r.statusCode >= 400).length;
    const clientErrorCount = recentRequests.filter(r => r.statusCode >= 400 && r.statusCode < 500).length;
    const serverErrorCount = recentRequests.filter(r => r.statusCode >= 500).length;

    return {
      totalRequests: recentRequests.length,
      errorCount,
      errorRate: Math.round((errorCount / recentRequests.length) * 10000) / 100,
      clientErrorRate: Math.round((clientErrorCount / recentRequests.length) * 10000) / 100,
      serverErrorRate: Math.round((serverErrorCount / recentRequests.length) * 10000) / 100
    };
  }

  getSlowRequests(threshold = null, limit = 100) {
    const thresholdMs = threshold || this.slowRequestThreshold;
    return this.requestRecords
      .filter(r => r.duration >= thresholdMs)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  getResponseTimeStats(timeRangeMs = 60000) {
    const now = Date.now();
    const cutoff = now - timeRangeMs;
    const recentRequests = this.requestRecords.filter(r => r.timestamp >= cutoff);

    if (recentRequests.length === 0) {
      return {
        count: 0,
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0
      };
    }

    const durations = recentRequests.map(r => r.duration).sort((a, b) => a - b);
    const count = durations.length;
    const sum = durations.reduce((a, b) => a + b, 0);

    const getPercentile = (arr, p) => {
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };

    return {
      count,
      avg: Math.round(sum / count),
      min: durations[0],
      max: durations[count - 1],
      p50: getPercentile(durations, 50),
      p90: getPercentile(durations, 90),
      p95: getPercentile(durations, 95),
      p99: getPercentile(durations, 99)
    };
  }

  aggregateByTimeUnit(records, timeUnit) {
    const aggregated = {};

    for (const record of records) {
      const date = new Date(record.timestamp);
      let key;

      switch (timeUnit) {
        case 'minute':
          key = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()).getTime();
          break;
        case 'hour':
          key = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime();
          break;
        case 'day':
          key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
          break;
        default:
          key = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime();
      }

      if (!aggregated[key]) {
        aggregated[key] = {
          timestamp: key,
          requests: 0,
          totalDuration: 0,
          errorCount: 0,
          clientErrorCount: 0,
          serverErrorCount: 0,
          statusCodes: {},
          methods: {}
        };
      }

      aggregated[key].requests++;
      aggregated[key].totalDuration += record.duration;

      if (record.statusCode >= 400 && record.statusCode < 500) {
        aggregated[key].errorCount++;
        aggregated[key].clientErrorCount++;
      } else if (record.statusCode >= 500) {
        aggregated[key].errorCount++;
        aggregated[key].serverErrorCount++;
      }

      aggregated[key].statusCodes[record.statusCode] = (aggregated[key].statusCodes[record.statusCode] || 0) + 1;
      aggregated[key].methods[record.method] = (aggregated[key].methods[record.method] || 0) + 1;
    }

    return Object.values(aggregated).map(item => ({
      timestamp: item.timestamp,
      requests: item.requests,
      avgDuration: item.requests > 0 ? Math.round(item.totalDuration / item.requests) : 0,
      errorCount: item.errorCount,
      errorRate: item.requests > 0 ? Math.round((item.errorCount / item.requests) * 10000) / 100 : 0,
      clientErrorCount: item.clientErrorCount,
      serverErrorCount: item.serverErrorCount,
      statusCodes: item.statusCodes,
      methods: item.methods
    })).sort((a, b) => a.timestamp - b.timestamp);
  }

  getMetrics(timeRange) {
    const timeRangeMs = this.parseTimeRange(timeRange);
    const now = Date.now();
    const cutoff = now - timeRangeMs;
    const recentRecords = this.requestRecords.filter(r => r.timestamp >= cutoff);

    const aggregated = {
      minute: this.aggregateByTimeUnit(recentRecords, 'minute'),
      hour: this.aggregateByTimeUnit(recentRecords, 'hour'),
      day: this.aggregateByTimeUnit(recentRecords, 'day')
    };

    return {
      summary: {
        totalRequests: recentRecords.length,
        uptime: Date.now() - this.startTime,
        timeRange: timeRange,
        timeRangeMs
      },
      memory: this.getMemoryUsage(),
      requestRate: this.getRequestRate(timeRangeMs),
      errorRate: this.getErrorRate(timeRangeMs),
      responseTime: this.getResponseTimeStats(timeRangeMs),
      statusCodeCounts: this.statusCodeCounts,
      methodCounts: this.methodCounts,
      topPaths: this.getTopPaths(10),
      aggregated
    };
  }

  getTopPaths(limit = 10) {
    return Object.entries(this.pathCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([path, count]) => ({ path, count }));
  }

  parseTimeRange(timeRange) {
    const mapping = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '1m': 30 * 24 * 60 * 60 * 1000
    };
    return mapping[timeRange] || mapping['1h'];
  }

  getSlowRequestsList(timeRange, limit = 50) {
    const timeRangeMs = this.parseTimeRange(timeRange);
    const now = Date.now();
    const cutoff = now - timeRangeMs;
    const recentRecords = this.requestRecords.filter(r => r.timestamp >= cutoff);

    return recentRecords
      .filter(r => r.duration >= this.slowRequestThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
      .map(r => ({
        path: r.path,
        method: r.method,
        statusCode: r.statusCode,
        duration: r.duration,
        timestamp: r.timestamp,
        query: r.query
      }));
  }

  getSummary() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const recentRecords = this.requestRecords.filter(r => r.timestamp >= oneHourAgo);

    return {
      uptime: Date.now() - this.startTime,
      totalRequests: this.requestRecords.length,
      requestsLastHour: recentRecords.length,
      memory: this.getMemoryUsage(),
      errorRate: this.getErrorRate(3600000).errorRate,
      avgResponseTime: this.getResponseTimeStats(3600000).avg,
      slowRequestsCount: this.getSlowRequests().length,
      statusCodeCounts: this.statusCodeCounts,
      methodCounts: this.methodCounts
    };
  }

  reset() {
    this.requestRecords = [];
    this.statusCodeCounts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    this.methodCounts = { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0, OPTIONS: 0, HEAD: 0 };
    this.pathCounts = {};
  }
}

const performanceMonitor = new PerformanceMonitor();

module.exports = {
  PerformanceMonitor,
  performanceMonitor,
  createPerformanceMonitor: (options) => new PerformanceMonitor(options)
};
