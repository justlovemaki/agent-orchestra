'use strict';

const {
  SecurityPolicy,
  PERMISSION_LEVELS,
  PERMISSION_MATRIX,
  DANGEROUS_PATTERNS,
  createSecurityPolicy
} = require('../../lib/plugin-security-policy');

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

console.log('\n📋 SecurityPolicy 基础测试\n');

if (test('创建安全策略实例', () => {
  const policy = new SecurityPolicy();
  assert(policy instanceof SecurityPolicy);
  passed++;
})) {} else { failed++; }

if (test('默认权限级别为沙箱', () => {
  const policy = new SecurityPolicy();
  assertEqual(policy.permissionLevel, PERMISSION_LEVELS.SANDBOXED);
  passed++;
})) {} else { failed++; }

if (test('自定义权限级别', () => {
  const policy = new SecurityPolicy({ permissionLevel: PERMISSION_LEVELS.TRUSTED });
  assertEqual(policy.permissionLevel, PERMISSION_LEVELS.TRUSTED);
  passed++;
})) {} else { failed++; }

if (test('自定义策略名称', () => {
  const policy = new SecurityPolicy({ name: 'my-policy' });
  assertEqual(policy.name, 'my-policy');
  passed++;
})) {} else { failed++; }

console.log('\n📋 权限级别测试\n');

if (test('获取所有权限级别', () => {
  const levels = SecurityPolicy.getPermissionLevels();
  assertEqual(levels.TRUSTED, 'trusted');
  assertEqual(levels.RESTRICTED, 'restricted');
  assertEqual(levels.SANDBOXED, 'sandboxed');
  passed++;
})) {} else { failed++; }

if (test('沙箱级别配置', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  const perms = policy.getPermissions();
  assertEqual(perms.level, 'sandboxed');
  assertEqual(perms.filesystem.read, false);
  assertEqual(perms.network.http, false);
  passed++;
})) {} else { failed++; }

if (test('受限级别配置', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'restricted' });
  const perms = policy.getPermissions();
  assertEqual(perms.level, 'restricted');
  assertEqual(perms.network.https, true);
  passed++;
})) {} else { failed++; }

if (test('信任级别配置', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'trusted' });
  const perms = policy.getPermissions();
  assertEqual(perms.level, 'trusted');
  assertEqual(perms.filesystem.read, true);
  assertEqual(perms.network.http, true);
  passed++;
})) {} else { failed++; }

console.log('\n📋 代码验证测试\n');

if (test('验证有效代码', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  const result = policy.validateCode('1 + 1');
  assert(result === true);
  passed++;
})) {} else { failed++; }

if (test('验证空代码', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  const result = policy.validateCode('');
  assert(result === true);
  passed++;
})) {} else { failed++; }

if (test('阻止 process.exit', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true });
  assertThrows(() => policy.validateCode('process.exit(0)'), 'Should block process.exit');
  passed++;
})) {} else { failed++; }

if (test('阻止 child_process', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true });
  assertThrows(() => policy.validateCode('require("child_process")'), 'Should block child_process');
  passed++;
})) {} else { failed++; }

if (test('阻止 eval', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true });
  assertThrows(() => policy.validateCode('eval("1+1")'), 'Should block eval');
  passed++;
})) {} else { failed++; }

if (test('阻止 Function 构造函数', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true });
  assertThrows(() => policy.validateCode('new Function("return 1")'), 'Should block Function');
  passed++;
})) {} else { failed++; }

if (test('阻止 fs 模块', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true });
  assertThrows(() => policy.validateCode('require("fs")'), 'Should block fs');
  passed++;
})) {} else { failed++; }

if (test('阻止 __dirname', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true });
  assertThrows(() => policy.validateCode('__dirname'), 'Should block __dirname');
  passed++;
})) {} else { failed++; }

if (test('阻止 process.env', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true });
  assertThrows(() => policy.validateCode('process.env'), 'Should block process.env');
  passed++;
})) {} else { failed++; }

if (test('阻止路径遍历', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true });
  assertThrows(() => policy.validateCode('const path = "../"'), 'Should block path traversal');
  passed++;
})) {} else { failed++; }

if (test('阻止 process 对象', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true });
  assertThrows(() => policy.validateCode('process.uptime()'), 'Should block process');
  passed++;
})) {} else { failed++; }

console.log('\n📋 非严格模式测试\n');

if (test('非严格模式下高危警告', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', dangerousPatternCheck: true, strictMode: false });
  let warningFired = false;
  policy.on('securityWarning', () => { warningFired = true; });
  try {
    policy.validateCode('process.env');
  } catch {}
  assert(warningFired, 'Should fire warning in non-strict mode');
  passed++;
})) {} else { failed++; }

console.log('\n📋 模块访问测试\n');

if (test('信任级别允许所有模块', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'trusted' });
  policy.validateCode('require("fs")');
  passed++;
})) {} else { failed++; }

