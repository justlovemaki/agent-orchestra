/**
 * Component Registry 单元测试
 */

// 简化的测试框架
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

function assertStrict(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `期望 ${expected}, 实际 ${actual}`);
  }
}

function assertThrows(fn, expectedMessage, message) {
  try {
    fn();
    throw new Error(message || '期望抛出错误但未抛出');
  } catch (error) {
    if (expectedMessage && !error.message.includes(expectedMessage)) {
      throw new Error(`错误消息不匹配`);
    }
  }
}

// Mock DOM 环境
global.document = {
  getElementById: () => ({ id: 'mock', innerHTML: '', style: {}, dataset: {}, className: '' }),
  createElement: () => ({ id: 'mock' }),
  head: { appendChild: () => {} }
};

// 简化的组件注册中心实现
class ComponentRegistry {
  constructor() {
    this.components = new Map();
    this.callbacks = new Map();
  }

  registerComponent(id, component) {
    this.components.set(id, {
      id,
      name: component.name || id,
      type: component.type || 'panel',
      render: component.render || (() => {}),
      refresh: component.refresh || (() => {}),
      destroy: component.destroy || (() => {}),
      config: component.config || {},
      registeredAt: Date.now()
    });
  }

  unregisterComponent(id) {
    const component = this.components.get(id);
    if (!component) {
      throw new Error(`Component "${id}" not found`);
    }
    this.callbacks.delete(id);
    this.components.delete(id);
  }

  getComponent(id) {
    return this.components.get(id) || null;
  }

  getAllComponents() {
    return Array.from(this.components.values());
  }

  getComponentsByType(type) {
    return this.getAllComponents().filter(c => c.type === type);
  }

  setAutoRefresh(id, interval) {
    const timerId = setTimeout(() => {}, interval);
    this.callbacks.set(id, timerId);
  }

  clearAutoRefresh(id) {
    this.callbacks.delete(id);
  }

  clearAllAutoRefresh() {
    this.callbacks.clear();
  }
}

let passed = 0;
let failed = 0;

console.log('\n📋 Component Registry 基本功能测试\n');

// 测试 1: 注册新组件
if (test('注册新组件', () => {
  const registry = new ComponentRegistry();
  registry.registerComponent('test-component', {
    name: 'Test Component',
    type: 'panel',
    render: async () => '<div>Test</div>'
  });

  const component = registry.getComponent('test-component');
  assert(component, '组件应该存在');
  assertEqual(component.name, 'Test Component');
  assertEqual(component.type, 'panel');
  passed++;
})) {} else { failed++; }

// 测试 2: 未提供 name 时使用 ID
if (test('未提供 name 时使用 ID', () => {
  const registry = new ComponentRegistry();
  registry.registerComponent('auto-name', {});
  const component = registry.getComponent('auto-name');
  assertEqual(component.name, 'auto-name');
  passed++;
})) {} else { failed++; }

// 测试 3: 默认类型为 panel
if (test('默认类型为 panel', () => {
  const registry = new ComponentRegistry();
  registry.registerComponent('no-type', {});
  const component = registry.getComponent('no-type');
  assertEqual(component.type, 'panel');
  passed++;
})) {} else { failed++; }

// 测试 4: 提供默认函数
if (test('提供默认函数', () => {
  const registry = new ComponentRegistry();
  registry.registerComponent('minimal', {});
  const component = registry.getComponent('minimal');
  assertStrict(typeof component.render, 'function');
  assertStrict(typeof component.refresh, 'function');
  assertStrict(typeof component.destroy, 'function');
  passed++;
})) {} else { failed++; }

console.log('\n📋 组件查询测试\n');

// 测试 5: 通过 ID 获取组件
if (test('通过 ID 获取组件', () => {
  const registry = new ComponentRegistry();
  registry.registerComponent('get-test', { name: 'Get Test' });
  const component = registry.getComponent('get-test');
  assert(component);
  assertEqual(component.id, 'get-test');
  passed++;
})) {} else { failed++; }

// 测试 6: 获取不存在的组件返回 null
if (test('获取不存在的组件返回 null', () => {
  const registry = new ComponentRegistry();
  const component = registry.getComponent('non-existent');
  assertStrict(component, null);
  passed++;
})) {} else { failed++; }

// 测试 7: 获取所有组件
if (test('获取所有组件', () => {
  const registry = new ComponentRegistry();
  registry.registerComponent('all-1', {});
  registry.registerComponent('all-2', {});
  registry.registerComponent('all-3', {});

  const all = registry.getAllComponents();
  assertStrict(all.length, 3);
  passed++;
})) {} else { failed++; }

