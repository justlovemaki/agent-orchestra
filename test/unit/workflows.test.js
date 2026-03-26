/**
 * 工作流模块测试
 */

const {
  createWorkflow,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  loadWorkflows,
  saveWorkflows
} = require('../../lib/workflows');

const path = require('path');
const fs = require('fs').promises;

const TEST_DATA_DIR = path.join(__dirname, '../../data/test-workflows');
const TEST_FILE = path.join(TEST_DATA_DIR, 'workflows.json');

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

let passed = 0;
let failed = 0;

async function setup() {
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  await fs.writeFile(TEST_FILE, '[]\n');
  const workflows = require('../../lib/workflows');
  workflows.WORKFLOWS_FILE = TEST_FILE;
}

async function cleanup() {
  try {
    await fs.unlink(TEST_FILE);
  } catch {}
  try {
    await fs.rmdir(TEST_DATA_DIR);
  } catch {}
}

async function runTests() {
  await setup();

  console.log('\n📋 创建工作流测试\n');

  if (test('创建工作流 - 基本参数', async () => {
    const workflow = await createWorkflow({ name: '测试工作流' });
    assert(workflow.id, '应生成工作流ID');
    assertEqual(workflow.name, '测试工作流');
    assertEqual(workflow.steps, []);
    assert(workflow.createdAt, '应设置创建时间');
    passed++;
  })) {} else { failed++; }

  if (test('创建工作流 - 带描述', async () => {
    const workflow = await createWorkflow({ name: '工作流2', description: '这是一个测试工作流' });
    assertEqual(workflow.description, '这是一个测试工作流');
    passed++;
  })) {} else { failed++; }

  if (test('创建工作流 - 带步骤', async () => {
    const workflow = await createWorkflow({
      name: '工作流3',
      steps: [
        { agentId: 'agent-1', prompt: '步骤1' },
        { agentId: 'agent-2', prompt: '步骤2', dependsOn: ['step-1'] }
      ]
    });
    assertEqual(workflow.steps.length, 2);
    assertEqual(workflow.steps[0].agentId, 'agent-1');
    assertEqual(workflow.steps[1].dependsOn, ['step-1']);
    passed++;
  })) {} else { failed++; }

  if (test('创建工作流 - 空名称应抛出异常', async () => {
    await assertThrowsAsync(() => createWorkflow({ name: '' }), '空名称应报错');
    passed++;
  })) {} else { failed++; }

  if (test('创建工作流 - 仅空格名称应抛出异常', async () => {
    await assertThrowsAsync(() => createWorkflow({ name: '   ' }), '仅空格名称应报错');
    passed++;
  })) {} else { failed++; }

  if (test('创建工作流 - 无名称应抛出异常', async () => {
    await assertThrowsAsync(() => createWorkflow({}), '无名称应报错');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 获取工作流测试\n');

  if (test('获取工作流 - 存在的工作流', async () => {
    const created = await createWorkflow({ name: '获取测试' });
    const workflow = await getWorkflow(created.id);
    assertEqual(workflow.id, created.id);
    assertEqual(workflow.name, '获取测试');
    passed++;
  })) {} else { failed++; }

  if (test('获取工作流 - 不存在的工作流', async () => {
    const workflow = await getWorkflow('non-existent-id');
    assertEqual(workflow, null);
    passed++;
  })) {} else { failed++; }

  if (test('获取工作流 - 多个工作流', async () => {
    await createWorkflow({ name: '工作流A' });
    await createWorkflow({ name: '工作流B' });
    const workflows = await loadWorkflows();
    assert(workflows.length >= 2, '应返回多个工作流');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 更新工作流测试\n');

  if (test('更新工作流 - 更新名称', async () => {
    const created = await createWorkflow({ name: '原名称' });
    const updated = await updateWorkflow(created.id, { name: '新名称' });
    assertEqual(updated.name, '新名称');
    passed++;
  })) {} else { failed++; }

  if (test('更新工作流 - 更新描述', async () => {
    const created = await createWorkflow({ name: '测试', description: '原描述' });
    const updated = await updateWorkflow(created.id, { description: '新描述' });
    assertEqual(updated.description, '新描述');
    passed++;
  })) {} else { failed++; }

  if (test('更新工作流 - 更新步骤', async () => {
    const created = await createWorkflow({ name: '测试', steps: [{ agentId: 'a1' }] });
    const updated = await updateWorkflow(created.id, { steps: [{ agentId: 'a2', prompt: '新步骤' }] });
    assertEqual(updated.steps.length, 1);
    assertEqual(updated.steps[0].agentId, 'a2');
    passed++;
  })) {} else { failed++; }

  if (test('更新工作流 - 不存在的工作流', async () => {
    await assertThrowsAsync(() => updateWorkflow('non-existent-id', { name: '测试' }), '更新不存在工作流应报错');
    passed++;
  })) {} else { failed++; }

  if (test('更新工作流 - 更新updatedAt时间戳', async () => {
    const created = await createWorkflow({ name: '时间测试' });
    const originalTime = created.updatedAt;
    await new Promise(r => setTimeout(r, 10));
    const updated = await updateWorkflow(created.id, { name: '新名称' });
    assert(updated.updatedAt > originalTime, '更新时间戳应更新');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 删除工作流测试\n');

  if (test('删除工作流 - 成功删除', async () => {
    const created = await createWorkflow({ name: '待删除' });
    const result = await deleteWorkflow(created.id);
    assert(result.success, '删除应返回成功');
    const deleted = await getWorkflow(created.id);
    assertEqual(deleted, null);
    passed++;
  })) {} else { failed++; }

  if (test('删除工作流 - 不存在的工作流', async () => {
    await assertThrowsAsync(() => deleteWorkflow('non-existent-id'), '删除不存在工作流应报错');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 边界情况测试\n');

  if (test('工作流步骤依赖处理 - 空数组', async () => {
    const workflow = await createWorkflow({
      name: '依赖测试',
      steps: [{ agentId: 'a1', dependsOn: [] }]
    });
    assertEqual(workflow.steps[0].dependsOn, []);
    passed++;
  })) {} else { failed++; }

  if (test('工作流步骤依赖处理 - 字符串转数组', async () => {
    const workflow = await createWorkflow({
      name: '依赖测试2',
      steps: [{ agentId: 'a1', dependsOn: 'not-array' }]
    });
    assertEqual(workflow.steps[0].dependsOn, []);
    passed++;
  })) {} else { failed++; }

  if (test('工作流步骤ID自动生成', async () => {
    const workflow = await createWorkflow({
      name: 'ID测试',
      steps: [{ prompt: '无ID步骤' }]
    });
    assert(workflow.steps[0].id, '步骤应有自动生成的ID');
    passed++;
  })) {} else { failed++; }

  if (test('更新空步骤应清空步骤', async () => {
    const created = await createWorkflow({ name: '步骤测试', steps: [{ agentId: 'a1' }] });
    const updated = await updateWorkflow(created.id, { steps: [] });
    assertEqual(updated.steps, []);
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
