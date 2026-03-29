'use strict';

const {
  PluginSandbox,
  SandboxTimeoutError,
  SandboxMemoryError,
  SandboxCPULimitError,
  SandboxAccessDeniedError,
  DEFAULT_API_WHITELIST,
  createSafeGlobal,
  createSafeConsole,
  SANDBOX_TIMEOUT_DEFAULT,
  SANDBOX_MEMORY_LIMIT_DEFAULT,
  SANDBOX_CPU_LIMIT_DEFAULT
} = require('../../lib/plugin-sandbox');

const { SecurityPolicy } = require('../../lib/plugin-security-policy');

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
  let error = null;
  try {
    fn();
  } catch (e) {
    threw = true;
    error = e;
  }
  if (!threw) {
    throw new Error(message || 'Expected to throw but did not');
  }
  return error;
}

let passed = 0;
let failed = 0;

console.log('\n📋 PluginSandbox 基础测试\n');

if (test('创建沙箱实例', () => {
  const sandbox = new PluginSandbox({ pluginName: 'test-plugin' });
  assert(sandbox.id.length > 0, 'Sandbox should have an ID');
  assertEqual(sandbox.pluginName, 'test-plugin');
  passed++;
})) {} else { failed++; }

if (test('沙箱默认配置', () => {
  const sandbox = new PluginSandbox({ pluginName: 'test' });
  assertEqual(sandbox.timeout, SANDBOX_TIMEOUT_DEFAULT);
  assertEqual(sandbox.memoryLimit, SANDBOX_MEMORY_LIMIT_DEFAULT);
  assertEqual(sandbox.cpuLimit, SANDBOX_CPU_LIMIT_DEFAULT);
  passed++;
})) {} else { failed++; }

if (test('沙箱自定义配置', () => {
  const sandbox = new PluginSandbox({
    pluginName: 'custom',
    timeout: 60000,
    memoryLimit: 256 * 1024 * 1024,
    cpuLimit: 10000
  });
  assertEqual(sandbox.timeout, 60000);
  assertEqual(sandbox.memoryLimit, 256 * 1024 * 1024);
  assertEqual(sandbox.cpuLimit, 10000);
  passed++;
})) {} else { failed++; }

if (test('初始化沙箱', () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  assert(sandbox.executionContext !== null, 'Should have execution context');
  passed++;
})) {} else { failed++; }

if (test('执行简单代码', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const result = await sandbox.execute('1 + 1');
  assertEqual(result.result, 2);
  passed++;
})) {} else { failed++; }

if (test('执行返回对象', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const result = await sandbox.execute('{ foo: "bar" }');
  assertEqual(result.result.foo, 'bar');
  passed++;
})) {} else { failed++; }

if (test('执行带上下文的代码', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const result = await sandbox.execute('x * 2', { x: 5 });
  assertEqual(result.result, 10);
  passed++;
})) {} else { failed++; }

if (test('执行数组操作', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const result = await sandbox.execute('[1, 2, 3].map(x => x * 2)');
  assertEqual(result.result, [2, 4, 6]);
  passed++;
})) {} else { failed++; }

if (test('执行字符串操作', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const result = await sandbox.execute('"hello".toUpperCase()');
  assertEqual(result.result, 'HELLO');
  passed++;
})) {} else { failed++; }

if (test('执行 Math 对象', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const result = await sandbox.execute('Math.max(1, 2, 3)');
  assertEqual(result.result, 3);
  passed++;
})) {} else { failed++; }

if (test('执行 JSON 操作', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const result = await sandbox.execute('JSON.stringify({ a: 1 })');
  assertEqual(result.result, '{"a":1}');
  passed++;
})) {} else { failed++; }

if (test('执行 Promise (async)', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const result = await sandbox.execute('Promise.resolve(42)');
  assertEqual(result.result, 42);
  passed++;
})) {} else { failed++; }

console.log('\n📋 API 限制测试\n');

if (test('阻止 process.exit', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true });
  sandbox.securityPolicy = policy;
  
  assertThrows(() => sandbox.execute('process.exit(0)'), 'Should block process.exit');
  passed++;
})) {} else { failed++; }

if (test('阻止 eval', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true });
  sandbox.securityPolicy = policy;
  
  assertThrows(() => sandbox.execute('eval("1+1")'), 'Should block eval');
  passed++;
})) {} else { failed++; }

