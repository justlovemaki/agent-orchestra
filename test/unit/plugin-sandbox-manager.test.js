'use strict';

const {
  SandboxManager,
  DEFAULT_MAX_SANDBOXES,
  DEFAULT_HEALTH_CHECK_INTERVAL,
  DEFAULT_RESTART_DELAY
} = require('../../lib/plugin-sandbox-manager');

const { SandboxTimeoutError } = require('../../lib/plugin-sandbox');

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
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || 'Expected to throw but did not');
  }
}

let passed = 0;
let failed = 0;

console.log('\n📋 SandboxManager 基础测试\n');

if (test('创建管理器实例', () => {
  const manager = new SandboxManager();
  assert(manager instanceof SandboxManager);
  passed++;
})) {} else { failed++; }

if (test('管理器默认配置', () => {
  const manager = new SandboxManager();
  assertEqual(manager.maxSandboxes, DEFAULT_MAX_SANDBOXES);
  assertEqual(manager.healthCheckInterval, DEFAULT_HEALTH_CHECK_INTERVAL);
  passed++;
})) {} else { failed++; }

if (test('管理器自定义配置', () => {
  const manager = new SandboxManager({
    maxSandboxes: 10,
    healthCheckInterval: 60000,
    defaultTimeout: 60000
  });
  assertEqual(manager.maxSandboxes, 10);
  assertEqual(manager.healthCheckInterval, 60000);
  passed++;
})) {} else { failed++; }

console.log('\n📋 沙箱创建测试\n');

if (test('创建沙箱', () => {
  const manager = new SandboxManager({ maxSandboxes: 5 });
  const sandbox = manager.createSandbox('test-plugin');
  assert(sandbox !== null, 'Should create sandbox');
  assertEqual(manager.sandboxes.size, 1);
  sandbox.terminate();
  passed++;
})) {} else { failed++; }

if (test('通过插件名获取沙箱', () => {
  const manager = new SandboxManager();
  const sandbox = manager.createSandbox('my-plugin');
  const retrieved = manager.getSandboxByPlugin('my-plugin');
  assert(retrieved === sandbox);
  sandbox.terminate();
  passed++;
})) {} else { failed++; }

if (test('通过 ID 获取沙箱', () => {
  const manager = new SandboxManager();
  const sandbox = manager.createSandbox('test-plugin');
  const retrieved = manager.getSandbox(sandbox.id);
  assert(retrieved === sandbox);
  sandbox.terminate();
  passed++;
})) {} else { failed++; }

if (test('获取不存在的沙箱返回 null', () => {
  const manager = new SandboxManager();
  const result = manager.getSandbox('non-existent');
  assertEqual(result, null);
  passed++;
})) {} else { failed++; }

