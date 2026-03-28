/**
 * Plugin Installer and Update Notifier Tests
 */

const PluginInstaller = require('../../lib/plugin-installer');
const PluginUpdateNotifier = require('../../lib/plugin-update-notifier');
const path = require('path');
const fs = require('fs').promises;

const TEST_PLUGINS_DIR = path.join(__dirname, '../../data/test-plugins-installer');
const TEST_TEMP_DIR = path.join(__dirname, '../../data/test-temp-installer');

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
    return true;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   错误：${error.message}`);
    failed++;
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

async function assertThrowsAsync(fn, message) {
  let threw = false;
  try {
    await fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || '期望抛出异常但未抛出');
  }
}

async function setup() {
  await fs.mkdir(TEST_PLUGINS_DIR, { recursive: true });
  await fs.mkdir(TEST_TEMP_DIR, { recursive: true });
}

async function cleanup() {
  try {
    await fs.rm(TEST_PLUGINS_DIR, { recursive: true, force: true });
    await fs.rm(TEST_TEMP_DIR, { recursive: true, force: true });
  } catch {}
}

let passed = 0;
let failed = 0;

async function runTests() {
  await setup();

  console.log('\n📋 PluginInstaller 基础测试\n');

  await test('创建 PluginInstaller 实例', () => {
    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    assert(installer !== null, '应创建实例');
    assert(installer.pluginsDir === TEST_PLUGINS_DIR, '应设置 pluginsDir');
    passed++;
  });

  await test('创建带选项的 PluginInstaller', () => {
    const installer = new PluginInstaller(TEST_PLUGINS_DIR, {
      tempDir: TEST_TEMP_DIR,
      downloadTimeout: 30000
    });
    assert(installer.tempDir === TEST_TEMP_DIR, '应设置 tempDir');
    assert(installer.downloadTimeout === 30000, '应设置 downloadTimeout');
    passed++;
  });

  await test('compareVersions - 相等版本', () => {
    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    assert(installer.compareVersions('1.0.0', '1.0.0') === 0, '相等版本应返回 0');
    passed++;
  });

  await test('compareVersions - 主版本更新', () => {
    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    assert(installer.compareVersions('1.0.0', '2.0.0') === -1, '旧版本应返回 -1');
    assert(installer.compareVersions('2.0.0', '1.0.0') === 1, '新版本应返回 1');
    passed++;
  });

  await test('compareVersions - 次版本更新', () => {
    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    assert(installer.compareVersions('1.0.0', '1.1.0') === -1, '次版本更新应返回 -1');
    assert(installer.compareVersions('1.1.0', '1.0.0') === 1, '次版本更新应返回 1');
    passed++;
  });

  await test('compareVersions - 补丁版本更新', () => {
    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    assert(installer.compareVersions('1.0.0', '1.0.1') === -1, '补丁更新应返回 -1');
    assert(installer.compareVersions('1.0.1', '1.0.0') === 1, '补丁更新应返回 1');
    passed++;
  });

  await test('compareVersions - 不同长度版本号', () => {
    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    assert(installer.compareVersions('1.0', '1.0.0') === 0, '应正确处理不同长度');
    assert(installer.compareVersions('1.0.0.1', '1.0.0') === 1, '应正确处理不同长度');
    passed++;
  });

  console.log('\n📋 PluginInstaller validatePlugin 测试\n');

  await test('validatePlugin - 有效插件', async () => {
    const pluginDir = path.join(TEST_PLUGINS_DIR, 'valid-plugin');
    await fs.mkdir(pluginDir, { recursive: true });
    await fs.writeFile(path.join(pluginDir, 'manifest.json'), JSON.stringify({
      name: 'test-plugin',
      version: '1.0.0',
      type: 'panel',
      description: 'Test plugin',
      author: 'Test Author'
    }) + '\n');
    await fs.writeFile(path.join(pluginDir, 'index.js'), 'module.exports = async function() {};\n');

    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    const result = await installer.validatePlugin(pluginDir);
    assert(result.valid === true, '有效插件应通过验证');
    assert(result.manifest.name === 'test-plugin', '应返回 manifest');
    passed++;
  });

  await test('validatePlugin - 缺少 manifest.json', async () => {
    const pluginDir = path.join(TEST_PLUGINS_DIR, 'no-manifest');
    await fs.mkdir(pluginDir, { recursive: true });

    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    const result = await installer.validatePlugin(pluginDir);
    assert(result.valid === false, '缺少 manifest 应失败');
    assert(result.error.includes('manifest.json'), '应包含正确错误信息');
    passed++;
  });

  await test('validatePlugin - 缺少必需字段', async () => {
    const pluginDir = path.join(TEST_PLUGINS_DIR, 'invalid-manifest');
    await fs.mkdir(pluginDir, { recursive: true });
    await fs.writeFile(path.join(pluginDir, 'manifest.json'), JSON.stringify({
      name: 'test-plugin',
      version: '1.0.0'
    }) + '\n');

    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    const result = await installer.validatePlugin(pluginDir);
    assert(result.valid === false, '缺少字段应失败');
    passed++;
  });

  await test('validatePlugin - 无效版本格式', async () => {
    const pluginDir = path.join(TEST_PLUGINS_DIR, 'bad-version');
    await fs.mkdir(pluginDir, { recursive: true });
    await fs.writeFile(path.join(pluginDir, 'manifest.json'), JSON.stringify({
      name: 'test-plugin',
      version: '1.0',
      type: 'panel',
      description: 'Test',
      author: 'Test'
    }) + '\n');

    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    const result = await installer.validatePlugin(pluginDir);
    assert(result.valid === false, '无效版本应失败');
    passed++;
  });

  await test('validatePlugin - 无效插件类型', async () => {
    const pluginDir = path.join(TEST_PLUGINS_DIR, 'bad-type');
    await fs.mkdir(pluginDir, { recursive: true });
    await fs.writeFile(path.join(pluginDir, 'manifest.json'), JSON.stringify({
      name: 'test-plugin',
      version: '1.0.0',
      type: 'invalid-type',
      description: 'Test',
      author: 'Test'
    }) + '\n');

    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    const result = await installer.validatePlugin(pluginDir);
    assert(result.valid === false, '无效类型应失败');
    passed++;
  });

  await test('validatePlugin - 缺少 index.js', async () => {
    const pluginDir = path.join(TEST_PLUGINS_DIR, 'no-index');
    await fs.mkdir(pluginDir, { recursive: true });
    await fs.writeFile(path.join(pluginDir, 'manifest.json'), JSON.stringify({
      name: 'test-plugin',
      version: '1.0.0',
      type: 'panel',
      description: 'Test',
      author: 'Test'
    }) + '\n');

    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    const result = await installer.validatePlugin(pluginDir);
    assert(result.valid === false, '缺少 index.js 应失败');
    passed++;
  });

  console.log('\n📋 PluginUpdateNotifier 测试\n');

  await test('创建 PluginUpdateNotifier 实例', () => {
    const notifier = new PluginUpdateNotifier();
    assert(notifier !== null, '应创建实例');
    passed++;
  });

  await test('创建带选项的 PluginUpdateNotifier', () => {
    const notifier = new PluginUpdateNotifier({
      checkInterval: 7200000,
      pluginsDir: TEST_PLUGINS_DIR
    });
    assert(notifier.checkInterval === 7200000, '应设置 checkInterval');
    assert(notifier.pluginsDir === TEST_PLUGINS_DIR, '应设置 pluginsDir');
    passed++;
  });

  await test('PluginUpdateNotifier compareVersions', () => {
    const notifier = new PluginUpdateNotifier();
    assert(notifier.compareVersions('1.0.0', '1.0.0') === 0, '相等版本');
    assert(notifier.compareVersions('1.0.0', '2.0.0') === -1, '主版本更新');
    assert(notifier.compareVersions('2.0.0', '1.0.0') === 1, '主版本更新');
    passed++;
  });

  await test('getUpdateReason - major', () => {
    const notifier = new PluginUpdateNotifier();
    const reason = notifier.getUpdateReason('major');
    assert(reason.includes('重大'), '应返回 major 更新原因');
    passed++;
  });

  await test('getUpdateReason - minor', () => {
    const notifier = new PluginUpdateNotifier();
    const reason = notifier.getUpdateReason('minor');
    assert(reason.includes('功能'), '应返回 minor 更新原因');
    passed++;
  });

  await test('getUpdateReason - patch', () => {
    const notifier = new PluginUpdateNotifier();
    const reason = notifier.getUpdateReason('patch');
    assert(reason.includes('修复'), '应返回 patch 更新原因');
    passed++;
  });

  console.log('\n📋 PluginUpdateNotifier loadInstalledPlugins 测试\n');

  await test('loadInstalledPlugins - 空文件', async () => {
    const testPath = path.join(TEST_TEMP_DIR, 'empty-installed.json');
    await fs.writeFile(testPath, '{}');
    
    const notifier = new PluginUpdateNotifier({ installedPluginsPath: testPath });
    const result = await notifier.loadInstalledPlugins('user1');
    assert(Array.isArray(result), '应返回数组');
    passed++;
  });

  await test('loadInstalledPlugins - 指定用户', async () => {
    const testPath = path.join(TEST_TEMP_DIR, 'users-installed.json');
    await fs.writeFile(testPath, JSON.stringify({
      'user1': [{ pluginName: 'plugin1', version: '1.0.0' }],
      'user2': [{ pluginName: 'plugin2', version: '2.0.0' }]
    }));
    
    const notifier = new PluginUpdateNotifier({ installedPluginsPath: testPath });
    const result = await notifier.loadInstalledPlugins('user1');
    assertEqual(result.length, 1, '应返回用户1的插件');
    assertEqual(result[0].pluginName, 'plugin1', '应返回正确的插件名');
    passed++;
  });

  await test('loadInstalledPlugins - 所有用户', async () => {
    const testPath = path.join(TEST_TEMP_DIR, 'all-users-installed.json');
    await fs.writeFile(testPath, JSON.stringify({
      'user1': [{ pluginName: 'plugin1', version: '1.0.0' }],
      'user2': [{ pluginName: 'plugin2', version: '2.0.0' }]
    }));
    
    const notifier = new PluginUpdateNotifier({ installedPluginsPath: testPath });
    const result = await notifier.loadInstalledPlugins();
    assert(Object.keys(result).length === 2, '应返回所有用户数据');
    passed++;
  });

  console.log('\n📋 PluginInstaller 事件发射测试\n');

  await test('事件发射 - installStart', async () => {
    let eventFired = false;
    const installer = new PluginInstaller(TEST_PLUGINS_DIR, {
      eventEmitter: {
        emit: (event) => { if (event === 'installStart') eventFired = true; }
      }
    });
    installer.emit('installStart', { pluginName: 'test' });
    assert(eventFired, 'installStart 事件应被发射');
    passed++;
  });

  await test('事件发射 - checkComplete', () => {
    let eventFired = false;
    const notifier = new PluginUpdateNotifier({
      eventEmitter: {
        emit: (event) => { if (event === 'checkComplete') eventFired = true; }
      }
    });
    notifier.emit('checkComplete', { updates: [] });
    assert(eventFired, 'checkComplete 事件应被发射');
    passed++;
  });

  console.log('\n📋 错误处理测试\n');

  await test('loadMarketData - 文件不存在', async () => {
    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    await assertThrowsAsync(async () => {
      await installer.loadMarketData('/non/existent/path.json');
    }, '文件不存在应抛出错误');
    passed++;
  });

  await test('loadMarketData - JSON 格式错误', async () => {
    const badPath = path.join(TEST_TEMP_DIR, 'bad-json.json');
    await fs.writeFile(badPath, 'not valid json');
    
    const installer = new PluginInstaller(TEST_PLUGINS_DIR);
    await assertThrowsAsync(async () => {
      await installer.loadMarketData(badPath);
    }, 'JSON 错误应抛出错误');
    passed++;
  });

  await cleanup();

  console.log('\n' + '='.repeat(50));
  console.log(`测试结果：${passed} 通过，${failed} 失败`);
  console.log('='.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试执行失败:', err);
  cleanup().then(() => process.exit(1));
});
