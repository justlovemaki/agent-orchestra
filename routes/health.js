/**
 * Health and Statistics Routes
 * Provides system health, runtime info, overview, and statistics endpoints
 * @param {Object} server - HTTP server instance
 * @param {Object} deps - Dependencies object containing helper functions and lib modules
 */
module.exports = function registerHealthRoutes(server, deps) {
  const {
    readRuntime,
    buildOverview,
    invalidateOverviewCache,
    readTasks,
    json,
    readJson,
    readBody,
    verifyTokenFromRequest,
    addAuditEvent,
    quietHours,
    parseTaskFilters,
    filterTasks,
    formatTaskForUi,
    DATA_DIR,
    fsp,
    path
  } = deps;

  /**
   * GET /api/health - System health check
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/health') {
      const runtime = await readRuntime();
      const tasks = await readTasks();
      
      const busyAgents = new Set();
      tasks.forEach(t => {
        if (t.status === 'running' && t.currentAgent) {
          busyAgents.add(t.currentAgent);
        }
      });
      
      const health = {
        status: 'healthy',
        timestamp: Date.now(),
        agents: {
          total: (runtime.agents || []).length,
          busy: busyAgents.size,
          idle: (runtime.agents || []).length - busyAgents.size
        },
        tasks: {
          queued: tasks.filter(t => t.status === 'queued').length,
          running: tasks.filter(t => t.status === 'running').length,
          completed: tasks.filter(t => t.status === 'completed').length,
          failed: tasks.filter(t => t.status === 'failed').length
        },
        gateway: runtime.gateway || {}
      };
      
      return json(res, 200, health);
    }
  });

  /**
   * GET /api/runtime - Runtime information
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/runtime') {
      const runtime = await readRuntime();
      return json(res, 200, runtime);
    }
  });

  /**
   * GET /api/overview - Dashboard overview data
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/overview') {
      const forceRefresh = parsed.query?.refresh === 'true';
      const overview = await buildOverview(forceRefresh);
      return json(res, 200, overview);
    }
  });

  /**
   * GET /api/stats - Task statistics
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/stats') {
      const tasks = await readTasks();
      const timeFrom = parsed.query?.timeFrom ? new Date(parsed.query.timeFrom) : null;
      const timeTo = parsed.query?.timeTo ? new Date(parsed.query.timeTo) : null;
      
      let filteredTasks = tasks;
      if (timeFrom || timeTo) {
        filteredTasks = tasks.filter(t => {
          const created = t.createdAt ? new Date(t.createdAt).getTime() : 0;
          if (timeFrom && created < timeFrom.getTime()) return false;
          if (timeTo && created > timeTo.getTime()) return false;
          return true;
        });
      }
      
      const stats = {
        total: filteredTasks.length,
        queued: filteredTasks.filter(t => t.status === 'queued').length,
        running: filteredTasks.filter(t => t.status === 'running').length,
        paused: filteredTasks.filter(t => t.status === 'paused').length,
        completed: filteredTasks.filter(t => t.status === 'completed').length,
        failed: filteredTasks.filter(t => t.status === 'failed').length,
        canceled: filteredTasks.filter(t => t.status === 'canceled').length
      };
      
      return json(res, 200, stats);
    }
  });

  /**
   * GET /api/stats/trends - Task statistics trends
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/stats/trends') {
      const days = parseInt(parsed.query?.days) || 7;
      const tasks = await readTasks();
      
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const startTime = now - (days * dayMs);
      
      const dailyStats = {};
      for (let i = 0; i < days; i++) {
        const date = new Date(now - i * dayMs).toISOString().split('T')[0];
        dailyStats[date] = { completed: 0, failed: 0, created: 0 };
      }
      
      tasks.forEach(task => {
        if (!task.createdAt) return;
        const createdDate = new Date(task.createdAt).toISOString().split('T')[0];
        if (dailyStats[createdDate]) {
          dailyStats[createdDate].created++;
        }
        
        if (task.status === 'completed' && task.finishedAt) {
          const finishDate = new Date(task.finishedAt).toISOString().split('T')[0];
          if (dailyStats[finishDate]) {
            dailyStats[finishDate].completed++;
          }
        }
        
        if (task.status === 'failed' && task.finishedAt) {
          const finishDate = new Date(task.finishedAt).toISOString().split('T')[0];
          if (dailyStats[finishDate]) {
            dailyStats[finishDate].failed++;
          }
        }
      });
      
      const trends = Object.entries(dailyStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({ date, ...data }));
      
      return json(res, 200, { days, trends });
    }
  });
};

/**
 * Parse incoming HTTP request to extract pathname and query
 * @param {Object} req - HTTP request object
 * @returns {Object} Parsed request with pathname and parsed query
 */
function parseRequest(req) {
  const url = require('url');
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return { pathname, parsed };
}