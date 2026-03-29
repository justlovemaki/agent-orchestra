/**
 * Analytics Routes
 * Handles all analytics and insights API endpoints
 * @param {Object} server - HTTP server instance
 * @param {Object} deps - Dependencies object containing helper functions and lib modules
 */
module.exports = function registerAnalyticsRoutes(server, deps) {
  const {
    readTasks,
    json,
    readJson,
    verifyTokenFromRequest,
    loadWorkflows,
    loadWorkflowRuns,
    overviewCache,
    ROOT,
    fsp,
    path
  } = deps;
  
  const { analyticsEngine } = require('../lib/analytics-engine');
  const DATA_DIR = path.join(ROOT, 'data');
  const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');

  async function loadAgents() {
    try {
      await fsp.access(AGENTS_FILE);
      const data = await fsp.readFile(AGENTS_FILE, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  function parseRequest(req) {
    const url = require('url');
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return { pathname, parsed };
  }

  /**
   * GET /api/analytics/overview - Get overall analytics overview
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/analytics/overview') {
      try {
        const [tasks, agents, overview] = await Promise.all([
          readTasks(),
          loadAgents(),
          overviewCache.get('overview')
        ]);
        
        const overviewAgents = overview?.agents || [];
        const workflows = await loadWorkflows();
        const workflowRuns = await loadWorkflowRuns();
        
        const data = analyticsEngine.getOverview(tasks, overviewAgents, workflows, workflowRuns);
        
        return json(res, 200, data);
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }
  });

  /**
   * GET /api/analytics/tasks - Get task analytics
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/analytics/tasks') {
      try {
        const days = parseInt(parsed.query.days) || 30;
        const tasks = await readTasks();
        
        const data = analyticsEngine.analyzeTasks(tasks, { days });
        
        return json(res, 200, data);
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }
  });

  /**
   * GET /api/analytics/agents - Get agent analytics
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/analytics/agents') {
      try {
        const tasks = await readTasks();
        const overview = await overviewCache.get('overview');
        const overviewAgents = overview?.agents || [];
        
        const data = analyticsEngine.analyzeAgents(tasks, overviewAgents);
        
        return json(res, 200, data);
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }
  });

  /**
   * GET /api/analytics/workflows - Get workflow analytics
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/analytics/workflows') {
      try {
        const workflows = await loadWorkflows();
        const workflowRuns = await loadWorkflowRuns();
        
        const data = analyticsEngine.analyzeWorkflows(workflows, workflowRuns);
        
        return json(res, 200, data);
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }
  });

  /**
   * GET /api/analytics/insights - Get intelligent insights
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/analytics/insights') {
      try {
        const tasks = await readTasks();
        const overview = await overviewCache.get('overview');
        const overviewAgents = overview?.agents || [];
        const workflows = await loadWorkflows();
        
        const data = analyticsEngine.generateInsights(tasks, overviewAgents, workflows);
        
        return json(res, 200, {
          generatedAt: Date.now(),
          insights: data,
          count: data.length
        });
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }
  });

  /**
   * GET /api/analytics/anomalies - Get anomaly detection results
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/analytics/anomalies') {
      try {
        const sensitivity = parseFloat(parsed.query.sensitivity) || 2.0;
        const tasks = await readTasks();
        
        const data = analyticsEngine.detectAnomalies(tasks, { sensitivity });
        
        return json(res, 200, data);
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }
  });
};
