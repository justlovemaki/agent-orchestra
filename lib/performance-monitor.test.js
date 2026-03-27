/**
 * Performance Monitor Module Tests
 */

const { PerformanceMonitor, createPerformanceMonitor } = require('./performance-monitor');

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

function assertGreaterThan(actual, min, message) {
  if (!(actual > min)) {
    throw new Error(message || `期望 ${actual} > ${min}`);
  }
}

function assertLessThan(actual, max, message) {
  if (!(actual < max)) {
    throw new Error(message || `期望 ${actual} < ${max}`);
  }
}

let passed = 0;
let failed = 0;

console.log('\n📋 PerformanceMonitor 基本功能测试\n');

if (test('创建性能监控实例', () => {
  const monitor = new PerformanceMonitor();
  assert(monitor !== null, '监控实例应该被创建');
  passed++;
})) {} else { failed++; }

if (test('创建带自定义阈值的监控实例', () => {
  const monitor = new PerformanceMonitor({ slowRequestThreshold: 500 });
  assertEqual(monitor.slowRequestThreshold, 500);
  passed++;
})) {} else { failed++; }

if (test('默认慢请求阈值为1000ms', () => {
  const monitor = new PerformanceMonitor();
  assertEqual(monitor.slowRequestThreshold, 1000);
  passed++;
})) {} else { failed++; }

console.log('\n📋 请求记录测试\n');

if (test('记录单个请求', () => {
  const monitor = new PerformanceMonitor();
  monitor.recordRequest({
    path: '/api/test',
    method: 'GET',
    statusCode: 200,
    duration: 50,
    timestamp: Date.now()
  });
  assertEqual(monitor.requestRecords.length, 1);
  passed++;
})) {} else { failed++; }

if (test('记录多个请求', () => {
  const monitor = new PerformanceMonitor();
  for (let i = 0; i < 10; i++) {
    monitor.recordRequest({
      path: '/api/test',
      method: 'GET',
      statusCode: 200,
      duration: 50,
      timestamp: Date.now()
    });
  }
  assertEqual(monitor.requestRecords.length, 10);
  passed++;
})) {} else { failed++; }

if (test('限制最大记录数', () => {
  const monitor = new PerformanceMonitor({ maxRequestRecords: 5 });
  for (let i = 0; i < 10; i++) {
    monitor.recordRequest({
      path: '/api/test',
      method: 'GET',
      statusCode: 200,
      duration: 50,
      timestamp: Date.now()
    });
  }
  assertEqual(monitor.requestRecords.length, 5);
  passed++;
})) {} else { failed++; }

console.log('\n📋 状态码分类测试\n');

if (test('状态码 2xx 分类', () => {
  const monitor = new PerformanceMonitor();
  monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: 50, timestamp: Date.now() });
  assertEqual(monitor.statusCodeCounts['2xx'], 1);
  passed++;
})) {} else { failed++; }

if (test('状态码 4xx 分类', () => {
  const monitor = new PerformanceMonitor();
  monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 404, duration: 50, timestamp: Date.now() });
  assertEqual(monitor.statusCodeCounts['4xx'], 1);
  passed++;
})) {} else { failed++; }

if (test('状态码 5xx 分类', () => {
  const monitor = new PerformanceMonitor();
  monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 500, duration: 50, timestamp: Date.now() });
  assertEqual(monitor.statusCodeCounts['5xx'], 1);
  passed++;
})) {} else { failed++; }

if (test('状态码 3xx 分类', () => {
  const monitor = new PerformanceMonitor();
  monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 301, duration: 50, timestamp: Date.now() });
  assertEqual(monitor.statusCodeCounts['3xx'], 1);
  passed++;
})) {} else { failed++; }

console.log('\n📋 HTTP 方法统计测试\n');

if (test('GET 方法计数', () => {
  const monitor = new PerformanceMonitor();
  monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: 50, timestamp: Date.now() });
  monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: 50, timestamp: Date.now() });
  assertEqual(monitor.methodCounts['GET'], 2);
  passed++;
})) {} else { failed++; }

if (test('POST 方法计数', () => {
  const monitor = new PerformanceMonitor();
  monitor.recordRequest({ path: '/api/test', method: 'POST', statusCode: 201, duration: 50, timestamp: Date.now() });
  assertEqual(monitor.methodCounts['POST'], 1);
  passed++;
})) {} else { failed++; }

