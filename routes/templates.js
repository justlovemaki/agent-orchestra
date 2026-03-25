/**
 * Template Routes
 * Handles template management API endpoints
 * @param {Object} server - HTTP server instance
 * @param {Object} deps - Dependencies object containing helper functions and lib modules
 */
module.exports = function registerTemplateRoutes(server, deps) {
  const {
    readTemplates,
    writeTemplates,
    json,
    readJson,
    verifyTokenFromRequest,
    addAuditEvent,
    invalidateOverviewCache
  } = deps;

  /**
   * GET /api/templates - List all templates
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/templates') {
      const templates = await readTemplates();
      return json(res, 200, { templates });
    }
  });

  /**
   * POST /api/templates - Create a new template
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/templates') {
      const body = await readJson(req);
      const templates = await readTemplates();
      const newTemplate = {
        id: body.id || `template-${Date.now()}`,
        name: body.name,
        prompt: body.prompt,
        agents: body.agents || [],
        mode: body.mode || 'parallel',
        priority: body.priority || 'medium',
        createdAt: new Date().toISOString()
      };
      templates.push(newTemplate);
      await writeTemplates(templates);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('template.created', { templateId: newTemplate.id, templateName: newTemplate.name }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 201, { template: newTemplate });
    }
  });

  /**
   * PUT /api/templates/:id - Update a template
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/templates\/([^\/]+)$/);
    if (req.method === 'PUT' && match) {
      const templateId = match[1];
      const body = await readJson(req);
      const templates = await readTemplates();
      const index = templates.findIndex(t => t.id === templateId);
      
      if (index === -1) {
        return json(res, 404, { error: '模板不存在' });
      }
      
      templates[index] = { ...templates[index], ...body, updatedAt: new Date().toISOString() };
      await writeTemplates(templates);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('template.updated', { templateId, templateName: templates[index].name }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 200, { template: templates[index] });
    }
  });

  /**
   * DELETE /api/templates/:id - Delete a template
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/templates\/([^\/]+)$/);
    if (req.method === 'DELETE' && match) {
      const templateId = match[1];
      const templates = await readTemplates();
      const index = templates.findIndex(t => t.id === templateId);
      
      if (index === -1) {
        return json(res, 404, { error: '模板不存在' });
      }
      
      const deleted = templates.splice(index, 1)[0];
      await writeTemplates(templates);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('template.deleted', { templateId, templateName: deleted.name }, currentUser?.name || 'system', currentUser?.id);
      
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