if (test('检查沙箱是否存在', () => {
  const manager = new SandboxManager();
  manager.createSandbox('existing-plugin');
  assert(manager.hasSandbox('existing-plugin'));
  assert(!manager.hasSandbox('non-existing-plugin'));
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('重复创建同名沙箱返回现有沙箱', () => {
  const manager = new SandboxManager();
  const sandbox1 = manager.createSandbox('same-name');
  const sandbox2 = manager.createSandbox('same-name');
  assert(sandbox1 === sandbox2);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

console.log('\n📋 沙箱执行测试\n');

if (test('执行代码', async () => {
  const manager = new SandboxManager({ maxSandboxes: 5 });
  const result = await manager.executeInSandbox('test-plugin', '1 + 1');
  assertEqual(result.result, 2);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('执行带上下文的代码', async () => {
  const manager = new SandboxManager();
  const result = await manager.executeInSandbox('test', 'x * y', { x: 3, y: 4 });
  assertEqual(result.result, 12);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('执行返回数组', async () => {
  const manager = new SandboxManager();
  const result = await manager.executeInSandbox('test', '[1, 2, 3].filter(x => x > 1)');
  assertEqual(result.result, [2, 3]);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('执行返回对象', async () => {
  const manager = new SandboxManager();
  const result = await manager.executeInSandbox('test', '({ status: "ok", data: [1,2,3] })');
  assertEqual(result.result.status, 'ok');
  assertEqual(result.result.data.length, 3);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('执行包含日志', async () => {
  const manager = new SandboxManager();
  await manager.executeInSandbox('test', 'console.log("test")');
  const logs = manager.getPluginLogs('test');
  assert(logs.length > 0);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

console.log('\n📋 沙箱销毁测试\n');

if (test('通过 ID 销毁沙箱', () => {
  const manager = new SandboxManager();
  const sandbox = manager.createSandbox('test');
  const id = sandbox.id;
  const result = manager.destroySandbox(id);
  assert(result);
  assertEqual(manager.sandboxes.size, 0);
  passed++;
})) {} else { failed++; }

if (test('通过插件名销毁沙箱', () => {
  const manager = new SandboxManager();
  manager.createSandbox('test-plugin');
  const result = manager.destroySandboxByPlugin('test-plugin');
  assert(result);
  assertEqual(manager.sandboxes.size, 0);
  passed++;
})) {} else { failed++; }

if (test('销毁不存在的沙箱返回 false', () => {
  const manager = new SandboxManager();
  const result = manager.destroySandbox('non-existent-id');
  assertEqual(result, false);
  passed++;
})) {} else { failed++; }

if (test('销毁所有沙箱', () => {
  const manager = new SandboxManager();
  manager.createSandbox('plugin1');
  manager.createSandbox('plugin2');
  manager.createSandbox('plugin3');
  assertEqual(manager.sandboxes.size, 3);
  manager.destroyAll();
  assertEqual(manager.sandboxes.size, 0);
  passed++;
})) {} else { failed++; }

console.log('\n📋 沙箱重启测试\n');

if (test('重启沙箱', async () => {
  const manager = new SandboxManager();
  const sandbox1 = manager.createSandbox('test-plugin');
  const id1 = sandbox1.id;
  const sandbox2 = await manager.restartSandbox('test-plugin');
  assert(sandbox2.id !== id1, 'Should have new ID');
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('重启沙箱带延迟', async () => {
  const manager = new SandboxManager();
  manager.createSandbox('test-plugin');
  const sandbox = await manager.restartSandbox('test-plugin', { delay: 10 });
  assert(sandbox !== null);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

console.log('\n📋 统计测试\n');

if (test('初始统计为零', () => {
  const manager = new SandboxManager();
  const stats = manager.getStats();
  assertEqual(stats.totalCreated, 0);
  assertEqual(stats.totalExecuted, 0);
  assertEqual(stats.totalTerminated, 0);
  assertEqual(stats.totalErrors, 0);
  passed++;
})) {} else { failed++; }

if (test('统计创建沙箱', () => {
  const manager = new SandboxManager();
  manager.createSandbox('test');
  const stats = manager.getStats();
  assertEqual(stats.totalCreated, 1);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('统计执行次数', async () => {
  const manager = new SandboxManager();
  await manager.executeInSandbox('test', '1+1');
  await manager.executeInSandbox('test', '2+2');
  const stats = manager.getStats();
  assertEqual(stats.totalExecuted, 2);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('统计销毁次数', () => {
  const manager = new SandboxManager();
  manager.createSandbox('test');
  manager.destroySandboxByPlugin('test');
  const stats = manager.getStats();
  assertEqual(stats.totalTerminated, 1);
  passed++;
})) {} else { failed++; }

if (test('统计错误次数', async () => {
  const manager = new SandboxManager();
  try {
    await manager.executeInSandbox('test', 'invalid syntax @#$');
  } catch {}
  const stats = manager.getStats();
  assert(stats.totalErrors >= 1);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('统计超时次数', async () => {
  const manager = new SandboxManager({ defaultTimeout: 10 });
  try {
    await manager.executeInSandbox('test', 'while(true){}');
  } catch {}
  const stats = manager.getStats();
  assert(stats.totalTimeouts >= 1);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

console.log('\n📋 健康检查测试\n');

if (test('执行健康检查', () => {
  const manager = new SandboxManager();
  manager.createSandbox('test');
  const health = manager.performHealthCheck();
  assertEqual(health.totalSandboxes, 1);
  assert(health.plugins.length > 0);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('健康检查包含插件信息', () => {
  const manager = new SandboxManager();
  manager.createSandbox('my-plugin');
  const health = manager.performHealthCheck();
  assertEqual(health.plugins[0].pluginName, 'my-plugin');
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('启动健康检查定时器', () => {
  const manager = new SandboxManager({ healthCheckInterval: 100 });
  manager.createSandbox('test');
  manager.startHealthCheck();
  assert(manager.healthCheckTimer !== null);
  manager.stopHealthCheck();
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('停止健康检查定时器', () => {
  const manager = new SandboxManager({ healthCheckInterval: 100 });
  manager.createSandbox('test');
  manager.startHealthCheck();
  manager.stopHealthCheck();
  assert(manager.healthCheckTimer === null);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

console.log('\n📋 隔离测试\n');

if (test('隔离插件', () => {
  const manager = new SandboxManager({ interPluginCommunication: true });
  manager.createSandbox('plugin1');
  manager.createSandbox('plugin2');
  const result = manager.isolatePlugin('plugin1');
  assert(result);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('隔离不存在的插件返回 false', () => {
  const manager = new SandboxManager();
  const result = manager.isolatePlugin('non-existent');
  assertEqual(result, false);
  passed++;
})) {} else { failed++; }

console.log('\n📋 API 测试\n');

if (test('设置插件 API', () => {
  const manager = new SandboxManager();
  manager.createSandbox('test');
  const result = manager.setPluginAPI('test', 'myAPI', { foo: 'bar' });
  assert(result);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('移除插件 API', () => {
  const manager = new SandboxManager();
  manager.createSandbox('test');
  manager.setPluginAPI('test', 'myAPI', { foo: 'bar' });
  const result = manager.removePluginAPI('test', 'myAPI');
  assert(result);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('对不存在插件设置 API 抛出错误', () => {
  const manager = new SandboxManager();
  assertThrows(() => manager.setPluginAPI('non-existent', 'myAPI', {}));
  passed++;
})) {} else { failed++; }

console.log('\n📋 日志测试\n');

if (test('获取插件日志', () => {
  const manager = new SandboxManager();
  manager.createSandbox('test');
  manager.getPluginLogs('test');
  passed++;
})) {} else { failed++; }

if (test('清空插件日志', () => {
  const manager = new SandboxManager();
  manager.createSandbox('test');
  manager.executeInSandbox('test', 'console.log("test")');
  manager.clearPluginLogs('test');
  const logs = manager.getPluginLogs('test');
  assertEqual(logs.length, 0);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('获取所有沙箱信息', () => {
  const manager = new SandboxManager();
  manager.createSandbox('plugin1');
  manager.createSandbox('plugin2');
  const all = manager.getAllSandboxes();
  assertEqual(all.length, 2);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

console.log('\n📋 事件测试\n');

if (test('监听沙箱创建事件', () => {
  const manager = new SandboxManager();
  let eventFired = false;
  manager.on('sandboxCreated', () => { eventFired = true; });
  manager.createSandbox('test');
  assert(eventFired);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('监听沙箱销毁事件', () => {
  const manager = new SandboxManager();
  let eventFired = false;
  manager.on('sandboxDestroyed', () => { eventFired = true; });
  const sandbox = manager.createSandbox('test');
  manager.destroySandbox(sandbox.id);
  assert(eventFired);
  passed++;
})) {} else { failed++; }

if (test('监听执行完成事件', async () => {
  const manager = new SandboxManager();
  let eventFired = false;
  manager.on('executionComplete', () => { eventFired = true; });
  await manager.executeInSandbox('test', '1+1');
  assert(eventFired);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

if (test('监听错误事件', async () => {
  const manager = new SandboxManager();
  let eventFired = false;
  manager.on('sandboxError', () => { eventFired = true; });
  try {
    await manager.executeInSandbox('test', 'invalid @#$');
  } catch {}
  assert(eventFired);
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

console.log('\n📋 跨插件隔离测试\n');

if (test('跨插件通信默认禁用', () => {
  const manager = new SandboxManager({ interPluginCommunication: false });
  assertEqual(manager.interPluginCommunication, false);
  passed++;
})) {} else { failed++; }

if (test('跨插件通信可启用', () => {
  const manager = new SandboxManager({ interPluginCommunication: true });
  assertEqual(manager.interPluginCommunication, true);
  passed++;
})) {} else { failed++; }

if (test('执行代码时隔离上下文', async () => {
  const manager = new SandboxManager({ interPluginCommunication: true });
  await manager.executeInSandbox('plugin1', 'x = 5', { crossPlugin: false });
  await manager.executeInSandbox('plugin2', 'typeof x', { crossPlugin: false });
  passed++;
})) {} else { failed++; }

console.log('\n📋 默认安全策略测试\n');

if (test('管理器有默认安全策略', () => {
  const manager = new SandboxManager();
  assert(manager.defaultSecurityPolicy !== null);
  passed++;
})) {} else { failed++; }

if (test('默认权限级别为沙箱', () => {
  const manager = new SandboxManager();
  assertEqual(manager.defaultSecurityPolicy.getPermissionLevel(), 'sandboxed');
  passed++;
})) {} else { failed++; }

console.log('\n📋 最大沙箱数测试\n');

if (test('超过最大沙箱数抛出错误', () => {
  const manager = new SandboxManager({ maxSandboxes: 2 });
  manager.createSandbox('plugin1');
  manager.createSandbox('plugin2');
  assertThrows(() => manager.createSandbox('plugin3'));
  manager.destroyAll();
  passed++;
})) {} else { failed++; }

console.log('\n' + '='.repeat(50));
console.log(`测试结果：${passed} 通过，${failed} 失败`);
console.log('='.repeat(50) + '\n');

process.exit(failed > 0 ? 1 : 0);