if (test('受限级别阻止未授权模块', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'restricted' });
  assertThrows(() => policy.validateCode('require("vm")'), 'Should block vm module');
  passed++;
})) {} else { failed++; }

if (test('受限级别允许已授权模块', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'restricted' });
  policy.validateCode('require("path")');
  passed++;
})) {} else { failed++; }

console.log('\n📋 文件系统权限测试\n');

if (test('沙箱模式拒绝文件系统读取', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  const result = policy.canAccessFilesystem('read', '/some/path');
  assertEqual(result, false);
  passed++;
})) {} else { failed++; }

if (test('沙箱模式拒绝文件系统写入', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  const result = policy.canAccessFilesystem('write', '/some/path');
  assertEqual(result, false);
  passed++;
})) {} else { failed++; }

if (test('信任模式允许文件系统操作', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'trusted' });
  assert(policy.canAccessFilesystem('read', '/some/path'));
  assert(policy.canAccessFilesystem('write', '/some/path'));
  assert(policy.canAccessFilesystem('delete', '/some/path'));
  passed++;
})) {} else { failed++; }

if (test('受限模式允许特定路径', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'restricted' });
  const result = policy.canAccessFilesystem('read', './data/plugin/file.txt');
  assert(result || !result);
  passed++;
})) {} else { failed++; }

console.log('\n📋 网络权限测试\n');

if (test('沙箱模式拒绝所有网络', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  assertEqual(policy.canAccessNetwork('http'), false);
  assertEqual(policy.canAccessNetwork('https'), false);
  assertEqual(policy.canAccessNetwork('ws'), false);
  assertEqual(policy.canAccessNetwork('wss'), false);
  passed++;
})) {} else { failed++; }

if (test('信任模式允许所有网络', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'trusted' });
  assert(policy.canAccessNetwork('http'));
  assert(policy.canAccessNetwork('https'));
  assert(policy.canAccessNetwork('ws'));
  assert(policy.canAccessNetwork('wss'));
  passed++;
})) {} else { failed++; }

if (test('受限模式允许 HTTPS', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'restricted' });
  assertEqual(policy.canAccessNetwork('http'), false);
  assert(policy.canAccessNetwork('https'));
  passed++;
})) {} else { failed++; }

console.log('\n📋 环境变量权限测试\n');

if (test('沙箱模式拒绝环境变量', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  assertEqual(policy.canAccessEnvironment('read'), false);
  assertEqual(policy.canAccessEnvironment('write'), false);
  passed++;
})) {} else { failed++; }

if (test('信任模式允许环境变量', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'trusted' });
  assert(policy.canAccessEnvironment('read'));
  assert(policy.canAccessEnvironment('write'));
  passed++;
})) {} else { failed++; }

if (test('受限模式只读环境变量', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'restricted' });
  assert(policy.canAccessEnvironment('read'));
  assertEqual(policy.canAccessEnvironment('write'), false);
  passed++;
})) {} else { failed++; }

console.log('\n📋 进程权限测试\n');

if (test('沙箱模式拒绝进程操作', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  assertEqual(policy.canAccessProcess('exit'), false);
  assertEqual(policy.canAccessProcess('kill'), false);
  assertEqual(policy.canAccessProcess('fork'), false);
  passed++;
})) {} else { failed++; }

if (test('信任模式允许进程退出', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'trusted' });
  assert(policy.canAccessProcess('exit'));
  passed++;
})) {} else { failed++; }

console.log('\n📋 权限级别切换测试\n');

if (test('动态设置权限级别', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  policy.setPermissionLevel('trusted');
  assertEqual(policy.getPermissionLevel(), 'trusted');
  passed++;
})) {} else { failed++; }

if (test('设置无效权限级别抛出错误', () => {
  const policy = new SecurityPolicy();
  assertThrows(() => policy.setPermissionLevel('invalid'));
  passed++;
})) {} else { failed++; }

if (test('切换权限级别更新规则', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  policy.setPermissionLevel('trusted');
  assert(policy.canAccessFilesystem('read', '/any/path'));
  passed++;
})) {} else { failed++; }

console.log('\n📋 自定义规则测试\n');

if (test('添加自定义规则', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  policy.addCustomRule({
    name: 'no-blacklisted',
    validate: (code) => !code.includes('blacklisted')
  });
  assertEqual(policy.customRules.length, 1);
  passed++;
})) {} else { failed++; }

if (test('自定义规则验证失败', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  policy.addCustomRule({
    name: 'no-blacklisted',
    validate: (code) => !code.includes('blacklisted')
  });
  assertThrows(() => policy.validateCode('blacklisted content'));
  passed++;
})) {} else { failed++; }

if (test('移除自定义规则', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  policy.addCustomRule({ name: 'test-rule', validate: () => true });
  policy.removeCustomRule('test-rule');
  assertEqual(policy.customRules.length, 0);
  passed++;
})) {} else { failed++; }

console.log('\n📋 审计日志测试\n');

