/**
 * Agents component - Agent management UI and rendering
 */

import { state } from '../../state.js';
import { fetchJson } from '../../api.js';
import { escapeHtml, formatDate, show, hide } from '../../utils/dom.js';

export function getAgentElements() {
  return {
    agentsGridEl: document.getElementById('agentsGrid'),
    filterGroupEl: document.getElementById('filterGroup'),
    showGroupFormBtn: document.getElementById('showGroupFormBtn'),
    showCombinationPanelBtn: document.getElementById('showCombinationPanelBtn'),
    groupPanel: document.getElementById('groupPanel'),
    hideGroupPanelBtn: document.getElementById('hideGroupPanelBtn'),
    groupForm: document.getElementById('groupForm'),
    groupNameInput: document.getElementById('groupNameInput'),
    groupColorInput: document.getElementById('groupColorInput'),
    groupDescInput: document.getElementById('groupDescInput'),
    saveGroupBtn: document.getElementById('saveGroupBtn'),
    cancelGroupBtn: document.getElementById('cancelGroupBtn'),
    groupListEl: document.getElementById('groupList'),
    agentCheckboxesEl: document.getElementById('agentCheckboxes')
  };
}

export function renderAgents() {
  const { agentsGridEl, filterGroupEl } = getAgentElements();
  if (!agentsGridEl) return;
  
  const agents = state.runtime?.agents || [];
  const groups = state.groups || [];
  const groupFilter = state.groupFilter;
  
  const filteredAgents = groupFilter ? agents.filter(a => a.group === groupFilter) : agents;
  
  if (filteredAgents.length === 0) {
    agentsGridEl.innerHTML = '<div class="empty-state muted">暂无 Agent</div>';
    return;
  }
  
  agentsGridEl.innerHTML = filteredAgents.map(agent => {
    const group = groups.find(g => g.id === agent.group);
    const statusClass = agent.status === 'running' ? 'success' : 
                       agent.status === 'idle' ? 'warning' : '';
    const workload = agent.runningTasks + agent.queuedTasks;
    const workloadBar = Math.min(100, (workload / 10) * 100);
    
    return `
      <div class="agent-card" data-agent-id="${agent.id}">
        <div class="agent-card-header">
          <span class="agent-status-dot ${statusClass}"></span>
          <span class="agent-name">${escapeHtml(agent.id)}</span>
          ${group ? `<span class="agent-group-badge" style="background: ${group.color || '#6b7280'}">${escapeHtml(group.name)}</span>` : ''}
        </div>
        <div class="agent-card-stats">
          <div class="agent-stat">
            <span class="agent-stat-value">${agent.runningTasks}</span>
            <span class="agent-stat-label">运行中</span>
          </div>
          <div class="agent-stat">
            <span class="agent-stat-value">${agent.queuedTasks}</span>
            <span class="agent-stat-label">排队中</span>
          </div>
          <div class="agent-stat">
            <span class="agent-stat-value">${agent.completedToday || 0}</span>
            <span class="agent-stat-label">今日完成</span>
          </div>
        </div>
        <div class="agent-workload-bar">
          <div class="agent-workload-fill" style="width: ${workloadBar}%"></div>
        </div>
        <div class="agent-card-meta">
          <span class="muted small">负载: ${workload} / 10</span>
        </div>
      </div>
    `;
  }).join('');
  
  agentsGridEl.querySelectorAll('.agent-card').forEach(card => {
    card.addEventListener('click', () => {
      const agentId = card.dataset.agentId;
      state.selectedAgentId = agentId;
    });
  });
}

export function renderAgentCheckboxes(container = null, selectedAgents = []) {
  const { agentCheckboxesEl } = getAgentElements();
  const targetEl = container || agentCheckboxesEl;
  if (!targetEl) return;
  
  const agents = state.runtime?.agents || [];
  
  targetEl.innerHTML = agents.map(agent => `
    <label class="agent-checkbox-label">
      <input type="checkbox" name="agents" value="${agent.id}" ${selectedAgents.includes(agent.id) ? 'checked' : ''} />
      <span>${escapeHtml(agent.id)}</span>
    </label>
  `).join('');
}

export function renderGroupFilter() {
  const { filterGroupEl } = getAgentElements();
  if (!filterGroupEl) return;
  
  const groups = state.groups || [];
  
  filterGroupEl.innerHTML = '<option value="">全部分组</option>' +
    groups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
  
  filterGroupEl.value = state.groupFilter || '';
}

