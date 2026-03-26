/**
 * 通知渠道模块测试
 */

const {
  createChannel,
  getChannel,
  getChannels,
  updateChannel,
  deleteChannel,
  toggleChannel,
  getChannelsByType,
  getSortedChannels,
  updateChannelPriority,
  reorderChannels,
  renderTemplate,
  VALID_CHANNEL_TYPES,
  DEFAULT_PRIORITY
} = require('../../lib/notification-channels');

const path = require('path');
const fs = require('fs').promises;

const TEST_DATA_DIR = path.join(__dirname, '../../data/test-channels');
const TEST_FILE = path.join(TEST_DATA_DIR, 'notification-channels.json');

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
  const channels = require('../../lib/notification-channels');
  channels.NOTIFICATION_CHANNELS_FILE = TEST_FILE;
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

  console.log('\n📋 创建渠道测试\n');

  if (test('创建渠道 - 基本参数', async () => {
    const channel = await createChannel({
      name: '测试渠道',
      type: 'feishu',
      webhook: 'https://example.com/webhook'
    });
    assert(channel.id, '应生成渠道ID');
    assertEqual(channel.name, '测试渠道');
    assertEqual(channel.type, 'feishu');
    assert(channel.isEnabled !== false, '默认应启用');
    passed++;
  })) {} else { failed++; }

  if (test('创建渠道 - 使用webhookUrl别名', async () => {
    const channel = await createChannel({
      name: '测试渠道2',
      type: 'dingtalk',
      webhookUrl: 'https://example.com/webhook'
    });
    assert(channel.webhook, '应设置webhook');
    passed++;
  })) {} else { failed++; }

  if (test('创建渠道 - 优先级自动递增', async () => {
    await createChannel({ name: '渠道1', type: 'feishu', webhook: 'https://a.com' });
    await createChannel({ name: '渠道2', type: 'dingtalk', webhook: 'https://b.com' });
    const channels = await getChannels();
    assert(channels[1].priority > channels[0].priority, '优先级应递增');
    passed++;
  })) {} else { failed++; }

  if (test('创建渠道 - 空名称应抛出异常', async () => {
    await assertThrowsAsync(() => createChannel({ name: '', type: 'feishu', webhook: 'https://x.com' }), '空名称应报错');
    passed++;
  })) {} else { failed++; }

  if (test('创建渠道 - 无效类型应抛出异常', async () => {
    await assertThrowsAsync(() => createChannel({ name: '测试', type: 'invalid', webhook: 'https://x.com' }), '无效类型应报错');
    passed++;
  })) {} else { failed++; }

  if (test('创建渠道 - 缺少webhook应抛出异常', async () => {
    await assertThrowsAsync(() => createChannel({ name: '测试', type: 'feishu' }), '缺少webhook应报错');
    passed++;
  })) {} else { failed++; }

  if (test('创建渠道 - 所有有效类型', async () => {
    for (const type of VALID_CHANNEL_TYPES) {
      const channel = await createChannel({ name: `渠道-${type}`, type, webhook: 'https://x.com' });
      assertEqual(channel.type, type);
    }
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 获取渠道测试\n');

  if (test('获取渠道 - 存在的渠道', async () => {
    const created = await createChannel({ name: '获取测试', type: 'feishu', webhook: 'https://x.com' });
    const channel = await getChannel(created.id);
    assertEqual(channel.id, created.id);
    passed++;
  })) {} else { failed++; }

  if (test('获取渠道 - 不存在的渠道', async () => {
    const channel = await getChannel('non-existent-id');
    assertEqual(channel, null);
    passed++;
  })) {} else { failed++; }

  if (test('获取渠道 - 获取所有渠道', async () => {
    await createChannel({ name: '全部1', type: 'feishu', webhook: 'https://a.com' });
    await createChannel({ name: '全部2', type: 'dingtalk', webhook: 'https://b.com' });
    const channels = await getChannels();
    assert(channels.length >= 2, '应返回多个渠道');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 更新渠道测试\n');

  if (test('更新渠道 - 更新名称', async () => {
    const created = await createChannel({ name: '原名称', type: 'feishu', webhook: 'https://x.com' });
    const updated = await updateChannel(created.id, { name: '新名称' });
    assertEqual(updated.name, '新名称');
    passed++;
  })) {} else { failed++; }

  if (test('更新渠道 - 切换启用状态', async () => {
    const created = await createChannel({ name: '测试', type: 'feishu', webhook: 'https://x.com' });
    const updated = await updateChannel(created.id, { isEnabled: false });
    assertEqual(updated.isEnabled, false);
    passed++;
  })) {} else { failed++; }

  if (test('更新渠道 - 更新优先级', async () => {
    const created = await createChannel({ name: '优先级测试', type: 'feishu', webhook: 'https://x.com' });
    const updated = await updateChannel(created.id, { priority: 1 });
    assertEqual(updated.priority, 1);
    passed++;
  })) {} else { failed++; }

  if (test('更新渠道 - 优先级边界值', async () => {
    const created = await createChannel({ name: '边界测试', type: 'feishu', webhook: 'https://x.com' });
    const updated = await updateChannel(created.id, { priority: 15 });
    assertEqual(updated.priority, 10, '优先级应限制为最大10');
    passed++;
  })) {} else { failed++; }

  if (test('更新渠道 - 不存在的渠道', async () => {
    await assertThrowsAsync(() => updateChannel('non-existent-id', { name: '测试' }), '更新不存在渠道应报错');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 删除渠道测试\n');

  if (test('删除渠道 - 成功删除', async () => {
    const created = await createChannel({ name: '待删除', type: 'feishu', webhook: 'https://x.com' });
    const deleted = await deleteChannel(created.id);
    assertEqual(deleted.id, created.id);
    const result = await getChannel(created.id);
    assertEqual(result, null);
    passed++;
  })) {} else { failed++; }

  if (test('删除渠道 - 不存在的渠道', async () => {
    await assertThrowsAsync(() => deleteChannel('non-existent-id'), '删除不存在渠道应报错');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 切换和排序测试\n');

  if (test('切换渠道 - toggleChannel', async () => {
    const created = await createChannel({ name: '切换测试', type: 'feishu', webhook: 'https://x.com' });
    const toggled = await toggleChannel(created.id);
    assertEqual(toggled.isEnabled, false);
    const toggledBack = await toggleChannel(created.id);
    assertEqual(toggledBack.isEnabled, true);
    passed++;
  })) {} else { failed++; }

  if (test('按类型获取渠道 - getChannelsByType', async () => {
    await createChannel({ name: '飞书1', type: 'feishu', webhook: 'https://a.com' });
    await createChannel({ name: '飞书2', type: 'feishu', webhook: 'https://b.com' });
    await createChannel({ name: '钉钉', type: 'dingtalk', webhook: 'https://c.com' });
    const feishuChannels = await getChannelsByType('feishu');
    assertEqual(feishuChannels.length, 2);
    passed++;
  })) {} else { failed++; }

  if (test('排序渠道 - getSortedChannels', async () => {
    await createChannel({ name: '低优先级', type: 'feishu', webhook: 'https://a.com', priority: 10 });
    await createChannel({ name: '高优先级', type: 'dingtalk', webhook: 'https://b.com', priority: 1 });
    const sorted = await getSortedChannels();
    assertEqual(sorted[0].name, '高优先级');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 模板渲染测试\n');

  if (test('模板渲染 - 基本占位符', async () => {
    const result = renderTemplate('告警: {agentName} 负载 {level}', {
      agentName: 'agent-1',
      level: 'high'
    });
    assertEqual(result, '告警: agent-1 负载 high');
    passed++;
  })) {} else { failed++; }

  if (test('模板渲染 - 多个相同占位符', async () => {
    const result = renderTemplate('{agentName} 告警 {agentName}', {
      agentName: 'test'
    });
    assertEqual(result, 'test 告警 test');
    passed++;
  })) {} else { failed++; }

  if (test('模板渲染 - 缺失占位符保留原样', async () => {
    const result = renderTemplate('{agentName} {missing}', { agentName: 'test' });
    assertEqual(result, 'test {missing}');
    passed++;
  })) {} else { failed++; }

  if (test('模板渲染 - 所有支持的占位符', async () => {
    const template = '{agentName} {workload} {threshold} {level} {time} {percentage} {backupType} {fileSize} {duration} {error} {fileName}';
    const result = renderTemplate(template, {
      agentName: 'a', workload: 'w', threshold: 't', level: 'l',
      time: 'ti', percentage: 'p', backupType: 'b', fileSize: 'fs',
      duration: 'd', error: 'e', fileName: 'fn'
    });
    assertEqual(result, 'a w t l ti p b fs d e fn');
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
