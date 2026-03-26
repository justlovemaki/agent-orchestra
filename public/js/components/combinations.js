/**
 * Combinations component - Agent combination management UI
 */

import { state } from '../../state.js';
import { fetchJson, loadPopularCombinations, loadRecommendations } from '../../api.js';
import { escapeHtml, show, hide } from '../../utils/dom.js';

export function getCombinationElements() {
  return {
    showCombinationPanelBtn: document.getElementById('showCombinationPanelBtn'),
    combinationPanel: document.getElementById('combinationPanel'),
    hideCombinationPanelBtn: document.getElementById('hideCombinationPanelBtn'),
    combinationForm: document.getElementById('combinationForm'),
    combinationNameInput: document.getElementById('combinationNameInput'),
    combinationColorInput: document.getElementById('combinationColorInput'),
    combinationDescInput: document.getElementById('combinationDescInput'),
    combinationAgentCheckboxes: document.getElementById('combinationAgentCheckboxes'),
    combinationShareCheck: document.getElementById('combinationShareCheck'),
    saveCombinationBtn: document.getElementById('saveCombinationBtn'),
    cancelCombinationBtn: document.getElementById('cancelCombinationBtn'),
    combinationListEl: document.getElementById('combinationList'),
    selectFromCombinationBtn: document.getElementById('selectFromCombinationBtn'),
    selectCombinationModal: document.getElementById('selectCombinationModal'),
    closeSelectCombinationModal: document.getElementById('closeSelectCombinationModal'),
    combinationSelectionList: document.getElementById('combinationSelectionList'),
    confirmSelectCombinationBtn: document.getElementById('confirmSelectCombinationBtn'),
    cancelSelectCombinationBtn: document.getElementById('cancelSelectCombinationBtn'),
    selectCombinationMsg: document.getElementById('selectCombinationMsg'),
    recommendationsContainer: document.getElementById('recommendationsContainer'),
    recommendationsList: document.getElementById('recommendationsList'),
    recommendationsEmpty: document.getElementById('recommendationsEmpty'),
    refreshRecommendationsBtn: document.getElementById('refreshRecommendationsBtn'),
    combinationTabs: document.querySelectorAll('.combination-tab'),
    popularCombinationsContainer: document.getElementById('popularCombinationsContainer'),
    popularCombinationsList: document.getElementById('popularCombinationsList'),
    popularCombinationsEmpty: document.getElementById('popularCombinationsEmpty'),
    combinationSortSelect: document.getElementById('combinationSortSelect'),
    favoritesCombinationsContainer: document.getElementById('favoritesCombinationsContainer'),
    favoritesCombinationsList: document.getElementById('favoritesCombinationsList'),
    favoritesCombinationsEmpty: document.getElementById('favoritesCombinationsEmpty')
  };
}

export function showCombinationForm(combination = null) {
  const { combinationForm, combinationNameInput, combinationColorInput, combinationDescInput, combinationAgentCheckboxes, combinationShareCheck } = getCombinationElements();
  if (!combinationForm) return;
  
  show(combinationForm);
  
  renderCombinationAgentCheckboxes(combination?.agentIds || []);
  
  if (combination) {
    state.editingCombinationId = combination.id;
    if (combinationNameInput) combinationNameInput.value = combination.name;
    if (combinationColorInput) combinationColorInput.value = combination.color || '#6b7280';
    if (combinationDescInput) combinationDescInput.value = combination.description || '';
    if (combinationShareCheck) combinationShareCheck.checked = combination.shared || false;
  } else {
    state.editingCombinationId = null;
    if (combinationNameInput) combinationNameInput.value = '';
    if (combinationColorInput) combinationColorInput.value = '#6b7280';
    if (combinationDescInput) combinationDescInput.value = '';
    if (combinationShareCheck) combinationShareCheck.checked = false;
  }
  
  if (combinationNameInput) combinationNameInput.focus();
}

