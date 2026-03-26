/**
 * 插件系统模块测试
 */

const {
  PluginSystem,
  PluginLoader,
  PluginRegistry,
  createPlugin,
  validateManifest,
  PLUGIN_TYPES,
  PLUGIN_STATES,
  BasePlugin,
  PanelPlugin,
  NotificationPlugin,
  DatasourcePlugin
} = require('../../lib/plugin-system');

const path = require('path');
const fs = require('fs').promises;

const TEST_PLUGINS_DIR = path.join(__dirname, '../../data/test-plugins');

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

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || '期望抛出异常但未抛出');
  }
}

let passed = 0;
let failed = 0;

async function setup() {
  await fs.mkdir(TEST_PLUGINS_DIR, { recursive: true });
  await fs.mkdir(path.join(TEST_PLUGINS_DIR, 'test-panel'), { recursive: true });
  await fs.writeFile(path.join(TEST_PLUGINS_DIR, 'test-panel', 'manifest.json'), JSON.stringify({
    name: 'test-panel',
    version: '1.0.0',
    type: 'panel',
    description: 'Test panel plugin',
    author: 'Test',
    component: 'TestComponent',
    renderMethod: 'default'
  }) + '\n');
  await fs.writeFile(path.join(TEST_PLUGINS_DIR, 'test-panel', 'index.js'), `
    module.exports = async function(plugin, options) {
      plugin.testProperty = 'test';
    };
  ` + '\n');
  
  await fs.mkdir(path.join(TEST_PLUGINS_DIR, 'test-notification'), { recursive: true });
  await fs.writeFile(path.join(TEST_PLUGINS_DIR, 'test-notification', 'manifest.json'), JSON.stringify({
    name: 'test-notification',
    version: '1.0.0',
    type: 'notification',
    description: 'Test notification plugin',
    author: 'Test',
    channelName: 'test-channel',
    supportedFormats: ['text', 'markdown']
  }) + '\n');
  await fs.writeFile(path.join(TEST_PLUGINS_DIR, 'test-notification', 'index.js'), `
    module.exports = async function(plugin, options) {
      plugin.send = async function(message, options) {
        return { success: true };
      };
      plugin.test = async function(config) {
        return { success: true };
      };
    };
  ` + '\n');
  
  await fs.mkdir(path.join(TEST_PLUGINS_DIR, 'test-datasource'), { recursive: true });
  await fs.writeFile(path.join(TEST_PLUGINS_DIR, 'test-datasource', 'manifest.json'), JSON.stringify({
    name: 'test-datasource',
    version: '1.0.0',
    type: 'datasource',
    description: 'Test datasource plugin',
    author: 'Test',
    schema: { fields: [{ name: 'id', type: 'string' }] }
  }) + '\n');
  await fs.writeFile(path.join(TEST_PLUGINS_DIR, 'test-datasource', 'index.js'), `
    module.exports = async function(plugin, options) {
      plugin.query = async function(queryString, options) {
        return { data: [] };
      };
      plugin.test = async function(config) {
        return { success: true };
      };
    };
  ` + '\n');
}

async function cleanup() {
  try {
    await fs.rm(TEST_PLUGINS_DIR, { recursive: true, force: true });
  } catch {}
}

