/**
 * Agent Combinations Routes
 * Handles agent combination management, recommendations, usage trends, and import/export
 * @param {Object} server - HTTP server instance
 * @param {Object} deps - Dependencies object containing helper functions and lib modules
 */
module.exports = function registerAgentCombinationRoutes(server, deps) {
  const {
    readAgentCombinations,
    writeAgentCombinations,
    json,
    readJson,
    readBody,
    verifyTokenFromRequest,
    addAuditEvent,
    agentCombinations,
    combinationRecommendations,
    invalidateOverviewCache,
    DATA_DIR,
    fsp,
    path
  } = deps;

  /**
   * GET /api/agent-combinations - List all agent combinations
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/agent-combinations') {
      const combinations = await readAgentCombinations();
      return json(res, 200, { agentCombinations: combinations });
    }
  });

  /**
   * POST /api/agent-combinations - Create a new agent combination
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/agent-combinations') {
      const body = await readJson(req);
      const combinations = await readAgentCombinations();
      
      const newCombination = {
        id: body.id || `combo-${Date.now()}`,
        name: body.name,
        agents: body.agents || [],
        description: body.description || '',
        createdAt: new Date().toISOString()
      };
      
      combinations.push(newCombination);
      await writeAgentCombinations(combinations);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('agent_combination.created', { combinationId: newCombination.id, name: newCombination.name }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 201, { agentCombination: newCombination });
    }
  });

  /**
   * PUT /api/agent-combinations/:id - Update an agent combination
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/agent-combinations\/([^\/]+)$/);
    if (req.method === 'PUT' && match) {
      const combinationId = match[1];
      const body = await readJson(req);
      const combinations = await readAgentCombinations();
      const index = combinations.findIndex(c => c.id === combinationId);
      
      if (index === -1) {
        return json(res, 404, { error: '组合不存在' });
      }
      
      combinations[index] = { ...combinations[index], ...body, updatedAt: new Date().toISOString() };
      await writeAgentCombinations(combinations);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('agent_combination.updated', { combinationId, name: combinations[index].name }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 200, { agentCombination: combinations[index] });
    }
  });

  /**
   * DELETE /api/agent-combinations/:id - Delete an agent combination
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/agent-combinations\/([^\/]+)$/);
    if (req.method === 'DELETE' && match) {
      const combinationId = match[1];
      const combinations = await readAgentCombinations();
      const index = combinations.findIndex(c => c.id === combinationId);
      
      if (index === -1) {
        return json(res, 404, { error: '组合不存在' });
      }
      
      const deleted = combinations.splice(index, 1)[0];
      await writeAgentCombinations(combinations);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('agent_combination.deleted', { combinationId, name: deleted.name }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 200, { success: true });
    }
  });

  /**
   * GET /api/agent-combinations/recommendations - Get agent combination recommendations
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/agent-combinations/recommendations') {
      const recommendations = await combinationRecommendations.getRecommendations();
      return json(res, 200, { recommendations });
    }
  });

  /**
   * GET /api/agent-combinations/usage-trends - Get usage trends
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/agent-combinations/usage-trends') {
      const days = parseInt(parsed.query?.days) || 30;
      const trends = await agentCombinations.getUsageTrends(days);
      return json(res, 200, { days, trends });
    }
  });

  /**
   * POST /api/agent-combinations/import - Import agent combinations
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/agent-combinations/import') {
      const body = await readJson(req);
      const combinations = await readAgentCombinations();
      
      const imported = body.combinations || [];
      const newCombinations = imported.map(c => ({
        ...c,
        id: c.id || `combo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        importedAt: new Date().toISOString()
      }));
      
      const existingCount = combinations.length;
      combinations.push(...newCombinations);
      await writeAgentCombinations(combinations);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('agent_combination.imported', { count: newCombinations.length }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 200, { success: true, imported: newCombinations.length, total: combinations.length });
    }
  });

  /**
   * GET /api/agent-combinations/export - Export agent combinations
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/agent-combinations/export') {
      const combinations = await readAgentCombinations();
      const format = parsed.query?.format || 'json';
      
      if (format === 'csv') {
        const csv = combinations.map(c => `${c.name},${c.agents.join(';')},${c.description || ''}`).join('\n');
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="agent-combinations.csv"' });
        return res.end(csv);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="agent-combinations.json"' });
      return res.end(JSON.stringify({ agentCombinations: combinations }, null, 2));
    }
  });
};

function parseRequest(req) {
  const url = require('url');
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return { pathname, parsed };
}