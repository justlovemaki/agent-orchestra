const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json');

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(WORKFLOWS_FILE);
  } catch {
    await fs.writeFile(WORKFLOWS_FILE, '[]\n');
  }
}

async function loadWorkflows() {
  await ensureData();
  const data = await fs.readFile(WORKFLOWS_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveWorkflows(workflows) {
  await ensureData();
  await fs.writeFile(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2) + '\n');
}

async function createWorkflow(body) {
  if (!body.name?.trim()) {
    throw new Error('工作流名称不能为空');
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  const steps = (body.steps || []).map(step => ({
    id: step.id || crypto.randomUUID(),
    agentId: step.agentId || '',
    prompt: step.prompt || '',
    dependsOn: Array.isArray(step.dependsOn) ? step.dependsOn : []
  }));

  const workflow = {
    id,
    name: body.name.trim(),
    description: body.description?.trim() || '',
    steps,
    createdAt: now,
    updatedAt: now
  };

  const workflows = await loadWorkflows();
  workflows.push(workflow);
  await saveWorkflows(workflows);

  return workflow;
}

async function getWorkflow(workflowId) {
  const workflows = await loadWorkflows();
  return workflows.find(w => w.id === workflowId) || null;
}

async function updateWorkflow(workflowId, body) {
  const workflows = await loadWorkflows();
  const idx = workflows.findIndex(w => w.id === workflowId);
  if (idx === -1) {
    throw new Error('工作流不存在');
  }

  const workflow = workflows[idx];

  if (body.name != null) {
    workflow.name = body.name.trim();
  }
  if (body.description != null) {
    workflow.description = body.description.trim();
  }
  if (body.steps != null) {
    workflow.steps = body.steps.map(step => ({
      id: step.id || crypto.randomUUID(),
      agentId: step.agentId || '',
      prompt: step.prompt || '',
      dependsOn: Array.isArray(step.dependsOn) ? step.dependsOn : []
    }));
  }

  workflow.updatedAt = Date.now();
  await saveWorkflows(workflows);

  return workflow;
}

async function deleteWorkflow(workflowId) {
  const workflows = await loadWorkflows();
  const idx = workflows.findIndex(w => w.id === workflowId);
  if (idx === -1) {
    throw new Error('工作流不存在');
  }

  workflows.splice(idx, 1);
  await saveWorkflows(workflows);

  return { success: true };
}

module.exports = {
  loadWorkflows,
  saveWorkflows,
  createWorkflow,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow
};