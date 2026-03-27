/**
 * Component Registry - Frontend Plugin Component Management
 * 
 * 负责注册、管理和渲染插件组件
 * 支持动态加载插件面板到仪表板
 */

/** @type {Map<string, PluginComponent>} */
const componentRegistry = new Map();

/** @type {Map<string, Function>} */
const renderCallbacks = new Map();

/**
 * 插件组件接口
 * @typedef {Object} PluginComponent
 * @property {string} id - 组件唯一标识
 * @property {string} name - 组件名称
 * @property {string} type - 组件类型 (panel/widget/chart)
 * @property {Function} render - 渲染函数
 * @property {Function} refresh - 刷新函数
 * @property {Function} destroy - 销毁函数
 * @property {Object} config - 组件配置
 */

/**
 * 注册组件
 * @param {string} id - 组件 ID
 * @param {PluginComponent} component - 组件对象
 */
export function registerComponent(id, component) {
  if (componentRegistry.has(id)) {
    console.warn(`[ComponentRegistry] Component "${id}" already registered, overwriting`);
  }
  
  componentRegistry.set(id, {
    id,
    name: component.name || id,
    type: component.type || 'panel',
    render: component.render || (() => {}),
    refresh: component.refresh || (() => {}),
    destroy: component.destroy || (() => {}),
    config: component.config || {},
    registeredAt: Date.now()
  });
  
  console.log(`[ComponentRegistry] Component "${id}" registered`);
}

/**
 * 注销组件
 * @param {string} id - 组件 ID
 */
export async function unregisterComponent(id) {
  const component = componentRegistry.get(id);
  if (!component) {
    throw new Error(`Component "${id}" not found`);
  }
  
  // 调用销毁回调
  if (typeof component.destroy === 'function') {
    try {
      await component.destroy();
    } catch (error) {
      console.error(`[ComponentRegistry] Error destroying component "${id}":`, error);
    }
  }
  
  // 移除渲染回调
  renderCallbacks.delete(id);
  componentRegistry.delete(id);
  
  console.log(`[ComponentRegistry] Component "${id}" unregistered`);
}

/**
 * 获取组件
 * @param {string} id - 组件 ID
 * @returns {PluginComponent|null}
 */
export function getComponent(id) {
  return componentRegistry.get(id) || null;
}

/**
 * 获取所有组件
 * @returns {PluginComponent[]}
 */
export function getAllComponents() {
  return Array.from(componentRegistry.values());
}

/**
 * 按类型获取组件
 * @param {string} type - 组件类型
 * @returns {PluginComponent[]}
 */
export function getComponentsByType(type) {
  return getAllComponents().filter(c => c.type === type);
}

/**
 * 渲染组件到指定容器
 * @param {string} id - 组件 ID
 * @param {string} containerId - 容器 ID
 * @param {Object} options - 渲染选项
 */
