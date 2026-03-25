/**
 * Session Routes
 * Handles session management API endpoints
 * @param {Object} server - HTTP server instance
 * @param {Object} deps - Dependencies object containing helper functions and lib modules
 */
module.exports = function registerSessionRoutes(server, deps) {
  const {
    readRuntime,
    json,
    readJson,
    verifyTokenFromRequest,
    addAuditEvent
  } = deps;

  /**
   * GET /api/sessions - List all sessions
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/sessions') {
      const runtime = await readRuntime();
      const sessions = (runtime.agents || []).flatMap(agent => 
        (agent.sessions || []).map(session => ({
          ...session,
          agentId: agent.id,
          agentName: agent.name
        }))
      );
      return json(res, 200, { sessions });
    }
  });

  /**
   * DELETE /api/sessions/:agentId - Clear sessions for an agent
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/sessions\/([^\/]+)$/);
    if (req.method === 'DELETE' && match) {
      const agentId = match[1];
      const runtime = await readRuntime();
      const agent = (runtime.agents || []).find(a => a.id === agentId);
      
      if (!agent) {
        return json(res, 404, { error: 'Agent 不存在' });
      }
      
      agent.sessions = [];
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('session.cleared', { agentId }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 200, { success: true });
    }
  });

  /**
   * POST /api/sessions/:agentId/clear - Clear sessions for an agent (alternative endpoint)
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/sessions\/([^\/]+)\/clear$/);
    if (match) {
      const agentId = match[1];
      const runtime = await readRuntime();
      const agent = (runtime.agents || []).find(a => a.id === agentId);
      
      if (!agent) {
        return json(res, 404, { error: 'Agent 不存在' });
      }
      
      agent.sessions = [];
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('session.cleared', { agentId }, currentUser?.name || 'system', currentUser?.id);
      
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