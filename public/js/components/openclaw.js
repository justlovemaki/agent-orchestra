/**
 * OpenClaw Integration Component
 * Handles OpenClaw Gateway integration settings UI
 */

import { state } from '../../state.js';
import { fetchJson } from '../../api.js';
import { escapeHtml, show, hide, showById, hideById } from '../../utils/dom.js';

export function getOpenClawElements() {
  return {
    openclawPanel: document.getElementById('openclawPanel'),
    openclawConfig: document.getElementById('openclawConfig'),
    openclawStatusIndicator: document.getElementById('openclawStatusIndicator'),
    openclawStatusText: document.getElementById('openclawStatusText'),
    openclawConnectBtn: document.getElementById('openclawConnectBtn'),
    openclawDisconnectBtn: document.getElementById('openclawDisconnectBtn'),
    openclawGatewayUrl: document.getElementById('openclawGatewayUrl'),
    openclawToken: document.getElementById('openclawToken'),
    openclawAutoConnect: document.getElementById('openclawAutoConnect'),
    openclawSaveConfigBtn: document.getElementById('openclawSaveConfigBtn'),
    openclawTestBtn: document.getElementById('openclawTestBtn'),
    openclawConfigMsg: document.getElementById('openclawConfigMsg'),
    openclawToolsList: document.getElementById('openclawToolsList'),
    openclawToolForm: document.getElementById('openclawToolForm'),
    openclawRegisterToolBtn: document.getElementById('openclawRegisterToolBtn'),
    openclawEventSubscriptions: document.getElementById('openclawEventSubscriptions'),
    openclawActiveSubscriptions: document.getElementById('openclawActiveSubscriptions'),
    openclawSessionsList: document.getElementById('openclawSessionsList')
  };
}

export function initOpenClawComponent() {
  initEventListeners();
  loadOpenClawConfig();
  loadOpenClawStatus();
  loadOpenClawTools();
  loadOpenClawEvents();
}

function initEventListeners() {
  const { openclawConnectBtn, openclawDisconnectBtn, openclawSaveConfigBtn, openclawTestBtn, openclawRegisterToolBtn } = getOpenClawElements();

  if (openclawConnectBtn) {
    openclawConnectBtn.addEventListener('click', async () => {
      await connectOpenClaw();
    });
  }

  if (openclawDisconnectBtn) {
    openclawDisconnectBtn.addEventListener('click', async () => {
      await disconnectOpenClaw();
    });
  }

  if (openclawSaveConfigBtn) {
    openclawSaveConfigBtn.addEventListener('click', async () => {
      await saveOpenClawConfig();
    });
  }

  if (openclawTestBtn) {
    openclawTestBtn.addEventListener('click', async () => {
      await testOpenClawConnection();
    });
  }

  if (openclawRegisterToolBtn) {
    openclawRegisterToolBtn.addEventListener('click', () => {
      showToolForm();
    });
  }

  const tabButtons = document.querySelectorAll('.openclaw-tab');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchOpenClawTab(btn.dataset.tab);
    });
  });

  const saveToolBtn = document.getElementById('saveToolBtn');
  const cancelToolBtn = document.getElementById('cancelToolBtn');

  if (saveToolBtn) {
    saveToolBtn.addEventListener('click', async () => {
      await registerTool();
    });
  }

  if (cancelToolBtn) {
    cancelToolBtn.addEventListener('click', () => {
      hideToolForm();
    });
  }

  const openclawSaveEventsBtn = document.getElementById('openclawSaveEventsBtn');
  if (openclawSaveEventsBtn) {
    openclawSaveEventsBtn.addEventListener('click', async () => {
      await saveEventSubscriptions();
    });
  }

  const refreshSessionsBtn = document.getElementById('refreshSessionsBtn');
  if (refreshSessionsBtn) {
    refreshSessionsBtn.addEventListener('click', () => {
      loadOpenClawSessions();
    });
  }
}

function switchOpenClawTab(tabName) {
  const tabButtons = document.querySelectorAll('.openclaw-tab');
  tabButtons.forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const tabPanels = document.querySelectorAll('.openclaw-tab-panel');
  tabPanels.forEach(panel => {
    if (panel.id === `openclaw${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`) {
      show(panel);
    } else {
      hide(panel);
    }
  });

  if (tabName === 'sessions') {
    loadOpenClawSessions();
  }
}

async function loadOpenClawConfig() {
  try {
    const res = await fetchJson('/api/openclaw/config');
    const { config } = res;
    
    const { openclawGatewayUrl, openclawToken, openclawAutoConnect } = getOpenClawElements();
    
    if (openclawGatewayUrl && config.gatewayUrl) {
      openclawGatewayUrl.value = config.gatewayUrl;
    }
    if (openclawAutoConnect) {
      openclawAutoConnect.checked = config.autoConnect || false;
    }
  } catch (err) {
    console.error('Failed to load OpenClaw config:', err);
  }
}

