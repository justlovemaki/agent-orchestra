/**
 * Tasks component - Task management UI and logic
 */

import { state } from '../state.js';
import { fetchJson, createTask, retryTask, cancelTask, pauseTask, resumeTask, getTaskDetail } from '../api.js';
import { escapeHtml, formatDate, formatDuration, show, hide } from '../utils/dom.js';
import { getFilters, hasActiveFilters, syncFiltersToUrl, clearFilterUrl, saveFiltersToStorage, loadFiltersFromStorage, parseFiltersFromUrl, getResolvedDefaultPresets } from '../utils/storage.js';

/**
 * 性能优化: 日志懒加载
 * 任务日志默认不加载，只有点击展开时才请求日志数据
 */
const lazyLoadLogTaskIds = new Set();

/**
 * 性能优化: 虚拟滚动配置
 * 只渲染可见区域的任务，支持大数据量场景
 */
const VIRTUAL_SCROLL_ITEM_HEIGHT = 120;
const VIRTUAL_SCROLL_BUFFER = 5;
let virtualScrollState = {
  container: null,
  totalHeight: 0,
  visibleCount: 0,
  scrollTop: 0,
  startIndex: 0,
  endIndex: 0
};

let selectedCombinationId = null;

export function getTaskElements() {
  return {
    taskBoardEl: document.getElementById('taskBoard'),
    form: document.getElementById('taskForm'),
    formMsg: document.getElementById('formMsg'),
    filterKeywordEl: document.getElementById('filterKeyword'),
    filterStatusEl: document.getElementById('filterStatus'),
    filterAgentEl: document.getElementById('filterAgent'),
    filterPriorityEl: document.getElementById('filterPriority'),
    filterModeEl: document.getElementById('filterMode'),
    filterTimeFromEl: document.getElementById('filterTimeFrom'),
    filterTimeToEl: document.getElementById('filterTimeTo'),
    applyFilterBtn: document.getElementById('applyFilterBtn'),
    clearFilterBtn: document.getElementById('clearFilterBtn'),
    filterResultCountEl: document.getElementById('filterResultCount'),
    filterChipsEl: document.getElementById('filterChips'),
    defaultPresetChipsEl: document.getElementById('defaultPresetChips'),
    savedPresetListEl: document.getElementById('savedPresetList'),
    sharedPresetListEl: document.getElementById('sharedPresetList'),
    presetNameInputEl: document.getElementById('presetNameInput'),
    savePresetBtn: document.getElementById('savePresetBtn'),
    presetShareCheckEl: document.getElementById('presetShareCheck'),
    batchToolbarEl: document.getElementById('batchToolbar'),
    selectedCountEl: document.getElementById('selectedCount'),
    batchPrioritySelect: document.getElementById('batchPrioritySelect'),
    batchRetryBtn: document.getElementById('batchRetryBtn'),
    batchCancelBtn: document.getElementById('batchCancelBtn'),
    batchClearBtn: document.getElementById('batchClearBtn'),
    logEmptyEl: document.getElementById('logEmpty'),
    detailBodyEl: document.getElementById('detailBody'),
    taskMetaEl: document.getElementById('taskMeta'),
    logBoxEl: document.getElementById('logBox'),
    retryBtn: document.getElementById('retryBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resumeBtn: document.getElementById('resumeBtn')
  };
}

export function applyFilters() {
  const filters = getFilters();
  state.filters = filters;
  saveFiltersToStorage(filters);
  syncFiltersToUrl(filters);
  renderTaskBoard();
  renderFilterChips();
  renderFilterPresets();
  renderFilterSummary();
}

export function clearFilters() {
  state.filters = {};
  state.selectedTaskIds.clear();
  const els = getTaskElements();
  if (els.filterKeywordEl) els.filterKeywordEl.value = '';
  if (els.filterStatusEl) els.filterStatusEl.value = '';
  if (els.filterAgentEl) els.filterAgentEl.value = '';
  if (els.filterPriorityEl) els.filterPriorityEl.value = '';
  if (els.filterModeEl) els.filterModeEl.value = '';
  if (els.filterTimeFromEl) els.filterTimeFromEl.value = '';
  if (els.filterTimeToEl) els.filterTimeToEl.value = '';
  
  saveFiltersToStorage({});
  clearFilterUrl();
  renderTaskBoard();
  renderFilterChips();
  renderFilterPresets();
  renderFilterSummary();
  updateBatchToolbar();
}

export function renderTaskBoard() {
  const { taskBoardEl } = getTaskElements();
  if (!taskBoardEl) return;
  
  const tasks = state.tasks || [];
  
  if (tasks.length === 0) {
    taskBoardEl.innerHTML = '<div class="empty-state muted">暂无任务</div>';
    return;
  }
  
  virtualScrollState.totalHeight = tasks.length * VIRTUAL_SCROLL_ITEM_HEIGHT;
  
  const container = taskBoardEl;
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.height = `${virtualScrollState.totalHeight}px`;
  
  const spacer = document.createElement('div');
  spacer.className = 'virtual-scroll-spacer';
  spacer.style.height = `${virtualScrollState.totalHeight}px`;
  container.appendChild(spacer);
  
  virtualScrollState.container = container;
  
  const updateVirtualScroll = () => {
    virtualScrollState.scrollTop = container.scrollTop;
    virtualScrollState.visibleCount = Math.ceil(container.clientHeight / VIRTUAL_SCROLL_ITEM_HEIGHT) + VIRTUAL_SCROLL_BUFFER * 2;
    
    virtualScrollState.startIndex = Math.max(0, Math.floor(virtualScrollState.scrollTop / VIRTUAL_SCROLL_ITEM_HEIGHT) - VIRTUAL_SCROLL_BUFFER);
    virtualScrollState.endIndex = Math.min(tasks.length, virtualScrollState.startIndex + virtualScrollState.visibleCount);
    
    const visibleTasks = tasks.slice(virtualScrollState.startIndex, virtualScrollState.endIndex);
    
    const contentContainer = container.querySelector('.virtual-scroll-content');
    if (contentContainer) {
      contentContainer.remove();
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'virtual-scroll-content';
    contentDiv.style.position = 'absolute';
    contentDiv.style.top = `${virtualScrollState.startIndex * VIRTUAL_SCROLL_ITEM_HEIGHT}px`;
    contentDiv.style.left = '0';
    contentDiv.style.right = '0';
    
    contentDiv.innerHTML = visibleTasks.map(task => {
      const statusClass = task.status === 'completed' ? 'success' : 
                          task.status === 'failed' ? 'danger' : 
                          task.status === 'running' ? 'primary' : 
                          task.status === 'paused' ? 'warning' : '';
      const priorityClass = task.priority === 'high' ? 'priority-high' : 
                           task.priority === 'low' ? 'priority-low' : '';
      const isSelected = state.selectedTaskIds.has(task.id);
      
      return `
        <div class="task-card ${statusClass} ${priorityClass} ${isSelected ? 'selected' : ''}" data-task-id="${task.id}" data-index="${tasks.indexOf(task)}">
          <div class="task-card-header">
            <input type="checkbox" class="task-select-checkbox" ${isSelected ? 'checked' : ''} data-task-id="${task.id}" />
            <span class="task-status-badge ${statusClass}">${getStatusLabel(task.status)}</span>
            <span class="task-priority-badge ${priorityClass}">${getPriorityLabel(task.priority)}</span>
          </div>
          <div class="task-card-title">${escapeHtml(task.title || task.id)}</div>
          <div class="task-card-meta">
            <span>${task.mode === 'parallel' ? '并行' : '串行'}</span>
            <span>${task.agents?.length || 0} 个 Agent</span>
            <span>${formatDate(task.createdAt)}</span>
          </div>
          ${task.duration ? `<div class="task-card-duration">耗时: ${formatDuration(task.duration)}</div>` : ''}
        </div>
      `;
    }).join('');
    
    container.insertBefore(contentDiv, spacer);
    
    contentDiv.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('task-select-checkbox')) return;
        const taskId = card.dataset.taskId;
        selectTask(taskId);
      });
    });
    
    contentDiv.querySelectorAll('.task-select-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const taskId = cb.dataset.taskId;
        if (cb.checked) {
          state.selectedTaskIds.add(taskId);
        } else {
          state.selectedTaskIds.delete(taskId);
        }
        updateBatchToolbar();
        cardSelectionToggle(taskId, cb.checked);
      });
    });
  };
  
  container.addEventListener('scroll', updateVirtualScroll, { passive: true });
  container._virtualScrollHandler = updateVirtualScroll;
  
  updateVirtualScroll();
}

