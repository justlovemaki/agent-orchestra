const fs = require('fs').promises;
const path = require('path');
const { execFile } = require('child_process');
const crypto = require('crypto');

const workflowCompletionNotifier = require('./workflow-completion-notifier');
const { emitWorkflowStarted, emitWorkflowCompleted } = require('./plugin-event-system');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json');
const WORKFLOW_RUNS_FILE = path.join(DATA_DIR, 'workflow-runs.json');

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(WORKFLOW_RUNS_FILE);
  } catch {
    await fs.writeFile(WORKFLOW_RUNS_FILE, '[]\n');
  }
}

async function loadWorkflowRuns() {
  await ensureData();
  const data = await fs.readFile(WORKFLOW_RUNS_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveWorkflowRuns(runs) {
  await ensureData();
  await fs.writeFile(WORKFLOW_RUNS_FILE, JSON.stringify(runs, null, 2) + '\n');
}

async function loadWorkflow(workflowId) {
  const workflows = JSON.parse(await fs.readFile(WORKFLOWS_FILE, 'utf8'));
  return workflows.find(w => w.id === workflowId) || null;
}

function runOpenClaw(args, timeout = 600000) {
  return new Promise((resolve, reject) => {
    execFile('openclaw', ['--no-color', ...args], { timeout, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function cleanCliJson(text) {
  const cleaned = String(text || '').replace(/\u001b[[0-9;]*m/g, '');
  const start = cleaned.search(/[\[{]/);
  if (start === -1) return null;

  const stack = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{' || ch === '[') {
      stack.push(ch);
      continue;
    }

    if (ch === '}' || ch === ']') {
      const expected = ch === '}' ? '{' : '[';
      const actual = stack.pop();
      if (actual !== expected) return null;
      if (stack.length === 0) {
        return cleaned.slice(start, i + 1).trim();
      }
    }
  }

  return null;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function substituteVariables(prompt, stepResults) {
  return prompt.replace(/\{\{step\.(\d+)\}\}/g, (match, stepIndex) => {
    const idx = parseInt(stepIndex, 10);
    const result = stepResults[idx];
    if (result && result.output) {
      return typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
    }
    return match;
  });
}

function sortStepsByDependencies(steps) {
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(step, index) {
    if (visited.has(index)) return;
    if (visiting.has(index)) {
      throw new Error(`循环依赖检测到步骤: ${step.id}`);
    }

    visiting.add(index);

    const dependsOn = step.dependsOn || [];
    for (const depId of dependsOn) {
      const depIndex = steps.findIndex(s => s.id === depId);
      if (depIndex === -1) {
        throw new Error(`步骤 ${step.id} 依赖的步骤 ${depId} 不存在`);
      }
      visit(steps[depIndex], depIndex);
    }

    visiting.delete(index);
    visited.add(index);
    sorted.push({ ...step, originalIndex: index });
  }

  for (let i = 0; i < steps.length; i++) {
    visit(steps[i], i);
  }

  return sorted;
}

async function executeStep(step, prompt, workflowRunId) {
  const stepId = crypto.randomUUID();
  console.log(`[workflow-run:${workflowRunId}] step ${step.originalIndex + 1} dispatch -> ${step.agentId}`);

  const startTime = Date.now();

  try {
    const result = await runOpenClaw(['agent', '--agent', step.agentId, '--message', prompt, '--json'], 600000);
    const duration = Date.now() - startTime;

    console.log(`[workflow-run:${workflowRunId}] step ${step.originalIndex + 1} completed`);

    return {
      stepId: step.id,
      stepIndex: step.originalIndex,
      agentId: step.agentId,
      status: 'completed',
      startedAt: startTime,
      finishedAt: Date.now(),
      duration,
      exitCode: 0,
      output: safeJson(cleanCliJson(result.stdout) || result.stdout) || { raw: result.stdout.trim() },
      error: null
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[workflow-run:${workflowRunId}] step ${step.originalIndex + 1} failed`);
    console.error(error.stderr || error.stdout || error.message);

    return {
      stepId: step.id,
      stepIndex: step.originalIndex,
      agentId: step.agentId,
      status: 'failed',
      startedAt: startTime,
      finishedAt: Date.now(),
      duration,
      exitCode: error.code ?? 1,
      output: null,
      error: (error.stderr || error.stdout || error.message || '').slice(-12000)
    };
  }
}

async function runWorkflow(workflowId, options = {}) {
  const stopOnFailure = options.stopOnFailure !== false;

  const workflow = await loadWorkflow(workflowId);
  if (!workflow) {
    throw new Error('工作流不存在');
  }

  const workflowRunId = crypto.randomUUID();
  const now = Date.now();

  const workflowRun = {
    id: workflowRunId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: 'running',
    stopOnFailure,
    startedAt: now,
    finishedAt: null,
    steps: [],
    error: null
  };

  const runs = await loadWorkflowRuns();
  runs.push(workflowRun);
  await saveWorkflowRuns(runs);

  console.log(`[workflow-run:${workflowRunId}] starting workflow: ${workflow.name}`);

  emitWorkflowStarted({
    workflowRunId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: 'running',
    startedAt: now,
    steps: workflow.steps
  }).catch(err => console.error('[EventSystem] Failed to emit workflow.started:', err.message));

  try {
    const sortedSteps = sortStepsByDependencies(workflow.steps);
    const stepResults = [];

    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      const substitutedPrompt = substituteVariables(step.prompt, stepResults);

      const stepResult = await executeStep(step, substitutedPrompt, workflowRunId);

      workflowRun.steps.push(stepResult);
      stepResults[i] = stepResult;

      await saveWorkflowRuns((await loadWorkflowRuns()).map(r =>
        r.id === workflowRunId ? { ...workflowRun } : r
      ));

      if (stepResult.status === 'failed') {
        if (stopOnFailure) {
          console.log(`[workflow-run:${workflowRunId}] step ${step.originalIndex + 1} failed, stopping workflow`);
          workflowRun.status = 'failed';
          workflowRun.error = `步骤 ${step.originalIndex + 1} 执行失败: ${stepResult.error}`;
          workflowRun.finishedAt = Date.now();
          await saveWorkflowRuns((await loadWorkflowRuns()).map(r =>
            r.id === workflowRunId ? { ...workflowRun } : r
          ));
          return workflowRun;
        } else {
          console.log(`[workflow-run:${workflowRunId}] step ${step.originalIndex + 1} failed, continuing (stopOnFailure=false)`);
        }
      }
    }

    const allCompleted = workflowRun.steps.every(s => s.status === 'completed');
    workflowRun.status = allCompleted ? 'completed' : 'failed';
    workflowRun.finishedAt = Date.now();

    if (!allCompleted) {
      const failedSteps = workflowRun.steps.filter(s => s.status === 'failed');
      workflowRun.error = `${failedSteps.length} 个步骤执行失败`;
    }

    await saveWorkflowRuns((await loadWorkflowRuns()).map(r =>
      r.id === workflowRunId ? { ...workflowRun } : r
    ));

    console.log(`[workflow-run:${workflowRunId}] workflow finished with status: ${workflowRun.status}`);
    
    workflowCompletionNotifier.sendWorkflowCompletionNotification(workflowRun).catch(err => {
      console.error(`[workflow-run:${workflowRunId}] notification error:`, err.message);
    });

    emitWorkflowCompleted({
      workflowRunId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: workflowRun.status,
      startedAt: workflowRun.startedAt,
      finishedAt: workflowRun.finishedAt,
      steps: workflowRun.steps,
      error: workflowRun.error
    }).catch(err => console.error('[EventSystem] Failed to emit workflow.completed:', err.message));
    
    return workflowRun;

  } catch (error) {
    console.error(`[workflow-run:${workflowRunId}] workflow error:`, error);
    workflowRun.status = 'failed';
    workflowRun.error = error.message;
    workflowRun.finishedAt = Date.now();
    await saveWorkflowRuns((await loadWorkflowRuns()).map(r =>
      r.id === workflowRunId ? { ...workflowRun } : r
    ));
    
    workflowCompletionNotifier.sendWorkflowCompletionNotification(workflowRun).catch(err => {
      console.error(`[workflow-run:${workflowRunId}] notification error:`, err.message);
    });

    emitWorkflowCompleted({
      workflowRunId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'failed',
      startedAt: workflowRun.startedAt,
      finishedAt: workflowRun.finishedAt,
      error: error.message
    }).catch(err => console.error('[EventSystem] Failed to emit workflow.completed:', err.message));
    
    throw error;
  }
}

async function getWorkflowRun(runId) {
  const runs = await loadWorkflowRuns();
  return runs.find(r => r.id === runId) || null;
}

async function getWorkflowRuns(workflowId) {
  const runs = await loadWorkflowRuns();
  return runs.filter(r => r.workflowId === workflowId).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
}

module.exports = {
  runWorkflow,
  getWorkflowRun,
  getWorkflowRuns,
  loadWorkflowRuns,
  saveWorkflowRuns
};