if (test('路径访问统计', () => {
  const monitor = new PerformanceMonitor();
  monitor.recordRequest({ path: '/api/users', method: 'GET', statusCode: 200, duration: 50, timestamp: Date.now() });
  monitor.recordRequest({ path: '/api/users', method: 'GET', statusCode: 200, duration: 50, timestamp: Date.now() });
  monitor.recordRequest({ path: '/api/tasks', method: 'GET', statusCode: 200, duration: 50, timestamp: Date.now() });
  assertEqual(monitor.pathCounts['/api/users'], 2);
  assertEqual(monitor.pathCounts['/api/tasks'], 1);
  passed++;
})) {} else { failed++; }

console.log('\n📋 中间件测试\n');

if (test('创建中间件函数', () => {
  const monitor = new PerformanceMonitor();
  const middleware = monitor.createMiddleware();
  assert(typeof middleware === 'function', '中间件应该是一个函数');
  passed++;
})) {} else { failed++; }

if (test('中间件记录请求', () => {
  const monitor = new PerformanceMonitor();
  const middleware = monitor.createMiddleware();

  const req = { method: 'GET', url: '/api/test' };
  let recorded = false;
  const res = {
    statusCode: 200,
    end: function() { recorded = true; }
  };
  const next = function() {};

  middleware(req, res, next);
  res.end();
  assertEqual(monitor.requestRecords.length, 1);
  passed++;
})) {} else { failed++; }

console.log('\n📋 内存使用测试\n');

if (test('获取内存使用信息', () => {
  const monitor = new PerformanceMonitor();
  const mem = monitor.getMemoryUsage();
  assert(mem !== null, '内存信息应该被返回');
  assert(typeof mem.heapUsed === 'number', 'heapUsed 应该是数字');
  assert(typeof mem.heapTotal === 'number', 'heapTotal 应该是数字');
  assert(typeof mem.usagePercent === 'number', 'usagePercent 应该是数字');
  passed++;
})) {} else { failed++; }

console.log('\n📋 请求速率测试\n');

if (test('计算请求速率', () => {
  const monitor = new PerformanceMonitor();
  const now = Date.now();
  for (let i = 0; i < 60; i++) {
    monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: 50, timestamp: now - i * 1000 });
  }
  const rate = monitor.getRequestRate(60000);
  assertGreaterThan(rate.requestsPerMinute, 50);
  passed++;
})) {} else { failed++; }

if (test('空请求时请求速率为0', () => {
  const monitor = new PerformanceMonitor();
  const rate = monitor.getRequestRate(60000);
  assertEqual(rate.requests, 0);
  assertEqual(rate.requestsPerMinute, 0);
  passed++;
})) {} else { failed++; }

console.log('\n📋 错误率测试\n');

if (test('计算错误率', () => {
  const monitor = new PerformanceMonitor();
  const now = Date.now();
  for (let i = 0; i < 100; i++) {
    const status = i < 90 ? 200 : (i < 95 ? 404 : 500);
    monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: status, duration: 50, timestamp: now - i * 10 });
  }
  const errorRate = monitor.getErrorRate(60000);
  assertEqual(errorRate.totalRequests, 100);
  assertEqual(errorRate.errorCount, 10);
  passed++;
})) {} else { failed++; }

if (test('空请求时错误率为0', () => {
  const monitor = new PerformanceMonitor();
  const errorRate = monitor.getErrorRate(60000);
  assertEqual(errorRate.errorRate, 0);
  passed++;
})) {} else { failed++; }

console.log('\n📋 响应时间统计测试\n');

if (test('计算响应时间统计', () => {
  const monitor = new PerformanceMonitor();
  const now = Date.now();
  const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  for (const d of durations) {
    monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: d, timestamp: now });
  }
  const stats = monitor.getResponseTimeStats(60000);
  assertEqual(stats.count, 10);
  assertEqual(stats.min, 10);
  assertEqual(stats.max, 100);
  assertEqual(stats.avg, 55);
  passed++;
})) {} else { failed++; }

