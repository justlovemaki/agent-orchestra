'use strict';

/**
 * Plugins Routes
 * 
 * Plugin management API endpoints
 */

function pluginsRoutes(serverWithEvents, deps) {
  const { json, readJson, pluginSystem } = deps;

  serverWithEvents.on('request', async (req, res) => {
    const parsed = new URL(req.url, `http://localhost`);
    const pathname = parsed.pathname;

    if (pathname === '/api/plugins' && req.method === 'GET') {
      try {
        const plugins = pluginSystem.getAllPlugins();
        return json(res, 200, { plugins });
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }

    if (pathname.match(/^\/api\/plugins\/[\w-]+\/enable$/) && req.method === 'POST') {
      const pluginName = pathname.split('/')[3];
      try {
        const plugin = await pluginSystem.enablePlugin(pluginName);
        return json(res, 200, { success: true, plugin: plugin.getMetadata() });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (pathname.match(/^\/api\/plugins\/[\w-]+\/disable$/) && req.method === 'POST') {
      const pluginName = pathname.split('/')[3];
      try {
        const plugin = await pluginSystem.disablePlugin(pluginName);
        return json(res, 200, { success: true, plugin: plugin.getMetadata() });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (pathname.match(/^\/api\/plugins\/[\w-]+\/config$/) && req.method === 'GET') {
      const pluginName = pathname.split('/')[3];
      try {
        const config = pluginSystem.getPluginConfig(pluginName);
        const plugin = pluginSystem.getPlugin(pluginName);
        return json(res, 200, {
          config,
          schema: plugin?.configSchema || {}
        });
      } catch (error) {
        return json(res, 404, { error: error.message });
      }
    }

    if (pathname.match(/^\/api\/plugins\/[\w-]+\/config$/) && req.method === 'PUT') {
      const pluginName = pathname.split('/')[3];
      try {
        const body = await readJson(req);
        const plugin = pluginSystem.updatePluginConfig(pluginName, body);
        return json(res, 200, { success: true, config: plugin.config });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (pathname.match(/^\/api\/plugins\/[\w-]+$/) && req.method === 'GET') {
      const pluginName = pathname.split('/')[3];
      // 排除插件市场路径
      if (pluginName === 'marketplace') {
        return; // 让插件市场路由处理
      }
      try {
        const plugin = pluginSystem.getPlugin(pluginName);
        if (!plugin) {
          return json(res, 404, { error: 'Plugin not found' });
        }
        return json(res, 200, {
          ...plugin.getMetadata(),
          config: pluginSystem.getPluginConfig(pluginName),
          path: plugin.pluginPath
        });
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }

    if (pathname.match(/^\/api\/plugins\/type\/[\w-]+$/) && req.method === 'GET') {
      const pluginType = pathname.split('/')[4];
      try {
        const plugins = pluginSystem.getPluginsByType(pluginType);
        return json(res, 200, { plugins });
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }

    if (pathname.match(/^\/api\/plugins\/[\w-]+\/reload$/) && req.method === 'POST') {
      const pluginName = pathname.split('/')[3];
      try {
        await pluginSystem.reloadPlugin(pluginName);
        const plugin = pluginSystem.getPlugin(pluginName);
        return json(res, 200, { success: true, plugin: plugin.getMetadata() });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (pathname.match(/^\/api\/plugins\/[\w-]+\/call$/) && req.method === 'POST') {
      const pluginName = pathname.split('/')[3];
      try {
        const body = await readJson(req);
        const plugin = pluginSystem.getPlugin(pluginName);
        
        if (!plugin) {
          return json(res, 404, { error: 'Plugin not found' });
        }

        const { method, args = {} } = body;
        
        if (typeof plugin[method] === 'function') {
          const result = await plugin[method](args);
          return json(res, 200, { result });
        } else {
          return json(res, 400, { error: `Method ${method} not found on plugin` });
        }
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }
  });
}

module.exports = pluginsRoutes;
