/**
 * Agent Groups Routes
 * Handles agent group management API endpoints
 * @param {Object} server - HTTP server instance
 * @param {Object} deps - Dependencies object containing helper functions and lib modules
 */
module.exports = function registerAgentGroupRoutes(server, deps) {
  const {
    readAgentGroups,
    writeAgentGroups,
    json,
    readJson,
    verifyTokenFromRequest,
    addAuditEvent,
    invalidateOverviewCache
  } = deps;

  /**
   * GET /api/agent-groups - List all agent groups
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/agent-groups') {
      const groups = await readAgentGroups();
      return json(res, 200, { agentGroups: groups });
    }
  });

  /**
   * POST /api/agent-groups - Create a new agent group
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/agent-groups') {
      const body = await readJson(req);
      const groups = await readAgentGroups();
      
      const newGroup = {
        id: body.id || `group-${Date.now()}`,
        name: body.name,
        agents: body.agents || [],
        createdAt: new Date().toISOString()
      };
      
      groups.push(newGroup);
      await writeAgentGroups(groups);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('agent_group.created', { groupId: newGroup.id, groupName: newGroup.name }, currentUser?.name || 'system', currentUser?.id);
      
      invalidateOverviewCache();
      return json(res, 201, { agentGroup: newGroup });
    }
  });

  /**
   * PUT /api/agent-groups/:id - Update an agent group
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/agent-groups\/([^\/]+)$/);
    if (req.method === 'PUT' && match) {
      const groupId = match[1];
      const body = await readJson(req);
      const groups = await readAgentGroups();
      const index = groups.findIndex(g => g.id === groupId);
      
      if (index === -1) {
        return json(res, 404, { error: 'Agent 分组不存在' });
      }
      
      groups[index] = { ...groups[index], ...body, updatedAt: new Date().toISOString() };
      await writeAgentGroups(groups);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('agent_group.updated', { groupId, groupName: groups[index].name }, currentUser?.name || 'system', currentUser?.id);
      
      invalidateOverviewCache();
      return json(res, 200, { agentGroup: groups[index] });
    }
  });

  /**
   * DELETE /api/agent-groups/:id - Delete an agent group
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/agent-groups\/([^\/]+)$/);
    if (req.method === 'DELETE' && match) {
      const groupId = match[1];
      const groups = await readAgentGroups();
      const index = groups.findIndex(g => g.id === groupId);
      
      if (index === -1) {
        return json(res, 404, { error: 'Agent 分组不存在' });
      }
      
      const deleted = groups.splice(index, 1)[0];
      await writeAgentGroups(groups);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('agent_group.deleted', { groupId, groupName: deleted.name }, currentUser?.name || 'system', currentUser?.id);
      
      invalidateOverviewCache();
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