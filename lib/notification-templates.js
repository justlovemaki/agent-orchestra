const fs = require('fs').promises;
const path = require('path');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const TEMPLATES_FILE = path.join(DATA_DIR, 'notification-templates.json');

const TEMPLATE_TYPES = ['backup_success', 'backup_failed', 'workload_warning', 'workload_critical', 'task_completed', 'task_failed', 'workflow_completed', 'workflow_failed'];

const DEFAULT_TEMPLATES = {
  backup_success: {
    id: 'backup_success',
    name: '备份成功',
    type: 'backup_success',
    template: `📦 Agent Orchestra 定时备份通知\n━━━━━━━━━━━━━━━━━━━━\n⏰ 时间：{time}\n📋 类型：{backupType}\n📊 状态：成功\n📁 文件：{fileName}\n💾 大小：{fileSize}\n⏱️ 耗时：{duration}\n━━━━━━━━━━━━━━━━━━━━`
  },
  backup_failed: {
    id: 'backup_failed',
    name: '备份失败',
    type: 'backup_failed',
    template: `📦 Agent Orchestra 定时备份通知\n━━━━━━━━━━━━━━━━━━━━\n⏰ 时间：{time}\n📋 类型：{backupType}\n📊 状态：失败\n❌ 错误：{error}\n━━━━━━━━━━━━━━━━━━━━`
  },
  workload_warning: {
    id: 'workload_warning',
    name: '负载预警警告',
    type: 'workload_warning',
    template: `🚨 [{level}] Agent 负载预警\n━━━━━━━━━━━━━━━━━━━━\n⏰ 时间：{time}\n📊 阈值：{threshold}\n⚠️ 级别：{level}\n⚠️ Agent: {agentName}\n📈 负载：{workload} 个任务 ({percentage}%)\n━━━━━━━━━━━━━━━━━━━━`
  },
  workload_critical: {
    id: 'workload_critical',
    name: '负载预警严重',
    type: 'workload_critical',
    template: `🚨 [{level}] Agent 负载告警\n━━━━━━━━━━━━━━━━━━━━\n⏰ 时间：{time}\n📊 阈值：{threshold}\n🔴 级别：{level}\n🔴 Agent: {agentName}\n📈 负载：{workload} 个任务 ({percentage}%)\n━━━━━━━━━━━━━━━━━━━━`
  },
  task_completed: {
    id: 'task_completed',
    name: '任务完成',
    type: 'task_completed',
    template: `✅ 任务完成通知\n━━━━━━━━━━━━━━━━━━━━\n⏰ 时间：{time}\n📋 任务：{taskTitle}\n📊 状态：完成\n🤖 Agent: {agentName}\n⏱️ 耗时：{duration}\n━━━━━━━━━━━━━━━━━━━━`
  },
  task_failed: {
    id: 'task_failed',
    name: '任务失败',
    type: 'task_failed',
    template: `❌ 任务失败通知\n━━━━━━━━━━━━━━━━━━━━\n⏰ 时间：{time}\n📋 任务：{taskTitle}\n📊 状态：失败\n🤖 Agent: {agentName}\n❌ 错误：{error}\n━━━━━━━━━━━━━━━━━━━━`
  },
  workflow_completed: {
    id: 'workflow_completed',
    name: '工作流完成',
    type: 'workflow_completed',
    template: `✅ 工作流完成通知\n━━━━━━━━━━━━━━━━━━━━\n⏰ 时间：{time}\n📋 工作流：{workflowName}\n🔖 运行ID：{runId}\n📊 状态：{status}\n⏱️ 耗时：{duration}\n📝 步骤数：{stepCount}\n━━━━━━━━━━━━━━━━━━━━`
  },
  workflow_failed: {
    id: 'workflow_failed',
    name: '工作流失败',
    type: 'workflow_failed',
    template: `❌ 工作流失败通知\n━━━━━━━━━━━━━━━━━━━━\n⏰ 时间：{time}\n📋 工作流：{workflowName}\n🔖 运行ID：{runId}\n📊 状态：{status}\n⏱️ 耗时：{duration}\n📝 步骤数：{stepCount}\n❌ 错误：{error}\n━━━━━━━━━━━━━━━━━━━━`
  }
};

const TEMPLATE_VARIABLES = [
  { name: 'agentName', description: 'Agent 名称' },
  { name: 'workload', description: '工作负载数量' },
  { name: 'threshold', description: '阈值' },
  { name: 'level', description: '预警级别（警告/严重）' },
  { name: 'time', description: '触发时间' },
  { name: 'percentage', description: '负载百分比' },
  { name: 'backupType', description: '备份类型（增量/完整）' },
  { name: 'fileSize', description: '文件大小' },
  { name: 'duration', description: '耗时' },
  { name: 'error', description: '错误信息' },
  { name: 'fileName', description: '文件名' },
  { name: 'taskTitle', description: '任务标题' },
  { name: 'workflowName', description: '工作流名称' },
  { name: 'runId', description: '运行ID' },
  { name: 'status', description: '状态' },
  { name: 'stepCount', description: '步骤数量' },
  { name: 'stepSummary', description: '步骤摘要' }
];

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(TEMPLATES_FILE);
  } catch {
    await fs.writeFile(TEMPLATES_FILE, JSON.stringify(DEFAULT_TEMPLATES, null, 2) + '\n');
  }
}

async function loadTemplates() {
  await ensureData();
  const data = await fs.readFile(TEMPLATES_FILE, 'utf8');
  const templates = JSON.parse(data);
  for (const key of TEMPLATE_TYPES) {
    if (!templates[key]) {
      templates[key] = { ...DEFAULT_TEMPLATES[key] };
    }
  }
  return templates;
}

async function saveTemplates(templates) {
  await ensureData();
  await fs.writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2) + '\n');
}

async function getTemplates() {
  return await loadTemplates();
}

async function updateTemplates(newTemplates) {
  const templates = await loadTemplates();
  for (const [key, value] of Object.entries(newTemplates)) {
    if (templates[key]) {
      templates[key].template = value;
      templates[key].updatedAt = Date.now();
    }
  }
  await saveTemplates(templates);
  return templates;
}

async function resetTemplate(type) {
  if (!DEFAULT_TEMPLATES[type]) {
    throw new Error(`无效的模板类型：${type}`);
  }
  const templates = await loadTemplates();
  templates[type] = { ...DEFAULT_TEMPLATES[type] };
  await saveTemplates(templates);
  return templates[type];
}

async function resetAllTemplates() {
  await saveTemplates({ ...DEFAULT_TEMPLATES });
  return { ...DEFAULT_TEMPLATES };
}

module.exports = {
  getTemplates,
  updateTemplates,
  resetTemplate,
  resetAllTemplates,
  TEMPLATE_TYPES,
  TEMPLATE_VARIABLES,
  DEFAULT_TEMPLATES
};