async function runTests() {
  await setup();

  console.log('\n📋 插件接口测试\n');

  if (test('验证清单 - 有效清单', () => {
    const manifest = { name: 'test', version: '1.0.0', type: 'panel' };
    assert(validateManifest(manifest) === true, '有效清单应通过验证');
    passed++;
  })) {} else { failed++; }

  if (test('验证清单 - 缺少必需字段', () => {
    assertThrows(() => validateManifest({ name: 'test' }), '缺少字段应报错');
    passed++;
  })) {} else { failed++; }

  if (test('验证清单 - 无效类型', () => {
    assertThrows(() => validateManifest({ name: 'test', version: '1.0.0', type: 'invalid' }), '无效类型应报错');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 创建插件测试\n');

  if (test('创建面板插件', () => {
    const manifest = { name: 'panel-test', version: '1.0.0', type: 'panel', component: 'TestComp' };
    const plugin = createPlugin(manifest, '/tmp');
    assert(plugin instanceof PanelPlugin, '应创建PanelPlugin实例');
    assertEqual(plugin.name, 'panel-test');
    passed++;
  })) {} else { failed++; }

  if (test('创建通知插件', () => {
    const manifest = { name: 'notif-test', version: '1.0.0', type: 'notification' };
    const plugin = createPlugin(manifest, '/tmp');
    assert(plugin instanceof NotificationPlugin, '应创建NotificationPlugin实例');
    passed++;
  })) {} else { failed++; }

  if (test('创建数据源插件', () => {
    const manifest = { name: 'ds-test', version: '1.0.0', type: 'datasource' };
    const plugin = createPlugin(manifest, '/tmp');
    assert(plugin instanceof DatasourcePlugin, '应创建DatasourcePlugin实例');
    passed++;
  })) {} else { failed++; }

  if (test('创建插件 - 无效类型抛出异常', () => {
    assertThrows(() => createPlugin({ name: 'test', version: '1.0.0', type: 'invalid' }, '/tmp'), '无效类型应报错');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 插件注册表测试\n');

  if (test('注册插件', () => {
    const registry = new PluginRegistry();
    const plugin = createPlugin({ name: 'reg-test', version: '1.0.0', type: 'panel', component: 'C' }, '/tmp');
    plugin.state = PLUGIN_STATES.LOADED;
    const result = registry.register(plugin);
    assertEqual(result.name, 'reg-test');
    passed++;
  })) {} else { failed++; }

  if (test('注册重复插件抛出异常', () => {
    const registry = new PluginRegistry();
    const plugin = createPlugin({ name: 'dup-test', version: '1.0.0', type: 'panel', component: 'C' }, '/tmp');
    plugin.state = PLUGIN_STATES.LOADED;
    registry.register(plugin);
    assertThrows(() => registry.register(plugin), '重复注册应报错');
    passed++;
  })) {} else { failed++; }

  if (test('获取插件', () => {
    const registry = new PluginRegistry();
    const plugin = createPlugin({ name: 'get-test', version: '1.0.0', type: 'panel', component: 'C' }, '/tmp');
    plugin.state = PLUGIN_STATES.LOADED;
    registry.register(plugin);
    const found = registry.get('get-test');
    assertEqual(found.name, 'get-test');
    passed++;
  })) {} else { failed++; }

  if (test('获取不存在的插件返回null', () => {
    const registry = new PluginRegistry();
    const found = registry.get('non-existent');
    assertEqual(found, null);
    passed++;
  })) {} else { failed++; }

  if (test('注销插件', () => {
    const registry = new PluginRegistry();
    const plugin = createPlugin({ name: 'unreg-test', version: '1.0.0', type: 'panel', component: 'C' }, '/tmp');
    plugin.state = PLUGIN_STATES.DISABLED;
    registry.register(plugin);
    const result = registry.unregister('unreg-test');
    assertEqual(result.name, 'unreg-test');
    passed++;
  })) {} else { failed++; }

  if (test('注销启用的插件抛出异常', () => {
    const registry = new PluginRegistry();
    const plugin = createPlugin({ name: 'enabled-unreg', version: '1.0.0', type: 'panel', component: 'C' }, '/tmp');
    plugin.state = PLUGIN_STATES.ENABLED;
    registry.register(plugin);
    assertThrows(() => registry.unregister('enabled-unreg'), '注销启用插件应报错');
    passed++;
  })) {} else { failed++; }

  if (test('按类型获取插件', () => {
    const registry = new PluginRegistry();
    const p1 = createPlugin({ name: 'p1', version: '1.0.0', type: 'panel', component: 'C' }, '/tmp');
    p1.state = PLUGIN_STATES.LOADED;
    const p2 = createPlugin({ name: 'n1', version: '1.0.0', type: 'notification' }, '/tmp');
    p2.state = PLUGIN_STATES.LOADED;
    registry.register(p1);
    registry.register(p2);
    const panels = registry.getByType('panel');
    assertEqual(panels.length, 1);
    passed++;
  })) {} else { failed++; }

  if (test('获取已启用插件', () => {
    const registry = new PluginRegistry();
    const plugin = createPlugin({ name: 'enabled-get', version: '1.0.0', type: 'panel', component: 'C' }, '/tmp');
    plugin.state = PLUGIN_STATES.ENABLED;
    registry.register(plugin);
    const enabled = registry.getEnabled();
    assertEqual(enabled.length, 1);
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 插件启用禁用测试\n');

  if (test('启用插件', async () => {
    const registry = new PluginRegistry();
    const plugin = createPlugin({ name: 'enable-test', version: '1.0.0', type: 'panel', component: 'C' }, '/tmp');
    plugin.state = PLUGIN_STATES.LOADED;
    registry.register(plugin);
    await registry.enablePlugin('enable-test');
    assertEqual(plugin.state, PLUGIN_STATES.ENABLED);
    passed++;
  })) {} else { failed++; }

  if (test('禁用插件', async () => {
    const registry = new PluginRegistry();
    const plugin = createPlugin({ name: 'disable-test', version: '1.0.0', type: 'panel', component: 'C' }, '/tmp');
    plugin.state = PLUGIN_STATES.ENABLED;
    registry.register(plugin);
    await registry.disablePlugin('disable-test');
    assertEqual(plugin.state, PLUGIN_STATES.DISABLED);
    passed++;
  })) {} else { failed++; }

  if (test('重复启用返回原插件', async () => {
    const registry = new PluginRegistry();
    const plugin = createPlugin({ name: 'double-enable', version: '1.0.0', type: 'panel', component: 'C' }, '/tmp');
    plugin.state = PLUGIN_STATES.LOADED;
    registry.register(plugin);
    await registry.enablePlugin('double-enable');
    const result = await registry.enablePlugin('double-enable');
    assertEqual(result.name, 'double-enable');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 插件配置测试\n');

  if (test('更新插件配置', () => {
    const registry = new PluginRegistry();
    const plugin = createPlugin({ name: 'config-test', version: '1.0.0', type: 'panel', component: 'C', configSchema: { apiKey: { type: 'string', required: true } } }, '/tmp');
    plugin.state = PLUGIN_STATES.LOADED;
    plugin.config = {};
    registry.register(plugin);
    registry.updateConfig('config-test', { apiKey: 'secret123' });
    assertEqual(plugin.config.apiKey, 'secret123');
    passed++;
  })) {} else { failed++; }

  if (test('获取插件配置', () => {
    const registry = new PluginRegistry();
    const plugin = createPlugin({ name: 'get-config', version: '1.0.0', type: 'panel', component: 'C' }, '/tmp');
    plugin.state = PLUGIN_STATES.LOADED;
    plugin.config = { key: 'value' };
    registry.register(plugin);
    const config = registry.getConfig('get-config');
    assertEqual(config.key, 'value');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 事件监听测试\n');

  if (test('注册和触发事件', () => {
    const registry = new PluginRegistry();
    let eventFired = false;
    registry.on('registered', () => { eventFired = true; });
    const plugin = createPlugin({ name: 'event-test', version: '1.0.0', type: 'panel', component: 'C' }, '/tmp');
    plugin.state = PLUGIN_STATES.LOADED;
    registry.register(plugin);
    assert(eventFired, '事件应被触发');
    passed++;
  })) {} else { failed++; }

  if (test('移除事件监听', () => {
    const registry = new PluginRegistry();
    const callback = () => {};
    registry.on('registered', callback);
    registry.off('registered', callback);
    const plugin = createPlugin({ name: 'off-test', version: '1.0.0', type: 'panel', component: 'C' }, '/tmp');
    plugin.state = PLUGIN_STATES.LOADED;
    registry.register(plugin);
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 插件列表测试\n');

  if (test('获取插件列表', () => {
    const registry = new PluginRegistry();
    const plugin = createPlugin({ name: 'list-test', version: '1.0.0', type: 'panel', description: 'Test', author: 'Author', component: 'C' }, '/tmp');
    plugin.state = PLUGIN_STATES.LOADED;
    plugin.pluginPath = '/path/to/plugin';
    registry.register(plugin);
    const list = registry.getList();
    assertEqual(list.length, 1);
    assertEqual(list[0].name, 'list-test');
    assertEqual(list[0].version, '1.0.0');
    assertEqual(list[0].pluginPath, '/path/to/plugin');
    passed++;
  })) {} else { failed++; }

  await cleanup();

  console.log('\n' + '='.repeat(50));
  console.log(`测试结果：${passed} 通过，${failed} 失败`);
  console.log('='.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