if (test('P50/P90/P99 计算', () => {
  const monitor = new PerformanceMonitor();
  const now = Date.now();
  for (let i = 1; i <= 100; i++) {
    monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: i, timestamp: now - i });
  }
  const stats = monitor.getResponseTimeStats(60000);
  assertGreaterThan(stats.p50, 45);
  assertLessThan(stats.p50, 55);
  assertGreaterThan(stats.p90, 85);
  assertLessThan(stats.p90, 95);
  assertGreaterThan(stats.p99, 95);
  passed++;
})) {} else { failed++; }

console.log('\n📋 慢请求检测测试\n');

if (test('检测慢请求', () => {
  const monitor = new PerformanceMonitor({ slowRequestThreshold: 100 });
  monitor.recordRequest({ path: '/api/fast', method: 'GET', statusCode: 200, duration: 50, timestamp: Date.now() });
  monitor.recordRequest({ path: '/api/slow', method: 'GET', statusCode: 200, duration: 200, timestamp: Date.now() });
  monitor.recordRequest({ path: '/api/medium', method: 'GET', statusCode: 200, duration: 150, timestamp: Date.now() });

  const slowRequests = monitor.getSlowRequests();
  assertEqual(slowRequests.length, 2);
  passed++;
})) {} else { failed++; }

if (test('自定义阈值检测慢请求', () => {
  const monitor = new PerformanceMonitor({ slowRequestThreshold: 100 });
  monitor.recordRequest({ path: '/api/medium', method: 'GET', statusCode: 200, duration: 150, timestamp: Date.now() });
  monitor.recordRequest({ path: '/api/slow', method: 'GET', statusCode: 200, duration: 250, timestamp: Date.now() });
  monitor.recordRequest({ path: '/api/fast', method: 'GET', statusCode: 200, duration: 50, timestamp: Date.now() });

  const slowRequests = monitor.getSlowRequests(200);
  assertEqual(slowRequests.length, 1);
  passed++;
})) { } else { failed++; }

console.log('\n📋 数据聚合测试\n');

if (test('按小时聚合数据', () => {
  const monitor = new PerformanceMonitor();
  const now = Date.now();
  const hour1 = new Date(now - 2 * 60 * 60 * 1000).getTime();
  const hour2 = new Date(now - 1 * 60 * 60 * 1000).getTime();
  const hour3 = now;

  monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: 50, timestamp: hour1 });
  monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: 60, timestamp: hour1 });
  monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 404, duration: 30, timestamp: hour2 });
  monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 500, duration: 100, timestamp: hour3 });

  const aggregated = monitor.aggregateByTimeUnit(monitor.requestRecords, 'hour');
  assert(aggregated.length >= 2, '应该有至少2个小时的数据');

  const hour1Data = aggregated.find(a => a.timestamp === new Date(hour1).setMinutes(0, 0, 0));
  if (hour1Data) {
    assertEqual(hour1Data.requests, 2);
    assertEqual(hour1Data.avgDuration, 55);
  }
  passed++;
})) { } else { failed++; }

if (test('按分钟聚合数据', () => {
  const monitor = new PerformanceMonitor();
  const now = Date.now();
  
  for (let i = 0; i < 5; i++) {
    monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: 50 + i * 10, timestamp: now - i * 60000 });
  }

  const aggregated = monitor.aggregateByTimeUnit(monitor.requestRecords, 'minute');
  assertGreaterThan(aggregated.length, 0);
  passed++;
})) { } else { failed++; }

if (test('按分钟聚合数据', () => {
  const monitor = new PerformanceMonitor();
  const now = Date.now();
  
  for (let i = 0; i < 5; i++) {
    monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: 50 + i * 10, timestamp: now - i * 60000 });
  }

  const aggregated = monitor.aggregateByTimeUnit(monitor.requestRecords, 'minute');
  assertGreaterThan(aggregated.length, 0);
  passed++;
})) { } else { failed++; }

console.log('\n📋 getMetrics 测试\n');

if (test('获取指标 - 默认1h', () => {
  const monitor = new PerformanceMonitor();
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: 50, timestamp: now - i * 1000 });
  }

  const metrics = monitor.getMetrics('1h');
  assert(metrics !== null);
  assertEqual(metrics.summary.totalRequests, 10);
  assertEqual(metrics.summary.timeRange, '1h');
  passed++;
})) { } else { failed++; }