function cardSelectionToggle(taskId, selected) {
  const { taskBoardEl } = getTaskElements();
  const card = taskBoardEl?.querySelector(`.task-card[data-task-id="${taskId}"]`);
  if (card) {
    card.classList.toggle('selected', selected);
  }
}

export function selectTask(taskId) {
  state.selectedTaskId = taskId;
  loadTaskDetail(taskId);
}

export async function loadTaskDetail(taskId) {
  const { logEmptyEl, detailBodyEl, taskMetaEl, logBoxEl, pauseBtn, resumeBtn } = getTaskElements();
  
  try {
    const task = await getTaskDetail(taskId);
    
    if (logEmptyEl) hide(logEmptyEl);
    if (detailBodyEl) show(detailBodyEl);
    
    const statusClass = task.status === 'completed' ? 'success' : 
                       task.status === 'failed' ? 'danger' : 
                       task.status === 'running' ? 'primary' : '';
    
    if (taskMetaEl) {
      taskMetaEl.innerHTML = `
        <div class="task-meta-title">${escapeHtml(task.title)}</div>
        <div class="task-meta-info">
          <span class="task-status-badge ${statusClass}">${getStatusLabel(task.status)}</span>
          <span>${task.mode === 'parallel' ? '并行执行' : '串行广播'}</span>
          <span>优先级: ${getPriorityLabel(task.priority)}</span>
        </div>
        <div class="task-meta-time">
          <div>创建: ${formatDate(task.createdAt)}</div>
          ${task.startedAt ? `<div>开始: ${formatDate(task.startedAt)}</div>` : ''}
          ${task.completedAt ? `<div>完成: ${formatDate(task.completedAt)}</div>` : ''}
          ${task.duration ? `<div>耗时: ${formatDuration(task.duration)}</div>` : ''}
        </div>
        ${task.agents?.length ? `<div class="task-meta-agents">Agents: ${task.agents.join(', ')}</div>` : ''}
      `;
    }
    
    if (logBoxEl) {
      logBoxEl.innerHTML = '<div class="log-lazy-load-prompt">点击加载日志</div>';
      logBoxEl.dataset.logLoaded = 'false';
      logBoxEl.dataset.taskId = taskId;
      
      logBoxEl.onclick = async () => {
        if (logBoxEl.dataset.logLoaded === 'true') return;
        
        logBoxEl.innerHTML = '<div class="log-loading">加载中...</div>';
        
        try {
          const fullTask = await getTaskDetail(taskId);
          logBoxEl.textContent = fullTask.log || '暂无日志';
          logBoxEl.dataset.logLoaded = 'true';
          logBoxEl.onclick = null;
          lazyLoadLogTaskIds.add(taskId);
        } catch (err) {
          logBoxEl.textContent = '加载日志失败: ' + err.message;
        }
      };
    }
    
    if (pauseBtn && resumeBtn) {
      if (task.status === 'running') {
        show(pauseBtn);
        hide(resumeBtn);
      } else if (task.status === 'paused') {
        hide(pauseBtn);
        show(resumeBtn);
      } else {
        hide(pauseBtn);
        hide(resumeBtn);
      }
    }
  } catch (err) {
    console.error('加载任务详情失败:', err);
  }
}

