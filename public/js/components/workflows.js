/**
 * Workflows component - Workflow management UI
 */

import { state } from '../../state.js';
import { fetchJson, createWorkflow, updateWorkflow, deleteWorkflow, runWorkflow, cancelWorkflowRun } from '../../api.js';
import { escapeHtml, formatDate, show, hide } from '../../utils/dom.js';

export function getWorkflowElements() {
  return {
    showWorkflowFormBtn: document.getElementById('showWorkflowFormBtn'),
    workflowForm: document.getElementById('workflowForm'),
    workflowNameInput: document.getElementById('workflowNameInput'),
    workflowDescInput: document.getElementById('workflowDescInput'),
    workflowStepsList: document.getElementById('workflowStepsList'),
    addStepBtn: document.getElementById('addStepBtn'),
    saveWorkflowBtn: document.getElementById('saveWorkflowBtn'),
    cancelWorkflowBtn: document.getElementById('cancelWorkflowBtn'),
    workflowList: document.getElementById('workflowList')
  };
}

export function showWorkflowForm(workflow = null) {
  const { workflowForm, workflowNameInput, workflowDescInput } = getWorkflowElements();
  if (!workflowForm) return;
  
  show(workflowForm);
  
  if (workflow) {
    state.editingWorkflowId = workflow.id;
    if (workflowNameInput) workflowNameInput.value = workflow.name;
    if (workflowDescInput) workflowDescInput.value = workflow.description || '';
    renderWorkflowSteps(workflow.steps || []);
  } else {
    state.editingWorkflowId = null;
    if (workflowNameInput) workflowNameInput.value = '';
    if (workflowDescInput) workflowDescInput.value = '';
    renderWorkflowSteps([]);
  }
  
  if (workflowNameInput) workflowNameInput.focus();
}

export function hideWorkflowForm() {
  const { workflowForm } = getWorkflowElements();
  if (workflowForm) hide(workflowForm);
  state.editingWorkflowId = null;
}

export function renderWorkflowSteps(steps = []) {
  const { workflowStepsList } = getWorkflowElements();
  if (!workflowStepsList) return;
  
  workflowStepsList.innerHTML = steps.map((step, idx) => `
    <div class="workflow-step-item" data-step-index="${idx}">
      <div class="workflow-step-number">${idx + 1}</div>
      <div class="workflow-step-content">
        <input type="text" class="workflow-step-prompt" placeholder="步骤描述" value="${escapeHtml(step.prompt || '')}" />
        <input type="text" class="workflow-step-agent" placeholder="Agent ID" value="${escapeHtml(step.agentId || '')}" />
        <button class="ghost tiny remove-step-btn" data-step-index="${idx}">删除</button>
      </div>
    </div>
  `).join('');
  
  workflowStepsList.querySelectorAll('.remove-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.stepIndex, 10);
      const inputs = workflowStepsList.querySelectorAll('.workflow-step-item');
      if (inputs[idx]) inputs[idx].remove();
    });
  });
}

export function addWorkflowStep() {
  const { workflowStepsList } = getWorkflowElements();
  if (!workflowStepsList) return;
  
  const idx = workflowStepsList.children.length;
  const stepHtml = `
    <div class="workflow-step-item" data-step-index="${idx}">
      <div class="workflow-step-number">${idx + 1}</div>
      <div class="workflow-step-content">
        <input type="text" class="workflow-step-prompt" placeholder="步骤描述" />
        <input type="text" class="workflow-step-agent" placeholder="Agent ID" />
        <button class="ghost tiny remove-step-btn" data-step-index="${idx}">删除</button>
      </div>
    </div>
  `;
  workflowStepsList.insertAdjacentHTML('beforeend', stepHtml);
  
  const newStep = workflowStepsList.lastElementChild;
  newStep.querySelector('.remove-step-btn').addEventListener('click', () => newStep.remove());
  newStep.querySelector('.workflow-step-prompt').focus();
}