if (test('获取指标 - 24h', () => {
  const monitor = new PerformanceMonitor();
  const metrics = monitor.getMetrics('24h');
  assertEqual(metrics.summary.timeRange, '24h');
  passed++;
})) { } else { failed++; }

if (test('获取指标 - 7d', () => {
  const monitor = new PerformanceMonitor();
  const metrics = monitor.getMetrics('7d');
  assertEqual(metrics.summary.timeRange, '7d');
  passed++;
})) { } else { failed++; }

if (test('获取指标包含聚合数据', () => {
  const monitor = new PerformanceMonitor();
  monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: 50, timestamp: Date.now() });

  const metrics = monitor.getMetrics('1h');
  assert(Array.isArray(metrics.aggregated.minute));
  assert(Array.isArray(metrics.aggregated.hour));
  assert(Array.isArray(metrics.aggregated.day));
  passed++;
})) { } else { failed++; }

console.log('\n📋 慢请求列表测试\n');

if (test('获取慢请求列表', () => {
  const monitor = new PerformanceMonitor({ slowRequestThreshold: 100 });
  const now = Date.now();
  monitor.recordRequest({ path: '/api/fast', method: 'GET', statusCode: 200, duration: 50, timestamp: now });
  monitor.recordRequest({ path: '/api/slow', method: 'GET', statusCode: 200, duration: 200, timestamp: now - 1000 });

  const slowRequests = monitor.getSlowRequestsList('1h', 10);
  assertEqual(slowRequests.length, 1);
  assertEqual(slowRequests[0].path, '/api/slow');
  passed++;
})) { } else { failed++; }

console.log('\n📋 摘要测试\n');

if (test('获取摘要信息', () => {
  const monitor = new PerformanceMonitor();
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: 50, timestamp: now - i * 1000 });
  }

  const summary = monitor.getSummary();
  assert(summary.uptime >= 0, 'uptime should be >= 0');
  assertEqual(summary.totalRequests, 5);
  passed++;
})) { } else { failed++; }

if (test('摘要包含内存信息', () => {
  const monitor = new PerformanceMonitor();
  const summary = monitor.getSummary();
  assert(typeof summary.memory === 'object');
  assert(typeof summary.memory.heapUsed === 'number');
  passed++;
})) { } else { failed++; }

console.log('\n📋 Top Paths 测试\n');

if (test('获取访问最多的路径', () => {
  const monitor = new PerformanceMonitor();
  const now = Date.now();
  monitor.recordRequest({ path: '/api/users', method: 'GET', statusCode: 200, duration: 50, timestamp: now });
  monitor.recordRequest({ path: '/api/users', method: 'GET', statusCode: 200, duration: 50, timestamp: now });
  monitor.recordRequest({ path: '/api/users', method: 'GET', statusCode: 200, duration: 50, timestamp: now });
  monitor.recordRequest({ path: '/api/tasks', method: 'GET', statusCode: 200, duration: 50, timestamp: now });
  monitor.recordRequest({ path: '/api/tasks', method: 'GET', statusCode: 200, duration: 50, timestamp: now });

  const topPaths = monitor.getTopPaths(10);
  assertEqual(topPaths[0].path, '/api/users');
  assertEqual(topPaths[0].count, 3);
  assertEqual(topPaths[1].path, '/api/tasks');
  assertEqual(topPaths[1].count, 2);
  passed++;
})) { } else { failed++; }

console.log('\n📋 重置测试\n');

if (test('重置监控数据', () => {
  const monitor = new PerformanceMonitor();
  monitor.recordRequest({ path: '/api/test', method: 'GET', statusCode: 200, duration: 50, timestamp: Date.now() });
  monitor.reset();
  assertEqual(monitor.requestRecords.length, 0);
  assertEqual(monitor.statusCodeCounts['2xx'], 0);
  assertEqual(monitor.methodCounts['GET'], 0);
  passed++;
})) { } else { failed++; }

console.log('\n📋 工厂函数测试\n');

if (test('createPerformanceMonitor 工厂函数', () => {
  const monitor = createPerformanceMonitor({ slowRequestThreshold: 2000 });
  assertEqual(monitor.slowRequestThreshold, 2000);
  passed++;
})) { } else { failed++; }

console.log('\n' + '='.repeat(50));
console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