async function loadOpenClawStatus() {
  try {
    const res = await fetchJson('/api/openclaw/status');
    updateConnectionStatus(res.connected || false, res.gatewayHealth);
  } catch (err) {
    updateConnectionStatus(false, { success: false, message: err.message });
  }
}

function updateConnectionStatus(connected, health) {
  const { openclawStatusIndicator, openclawStatusText, openclawConnectBtn, openclawDisconnectBtn } = getOpenClawElements();
  
  if (connected) {
    openclawStatusIndicator.classList.remove('disconnected');
    openclawStatusIndicator.classList.add('connected');
    openclawStatusText.textContent = '已连接';
    if (health?.latency) {
      openclawStatusText.textContent += ` (${health.latency}ms)`;
    }
    if (openclawConnectBtn) hide(openclawConnectBtn);
    if (openclawDisconnectBtn) show(openclawDisconnectBtn);
  } else {
    openclawStatusIndicator.classList.remove('connected');
    openclawStatusIndicator.classList.add('disconnected');
    openclawStatusText.textContent = health?.message || '未连接';
    if (openclawConnectBtn) show(openclawConnectBtn);
    if (openclawDisconnectBtn) hide(openclawDisconnectBtn);
  }
}

async function connectOpenClaw() {
  const { openclawGatewayUrl, openclawToken, openclawAutoConnect, openclawConfigMsg } = getOpenClawElements();
  
  try {
    const res = await fetchJson('/api/openclaw/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gatewayUrl: openclawGatewayUrl.value,
        token: openclawToken.value,
        autoConnect: openclawAutoConnect.checked,
        connectNow: true
      })
    });
    
    if (res.connection?.success) {
      openclawConfigMsg.textContent = '连接成功';
      openclawConfigMsg.className = 'form-msg success';
    } else {
      openclawConfigMsg.textContent = res.connection?.message || '连接失败';
      openclawConfigMsg.className = 'form-msg error';
    }
    
    await loadOpenClawStatus();
  } catch (err) {
    openclawConfigMsg.textContent = err.message;
    openclawConfigMsg.className = 'form-msg error';
  }
  
  setTimeout(() => { openclawConfigMsg.textContent = ''; }, 3000);
}

async function disconnectOpenClaw() {
  const { openclawConfigMsg } = getOpenClawElements();
  
  try {
    await fetchJson('/api/openclaw/disconnect', { method: 'POST' });
    openclawConfigMsg.textContent = '已断开连接';
    openclawConfigMsg.className = 'form-msg success';
    await loadOpenClawStatus();
  } catch (err) {
    openclawConfigMsg.textContent = err.message;
    openclawConfigMsg.className = 'form-msg error';
  }
  
  setTimeout(() => { openclawConfigMsg.textContent = ''; }, 3000);
}

async function saveOpenClawConfig() {
  const { openclawGatewayUrl, openclawToken, openclawAutoConnect, openclawConfigMsg } = getOpenClawElements();
  
  try {
    const res = await fetchJson('/api/openclaw/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gatewayUrl: openclawGatewayUrl.value,
        token: openclawToken.value,
        autoConnect: openclawAutoConnect.checked
      })
    });
    
    openclawConfigMsg.textContent = '配置已保存';
    openclawConfigMsg.className = 'form-msg success';
  } catch (err) {
    openclawConfigMsg.textContent = err.message;
    openclawConfigMsg.className = 'form-msg error';
  }
  
  setTimeout(() => { openclawConfigMsg.textContent = ''; }, 3000);
}

async function testOpenClawConnection() {
  const { openclawConfigMsg } = getOpenClawElements();
  
  try {
    const res = await fetchJson('/api/openclaw/test');
    
    if (res.success) {
      openclawConfigMsg.textContent = `连接成功！延迟: ${res.latency}ms`;
      openclawConfigMsg.className = 'form-msg success';
    } else {
      openclawConfigMsg.textContent = res.message || '连接失败';
      openclawConfigMsg.className = 'form-msg error';
    }
  } catch (err) {
    openclawConfigMsg.textContent = err.message;
    openclawConfigMsg.className = 'form-msg error';
  }
  
  setTimeout(() => { openclawConfigMsg.textContent = ''; }, 3000);
}

async function loadOpenClawTools() {
  const { openclawToolsList } = getOpenClawElements();
  if (!openclawToolsList) return;
  
  try {
    const res = await fetchJson('/api/openclaw/tools');
    const tools = res.tools || [];
    
    if (tools.length === 0) {
      openclawToolsList.innerHTML = '<div class="muted small">暂无已注册工具</div>';
      return;
    }
    
    openclawToolsList.innerHTML = tools.map(tool => `
      <div class="openclaw-tool-item" data-tool-name="${escapeHtml(tool.name)}">
        <div class="openclaw-tool-info">
          <div class="openclaw-tool-name">${escapeHtml(tool.name)}</div>
          <div class="openclaw-tool-desc muted small">${escapeHtml(tool.description || '无描述')}</div>
        </div>
        <div class="openclaw-tool-actions">
          <button class="ghost tiny delete-tool-btn" data-tool-name="${escapeHtml(tool.name)}">删除</button>
        </div>
      </div>
    `).join('');
    
    openclawToolsList.querySelectorAll('.delete-tool-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const toolName = btn.dataset.toolName;
        if (confirm(`确定要删除工具 "${toolName}" 吗？`)) {
          await deleteTool(toolName);
        }
      });
    });
  } catch (err) {
    openclawToolsList.innerHTML = `<div class="muted small">加载失败: ${escapeHtml(err.message)}</div>`;
  }
}

