/**
 * 分页模块测试
 */

const { parsePagination, paginate, sliceArray } = require('../../lib/pagination');

function createMockRequest(url) {
  return { url };
}

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

// parsePagination 测试
console.log('\n📋 parsePagination 测试\n');

if (test('解析默认分页参数', () => {
  const req = createMockRequest('/api/tasks');
  const result = parsePagination(req);
  assertEqual(result, { page: 1, limit: 20, offset: 0 });
  passed++;
})) {} else { failed++; }

if (test('解析自定义 page 参数', () => {
  const req = createMockRequest('/api/tasks?page=3');
  const result = parsePagination(req);
  assertEqual(result.page, 3);
  assertEqual(result.offset, 40); // (3-1) * 20
  passed++;
})) {} else { failed++; }

if (test('解析自定义 limit 参数', () => {
  const req = createMockRequest('/api/tasks?limit=50');
  const result = parsePagination(req);
  assertEqual(result.limit, 50);
  passed++;
})) {} else { failed++; }

if (test('page 最小值为 1', () => {
  const req = createMockRequest('/api/tasks?page=-5');
  const result = parsePagination(req);
  assertEqual(result.page, 1);
  passed++;
})) {} else { failed++; }

if (test('limit 最小值为 1', () => {
  const req = createMockRequest('/api/tasks?limit=0');
  const result = parsePagination(req);
  assertEqual(result.limit, 1);
  passed++;
})) {} else { failed++; }

if (test('limit 最大值为 100', () => {
  const req = createMockRequest('/api/tasks?limit=500');
  const result = parsePagination(req);
  assertEqual(result.limit, 100);
  passed++;
})) {} else { failed++; }

// paginate 测试
console.log('\n📋 paginate 测试\n');

if (test('基本分页结果', () => {
  const data = [1, 2, 3, 4, 5];
  const result = paginate(data, 100, 1, 20);
  assertEqual(result.data, [1, 2, 3, 4, 5]);
  assertEqual(result.pagination.total, 100);
  assertEqual(result.pagination.page, 1);
  assertEqual(result.pagination.limit, 20);
  assertEqual(result.pagination.totalPages, 5);
  assertEqual(result.pagination.hasNext, true);
  assertEqual(result.pagination.hasPrev, false);
  passed++;
})) {} else { failed++; }

if (test('中间页', () => {
  const data = [1, 2, 3];
  const result = paginate(data, 10, 3, 3);
  assertEqual(result.pagination.totalPages, 4);
  assertEqual(result.pagination.hasNext, true);
  assertEqual(result.pagination.hasPrev, true);
  passed++;
})) {} else { failed++; }

if (test('最后一页', () => {
  const data = [1];
  const result = paginate(data, 10, 4, 3);
  assertEqual(result.pagination.hasNext, false);
  assertEqual(result.pagination.hasPrev, true);
  passed++;
})) {} else { failed++; }

if (test('只有一页', () => {
  const data = [1, 2, 3];
  const result = paginate(data, 3, 1, 20);
  assertEqual(result.pagination.totalPages, 1);
  assertEqual(result.pagination.hasNext, false);
  assertEqual(result.pagination.hasPrev, false);
  passed++;
})) {} else { failed++; }

// sliceArray 测试
console.log('\n📋 sliceArray 测试\n');

if (test('基本切片', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const result = sliceArray(arr, 0, 3);
  assertEqual(result, [1, 2, 3]);
  passed++;
})) {} else { failed++; }

if (test('中间切片', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const result = sliceArray(arr, 5, 3);
  assertEqual(result, [6, 7, 8]);
  passed++;
})) {} else { failed++; }

if (test('超出数组长度的切片', () => {
  const arr = [1, 2, 3];
  const result = sliceArray(arr, 0, 10);
  assertEqual(result, [1, 2, 3]);
  passed++;
})) {} else { failed++; }

if (test('空数组切片', () => {
  const arr = [];
  const result = sliceArray(arr, 0, 10);
  assertEqual(result, []);
  passed++;
})) {} else { failed++; }

// 总结
console.log('\n' + '='.repeat(50));
console.log(`测试结果：${passed} 通过，${failed} 失败`);
console.log('='.repeat(50) + '\n');

process.exit(failed > 0 ? 1 : 0);