export function getWorkflowStepsFromForm() {
  const { workflowStepsList } = getWorkflowElements();
  if (!workflowStepsList) return [];
  
  const stepItems = workflowStepsList.querySelectorAll('.workflow-step-item');
  return Array.from(stepItems).map(item => ({
    prompt: item.querySelector('.workflow-step-prompt')?.value || '',
    agentId: item.querySelector('.workflow-step-agent')?.value || ''
  })).filter(s => s.prompt || s.agentId);
}

export async function saveWorkflow() {
  const { workflowNameInput, workflowDescInput } = getWorkflowElements();
  const name = workflowNameInput?.value.trim();
  if (!name) {
    alert('请输入工作流名称');
    return;
  }
  
  const steps = getWorkflowStepsFromForm();
  if (steps.length === 0) {
    alert('请至少添加一个步骤');
    return;
  }
  
  const payload = {
    name,
    description: workflowDescInput?.value || '',
    steps
  };
  
  try {
    if (state.editingWorkflowId) {
      await updateWorkflow(state.editingWorkflowId, payload);
    } else {
      await createWorkflow(payload);
    }
    
    hideWorkflowForm();
    if (state.currentUser) {
      await refreshWorkflows();
    }
    renderWorkflows();
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
}

export function renderWorkflows() {
  const { workflowList } = getWorkflowElements();
  if (!workflowList) return;
  
  const workflows = state.workflows || [];
  
  if (workflows.length === 0) {
    workflowList.innerHTML = '<div class="empty-state muted">暂无工作流</div>';
    return;
  }
  
  workflowList.innerHTML = workflows.map(wf => `
    <div class="workflow-card" data-workflow-id="${wf.id}">
      <div class="workflow-card-header">
        <span class="workflow-name">${escapeHtml(wf.name)}</span>
        <span class="workflow-steps-count">${wf.steps?.length || 0} 个步骤</span>
      </div>
      <div class="workflow-card-desc muted small">${escapeHtml(wf.description || '')}</div>
      <div class="workflow-card-actions">
        <button class="primary tiny run-workflow-btn" data-workflow-id="${wf.id}">执行</button>
        <button class="ghost tiny edit-workflow-btn" data-workflow-id="${wf.id}">编辑</button>
        <button class="danger tiny delete-workflow-btn" data-workflow-id="${wf.id}">删除</button>
      </div>
    </div>
  `).join('');
  
  workflowList.querySelectorAll('.run-workflow-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const wfId = btn.dataset.workflowId;
      try {
        await runWorkflow(wfId);
        alert('工作流已开始执行');
      } catch (err) {
        alert('执行失败: ' + err.message);
      }
    });
  });
  
  workflowList.querySelectorAll('.edit-workflow-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const wf = state.workflows.find(w => w.id === btn.dataset.workflowId);
      if (wf) showWorkflowForm(wf);
    });
  });
  
  workflowList.querySelectorAll('.delete-workflow-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const wfId = btn.dataset.workflowId;
      const wf = state.workflows.find(w => w.id === wfId);
      if (!confirm(`确定要删除工作流 "${wf.name}" 吗？`)) return;
      
      try {
        await deleteWorkflow(wfId);
        state.workflows = state.workflows.filter(w => w.id !== wfId);
        renderWorkflows();
      } catch (err) {
        alert('删除失败: ' + err.message);
      }
    });
  });
}

async function refreshWorkflows() {
  const res = await fetchJson('/api/workflows');
  state.workflows = res.workflows || [];
}

export function initWorkflowComponent() {
  const els = getWorkflowElements();
  
  if (els.showWorkflowFormBtn) {
    els.showWorkflowFormBtn.addEventListener('click', () => showWorkflowForm());
  }
  
  if (els.cancelWorkflowBtn) {
    els.cancelWorkflowBtn.addEventListener('click', () => hideWorkflowForm());
  }
  
  if (els.saveWorkflowBtn) {
    els.saveWorkflowBtn.addEventListener('click', () => saveWorkflow());
  }
  
  if (els.addStepBtn) {
    els.addStepBtn.addEventListener('click', () => addWorkflowStep());
  }
  
  return {
    showWorkflowForm,
    hideWorkflowForm,
    renderWorkflows,
    saveWorkflow
  };
}