export function showGroupForm(group = null) {
  const { groupForm, groupNameInput, groupColorInput, groupDescInput } = getAgentElements();
  if (!groupForm) return;
  
  show(groupForm);
  
  if (group) {
    state.editingGroupId = group.id;
    if (groupNameInput) groupNameInput.value = group.name;
    if (groupColorInput) groupColorInput.value = group.color || '#6b7280';
    if (groupDescInput) groupDescInput.value = group.description || '';
  } else {
    state.editingGroupId = null;
    if (groupNameInput) groupNameInput.value = '';
    if (groupColorInput) groupColorInput.value = '#6b7280';
    if (groupDescInput) groupDescInput.value = '';
  }
  
  if (groupNameInput) groupNameInput.focus();
}

export function hideGroupForm() {
  const { groupForm } = getAgentElements();
  if (groupForm) hide(groupForm);
  state.editingGroupId = null;
}

export function renderGroups() {
  const { groupListEl } = getAgentElements();
  if (!groupListEl) return;
  
  const groups = state.groups || [];
  
  if (groups.length === 0) {
    groupListEl.innerHTML = '<div class="muted small">暂无分组</div>';
    return;
  }
  
  groupListEl.innerHTML = groups.map(group => `
    <div class="group-item" data-group-id="${group.id}">
      <div class="group-item-color" style="background: ${group.color || '#6b7280'}"></div>
      <div class="group-item-info">
        <div class="group-item-name">${escapeHtml(group.name)}</div>
        <div class="group-item-meta muted small">${escapeHtml(group.description || '')}</div>
      </div>
      <div class="group-item-actions">
        <button class="ghost tiny edit-group-btn" data-group-id="${group.id}">编辑</button>
        <button class="danger tiny delete-group-btn" data-group-id="${group.id}">删除</button>
      </div>
    </div>
  `).join('');
  
  groupListEl.querySelectorAll('.edit-group-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = groups.find(g => g.id === btn.dataset.groupId);
      if (group) showGroupForm(group);
    });
  });
  
  groupListEl.querySelectorAll('.delete-group-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const groupId = btn.dataset.groupId;
      const group = groups.find(g => g.id === groupId);
      if (!confirm(`确定要删除分组 "${group.name}" 吗？`)) return;
      
      try {
        await fetchJson(`/api/groups/${groupId}`, { method: 'DELETE' });
        state.groups = state.groups.filter(g => g.id !== groupId);
        renderGroups();
        renderAgentCheckboxes();
      } catch (err) {
        alert('删除失败: ' + err.message);
      }
    });
  });
}

export async function saveGroup() {
  const { groupNameInput, groupColorInput, groupDescInput } = getAgentElements();
  const name = groupNameInput?.value.trim();
  if (!name) {
    alert('请输入分组名称');
    return;
  }
  
  const payload = {
    name,
    color: groupColorInput?.value || '#6b7280',
    description: groupDescInput?.value || ''
  };
  
  try {
    if (state.editingGroupId) {
      await fetchJson(`/api/groups/${state.editingGroupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const idx = state.groups.findIndex(g => g.id === state.editingGroupId);
      if (idx !== -1) {
        state.groups[idx] = { ...state.groups[idx], ...payload };
      }
    } else {
      const res = await fetchJson('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      state.groups.push({ id: res.id, ...payload });
    }
    
    hideGroupForm();
    renderGroups();
    renderGroupFilter();
    renderAgents();
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
}

export function initAgentComponent(handlers) {
  const els = getAgentElements();
  
  if (els.showGroupFormBtn) {
    els.showGroupFormBtn.addEventListener('click', () => showGroupForm());
  }
  
  if (els.hideGroupPanelBtn && els.groupPanel) {
    els.hideGroupPanelBtn.addEventListener('click', () => hide(els.groupPanel));
  }
  
  if (els.saveGroupBtn) {
    els.saveGroupBtn.addEventListener('click', () => saveGroup());
  }
  
  if (els.cancelGroupBtn) {
    els.cancelGroupBtn.addEventListener('click', () => hideGroupForm());
  }
  
  if (els.filterGroupEl) {
    els.filterGroupEl.addEventListener('change', () => {
      state.groupFilter = els.filterGroupEl.value;
      renderAgents();
    });
  }
  
  return {
    renderAgents,
    renderAgentCheckboxes,
    renderGroups,
    renderGroupFilter,
    showGroupForm,
    hideGroupForm
  };
}