if (test('阻止 child_process', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true });
  sandbox.securityPolicy = policy;
  
  assertThrows(() => sandbox.execute('require("child_process")'), 'Should block child_process');
  passed++;
})) {} else { failed++; }

if (test('阻止 __dirname', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true });
  sandbox.securityPolicy = policy;
  
  assertThrows(() => sandbox.execute('__dirname'), 'Should block __dirname');
  passed++;
})) {} else { failed++; }

console.log('\n📋 超时测试\n');

if (test('执行超时', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false, timeout: 100 });
  sandbox.initialize();
  
  try {
    await sandbox.execute('while(true) {}');
    throw new Error('Should have timed out');
  } catch (error) {
    assert(error instanceof SandboxTimeoutError || error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT', 'Should be timeout error');
  }
  passed++;
})) {} else { failed++; }

if (test('执行超时返回 SandboxTimeoutError', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false, timeout: 50 });
  sandbox.initialize();
  
  let error = null;
  try {
    await sandbox.execute('setTimeout(() => {}, 10000)');
  } catch (e) {
    error = e;
  }
  
  assert(error !== null, 'Should throw an error');
  passed++;
})) {} else { failed++; }

console.log('\n📋 日志测试\n');

if (test('添加日志', () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  const log = sandbox.addLog('info', 'Test message', { data: 'test' });
  assertEqual(log.level, 'info');
  assertEqual(log.message, 'Test message');
  passed++;
})) {} else { failed++; }

if (test('获取日志', () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.addLog('info', 'Message 1');
  sandbox.addLog('warn', 'Message 2');
  const logs = sandbox.getLogs();
  assertEqual(logs.length, 2);
  passed++;
})) {} else { failed++; }

if (test('清空日志', () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.addLog('info', 'Message');
  sandbox.clearLogs();
  assertEqual(sandbox.logs.length, 0);
  passed++;
})) {} else { failed++; }

console.log('\n📋 健康检查测试\n');

if (test('获取健康状态', () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  const health = sandbox.getHealth();
  assertEqual(health.pluginName, 'test');
  assert(health.hasOwnProperty('isRunning'), 'Should have isRunning');
  assert(health.hasOwnProperty('uptime'), 'Should have uptime');
  passed++;
})) {} else { failed++; }

if (test('健康检查包含资源限制', () => {
  const sandbox = new PluginSandbox({ 
    pluginName: 'test', 
    useWorkerThreads: false,
    timeout: 30000,
    memoryLimit: 128 * 1024 * 1024
  });
  const health = sandbox.getHealth();
  assertEqual(health.timeout, 30000);
  assertEqual(health.memoryLimit, 128 * 1024 * 1024);
  passed++;
})) {} else { failed++; }

console.log('\n📋 终止测试\n');

if (test('终止沙箱', () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  sandbox.terminate();
  assert(!sandbox.isRunning, 'Should not be running after terminate');
  passed++;
})) {} else { failed++; }

if (test('终止时清空计时器', () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false, timeout: 10000 });
  sandbox.initialize();
  sandbox.terminate();
  assert(sandbox.timeoutTimer === null, 'Timer should be cleared');
  passed++;
})) {} else { failed++; }

console.log('\n📋 静态方法测试\n');

if (test('create 静态方法', () => {
  const sandbox = PluginSandbox.create({ pluginName: 'test' });
  assert(sandbox instanceof PluginSandbox);
  sandbox.terminate();
  passed++;
})) {} else { failed++; }

console.log('\n📋 API 白名单测试\n');

if (test('默认白名单包含 console', () => {
  assert(DEFAULT_API_WHITELIST.console.length > 0, 'Should have console methods');
  passed++;
})) {} else { failed++; }

if (test('自定义 API 白名单', () => {
  const sandbox = new PluginSandbox({
    pluginName: 'test',
    useWorkerThreads: false,
    apiWhitelist: {
      console: ['log', 'error'],
      JSON: ['stringify', 'parse']
    }
  });
  sandbox.initialize();
  assert(sandbox.apiWhitelist.console.length === 2);
  passed++;
})) {} else { failed++; }

console.log('\n📋 自定义 API 测试\n');

if (test('添加自定义 API', async () => {
  const sandbox = new PluginSandbox({
    pluginName: 'test',
    useWorkerThreads: false,
    customAPI: {
      myAPI: {
        greet: () => 'Hello'
      }
    }
  });
  sandbox.initialize();
  const result = await sandbox.execute('myAPI.greet()');
  assertEqual(result.result, 'Hello');
  passed++;
})) {} else { failed++; }

