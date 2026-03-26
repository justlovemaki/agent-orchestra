/**
 * 定时备份模块测试
 */

const scheduledBackup = require('../../lib/scheduled-backup');

const path = require('path');
const fs = require('fs').promises;

const TEST_DATA_DIR = path.join(__dirname, '../../data/test-backup');
const TEST_CONFIG_FILE = path.join(TEST_DATA_DIR, 'scheduled-backup-config.json');
const TEST_HISTORY_FILE = path.join(TEST_DATA_DIR, 'scheduled-backup-history.json');
const TEST_BACKUPS_DIR = path.join(TEST_DATA_DIR, 'backups');

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
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  await fs.mkdir(TEST_BACKUPS_DIR, { recursive: true });
  await fs.writeFile(TEST_CONFIG_FILE, JSON.stringify({ enabled: false, frequency: 'daily', time: '02:00' }) + '\n');
  await fs.writeFile(TEST_HISTORY_FILE, '[]\n');
  
  const backup = require('../../lib/scheduled-backup');
  backup.CONFIG_FILE = TEST_CONFIG_FILE;
  backup.HISTORY_FILE = TEST_HISTORY_FILE;
  backup.BACKUPS_DIR = TEST_BACKUPS_DIR;
  
  scheduledBackup.setBackupCreateFunction(async (mode) => {
    return {
      tasks: [{ id: 'task-1', name: 'Test Task' }],
      workflows: [],
      config: { mode }
    };
  });
  
  scheduledBackup.setNotificationFunction(async (notification) => {
    return { success: true };
  });
}

async function cleanup() {
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch {}
}

async function runTests() {
  await setup();

  console.log('\n📋 配置测试\n');

  if (test('获取默认配置', async () => {
    const config = await scheduledBackup.getConfig();
    assertEqual(config.frequency, 'daily');
    assertEqual(config.time, '02:00');
    assertEqual(config.enabled, false);
    passed++;
  })) {} else { failed++; }

  if (test('更新配置 - 基本参数', async () => {
    const result = await scheduledBackup.updateConfig({
      frequency: 'weekly',
      time: '03:00',
      dayOfWeek: 1
    });
    assertEqual(result.config.frequency, 'weekly');
    assertEqual(result.config.time, '03:00');
    passed++;
  })) {} else { failed++; }

  if (test('更新配置 - 设置保留数量', async () => {
    const result = await scheduledBackup.updateConfig({
      retentionCount: 10
    });
    assertEqual(result.config.retentionCount, 10);
    passed++;
  })) {} else { failed++; }

  if (test('更新配置 - 启用定时器', async () => {
    const result = await scheduledBackup.updateConfig({
      enabled: true,
      frequency: 'daily',
      time: '23:59'
    });
    assertEqual(result.config.enabled, true);
    assert(result.nextRunTime, '应返回下次运行时间');
    passed++;
  })) {} else { failed++; }

  if (test('更新配置 - 禁用定时器', async () => {
    await scheduledBackup.updateConfig({ enabled: true });
    const result = await scheduledBackup.updateConfig({ enabled: false });
    assertEqual(result.config.enabled, false);
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 备份执行测试\n');

  if (test('执行备份 - 成功执行', async () => {
    const result = await scheduledBackup.executeScheduledBackup();
    assert(result.success, '备份应成功');
    assert(result.fileName, '应生成备份文件名');
    assert(result.fileSize > 0, '应记录文件大小');
    passed++;
  })) {} else { failed++; }

  if (test('执行备份 - 备份文件内容正确', async () => {
    const result = await scheduledBackup.executeScheduledBackup();
    const filePath = path.join(TEST_BACKUPS_DIR, result.fileName);
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    assert(data.tasks, '备份应包含任务数据');
    const files = await fs.readdir(TEST_BACKUPS_DIR);
    assert(files.length > 0, '应生成备份文件');
    passed++;
  })) {} else { failed++; }

  if (test('执行备份 - 禁用时返回null', async () => {
    await scheduledBackup.updateConfig({ enabled: false });
    const result = await scheduledBackup.executeScheduledBackup();
    assertEqual(result, null);
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 历史记录测试\n');

  if (test('获取历史记录 - 默认限制', async () => {
    const history = await scheduledBackup.getHistory();
    assert(Array.isArray(history), '应返回数组');
    passed++;
  })) {} else { failed++; }

  if (test('获取历史记录 - 自定义限制', async () => {
    const history = await scheduledBackup.getHistory(5);
    assert(history.length <= 5, '应限制返回数量');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 下次运行时间测试\n');

  if (test('计算下次运行时间 - 禁用状态返回null', async () => {
    const config = { enabled: false };
    const nextTime = scheduledBackup.getNextScheduledTime(config);
    assertEqual(nextTime, null);
    passed++;
  })) {} else { failed++; }

  if (test('计算下次运行时间 - 启用状态返回时间戳', async () => {
    const config = { enabled: true, frequency: 'daily', time: '23:59' };
    const nextTime = scheduledBackup.getNextScheduledTime(config);
    assert(nextTime > Date.now(), '下次运行时间应是将来的时间戳');
    passed++;
  })) {} else { failed++; }

  if (test('计算下次运行时间 - 每周频率', async () => {
    const config = { enabled: true, frequency: 'weekly', time: '12:00', dayOfWeek: 1 };
    const nextTime = scheduledBackup.getNextScheduledTime(config);
    const nextDate = new Date(nextTime);
    assertEqual(nextDate.getDay(), 1, '应该是周一');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 调度器测试\n');

  if (test('启动调度器', () => {
    scheduledBackup.startScheduler();
    passed++;
  })) {} else { failed++; }

  if (test('停止调度器', async () => {
    await scheduledBackup.stopScheduler();
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 边界情况测试\n');

  if (test('备份函数未设置时执行返回null', async () => {
    scheduledBackup.setBackupCreateFunction(null);
    await scheduledBackup.updateConfig({ enabled: false });
    const result = await scheduledBackup.executeScheduledBackup();
    assertEqual(result, null);
    passed++;
  })) {} else { failed++; }

  if (test('计算下次运行时间 - 每天频率', async () => {
    const config = { enabled: true, frequency: 'daily', time: '23:59' };
    const nextTime = scheduledBackup.getNextScheduledTime(config);
    const nextDate = new Date(nextTime);
    assert(nextTime > Date.now(), '下次运行时间应是将来的时间戳');
    passed++;
  })) {} else { failed++; }

  if (test('清理旧备份', async () => {
    await scheduledBackup.updateConfig({ retentionCount: 1 });
    await scheduledBackup.executeScheduledBackup();
    await scheduledBackup.executeScheduledBackup();
    const files = await fs.readdir(TEST_BACKUPS_DIR);
    assert(files.length <= 2, '超过保留数的备份应被清理');
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