function getStatusLabel(status) {
  const map = {
    queued: '待执行',
    running: '执行中',
    completed: '已完成',
    failed: '失败',
    paused: '已暂停',
    canceled: '已取消'
  };
  return map[status] || status;
}

function getPriorityLabel(priority) {
  const map = { low: '低', medium: '中', high: '高', critical: '紧急' };
  return map[priority] || priority;
}

export function updateBatchToolbar() {
  const { batchToolbarEl, selectedCountEl, batchPrioritySelect, batchRetryBtn, batchCancelBtn, batchClearBtn } = getTaskElements();
  const count = state.selectedTaskIds.size;
  
  if (count > 0) {
    show(batchToolbarEl);
    if (selectedCountEl) selectedCountEl.textContent = count;
  } else {
    hide(batchToolbarEl);
  }
}

export async function handleBatchRetry() {
  const taskIds = Array.from(state.selectedTaskIds);
  for (const taskId of taskIds) {
    try {
      await retryTask(taskId);
    } catch (err) {
      console.error(`重试任务 ${taskId} 失败:`, err);
    }
  }
  state.selectedTaskIds.clear();
  updateBatchToolbar();
}

export async function handleBatchCancel() {
  if (!confirm(`确定要取消选中的 ${state.selectedTaskIds.size} 个任务吗？`)) return;
  
  const taskIds = Array.from(state.selectedTaskIds);
  for (const taskId of taskIds) {
    try {
      await cancelTask(taskId);
    } catch (err) {
      console.error(`取消任务 ${taskId} 失败:`, err);
    }
  }
  state.selectedTaskIds.clear();
  updateBatchToolbar();
}

