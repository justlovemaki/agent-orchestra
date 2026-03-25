/**
 * Preset Routes
 * Handles preset management for shared and user-specific presets
 * @param {Object} server - HTTP server instance
 * @param {Object} deps - Dependencies object containing helper functions and lib modules
 */
module.exports = function registerPresetRoutes(server, deps) {
  const {
    readSharedPresets,
    writeSharedPresets,
    readUserPresets,
    writeUserPresets,
    readTemplates,
    writeTemplates,
    json,
    readJson,
    verifyTokenFromRequest,
    addAuditEvent,
    invalidateOverviewCache
  } = deps;

  /**
   * GET /api/presets - List all shared presets
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/presets') {
      const presets = await readSharedPresets();
      return json(res, 200, { presets });
    }
  });

  /**
   * POST /api/presets - Create a new shared preset
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/presets') {
      const body = await readJson(req);
      const presets = await readSharedPresets();
      
      const newPreset = {
        id: body.id || `preset-${Date.now()}`,
        name: body.name,
        prompt: body.prompt,
        agents: body.agents || [],
        mode: body.mode || 'parallel',
        priority: body.priority || 'medium',
        createdAt: new Date().toISOString()
      };
      
      presets.push(newPreset);
      await writeSharedPresets(presets);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('preset.created', { presetId: newPreset.id, presetName: newPreset.name }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 201, { preset: newPreset });
    }
  });

  /**
   * PUT /api/presets/:id - Update a shared preset
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/presets\/([^\/]+)$/);
    if (req.method === 'PUT' && match) {
      const presetId = match[1];
      const body = await readJson(req);
      const presets = await readSharedPresets();
      const index = presets.findIndex(p => p.id === presetId);
      
      if (index === -1) {
        return json(res, 404, { error: 'Preset 不存在' });
      }
      
      presets[index] = { ...presets[index], ...body, updatedAt: new Date().toISOString() };
      await writeSharedPresets(presets);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('preset.updated', { presetId, presetName: presets[index].name }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 200, { preset: presets[index] });
    }
  });

  /**
   * DELETE /api/presets/:id - Delete a shared preset
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/presets\/([^\/]+)$/);
    if (req.method === 'DELETE' && match) {
      const presetId = match[1];
      const presets = await readSharedPresets();
      const index = presets.findIndex(p => p.id === presetId);
      
      if (index === -1) {
        return json(res, 404, { error: 'Preset 不存在' });
      }
      
      const deleted = presets.splice(index, 1)[0];
      await writeSharedPresets(presets);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('preset.deleted', { presetId, presetName: deleted.name }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 200, { success: true });
    }
  });

  /**
   * GET /api/presets/user - List user-specific presets
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/presets/user') {
      const userPresets = await readUserPresets();
      return json(res, 200, { presets: userPresets });
    }
  });

  /**
   * POST /api/presets/user - Create a user-specific preset
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/presets/user') {
      const body = await readJson(req);
      const userPresets = await readUserPresets();
      const currentUser = await verifyTokenFromRequest(req);
      
      const newPreset = {
        id: body.id || `user-preset-${Date.now()}`,
        name: body.name,
        prompt: body.prompt,
        agents: body.agents || [],
        mode: body.mode || 'parallel',
        priority: body.priority || 'medium',
        userId: currentUser?.id || 'anonymous',
        createdAt: new Date().toISOString()
      };
      
      userPresets.push(newPreset);
      await writeUserPresets(userPresets);
      
      return json(res, 201, { preset: newPreset });
    }
  });

  /**
   * DELETE /api/presets/user/:id - Delete a user-specific preset
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/presets\/user\/([^\/]+)$/);
    if (req.method === 'DELETE' && match) {
      const presetId = match[1];
      const userPresets = await readUserPresets();
      const index = userPresets.findIndex(p => p.id === presetId);
      
      if (index === -1) {
        return json(res, 404, { error: 'User preset 不存在' });
      }
      
      userPresets.splice(index, 1);
      await writeUserPresets(userPresets);
      
      return json(res, 200, { success: true });
    }
  });
};

function parseRequest(req) {
  const url = require('url');
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return { pathname, parsed };
}