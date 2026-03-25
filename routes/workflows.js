/**
 * Workflow Routes
 * Handles workflow management and execution API endpoints
 * @param {Object} server - HTTP server instance
 * @param {Object} deps - Dependencies object containing helper functions and lib modules
 */
module.exports = function registerWorkflowRoutes(server, deps) {
  const {
    json,
    readJson,
    verifyTokenFromRequest,
    addAuditEvent,
    loadWorkflows,
    createWorkflow,
    getWorkflow,
    updateWorkflow,
    deleteWorkflow,
    runWorkflow,
    getWorkflowRun,
    getWorkflowRuns
  } = deps;

  /**
   * GET /api/workflows - List all workflows
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/workflows') {
      const workflows = await loadWorkflows();
      return json(res, 200, { workflows });
    }
  });

  /**
   * POST /api/workflows - Create a new workflow
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/workflows') {
      const body = await readJson(req);
      const workflow = await createWorkflow(body);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('workflow.created', { workflowId: workflow.id, workflowName: workflow.name }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 201, { workflow });
    }
  });

  /**
   * GET /api/workflows/:id - Get a specific workflow
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/workflows\/([^\/]+)$/);
    if (req.method === 'GET' && match) {
      const workflowId = match[1];
      const workflow = await getWorkflow(workflowId);
      if (!workflow) {
        return json(res, 404, { error: 'Workflow 不存在' });
      }
      return json(res, 200, { workflow });
    }
  });

  /**
   * PUT /api/workflows/:id - Update a workflow
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/workflows\/([^\/]+)$/);
    if (req.method === 'PUT' && match) {
      const workflowId = match[1];
      const body = await readJson(req);
      const workflow = await updateWorkflow(workflowId, body);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('workflow.updated', { workflowId, workflowName: workflow.name }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 200, { workflow });
    }
  });

  /**
   * DELETE /api/workflows/:id - Delete a workflow
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/workflows\/([^\/]+)$/);
    if (req.method === 'DELETE' && match) {
      const workflowId = match[1];
      await deleteWorkflow(workflowId);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('workflow.deleted', { workflowId }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 200, { success: true });
    }
  });

  /**
   * POST /api/workflows/:id/run - Run a workflow
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/workflows\/([^\/]+)\/run$/);
    if (match) {
      const workflowId = match[1];
      const body = await readJson(req);
      const run = await runWorkflow(workflowId, body);
      
      const currentUser = await verifyTokenFromRequest(req);
      await addAuditEvent('workflow.run.started', { workflowId, runId: run.id }, currentUser?.name || 'system', currentUser?.id);
      
      return json(res, 200, { run });
    }
  });

  /**
   * GET /api/workflows/:id/runs - Get workflow run history
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/workflows\/([^\/]+)\/runs$/);
    if (req.method === 'GET' && match) {
      const workflowId = match[1];
      const runs = await getWorkflowRuns(workflowId);
      return json(res, 200, { runs });
    }
  });

  /**
   * GET /api/workflow-runs/:id - Get a specific workflow run
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/workflow-runs\/([^\/]+)$/);
    if (req.method === 'GET' && match) {
      const runId = match[1];
      const run = await getWorkflowRun(runId);
      if (!run) {
        return json(res, 404, { error: 'Run 不存在' });
      }
      return json(res, 200, { run });
    }
  });
};

function parseRequest(req) {
  const url = require('url');
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return { pathname, parsed };
}