async function deleteTool(toolName) {
  try {
    await fetchJson(`/api/openclaw/tools/${toolName}`, { method: 'DELETE' });
    await loadOpenClawTools();
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
}

function showToolForm() {
  const { openclawToolForm } = getOpenClawElements();
  if (openclawToolForm) {
    show(openclawToolForm);
    document.getElementById('toolNameInput').value = '';
    document.getElementById('toolDescInput').value = '';
    document.getElementById('toolHandlerType').value = 'orchestra-api';
  }
}

function hideToolForm() {
  const { openclawToolForm } = getOpenClawElements();
  if (openclawToolForm) {
    hide(openclawToolForm);
  }
}

async function registerTool() {
  const name = document.getElementById('toolNameInput').value;
  const description = document.getElementById('toolDescInput').value;
  const handlerType = document.getElementById('toolHandlerType').value;
  
  if (!name) {
    alert('请输入工具名称');
    return;
  }
  
  try {
    await fetchJson('/api/openclaw/register-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        handlerType
      })
    });
    
    hideToolForm();
    await loadOpenClawTools();
  } catch (err) {
    alert('注册失败: ' + err.message);
  }
}

async function loadOpenClawEvents() {
  const { openclawEventSubscriptions, openclawActiveSubscriptions } = getOpenClawElements();
  if (!openclawEventSubscriptions) return;
  
  try {
    const res = await fetchJson('/api/openclaw/events');
    const { availableEvents, subscriptions, config } = res;
    
    openclawEventSubscriptions.innerHTML = availableEvents.map(event => `
      <label class="openclaw-event-checkbox">
        <input type="checkbox" 
               value="${event.type}" 
               ${config[event.type] ? 'checked' : ''} 
               data-event-type="${event.type}" />
        <span class="event-type">${event.type}</span>
        <span class="event-desc muted small">${event.description}</span>
      </label>
    `).join('');
    
    if (subscriptions.length > 0) {
      openclawActiveSubscriptions.innerHTML = subscriptions.map(sub => `
        <div class="openclaw-subscription-item">
          <span class="subscription-event-type">${sub.eventType}</span>
          <span class="muted small">${sub.handlerCount} 个处理器</span>
        </div>
      `).join('');
    } else {
      openclawActiveSubscriptions.innerHTML = '<div class="muted small">暂无活跃订阅</div>';
    }
  } catch (err) {
    console.error('Failed to load events:', err);
  }
}

async function saveEventSubscriptions() {
  const checkboxes = document.querySelectorAll('#openclawEventSubscriptions input[type="checkbox"]');
  const eventSubscriptions = {};
  
  checkboxes.forEach(cb => {
    eventSubscriptions[cb.value] = cb.checked;
  });
  
  try {
    await fetchJson('/api/openclaw/events', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventSubscriptions })
    });
    
    const msgEl = document.getElementById('openclawConfigMsg');
    if (msgEl) {
      msgEl.textContent = '事件订阅配置已保存';
      msgEl.className = 'form-msg success';
      setTimeout(() => { msgEl.textContent = ''; }, 3000);
    }
    
    await loadOpenClawEvents();
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
}

async function loadOpenClawSessions() {
  const { openclawSessionsList } = getOpenClawElements();
  if (!openclawSessionsList) return;
  
  try {
    const res = await fetchJson('/api/openclaw/sessions');
    const sessions = res.sessions || [];
    
    if (sessions.length === 0) {
      openclawSessionsList.innerHTML = '<div class="muted small">暂无活跃会话</div>';
      return;
    }
    
    openclawSessionsList.innerHTML = sessions.map(session => `
      <div class="openclaw-session-item">
        <div class="openclaw-session-info">
          <div class="openclaw-session-id muted small">${escapeHtml(session.id || session.sessionId)}</div>
          <div class="openclaw-session-agent">${escapeHtml(session.agentId || 'Unknown Agent')}</div>
        </div>
        <div class="openclaw-session-status">
          <span class="session-status-badge ${session.status || 'active'}">${session.status || 'active'}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    openclawSessionsList.innerHTML = `<div class="muted small">加载失败: ${escapeHtml(err.message)}</div>`;
  }
}

export function renderOpenClawUI() {
  if (!state.isAdmin) {
    return;
  }
  
  const { openclawPanel } = getOpenClawElements();
  if (openclawPanel) {
    show(openclawPanel);
  }
  
  initOpenClawComponent();
}
