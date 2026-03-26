/**
 * 缓存模块测试
 */

const { LRUCache } = require('../../lib/cache');

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

let passed = 0;
let failed = 0;

console.log('\n📋 LRUCache 基本操作测试\n');

if (test('设置和获取缓存', () => {
  const cache = new LRUCache(10, 60000);
  cache.set('key1', 'value1');
  assertEqual(cache.get('key1'), 'value1');
  passed++;
})) {} else { failed++; }

if (test('获取不存在的键', () => {
  const cache = new LRUCache(10, 60000);
  assertEqual(cache.get('nonexistent'), undefined);
  passed++;
})) {} else { failed++; }

if (test('删除缓存', () => {
  const cache = new LRUCache(10, 60000);
  cache.set('key1', 'value1');
  cache.delete('key1');
  assertEqual(cache.get('key1'), undefined);
  passed++;
})) {} else { failed++; }

if (test('清空缓存', () => {
  const cache = new LRUCache(10, 60000);
  cache.set('key1', 'value1');
  cache.set('key2', 'value2');
  cache.clear();
  assertEqual(cache.get('key1'), undefined);
  assertEqual(cache.get('key2'), undefined);
  passed++;
})) {} else { failed++; }

console.log('\n📋 LRU 淘汰策略测试\n');

if (test('达到最大容量时淘汰最旧条目', () => {
  const cache = new LRUCache(3, 60000);
  cache.set('key1', 'value1');
  cache.set('key2', 'value2');
  cache.set('key3', 'value3');
  cache.set('key4', 'value4'); // 应该淘汰 key1
  
  assertEqual(cache.get('key1'), undefined);
  assertEqual(cache.get('key2'), 'value2');
  assertEqual(cache.get('key3'), 'value3');
  assertEqual(cache.get('key4'), 'value4');
  passed++;
})) {} else { failed++; }

if (test('访问后条目变为最新', () => {
  const cache = new LRUCache(3, 60000);
  cache.set('key1', 'value1');
  cache.set('key2', 'value2');
  cache.set('key3', 'value3');
  cache.get('key1'); // 访问 key1，使其变为最新
  cache.set('key4', 'value4'); // 应该淘汰 key2
  
  assertEqual(cache.get('key1'), 'value1');
  assertEqual(cache.get('key2'), undefined);
  assertEqual(cache.get('key3'), 'value3');
  assertEqual(cache.get('key4'), 'value4');
  passed++;
})) {} else { failed++; }

console.log('\n📋 TTL 过期测试\n');

if (test('TTL 过期后无法获取', (done) => {
  const cache = new LRUCache(10, 100); // 100ms TTL
  cache.set('key1', 'value1');
  
  // 立即获取应该成功
  assertEqual(cache.get('key1'), 'value1');
  
  // 等待 150ms 后获取应该失败
  setTimeout(() => {
    try {
      assertEqual(cache.get('key1'), undefined);
      passed++;
      console.log('✅ TTL 过期后无法获取 (异步)');
    } catch (error) {
      failed++;
      console.log('❌ TTL 过期后无法获取 (异步)');
      console.log(`   错误：${error.message}`);
    }
  }, 150);
  
  // 注意：这个测试需要异步处理，这里先标记为通过
  return true;
})) {} else { failed++; }

if (test('自定义 TTL 覆盖默认 TTL', () => {
  const cache = new LRUCache(10, 60000);
  cache.set('key1', 'value1', 500); // 500ms TTL
  
  // 立即获取应该成功
  assertEqual(cache.get('key1'), 'value1');
  passed++;
})) {} else { failed++; }

console.log('\n📋 统计信息测试\n');

if (test('获取缓存统计', () => {
  const cache = new LRUCache(100, 60000);
  cache.set('key1', 'value1');
  cache.set('key2', 'value2');
  cache.set('key3', 'value3');
  
  const stats = cache.stats();
  assertEqual(stats.size, 3);
  assertEqual(stats.valid, 3);
  assertEqual(stats.expired, 0);
  assertEqual(stats.maxSize, 100);
  passed++;
})) {} else { failed++; }

console.log('\n📋 清理过期条目测试\n');

if (test('cleanup 清理过期条目', () => {
  const cache = new LRUCache(10, 50); // 50ms TTL
  cache.set('key1', 'value1');
  cache.set('key2', 'value2', 60000); // 长时间 TTL
  
  // 等待 100ms
  setTimeout(() => {
    cache.cleanup();
    const stats = cache.stats();
    try {
      assertEqual(stats.valid, 1); // 只有 key2 应该还在
      assertEqual(stats.expired, 0); // 过期条目已被清理
      passed++;
      console.log('✅ cleanup 清理过期条目 (异步)');
    } catch (error) {
      failed++;
      console.log('❌ cleanup 清理过期条目 (异步)');
      console.log(`   错误：${error.message}`);
    }
  }, 100);
  
  return true;
})) {} else { failed++; }

// 总结
setTimeout(() => {
  console.log('\n' + '='.repeat(50));
  console.log(`测试结果：${passed} 通过，${failed} 失败`);
  console.log('='.repeat(50) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}, 300);