if (test('自定义 API 传参', async () => {
  const sandbox = new PluginSandbox({
    pluginName: 'test',
    useWorkerThreads: false,
    customAPI: {
      myAPI: {
        add: (a, b) => a + b
      }
    }
  });
  sandbox.initialize();
  const result = await sandbox.execute('myAPI.add(2, 3)');
  assertEqual(result.result, 5);
  passed++;
})) {} else { failed++; }

console.log('\n📋 错误处理测试\n');

if (test('执行无效代码抛出错误', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  
  let error = null;
  try {
    await sandbox.execute('invalid syntax here @#$');
  } catch (e) {
    error = e;
  }
  
  assert(error !== null, 'Should throw syntax error');
  passed++;
})) {} else { failed++; }

if (test('重复执行抛出错误', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  sandbox.isRunning = true;
  
  let error = null;
  try {
    await sandbox.execute('1+1');
  } catch (e) {
    error = e;
  }
  
  assert(error !== null, 'Should throw error for already running');
  passed++;
})) {} else { failed++; }

console.log('\n📋 createSafeGlobal 测试\n');

if (test('createSafeGlobal 包含基本对象', () => {
  const safeGlobal = createSafeGlobal(DEFAULT_API_WHITELIST, {});
  assert(typeof safeGlobal.console === 'object');
  assert(typeof safeGlobal.JSON === 'object');
  assert(typeof safeGlobal.Math === 'object');
  passed++;
})) {} else { failed++; }

if (test('createSafeGlobal 阻止不安全访问', () => {
  const safeGlobal = createSafeGlobal(DEFAULT_API_WHITELIST, {});
  assert(safeGlobal.process === undefined);
  assert(safeGlobal.global === safeGlobal);
  passed++;
})) {} else { failed++; }

console.log('\n📋 SafeConsole 测试\n');

if (test('createSafeConsole 记录日志', () => {
  const safeConsole = createSafeConsole();
  safeConsole.log('test message');
  const logs = safeConsole._getLogs();
  assertEqual(logs.length, 1);
  assertEqual(logs[0].level, 'log');
  passed++;
})) {} else { failed++; }

if (test('safeConsole 清空日志', () => {
  const safeConsole = createSafeConsole();
  safeConsole.log('test');
  safeConsole._clearLogs();
  assertEqual(safeConsole._getLogs().length, 0);
  passed++;
})) {} else { failed++; }

console.log('\n📋 执行时间测试\n');

if (test('返回执行时间', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const result = await sandbox.execute('1+1');
  assert(result.executionTime >= 0, 'Should have execution time');
  passed++;
})) {} else { failed++; }

if (test('快速执行', async () => {
  const sandbox = new PluginSandbox({ pluginName: 'test', useWorkerThreads: false });
  sandbox.initialize();
  const start = Date.now();
  await sandbox.execute('1+1');
  const duration = Date.now() - start;
  assert(duration < 1000, 'Should execute quickly');
  passed++;
})) {} else { failed++; }

console.log('\n📋 错误类型测试\n');

if (test('SandboxTimeoutError', () => {
  const error = new SandboxTimeoutError('Test timeout');
  assertEqual(error.name, 'SandboxTimeoutError');
  assertEqual(error.code, 'SANDBOX_TIMEOUT');
  passed++;
})) {} else { failed++; }

if (test('SandboxMemoryError', () => {
  const error = new SandboxMemoryError('Memory exceeded');
  assertEqual(error.name, 'SandboxMemoryError');
  assertEqual(error.code, 'SANDBOX_MEMORY_LIMIT');
  passed++;
})) {} else { failed++; }

if (test('SandboxCPULimitError', () => {
  const error = new SandboxCPULimitError('CPU exceeded');
  assertEqual(error.name, 'SandboxCPULimitError');
  assertEqual(error.code, 'SANDBOX_CPU_LIMIT');
  passed++;
})) {} else { failed++; }

if (test('SandboxAccessDeniedError', () => {
  const error = new SandboxAccessDeniedError('Access denied');
  assertEqual(error.name, 'SandboxAccessDeniedError');
  assertEqual(error.code, 'SANDBOX_ACCESS_DENIED');
  passed++;
})) {} else { failed++; }

console.log('\n' + '='.repeat(50));
console.log(`测试结果：${passed} 通过，${failed} 失败`);
console.log('='.repeat(50) + '\n');

process.exit(failed > 0 ? 1 : 0);
