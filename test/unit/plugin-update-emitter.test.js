'use strict';

const path = require('path');
const fs = require('fs');

const TEST_DATA_DIR = path.join(__dirname, '../../data/test-plugin-update-emitter');
const TEST_MARKETPLACE_FILE = path.join(TEST_DATA_DIR, 'plugins-marketplace.json');
const TEST_INSTALLED_FILE = path.join(TEST_DATA_DIR, 'installed-plugins.json');
const TEST_PLUGINS_DIR = path.join(TEST_DATA_DIR, 'plugins');

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        console.log(`✅ ${name}`);
        return true;
      }).catch((error) => {
        console.log(`❌ ${name}`);
        console.log(`   错误：${error.message}`);
        return false;
      });
    }
    console.log(`✅ ${name}`);
    return Promise.resolve(true);
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   错误：${error.message}`);
    return Promise.resolve(false);
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

let passed = 0;
let failed = 0;

async function setup() {
  await fs.promises.mkdir(TEST_DATA_DIR, { recursive: true });
  await fs.promises.mkdir(TEST_PLUGINS_DIR, { recursive: true });
  
  const marketplaceData = {
    plugins: [
      {
        id: 'plugin-1',
        name: 'test-plugin-1',
        version: '2.0.0',
        status: 'approved',
        description: 'Test plugin 1',
        author: 'Author 1',
        downloadUrl: 'https://example.com/plugin1.zip'
      },
      {
        id: 'plugin-2',
        name: 'test-plugin-2',
        version: '1.5.0',
        status: 'approved',
        description: 'Test plugin 2',
        author: 'Author 2',
        downloadUrl: 'https://example.com/plugin2.zip'
      },
      {
        id: 'plugin-3',
        name: 'test-plugin-3',
        version: '1.0.0',
        status: 'pending',
        description: 'Test plugin 3',
        author: 'Author 3',
        downloadUrl: 'https://example.com/plugin3.zip'
      }
    ],
    categories: []
  };
  
  await fs.promises.writeFile(TEST_MARKETPLACE_FILE, JSON.stringify(marketplaceData, null, 2));
  await fs.promises.writeFile(TEST_INSTALLED_FILE, JSON.stringify({}, null, 2));
}

async function cleanup() {
  try {
    await fs.promises.rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch {}
}

async function runTests() {
  await setup();
  console.log('\n📋 插件更新发射器模块测试\n');

  const PluginUpdateEmitter = require('../../lib/plugin-update-emitter');

  const tests = [
    ['PluginUpdateEmitter - 实例化', () => {
      const emitter = new PluginUpdateEmitter();
      assert(emitter !== null, '实例应存在');
      assert(emitter.checkInterval === 1800000, '默认检查间隔应为 30 分钟');
    }],
    ['PluginUpdateEmitter - 自定义选项', () => {
      const emitter = new PluginUpdateEmitter({
        marketDataPath: TEST_MARKETPLACE_FILE,
        installedPluginsPath: TEST_INSTALLED_FILE,
        pluginsDir: TEST_PLUGINS_DIR,
        checkInterval: 600000
      });
      assert(emitter.checkInterval === 600000, '检查间隔应自定义');
    }],
    ['PluginUpdateEmitter - 版本比较', () => {
      const emitter = new PluginUpdateEmitter();
      assert(emitter.compareVersions('2.0.0', '1.0.0') === 1, '2.0.0 > 1.0.0');
      assert(emitter.compareVersions('1.0.0', '2.0.0') === -1, '1.0.0 < 2.0.0');
      assert(emitter.compareVersions('1.0.0', '1.0.0') === 0, '1.0.0 === 1.0.0');
      assert(emitter.compareVersions('1.0.2', '1.0.1') === 1, '补丁版本比较');
      assert(emitter.compareVersions('2.0.0', '1.9.9') === 1, '次版本影响主版本');
      assert(emitter.compareVersions('1.1.0', '1.0.9') === 1, '次版本比较');
    }],
    ['PluginUpdateEmitter - 加载已安装插件', async () => {
      const emitter = new PluginUpdateEmitter({
        installedPluginsPath: TEST_INSTALLED_FILE
      });
      
      await fs.promises.writeFile(TEST_INSTALLED_FILE, JSON.stringify({
        'user1': [
          { pluginId: 'plugin-1', pluginName: 'test-plugin-1', version: '1.0.0' }
        ]
      }));
      
      const installed = await emitter.loadInstalledPlugins('user1');
      assert(Array.isArray(installed), '应返回数组, 实际: ' + JSON.stringify(installed));
      assert(installed.length === 1, '应有 1 个插件, 实际: ' + installed.length);
      assert(installed[0].pluginName === 'test-plugin-1', '插件名应正确');
    }],
    ['PluginUpdateEmitter - 加载市场数据', async () => {
      const emitter = new PluginUpdateEmitter({
        marketDataPath: TEST_MARKETPLACE_FILE
      });
      
      const data = await emitter.loadMarketData();
      assert(data.plugins.length === 3, '应有 3 个插件');
    }],
    ['PluginUpdateEmitter - 检查更新 - 无已安装插件', async () => {
      const emitter = new PluginUpdateEmitter({
        marketDataPath: TEST_MARKETPLACE_FILE,
        installedPluginsPath: TEST_INSTALLED_FILE,
        pluginsDir: TEST_PLUGINS_DIR
      });
      
      await fs.promises.writeFile(TEST_INSTALLED_FILE, JSON.stringify({}));
      
      const updates = await emitter.checkForUpdates('nonexistent-user');
      assert(updates.length === 0, '无可用更新');
    }],
    ['PluginUpdateEmitter - 检查更新 - 有可用更新', async () => {
      const emitter = new PluginUpdateEmitter({
        marketDataPath: TEST_MARKETPLACE_FILE,
        installedPluginsPath: TEST_INSTALLED_FILE,
        pluginsDir: TEST_PLUGINS_DIR
      });
      
      const installedData = {
        'user1': [
          { pluginId: 'plugin-1', pluginName: 'test-plugin-1', version: '1.0.0' }
        ]
      };
      await fs.promises.writeFile(TEST_INSTALLED_FILE, JSON.stringify(installedData));
      
      await fs.promises.mkdir(path.join(TEST_PLUGINS_DIR, 'test-plugin-1'), { recursive: true });
      await fs.promises.writeFile(
        path.join(TEST_PLUGINS_DIR, 'test-plugin-1', 'manifest.json'),
        JSON.stringify({ name: 'test-plugin-1', version: '1.0.0' })
      );
      
      const updates = await emitter.checkForUpdates('user1');
      assert(updates.length === 1, '应有 1 个可用更新');
      assert(updates[0].pluginName === 'test-plugin-1', '插件名应正确');
      assert(updates[0].currentVersion === '1.0.0', '当前版本应正确');
      assert(updates[0].latestVersion === '2.0.0', '最新版本应正确');
      assert(updates[0].updateType === 'major', '更新类型应为主版本');
    }],
    ['PluginUpdateEmitter - 检查更新 - 无可用更新', async () => {
      const emitter = new PluginUpdateEmitter({
        marketDataPath: TEST_MARKETPLACE_FILE,
        installedPluginsPath: TEST_INSTALLED_FILE,
        pluginsDir: TEST_PLUGINS_DIR
      });
      
      const installedData = {
        'user1': [
          { pluginId: 'plugin-1', pluginName: 'test-plugin-1', version: '2.0.0' }
        ]
      };
      await fs.promises.writeFile(TEST_INSTALLED_FILE, JSON.stringify(installedData));
      
      await fs.promises.mkdir(path.join(TEST_PLUGINS_DIR, 'test-plugin-1'), { recursive: true });
      await fs.promises.writeFile(
        path.join(TEST_PLUGINS_DIR, 'test-plugin-1', 'manifest.json'),
        JSON.stringify({ name: 'test-plugin-1', version: '2.0.0' })
      );
      
      const updates = await emitter.checkForUpdates('user1');
      assert(updates.length === 0, '应无可用更新');
    }],
    ['PluginUpdateEmitter - 检查更新 - 次版本更新', async () => {
      const emitter = new PluginUpdateEmitter({
        marketDataPath: TEST_MARKETPLACE_FILE,
        installedPluginsPath: TEST_INSTALLED_FILE,
        pluginsDir: TEST_PLUGINS_DIR
      });
      
      const installedData = {
        'user1': [
          { pluginId: 'plugin-2', pluginName: 'test-plugin-2', version: '1.0.0' }
        ]
      };
      await fs.promises.writeFile(TEST_INSTALLED_FILE, JSON.stringify(installedData));
      
      await fs.promises.mkdir(path.join(TEST_PLUGINS_DIR, 'test-plugin-2'), { recursive: true });
      await fs.promises.writeFile(
        path.join(TEST_PLUGINS_DIR, 'test-plugin-2', 'manifest.json'),
        JSON.stringify({ name: 'test-plugin-2', version: '1.0.0' })
      );
      
      const updates = await emitter.checkForUpdates('user1');
      assert(updates.length === 1, '应有 1 个可用更新');
      assert(updates[0].updateType === 'minor', '更新类型应为次版本');
    }],
    ['PluginUpdateEmitter - 检查更新 - 跳过待审核插件', async () => {
      const emitter = new PluginUpdateEmitter({
        marketDataPath: TEST_MARKETPLACE_FILE,
        installedPluginsPath: TEST_INSTALLED_FILE,
        pluginsDir: TEST_PLUGINS_DIR
      });
      
      const installedData = {
        'user1': [
          { pluginId: 'plugin-3', pluginName: 'test-plugin-3', version: '0.9.0' }
        ]
      };
      await fs.promises.writeFile(TEST_INSTALLED_FILE, JSON.stringify(installedData));
      
      const updates = await emitter.checkForUpdates('user1');
      assert(updates.length === 0, '应跳过待审核插件');
    }],
    ['PluginUpdateEmitter - 创建通知消息 - 无更新', () => {
      const emitter = new PluginUpdateEmitter();
      
      const notification = emitter.createNotificationMessage([]);
      
      assert(notification.type === 'plugin_updates', '类型应正确');
      assert(notification.title === '所有插件已是最新版本', '标题应正确');
      assert(notification.updates.length === 0, '更新列表应为空');
    }],
    ['PluginUpdateEmitter - 创建通知消息 - 有更新', () => {
      const emitter = new PluginUpdateEmitter();
      
      const updates = [
        {
          pluginName: 'plugin-1',
          currentVersion: '1.0.0',
          latestVersion: '2.0.0',
          updateType: 'major',
          description: 'Major update'
        },
        {
          pluginName: 'plugin-2',
          currentVersion: '1.0.0',
          latestVersion: '1.5.0',
          updateType: 'minor',
          description: 'Minor update'
        },
        {
          pluginName: 'plugin-3',
          currentVersion: '1.0.0',
          latestVersion: '1.0.1',
          updateType: 'patch',
          description: 'Patch update'
        }
      ];
      
      const notification = emitter.createNotificationMessage(updates);
      
      assert(notification.type === 'plugin_updates', '类型应正确');
      assert(notification.title.includes('3'), '标题应包含数量');
      assert(notification.updates.length === 3, '应有 3 个更新');
      assert(notification.updates[0].pluginName === 'plugin-1', '第一个更新名称应正确');
    }],
    ['PluginUpdateEmitter - 获取插件更新日志', async () => {
      const emitter = new PluginUpdateEmitter({
        marketDataPath: TEST_MARKETPLACE_FILE
      });
      
      const changelog = await emitter.getPluginChangeLog('test-plugin-1');
      
      assert(changelog !== null, '应返回更新日志');
      assert(changelog.name === 'test-plugin-1', '名称应正确');
      assert(changelog.version === '2.0.0', '版本应正确');
    }],
    ['PluginUpdateEmitter - 获取不存在的插件更新日志', async () => {
      const emitter = new PluginUpdateEmitter({
        marketDataPath: TEST_MARKETPLACE_FILE
      });
      
      const changelog = await emitter.getPluginChangeLog('nonexistent-plugin');
      
      assert(changelog === null, '应返回 null');
    }],
    ['PluginUpdateEmitter - 事件发射', async () => {
      const emitter = new PluginUpdateEmitter({
        marketDataPath: TEST_MARKETPLACE_FILE,
        installedPluginsPath: TEST_INSTALLED_FILE,
        pluginsDir: TEST_PLUGINS_DIR,
        checkInterval: 5000
      });
      
      let eventFired = false;
      emitter.on('checkComplete', (data) => {
        eventFired = true;
      });
      
      await fs.promises.writeFile(TEST_INSTALLED_FILE, JSON.stringify({ 'user-test': [] }));
      
      const result = await emitter.checkForUpdates('user-test');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      assert(eventFired === true, '事件应触发, eventFired=' + eventFired);
    }]
  ];

  for (const [name, fn] of tests) {
    const result = await test(name, fn);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  await cleanup();

  console.log('\n📋 插件更新发射器自动检查测试\n');

  const autoTests = [
    ['PluginUpdateEmitter - 启动自动检查', async () => {
      const emitter = new PluginUpdateEmitter({
        marketDataPath: TEST_MARKETPLACE_FILE,
        installedPluginsPath: TEST_INSTALLED_FILE,
        pluginsDir: TEST_PLUGINS_DIR,
        checkInterval: 1000
      });
      
      await fs.promises.mkdir(TEST_DATA_DIR, { recursive: true });
      await fs.promises.writeFile(TEST_MARKETPLACE_FILE, JSON.stringify({ plugins: [] }));
      await fs.promises.writeFile(TEST_INSTALLED_FILE, JSON.stringify({}));
      
      const intervalId = await emitter.startAutoCheck('test-user', () => {});
      
      assert(intervalId !== null, '应返回 interval ID');
      assert(emitter.intervals.has('test-user'), '用户应在 intervals 中');
      
      emitter.stopAutoCheck('test-user');
    }],
    ['PluginUpdateEmitter - 停止自动检查', async () => {
      const emitter = new PluginUpdateEmitter({
        marketDataPath: TEST_MARKETPLACE_FILE,
        installedPluginsPath: TEST_INSTALLED_FILE,
        pluginsDir: TEST_PLUGINS_DIR,
        checkInterval: 1000
      });
      
      await fs.promises.mkdir(TEST_DATA_DIR, { recursive: true });
      await fs.promises.writeFile(TEST_MARKETPLACE_FILE, JSON.stringify({ plugins: [] }));
      await fs.promises.writeFile(TEST_INSTALLED_FILE, JSON.stringify({}));
      
      await emitter.startAutoCheck('test-user', () => {});
      emitter.stopAutoCheck('test-user');
      
      assert(!emitter.intervals.has('test-user'), '用户应从 intervals 中移除');
    }],
    ['PluginUpdateEmitter - 停止所有自动检查', async () => {
      const emitter = new PluginUpdateEmitter({
        marketDataPath: TEST_MARKETPLACE_FILE,
        installedPluginsPath: TEST_INSTALLED_FILE,
        pluginsDir: TEST_PLUGINS_DIR,
        checkInterval: 1000
      });
      
      await fs.promises.mkdir(TEST_DATA_DIR, { recursive: true });
      await fs.promises.writeFile(TEST_MARKETPLACE_FILE, JSON.stringify({ plugins: [] }));
      await fs.promises.writeFile(TEST_INSTALLED_FILE, JSON.stringify({}));
      
      await emitter.startAutoCheck('user1', () => {});
      await emitter.startAutoCheck('user2', () => {});
      
      assert(emitter.intervals.size === 2, '应有 2 个 intervals');
      
      emitter.stopAllAutoCheck();
      
      assert(emitter.intervals.size === 0, '所有 intervals 应被清除');
    }]
  ];

  for (const [name, fn] of autoTests) {
    const result = await test(name, fn);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  try {
    await fs.promises.rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch {}

  console.log('\n' + '='.repeat(50));
  console.log(`测试结果：${passed} 通过，${failed} 失败`);
  console.log('='.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
