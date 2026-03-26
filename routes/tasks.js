/**
 * Task Routes
 * Handles all task-related API endpoints (CRUD, execution, logs, etc.)
 * @param {Object} server - HTTP server instance
 * @param {Object} deps - Dependencies object containing helper functions and lib modules
 */
module.exports = function registerTaskRoutes(server, deps) {
  const {
    readTasks,
    writeTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    runTask,
    pauseTask,
    resumeTask,
    cancelTask,
    listTasks,
    readLog,
    json,
    readJson,
    verifyTokenFromRequest,
    addAuditEvent,
    parseTaskFilters,
    filterTasks,
    formatTaskForUi,
    invalidateOverviewCache,
    DATA_DIR,
    fsp,
    path,
    execFile,
    spawn,
    apiValidation
  } = deps;
  
  const { parsePagination, paginate, sliceArray } = require('../lib/pagination');
  
  const validator = apiValidation?.validator;

  /**
   * GET /api/tasks - List all tasks with optional filtering and pagination
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/tasks') {
      const tasks = await readTasks();
      const filters = parseTaskFilters(parsed.query);
      const filtered = filterTasks(tasks, filters);
      const formatted = filtered.map(formatTaskForUi);
      
      // 应用分页
      const { page, limit, offset } = parsePagination(req);
      const paginated = paginate(sliceArray(formatted, offset, limit), filtered.length, page, limit);
      
      return json(res, 200, paginated);
    }
  });

  /**
   * POST /api/tasks - Create a new task
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/tasks') {
      try {
        const body = await readJson(req);
        
        // Validate request against OpenAPI spec
        if (validator) {
          const validation = validator.validateRequest('POST', pathname, parsed.query || {}, body);
          if (!validation.valid && validation.operation) {
            return json(res, 400, { 
              error: 'Validation failed', 
              details: validation.errors 
            });
          }
        }
        
        const task = await createTask(body);
        return json(res, 201, { task: formatTaskForUi(task) });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }
  });

  /**
   * GET /api/tasks/:id - Get a specific task
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/tasks\/([^\/]+)$/);
    if (req.method === 'GET' && match) {
      const taskId = match[1];
      const task = await getTask(taskId);
      if (!task) {
        return json(res, 404, { error: '任务不存在' });
      }
      return json(res, 200, { task: formatTaskForUi(task) });
    }
  });

  /**
   * PUT /api/tasks/:id - Update a task
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/tasks\/([^\/]+)$/);
    if (req.method === 'PUT' && match) {
      const taskId = match[1];
      const body = await readJson(req);
      const task = await updateTask(taskId, body);
      return json(res, 200, { task: formatTaskForUi(task) });
    }
  });

  /**
   * DELETE /api/tasks/:id - Delete a task
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/tasks\/([^\/]+)$/);
    if (req.method === 'DELETE' && match) {
      const taskId = match[1];
      await deleteTask(taskId);
      return json(res, 200, { success: true });
    }
  });

  /**
   * POST /api/tasks/:id/run - Run a task
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/tasks\/([^\/]+)\/run$/);
    if (match) {
      const taskId = match[1];
      const task = await runTask(taskId);
      return json(res, 200, { task: formatTaskForUi(task) });
    }
  });

  /**
   * POST /api/tasks/:id/pause - Pause a running task
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/tasks\/([^\/]+)\/pause$/);
    if (match) {
      const taskId = match[1];
      const task = await pauseTask(taskId);
      return json(res, 200, { task: formatTaskForUi(task) });
    }
  });

  /**
   * POST /api/tasks/:id/resume - Resume a paused task
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/tasks\/([^\/]+)\/resume$/);
    if (match) {
      const taskId = match[1];
      const task = await resumeTask(taskId);
      return json(res, 200, { task: formatTaskForUi(task) });
    }
  });

  /**
   * POST /api/tasks/:id/cancel - Cancel a task
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/tasks\/([^\/]+)\/cancel$/);
    if (match) {
      const taskId = match[1];
      const task = await cancelTask(taskId);
      return json(res, 200, { task: formatTaskForUi(task) });
    }
  });

  /**
   * GET /api/tasks/:id/log - Get task log
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/tasks\/([^\/]+)\/log$/);
    if (req.method === 'GET' && match) {
      const taskId = match[1];
      const log = await readLog(taskId);
      return json(res, 200, { log });
    }
  });

  /**
   * GET /api/tasks/:id/runs - Get task run history
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/tasks\/([^\/]+)\/runs$/);
    if (req.method === 'GET' && match) {
      const taskId = match[1];
      const task = await getTask(taskId);
      if (!task) {
        return json(res, 404, { error: '任务不存在' });
      }
      return json(res, 200, { runs: task.runs || [] });
    }
  });
};

function parseRequest(req) {
  const url = require('url');
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return { pathname, parsed };
}