export async function handleBatchPriority() {
  const { batchPrioritySelect } = getTaskElements();
  const priority = batchPrioritySelect.value;
  if (!priority) return;
  
  const taskIds = Array.from(state.selectedTaskIds);
  for (const taskId of taskIds) {
    try {
      await fetchJson(`/api/tasks/${taskId}/priority`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority })
      });
    } catch (err) {
      console.error(`更新任务 ${taskId} 优先级失败:`, err);
    }
  }
  batchPrioritySelect.value = '';
}

export function handleBatchClear() {
  state.selectedTaskIds.clear();
  const { taskBoardEl } = getTaskElements();
  taskBoardEl?.querySelectorAll('.task-select-checkbox').forEach(cb => {
    cb.checked = false;
  });
  taskBoardEl?.querySelectorAll('.task-card').forEach(card => {
    card.classList.remove('selected');
  });
  updateBatchToolbar();
}

export function renderFilterChips() {
  const { filterChipsEl } = getTaskElements();
  if (!filterChipsEl) return;
  
  const filters = state.filters;
  const chips = [];
  
  if (filters.keyword) {
    chips.push({ key: 'keyword', label: `关键词: ${filters.keyword}`, value: filters.keyword });
  }
  if (filters.status) {
    chips.push({ key: 'status', label: `状态: ${getStatusLabel(filters.status)}`, value: filters.status });
  }
  if (filters.agent) {
    chips.push({ key: 'agent', label: `Agent: ${filters.agent}`, value: filters.agent });
  }
  if (filters.priority) {
    chips.push({ key: 'priority', label: `优先级: ${getPriorityLabel(filters.priority)}`, value: filters.priority });
  }
  if (filters.mode) {
    chips.push({ key: 'mode', label: `模式: ${filters.mode === 'parallel' ? '并行' : '串行'}`, value: filters.mode });
  }
  if (filters.timeFrom || filters.timeTo) {
    chips.push({ key: 'time', label: `时间: ${formatDate(filters.timeFrom)} - ${formatDate(filters.timeTo)}`, value: 'time' });
  }
  
  if (chips.length === 0) {
    filterChipsEl.innerHTML = '';
    return;
  }
  
  filterChipsEl.innerHTML = chips.map(chip => `
    <span class="filter-chip">
      ${escapeHtml(chip.label)}
      <button class="filter-chip-remove" data-key="${chip.key}">&times;</button>
    </span>
  `).join('');
  
  filterChipsEl.querySelectorAll('.filter-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      if (key === 'time') {
        state.filters.timeFrom = null;
        state.filters.timeTo = null;
        const filterTimeFromEl = document.getElementById('filterTimeFrom');
        const filterTimeToEl = document.getElementById('filterTimeTo');
        if (filterTimeFromEl) filterTimeFromEl.value = '';
        if (filterTimeToEl) filterTimeToEl.value = '';
      } else {
        delete state.filters[key];
        const el = document.getElementById(`filter${key.charAt(0).toUpperCase() + key.slice(1)}El`);
        if (el) el.value = '';
      }
      saveFiltersToStorage(state.filters);
      syncFiltersToUrl(state.filters);
      renderFilterChips();
      renderFilterPresets();
      renderFilterSummary();
      renderTaskBoard();
    });
  });
}