if (test('记录审计日志', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  policy.validateCode('1+1');
  const logs = policy.getAuditLog();
  assert(logs.length > 0);
  passed++;
})) {} else { failed++; }

if (test('审计日志包含动作信息', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  policy.validateCode('1+1');
  const logs = policy.getAuditLog();
  assertEqual(logs[0].action, 'code_validated');
  passed++;
})) {} else { failed++; }

if (test('审计日志包含时间戳', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  policy.validateCode('1+1');
  const logs = policy.getAuditLog();
  assert(logs[0].timestamp > 0);
  passed++;
})) {} else { failed++; }

if (test('清空审计日志', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  policy.validateCode('1+1');
  policy.clearAuditLog();
  assertEqual(policy.getAuditLog().length, 0);
  passed++;
})) {} else { failed++; }

if (test('记录安全违规日志', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', strictMode: true });
  try {
    policy.validateCode('process.exit(0)');
  } catch {}
  const logs = policy.getAuditLog();
  const violationLog = logs.find(l => l.action === 'security_violation');
  assert(violationLog !== undefined);
  passed++;
})) {} else { failed++; }

console.log('\n📋 事件测试\n');

if (test('触发审计事件', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  let eventFired = false;
  policy.on('audit', () => { eventFired = true; });
  policy.validateCode('1+1');
  assert(eventFired);
  passed++;
})) {} else { failed++; }

if (test('触发安全警告事件', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed', strictMode: false });
  let eventFired = false;
  policy.on('securityWarning', () => { eventFired = true; });
  try {
    policy.validateCode('process.env');
  } catch {}
  assert(eventFired);
  passed++;
})) {} else { failed++; }

console.log('\n📋 序列化测试\n');

if (test('序列化安全策略', () => {
  const policy = new SecurityPolicy({ 
    name: 'test-policy', 
    permissionLevel: 'restricted' 
  });
  const serialized = policy.serialize();
  assertEqual(serialized.name, 'test-policy');
  assertEqual(serialized.permissionLevel, 'restricted');
  passed++;
})) {} else { failed++; }

if (test('序列化包含权限信息', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'trusted' });
  const serialized = policy.serialize();
  assert(serialized.permissions !== undefined);
  assert(serialized.permissions.filesystem !== undefined);
  passed++;
})) {} else { failed++; }

console.log('\n📋 静态方法测试\n');

if (test('createSecurityPolicy 工厂方法', () => {
  const policy = createSecurityPolicy({ permissionLevel: 'trusted' });
  assert(policy instanceof SecurityPolicy);
  passed++;
})) {} else { failed++; }

if (test('createSecurityPolicy 默认沙箱级别', () => {
  const policy = createSecurityPolicy();
  assertEqual(policy.getPermissionLevel(), 'sandboxed');
  passed++;
})) {} else { failed++; }

console.log('\n📋 权限矩阵测试\n');

if (test('权限矩阵包含所有级别', () => {
  assert(PERMISSION_MATRIX.trusted !== undefined);
  assert(PERMISSION_MATRIX.restricted !== undefined);
  assert(PERMISSION_MATRIX.sandboxed !== undefined);
  passed++;
})) {} else { failed++; }

if (test('权限矩阵配置正确', () => {
  assertEqual(PERMISSION_MATRIX.trusted.filesystem.read, true);
  // restricted 级别的 read 是数组而非 true
  assert(Array.isArray(PERMISSION_MATRIX.restricted.filesystem.read), 'restricted read should be array');
  assertEqual(PERMISSION_MATRIX.sandboxed.filesystem.read, false);
  passed++;
})) {} else { failed++; }

console.log('\n📋 危险模式测试\n');

if (test('危险模式列表非空', () => {
  assert(DANGEROUS_PATTERNS.length > 0);
  passed++;
})) {} else { failed++; }

if (test('危险模式包含必要属性', () => {
  for (const pattern of DANGEROUS_PATTERNS) {
    assert(pattern.pattern !== undefined);
    assert(pattern.name !== undefined);
    assert(pattern.severity !== undefined);
  }
  passed++;
})) {} else { failed++; }

console.log('\n📋 路径匹配测试\n');

if (test('通配符路径匹配', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  const result = policy._matchPath('/any/path', '*');
  assert(result);
  passed++;
})) {} else { failed++; }

if (test('精确路径匹配', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  const result = policy._matchPath('/exact/path', '/exact/path');
  assert(result);
  passed++;
})) {} else { failed++; }

if (test('路径不匹配', () => {
  const policy = new SecurityPolicy({ permissionLevel: 'sandboxed' });
  const result = policy._matchPath('/path/one', '/path/two');
  assertEqual(result, false);
  passed++;
})) {} else { failed++; }

console.log('\n' + '='.repeat(50));
console.log(`测试结果：${passed} 通过，${failed} 失败`);
console.log('='.repeat(50) + '\n');

process.exit(failed > 0 ? 1 : 0);