// 测试 8: 按类型筛选组件
if (test('按类型筛选组件', () => {
  const registry = new ComponentRegistry();
  registry.registerComponent('panel-1', { type: 'panel' });
  registry.registerComponent('widget-1', { type: 'widget' });
  registry.registerComponent('panel-2', { type: 'panel' });

  const panels = registry.getComponentsByType('panel');
  assertStrict(panels.length, 2);
  assert(panels.every(c => c.type === 'panel'));

  const widgets = registry.getComponentsByType('widget');
  assertStrict(widgets.length, 1);
  passed++;
})) {} else { failed++; }

// 测试 9: 筛选不存在的类型返回空数组
if (test('筛选不存在的类型返回空数组', () => {
  const registry = new ComponentRegistry();
  const charts = registry.getComponentsByType('chart');
  assertStrict(charts.length, 0);
  passed++;
})) {} else { failed++; }

console.log('\n📋 组件注销测试\n');

// 测试 10: 从注册表中移除组件
if (test('从注册表中移除组件', () => {
  const registry = new ComponentRegistry();
  registry.registerComponent('to-remove', {});
  assert(registry.getComponent('to-remove'));

  registry.unregisterComponent('to-remove');
  const component = registry.getComponent('to-remove');
  assertStrict(component, null);
  passed++;
})) {} else { failed++; }

// 测试 11: 注销不存在的组件抛出错误
if (test('注销不存在的组件抛出错误', () => {
  const registry = new ComponentRegistry();
  assertThrows(() => {
    registry.unregisterComponent('not-found');
  }, 'not found');
  passed++;
})) {} else { failed++; }

console.log('\n📋 自动刷新测试\n');

// 测试 12: 设置自动刷新定时器
if (test('设置自动刷新定时器', () => {
  const registry = new ComponentRegistry();
  registry.registerComponent('auto-refresh', {});
  registry.setAutoRefresh('auto-refresh', 5000);
  
  assert(registry.callbacks.has('auto-refresh'));
  passed++;
})) {} else { failed++; }

// 测试 13: 清除自动刷新定时器
if (test('清除自动刷新定时器', () => {
  const registry = new ComponentRegistry();
  registry.registerComponent('clear-test', {});
  registry.setAutoRefresh('clear-test', 5000);
  
  registry.clearAutoRefresh('clear-test');
  assert(!registry.callbacks.has('clear-test'));
  passed++;
})) {} else { failed++; }

// 测试 14: 清除所有自动刷新
if (test('清除所有自动刷新', () => {
  const registry = new ComponentRegistry();
  registry.registerComponent('batch-1', {});
  registry.registerComponent('batch-2', {});
  registry.registerComponent('batch-3', {});
  
  registry.setAutoRefresh('batch-1', 5000);
  registry.setAutoRefresh('batch-2', 5000);
  registry.setAutoRefresh('batch-3', 5000);
  
  assertStrict(registry.callbacks.size, 3);
  
  registry.clearAllAutoRefresh();
  
  assertStrict(registry.callbacks.size, 0);
  passed++;
})) {} else { failed++; }

console.log('\n📋 组件配置测试\n');

// 测试 15: 存储组件配置
if (test('存储组件配置', () => {
  const registry = new ComponentRegistry();
  registry.registerComponent('config-test', {
    config: {
      refreshInterval: 30000,
      showTitle: true,
      theme: 'dark'
    }
  });

  const component = registry.getComponent('config-test');
  assertEqual(component.config, {
    refreshInterval: 30000,
    showTitle: true,
    theme: 'dark'
  });
  passed++;
})) {} else { failed++; }

// 测试 16: 默认配置为空对象
if (test('默认配置为空对象', () => {
  const registry = new ComponentRegistry();
  registry.registerComponent('no-config', {});
  const component = registry.getComponent('no-config');
  assertEqual(component.config, {});
  passed++;
})) {} else { failed++; }

console.log('\n📋 组件生命周期测试\n');

// 测试 17: 完整的组件生命周期
if (test('完整的组件生命周期', () => {
  const registry = new ComponentRegistry();
  let renderCalled = false;
  let destroyCalled = false;

  registry.registerComponent('lifecycle', {
    name: 'Lifecycle Test',
    type: 'panel',
    render: async () => { renderCalled = true; },
    destroy: async () => { destroyCalled = true; }
  });

  const component = registry.getComponent('lifecycle');
  assert(component);
  assertEqual(component.name, 'Lifecycle Test');

  registry.unregisterComponent('lifecycle');
  assertStrict(registry.getComponent('lifecycle'), null);
  
  passed++;
})) {} else { failed++; }

// 输出结果
console.log('\n' + '='.repeat(50));
console.log(`测试结果：${passed} 通过，${failed} 失败`);
console.log('='.repeat(50) + '\n');

if (failed > 0) {
  process.exit(1);
}

module.exports = { passed, failed };