export function renderFilterPresets() {
  const { defaultPresetChipsEl, savedPresetListEl, sharedPresetListEl } = getTaskElements();
  
  if (defaultPresetChipsEl) {
    const defaultPresets = getResolvedDefaultPresets();
    defaultPresetChipsEl.innerHTML = defaultPresets.map(preset => `
      <button class="filter-preset-chip" data-key="${preset.key}">${escapeHtml(preset.name)}</button>
    `).join('');
    
    defaultPresetChipsEl.querySelectorAll('.filter-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const preset = defaultPresets.find(p => p.key === chip.dataset.key);
        if (preset) {
          state.filters = { ...preset.filters };
          populateFilterInputs(state.filters);
          saveFiltersToStorage(state.filters);
          syncFiltersToUrl(state.filters);
          renderTaskBoard();
          renderFilterChips();
          renderFilterPresets();
          renderFilterSummary();
        }
      });
    });
  }
  
  if (savedPresetListEl) {
    const saved = state.savedPresets || [];
    if (saved.length === 0) {
      savedPresetListEl.innerHTML = '<span class="muted small">暂无保存的预设</span>';
    } else {
      savedPresetListEl.innerHTML = saved.map(preset => `
        <button class="filter-preset-chip saved" data-preset-id="${preset.id}">
          ${escapeHtml(preset.name)}
          <span class="preset-delete" data-preset-id="${preset.id}">&times;</span>
        </button>
      `).join('');
      
      savedPresetListEl.querySelectorAll('.filter-preset-chip.saved').forEach(chip => {
        chip.addEventListener('click', (e) => {
          if (e.target.classList.contains('preset-delete')) return;
          const preset = saved.find(p => p.id === chip.dataset.presetId);
          if (preset) {
            state.filters = { ...preset.filters };
            populateFilterInputs(state.filters);
            saveFiltersToStorage(state.filters);
            syncFiltersToUrl(state.filters);
            renderTaskBoard();
            renderFilterChips();
            renderFilterPresets();
            renderFilterSummary();
          }
        });
      });
      
      savedPresetListEl.querySelectorAll('.preset-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const presetId = btn.dataset.presetId;
          try {
            await fetchJson(`/api/presets/${presetId}`, { method: 'DELETE' });
            state.savedPresets = state.savedPresets.filter(p => p.id !== presetId);
            renderFilterPresets();
          } catch (err) {
            alert('删除失败: ' + err.message);
          }
        });
      });
    }
  }
  
  if (sharedPresetListEl) {
    const shared = state.sharedPresets || [];
    if (shared.length === 0) {
      sharedPresetListEl.innerHTML = '<span class="muted small">暂无团队共享预设</span>';
    } else {
      sharedPresetListEl.innerHTML = shared.map(preset => `
        <button class="filter-preset-chip shared" data-preset-id="${preset.id}">${escapeHtml(preset.name)}</button>
      `).join('');
      
      sharedPresetListEl.querySelectorAll('.filter-preset-chip.shared').forEach(chip => {
        chip.addEventListener('click', () => {
          const preset = shared.find(p => p.id === chip.dataset.presetId);
          if (preset) {
            state.filters = { ...preset.filters };
            populateFilterInputs(state.filters);
            saveFiltersToStorage(state.filters);
            syncFiltersToUrl(state.filters);
            renderTaskBoard();
            renderFilterChips();
            renderFilterPresets();
            renderFilterSummary();
          }
        });
      });
    }
  }
}

export function renderFilterSummary() {
  const { filterResultCountEl } = getTaskElements();
  if (!filterResultCountEl) return;
  
  const count = (state.tasks || []).length;
  if (hasActiveFilters(state.filters)) {
    filterResultCountEl.textContent = `找到 ${count} 个任务`;
  } else {
    filterResultCountEl.textContent = '';
  }
}