export async function renderComponent(id, containerId, options = {}) {
  const component = componentRegistry.get(id);
  if (!component) {
    throw new Error(`Component "${id}" not found`);
  }
  
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container "${containerId}" not found`);
  }
  
  try {
    // 调用渲染函数
    const result = await component.render(container, options);
    
    // 如果返回 HTML，直接插入
    if (typeof result === 'string') {
      container.innerHTML = result;
    } 
    // 如果返回对象，处理 html/styles/script
    else if (result && typeof result === 'object') {
      if (result.html) {
        container.innerHTML = result.html;
      }
      if (result.styles) {
        injectStyles(result.styles, `plugin-${id}-styles`);
      }
      if (result.script) {
        // 将脚本绑定到组件上下文
        const scriptFn = new Function('component', 'container', result.script);
        scriptFn(component, container);
      }
    }
    
    console.log(`[ComponentRegistry] Component "${id}" rendered to "${containerId}"`);
    return result;
  } catch (error) {
    console.error(`[ComponentRegistry] Error rendering component "${id}":`, error);
    container.innerHTML = `<div class="error">组件渲染失败：${error.message}</div>`;
    throw error;
  }
}

/**
 * 刷新组件
 * @param {string} id - 组件 ID
 * @param {Object} options - 刷新选项
 */
export async function refreshComponent(id, options = {}) {
  const component = componentRegistry.get(id);
  if (!component) {
    throw new Error(`Component "${id}" not found`);
  }
  
  if (typeof component.refresh === 'function') {
    try {
      await component.refresh(options);
    } catch (error) {
      console.error(`[ComponentRegistry] Error refreshing component "${id}":`, error);
      throw error;
    }
  }
}

/**
 * 刷新所有组件
 * @param {Object} options - 刷新选项
 */
export async function refreshAllComponents(options = {}) {
  const promises = Array.from(componentRegistry.values()).map(async (component) => {
    try {
      await refreshComponent(component.id, options);
    } catch (error) {
      console.error(`[ComponentRegistry] Error refreshing component "${component.id}":`, error);
    }
  });
  
  await Promise.all(promises);
}

/**
 * 设置组件自动刷新
 * @param {string} id - 组件 ID
 * @param {number} interval - 刷新间隔（毫秒）
 */
export function setAutoRefresh(id, interval) {
  // 清除之前的定时器
  clearAutoRefresh(id);
  
  const timerId = setInterval(async () => {
    try {
      await refreshComponent(id);
    } catch (error) {
      console.error(`[ComponentRegistry] Auto-refresh failed for "${id}":`, error);
    }
  }, interval);
  
  renderCallbacks.set(id, timerId);
  console.log(`[ComponentRegistry] Auto-refresh set for "${id}" (interval: ${interval}ms)`);
}

/**
 * 清除组件自动刷新
 * @param {string} id - 组件 ID
 */
export function clearAutoRefresh(id) {
  const timerId = renderCallbacks.get(id);
  if (timerId) {
    clearInterval(timerId);
    renderCallbacks.delete(id);
    console.log(`[ComponentRegistry] Auto-refresh cleared for "${id}"`);
  }
}

/**
 * 清除所有自动刷新
 */
export function clearAllAutoRefresh() {
  renderCallbacks.forEach((timerId, id) => {
    clearInterval(timerId);
  });
  renderCallbacks.clear();
  console.log('[ComponentRegistry] All auto-refresh cleared');
}

/**
 * 注入样式
 * @param {string} css - CSS 内容
 * @param {string} id - 样式表 ID
 */
function injectStyles(css, id) {
  let styleEl = document.getElementById(id);
  
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = id;
    document.head.appendChild(styleEl);
  }
  
  styleEl.textContent = css;
}

/**
 * 创建仪表板小组件
 * @param {Object} options - 小组件选项
 * @returns {HTMLElement}
 */
export function createWidget(options = {}) {
  const {
    id,
    title = 'Widget',
    width = 'medium', // small, medium, large, full
    height = 'auto',
    refreshable = true,
    collapsible = true
  } = options;
  
  const widget = document.createElement('div');
  widget.className = `dashboard-widget widget-${width}`;
  widget.dataset.componentId = id;
  
  const header = document.createElement('div');
  header.className = 'widget-header';
  
  const titleEl = document.createElement('h3');
  titleEl.className = 'widget-title';
  titleEl.textContent = title;
  header.appendChild(titleEl);
  
  if (refreshable || collapsible) {
    const actions = document.createElement('div');
    actions.className = 'widget-actions';
    
    if (refreshable) {
      const refreshBtn = document.createElement('button');
      refreshBtn.className = 'widget-action refresh';
      refreshBtn.innerHTML = '🔄';
      refreshBtn.title = '刷新';
      refreshBtn.onclick = () => refreshComponent(id);
      actions.appendChild(refreshBtn);
    }
    
    if (collapsible) {
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'widget-action collapse';
      collapseBtn.innerHTML = '▼';
      collapseBtn.title = '折叠';
      collapseBtn.onclick = () => {
        const content = widget.querySelector('.widget-content');
        if (content) {
          content.style.display = content.style.display === 'none' ? 'block' : 'none';
          collapseBtn.innerHTML = content.style.display === 'none' ? '▶' : '▼';
        }
      };
      actions.appendChild(collapseBtn);
    }
    
    header.appendChild(actions);
  }
  
  const content = document.createElement('div');
  content.className = 'widget-content';
  content.id = `widget-${id}-content`;
  
  widget.appendChild(header);
  widget.appendChild(content);
  
  return widget;
}

/**
 * 渲染仪表板
 * @param {string[]} componentIds - 组件 ID 列表
 * @param {string} containerId - 容器 ID
 */
export async function renderDashboard(componentIds, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container "${containerId}" not found`);
  }
  
  container.innerHTML = '';
  container.className = 'dashboard-grid';
  
  for (const id of componentIds) {
    const component = componentRegistry.get(id);
    if (!component) {
      console.warn(`[ComponentRegistry] Component "${id}" not found, skipping`);
      continue;
    }
    
    const widget = createWidget({
      id,
      title: component.name,
      refreshable: typeof component.refresh === 'function'
    });
    
    container.appendChild(widget);
    
    const contentEl = document.getElementById(`widget-${id}-content`);
    if (contentEl) {
      await renderComponent(id, contentEl);
    }
  }
}

/**
 * 从插件配置加载组件
 * @param {Object} pluginConfig - 插件配置
 */
export async function loadComponentsFromPlugin(pluginConfig) {
  const { id, name, type, config } = pluginConfig;
  
  // 根据插件类型创建默认组件
  if (type === 'panel') {
    registerComponent(id, {
      name: name || id,
      type: 'panel',
      config: config || {},
      render: async (container) => {
        // 默认渲染逻辑，等待插件提供实际渲染函数
        return {
          html: `<div class="plugin-panel" data-plugin="${id}">
            <div class="loading">加载插件面板...</div>
          </div>`,
          styles: `.plugin-panel { padding: 16px; min-height: 200px; }
            .plugin-panel .loading { color: #64748b; text-align: center; padding: 40px; }`
        };
      },
      refresh: async () => {
        // 默认刷新逻辑
        console.log(`[ComponentRegistry] Refreshing plugin component "${id}"`);
      }
    });
  }
}

/**
 * 初始化组件注册中心
 */
export function initComponentRegistry() {
  console.log('[ComponentRegistry] Initialized');
  
  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    clearAllAutoRefresh();
  });
}

// 导出默认对象
export default {
  registerComponent,
  unregisterComponent,
  getComponent,
  getAllComponents,
  getComponentsByType,
  renderComponent,
  refreshComponent,
  refreshAllComponents,
  setAutoRefresh,
  clearAutoRefresh,
  clearAllAutoRefresh,
  createWidget,
  renderDashboard,
  loadComponentsFromPlugin,
  initComponentRegistry
};