export function hideCombinationForm() {
  const { combinationForm } = getCombinationElements();
  if (combinationForm) hide(combinationForm);
  state.editingCombinationId = null;
}

function renderCombinationAgentCheckboxes(selectedIds = []) {
  const { combinationAgentCheckboxes } = getCombinationElements();
  if (!combinationAgentCheckboxes) return;
  
  const agents = state.runtime?.agents || [];
  
  combinationAgentCheckboxes.innerHTML = agents.map(agent => `
    <label class="agent-checkbox-label">
      <input type="checkbox" value="${agent.id}" ${selectedIds.includes(agent.id) ? 'checked' : ''} />
      <span>${escapeHtml(agent.id)}</span>
    </label>
  `).join('');
}

export async function saveCombination() {
  const { combinationNameInput, combinationColorInput, combinationDescInput, combinationAgentCheckboxes, combinationShareCheck } = getCombinationElements();
  
  const name = combinationNameInput?.value.trim();
  if (!name) {
    alert('请输入组合名称');
    return;
  }
  
  const selectedAgents = [...combinationAgentCheckboxes?.querySelectorAll('input:checked')].map(cb => cb.value);
  if (selectedAgents.length === 0) {
    alert('请至少选择一个 Agent');
    return;
  }
  
  const payload = {
    name,
    color: combinationColorInput?.value || '#6b7280',
    description: combinationDescInput?.value || '',
    agentIds: selectedAgents,
    shared: combinationShareCheck?.checked || false
  };
  
  try {
    if (state.editingCombinationId) {
      await fetchJson(`/api/combinations/${state.editingCombinationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const idx = state.combinations.findIndex(c => c.id === state.editingCombinationId);
      if (idx !== -1) {
        state.combinations[idx] = { ...state.combinations[idx], ...payload };
      }
    } else {
      const res = await fetchJson('/api/combinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      state.combinations.push({ id: res.id, ...payload });
    }
    
    hideCombinationForm();
    renderCombinations();
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
}

export function renderCombinations() {
  const { combinationListEl } = getCombinationElements();
  if (!combinationListEl) return;
  
  const combinations = state.combinations || [];
  
  if (combinations.length === 0) {
    combinationListEl.innerHTML = '<div class="muted small">暂无组合</div>';
    return;
  }
  
  combinationListEl.innerHTML = combinations.map(comb => {
    const agentCount = comb.agentIds?.length || 0;
    return `
      <div class="combination-item" data-combination-id="${comb.id}">
        <div class="combination-item-header">
          <div class="combination-item-color" style="background: ${comb.color || '#6b7280'}"></div>
          <span class="combination-item-name">${escapeHtml(comb.name)}</span>
          ${comb.shared ? '<span class="combination-shared-badge">共享</span>' : ''}
        </div>
        <div class="combination-item-meta muted small">
          <span>${agentCount} 个 Agent</span>
          <span>${escapeHtml(comb.description || '')}</span>
        </div>
        <div class="combination-item-actions">
          <button class="ghost tiny select-combination-btn" data-combination-id="${comb.id}">选择</button>
          <button class="ghost tiny edit-combination-btn" data-combination-id="${comb.id}">编辑</button>
          <button class="danger tiny delete-combination-btn" data-combination-id="${comb.id}">删除</button>
        </div>
      </div>
    `;
  }).join('');
  
  combinationListEl.querySelectorAll('.edit-combination-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const comb = combinations.find(c => c.id === btn.dataset.combinationId);
      if (comb) showCombinationForm(comb);
    });
  });
  
  combinationListEl.querySelectorAll('.delete-combination-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const combId = btn.dataset.combinationId;
      const comb = combinations.find(c => c.id === combId);
      if (!confirm(`确定要删除组合 "${comb.name}" 吗？`)) return;
      
      try {
        await fetchJson(`/api/combinations/${combId}`, { method: 'DELETE' });
        state.combinations = state.combinations.filter(c => c.id !== combId);
        renderCombinations();
      } catch (err) {
        alert('删除失败: ' + err.message);
      }
    });
  });
  
  combinationListEl.querySelectorAll('.select-combination-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const comb = combinations.find(c => c.id === btn.dataset.combinationId);
      if (comb) selectCombination(comb);
    });
  });
}

export function switchCombinationTab(tabName) {
  const { combinationTabs, combinationListEl, favoritesCombinationsContainer, popularCombinationsContainer, recommendationsContainer } = getCombinationElements();
  
  state.currentCombinationTab = tabName;
  
  if (combinationTabs) {
    combinationTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
  }
  
  hide(combinationListEl);
  hide(favoritesCombinationsContainer);
  hide(popularCombinationsContainer);
  hide(recommendationsContainer);
  
  switch (tabName) {
    case 'combinations':
      show(combinationListEl);
      break;
    case 'favorites':
      show(favoritesCombinationsContainer);
      renderFavoritesCombinations();
      break;
    case 'popular':
      show(popularCombinationsContainer);
      loadPopularCombinationList();
      break;
    case 'recommendations':
      show(recommendationsContainer);
      loadRecommendationsList();
      break;
  }
}

function renderFavoritesCombinations() {
  const { favoritesCombinationsList, favoritesCombinationsEmpty } = getCombinationElements();
  
  const favorites = state.combinations?.filter(c => c.favorited) || [];
  
  if (favorites.length === 0) {
    hide(favoritesCombinationsList);
    show(favoritesCombinationsEmpty);
  } else {
    show(favoritesCombinationsList);
    hide(favoritesCombinationsEmpty);
    
    favoritesCombinationsList.innerHTML = favorites.map(comb => `
      <div class="combination-item" data-combination-id="${comb.id}">
        <div class="combination-item-header">
          <span class="combination-item-name">${escapeHtml(comb.name)}</span>
        </div>
        <div class="combination-item-actions">
          <button class="ghost tiny select-combination-btn" data-combination-id="${comb.id}">选择</button>
        </div>
      </div>
    `).join('');
  }
}

async function loadPopularCombinationList() {
  const { popularCombinationsList, popularCombinationsEmpty } = getCombinationElements();
  
  try {
    const res = await fetchJson(`/api/combinations/popular?sort=${state.combinationSortBy}`);
    state.popularCombinations = res.combinations || [];
    
    if (state.popularCombinations.length === 0) {
      hide(popularCombinationsList);
      show(popularCombinationsEmpty);
    } else {
      show(popularCombinationsList);
      hide(popularCombinationsEmpty);
      
      popularCombinationsList.innerHTML = state.popularCombinations.map(comb => `
        <div class="combination-item" data-combination-id="${comb.id}">
          <div class="combination-item-header">
            <span class="combination-item-name">${escapeHtml(comb.name)}</span>
            <span class="combination-usage-count muted small">使用 ${comb.usageCount || 0} 次</span>
          </div>
          <div class="combination-item-actions">
            <button class="ghost tiny select-combination-btn" data-combination-id="${comb.id}">选择</button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('加载热门组合失败:', err);
  }
}

async function loadRecommendationsList() {
  const { recommendationsList, recommendationsEmpty } = getCombinationElements();
  
  try {
    const res = await fetchJson('/api/combinations/recommendations');
    state.recommendations = res.recommendations || [];
    
    if (state.recommendations.length === 0) {
      hide(recommendationsList);
      show(recommendationsEmpty);
    } else {
      show(recommendationsList);
      hide(recommendationsEmpty);
      
      recommendationsList.innerHTML = state.recommendations.map(rec => `
        <div class="recommendation-item">
          <div class="recommendation-name">${escapeHtml(rec.name)}</div>
          <div class="recommendation-reason muted small">${escapeHtml(rec.reason || '')}</div>
          <div class="recommendation-actions">
            <button class="ghost tiny select-combination-btn" data-combination-id="${rec.id}">选择</button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('加载推荐失败:', err);
  }
}

let pendingSelectedCombination = null;

function selectCombination(combination) {
  const { selectCombinationModal, combinationSelectionList, selectCombinationMsg } = getCombinationElements();
  if (!selectCombinationModal) return;
  
  pendingSelectedCombination = combination;
  
  show(selectCombinationModal);
  
  if (combinationSelectionList) {
    const agents = state.runtime?.agents || [];
    const selectedAgents = combination.agentIds || [];
    const agentNames = selectedAgents.map(id => agents.find(a => a.id === id)?.id || id).join(', ');
    
    combinationSelectionList.innerHTML = `
      <div class="selected-combination-info">
        <strong>${escapeHtml(combination.name)}</strong>
        <p class="muted small">${agentNames}</p>
      </div>
    `;
  }
  
  if (selectCombinationMsg) selectCombinationMsg.textContent = '';
}

function hideSelectCombinationModal() {
  const { selectCombinationModal } = getCombinationElements();
  if (selectCombinationModal) hide(selectCombinationModal);
  pendingSelectedCombination = null;
}

function confirmSelectCombination(taskHandler) {
  if (!pendingSelectedCombination) return;
  
  if (taskHandler && taskHandler.setSelectedCombinationId) {
    taskHandler.setSelectedCombinationId(pendingSelectedCombination.id);
    
    const agents = state.runtime?.agents || [];
    const selectedAgents = pendingSelectedCombination.agentIds || [];
    
    const agentCheckboxesEl = document.getElementById('agentCheckboxes');
    if (agentCheckboxesEl) {
      agentCheckboxesEl.querySelectorAll('input').forEach(cb => {
        cb.checked = selectedAgents.includes(cb.value);
      });
    }
  }
  
  hideSelectCombinationModal();
}

export function initCombinationComponent(taskHandler) {
  const els = getCombinationElements();
  
  if (els.showCombinationPanelBtn) {
    els.showCombinationPanelBtn.addEventListener('click', () => show(els.combinationPanel));
  }
  
  if (els.hideCombinationPanelBtn && els.combinationPanel) {
    els.hideCombinationPanelBtn.addEventListener('click', () => hide(els.combinationPanel));
  }
  
  if (els.saveCombinationBtn) {
    els.saveCombinationBtn.addEventListener('click', () => saveCombination());
  }
  
  if (els.cancelCombinationBtn) {
    els.cancelCombinationBtn.addEventListener('click', () => hideCombinationForm());
  }
  
  if (els.combinationTabs) {
    els.combinationTabs.forEach(tab => {
      tab.addEventListener('click', () => switchCombinationTab(tab.dataset.tab));
    });
  }
  
  if (els.combinationSortSelect) {
    els.combinationSortSelect.addEventListener('change', () => {
      state.combinationSortBy = els.combinationSortSelect.value;
      if (state.currentCombinationTab === 'popular') {
        loadPopularCombinationList();
      }
    });
  }
  
  if (els.closeSelectCombinationModal) {
    els.closeSelectCombinationModal.addEventListener('click', () => hideSelectCombinationModal());
  }
  
  if (els.cancelSelectCombinationBtn) {
    els.cancelSelectCombinationBtn.addEventListener('click', () => hideSelectCombinationModal());
  }
  
  if (els.confirmSelectCombinationBtn) {
    els.confirmSelectCombinationBtn.addEventListener('click', () => confirmSelectCombination(taskHandler));
  }
  
  if (els.refreshRecommendationsBtn) {
    els.refreshRecommendationsBtn.addEventListener('click', () => loadRecommendationsList());
  }
  
  return {
    showCombinationForm,
    hideCombinationForm,
    renderCombinations,
    switchCombinationTab
  };
}