function populateFilterInputs(filters) {
  const { filterKeywordEl, filterStatusEl, filterAgentEl, filterPriorityEl, filterModeEl, filterTimeFromEl, filterTimeToEl } = getTaskElements();
  
  if (filterKeywordEl) filterKeywordEl.value = filters.keyword || '';
  if (filterStatusEl) filterStatusEl.value = filters.status || '';
  if (filterAgentEl) filterAgentEl.value = filters.agent || '';
  if (filterPriorityEl) filterPriorityEl.value = filters.priority || '';
  if (filterModeEl) filterModeEl.value = filters.mode || '';
  if (filterTimeFromEl && filters.timeFrom) {
    const date = new Date(filters.timeFrom);
    filterTimeFromEl.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  if (filterTimeToEl && filters.timeTo) {
    const date = new Date(filters.timeTo);
    filterTimeToEl.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}

export function saveCurrentPreset() {
  const { presetNameInputEl, presetShareCheckEl } = getTaskElements();
  const name = presetNameInputEl?.value.trim();
  if (!name) {
    alert('请输入预设名称');
    return;
  }
  
  const preset = {
    id: crypto.randomUUID(),
    name: name.substring(0, 40),
    filters: { ...state.filters },
    shared: presetShareCheckEl?.checked || false
  };
  
  state.savedPresets.push(preset);
  presetNameInputEl.value = '';
  if (presetShareCheckEl) presetShareCheckEl.checked = false;
  
  if (preset.shared) {
    fetchJson('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preset)
    }).catch(err => console.error('保存共享预设失败:', err));
  }
  
  renderFilterPresets();
}

export function initTaskComponent(handlers) {
  const els = getTaskElements();
  
  if (els.applyFilterBtn) {
    els.applyFilterBtn.addEventListener('click', () => applyFilters());
  }
  if (els.clearFilterBtn) {
    els.clearFilterBtn.addEventListener('click', () => clearFilters());
  }
  if (els.savePresetBtn) {
    els.savePresetBtn.addEventListener('click', () => saveCurrentPreset());
  }
  if (els.batchRetryBtn) {
    els.batchRetryBtn.addEventListener('click', () => handleBatchRetry());
  }
  if (els.batchCancelBtn) {
    els.batchCancelBtn.addEventListener('click', () => handleBatchCancel());
  }
  if (els.batchPrioritySelect) {
    els.batchPrioritySelect.addEventListener('change', () => handleBatchPriority());
  }
  if (els.batchClearBtn) {
    els.batchClearBtn.addEventListener('click', () => handleBatchClear());
  }
  
  if (els.filterKeywordEl) {
    els.filterKeywordEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyFilters();
      }
    });
  }
  
  [els.filterStatusEl, els.filterAgentEl, els.filterPriorityEl, els.filterModeEl].forEach(el => {
    if (el) {
      el.addEventListener('change', () => applyFilters());
    }
  });
  
  if (els.presetNameInputEl) {
    els.presetNameInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveCurrentPreset();
      }
    });
  }
  
  if (els.form) {
    els.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(els.form);
      const payload = {
        title: fd.get('title'),
        prompt: fd.get('prompt'),
        priority: fd.get('priority'),
        mode: fd.get('mode'),
        agents: fd.getAll('agents')
      };
      if (selectedCombinationId) {
        payload.combinationId = selectedCombinationId;
      }
      
      if (els.formMsg) els.formMsg.textContent = '正在派发任务…';
      
      try {
        const { task } = await createTask(payload);
        if (els.formMsg) els.formMsg.textContent = `任务已创建：${task.title}`;
        els.form.reset();
        selectedCombinationId = null;
        state.selectedTaskId = task.id;
        if (handlers?.onTaskCreated) handlers.onTaskCreated();
      } catch (err) {
        if (els.formMsg) els.formMsg.textContent = err.message;
      }
    });
  }
  
  if (els.retryBtn) {
    els.retryBtn.addEventListener('click', async () => {
      if (!state.selectedTaskId) return;
      try {
        await retryTask(state.selectedTaskId);
        if (handlers?.onTaskAction) handlers.onTaskAction();
      } catch (err) {
        alert(err.message);
      }
    });
  }
  
  if (els.cancelBtn) {
    els.cancelBtn.addEventListener('click', async () => {
      if (!state.selectedTaskId) return;
      try {
        await cancelTask(state.selectedTaskId);
        if (handlers?.onTaskAction) handlers.onTaskAction();
      } catch (err) {
        alert(err.message);
      }
    });
  }
  
  if (els.pauseBtn) {
    els.pauseBtn.addEventListener('click', async () => {
      if (!state.selectedTaskId) return;
      try {
        await pauseTask(state.selectedTaskId);
        if (handlers?.onTaskAction) handlers.onTaskAction();
      } catch (err) {
        alert(err.message);
      }
    });
  }
  
  if (els.resumeBtn) {
    els.resumeBtn.addEventListener('click', async () => {
      if (!state.selectedTaskId) return;
      try {
        await resumeTask(state.selectedTaskId);
        if (handlers?.onTaskAction) handlers.onTaskAction();
      } catch (err) {
        alert(err.message);
      }
    });
  }
  
  return {
    selectedCombinationId: () => selectedCombinationId,
    setSelectedCombinationId: (id) => { selectedCombinationId = id; }
  };
}