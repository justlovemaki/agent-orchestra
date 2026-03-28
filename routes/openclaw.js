/**
 * OpenClaw Integration Routes
 * API endpoints for OpenClaw Gateway integration
 * - POST /api/openclaw/connect - Configure and connect to OpenClaw
 * - GET /api/openclaw/status - Get connection status
 * - POST /api/openclaw/register-tool - Register Orchestra as a tool
 * - GET /api/openclaw/events - Event subscription configuration
 * - GET /api/openclaw/sessions - List sessions
 * - GET /api/openclaw/sessions/history - Get session history
 * - POST /api/openclaw/sessions/:id/send - Send message to session
 * - GET /api/openclaw/subagents - List subagents
 * - POST /api/openclaw/subagents/spawn - Spawn a subagent
 * - GET /api/openclaw/agents - List agents
 */

module.exports = function registerOpenClawRoutes(server, deps) {
  const {
    openclawIntegration,
    json,
    readJson,
    verifyTokenFromRequest,
    isAdmin,
    DATA_DIR,
    fsp,
    path,
    emitTaskCreated,
    emitTaskCompleted,
    emitWorkflowStarted,
    emitWorkflowCompleted
  } = deps;

  const { saveOpenClawConfig, loadOpenClawConfig } = require('../lib/openclaw-integration');

  let config = loadOpenClawConfig(DATA_DIR);

  async function checkAdmin(req, res) {
    const user = await verifyTokenFromRequest(req);
    if (!user || !isAdmin(user)) {
      return false;
    }
    return true;
  }

  server.on('request', async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    
    if (!pathname.startsWith('/api/openclaw')) {
      return;
    }

    const url = require('url');

    if (req.method === 'POST' && pathname === '/api/openclaw/connect') {
      try {
        const isAuthorized = await checkAdmin(req, res);
        if (!isAuthorized) {
          return json(res, 403, { error: 'Forbidden: Admin access required' });
        }

        const body = await readJson(req);
        
        const { gatewayUrl, token, autoConnect } = body;
        
        if (gatewayUrl) {
          config.gatewayUrl = gatewayUrl;
          openclawIntegration.setConfig({ gatewayUrl });
        }
        
        if (token !== undefined) {
          config.token = token;
          openclawIntegration.setConfig({ token });
        }
        
        if (autoConnect !== undefined) {
          config.autoConnect = autoConnect;
        }
        
        saveOpenClawConfig(DATA_DIR, config);
        
        let connectResult = { success: false, message: 'Auto-connect disabled' };
        if (autoConnect || body.connectNow) {
          connectResult = await openclawIntegration.connect();
        }
        
        return json(res, 200, {
          success: true,
          config: openclawIntegration.getConfig(),
          connection: connectResult
        });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'GET' && pathname === '/api/openclaw/status') {
      try {
        const status = openclawIntegration.getStatus();
        const health = await openclawIntegration.testConnection();
        
        return json(res, 200, {
          ...status,
          gatewayHealth: health
        });
      } catch (error) {
        return json(res, 200, {
          ...openclawIntegration.getStatus(),
          error: error.message
        });
      }
    }

    if (req.method === 'POST' && pathname === '/api/openclaw/disconnect') {
      try {
        const isAuthorized = await checkAdmin(req, res);
        if (!isAuthorized) {
          return json(res, 403, { error: 'Forbidden: Admin access required' });
        }

        const result = openclawIntegration.disconnect();
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'POST' && pathname === '/api/openclaw/register-tool') {
      try {
        const isAuthorized = await checkAdmin(req, res);
        if (!isAuthorized) {
          return json(res, 403, { error: 'Forbidden: Admin access required' });
        }

        const body = await readJson(req);
        const { name, description, parameters, handlerType } = body;
        
        if (!name) {
          return json(res, 400, { error: 'Tool name is required' });
        }

        let handler = null;
        
        if (handlerType === 'orchestra-api') {
          handler = async (params) => {
            const apiEndpoint = params.endpoint;
            const apiMethod = params.method || 'GET';
            const apiBody = params.body;
            
            return {
              orchestra: true,
              endpoint: apiEndpoint,
              method: apiMethod,
              params: params
            };
          };
        } else if (handlerType === 'task-create') {
          handler = async (params) => {
            return {
              taskCreated: true,
              title: params.title,
              agents: params.agents
            };
          };
        } else if (handlerType === 'custom' && body.handlerCode) {
          try {
            handler = new Function('params', body.handlerCode);
          } catch (e) {
            return json(res, 400, { error: 'Invalid handler code: ' + e.message });
          }
        }

        const result = openclawIntegration.registerTool({
          name,
          description: description || '',
          parameters: parameters || {},
          handler
        });

        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/openclaw/tools/')) {
      try {
        const isAuthorized = await checkAdmin(req, res);
        if (!isAuthorized) {
          return json(res, 403, { error: 'Forbidden: Admin access required' });
        }

        const toolName = pathname.split('/').pop();
        const result = openclawIntegration.unregisterTool(toolName);
        
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'GET' && pathname === '/api/openclaw/tools') {
      try {
        const tools = openclawIntegration.listTools();
        return json(res, 200, { tools });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'GET' && pathname === '/api/openclaw/events') {
      try {
        const subscriptions = openclawIntegration.getEventSubscriptions();
        const availableEvents = [
          { type: 'agent.spawned', description: 'Agent spawned' },
          { type: 'agent.completed', description: 'Agent completed' },
          { type: 'agent.error', description: 'Agent error' },
          { type: 'session.created', description: 'Session created' },
          { type: 'session.ended', description: 'Session ended' },
          { type: 'session.message', description: 'Session message received' },
          { type: 'task.created', description: 'Task created' },
          { type: 'task.completed', description: 'Task completed' },
          { type: 'task.failed', description: 'Task failed' },
          { type: 'workflow.started', description: 'Workflow started' },
          { type: 'workflow.completed', description: 'Workflow completed' }
        ];
        
        return json(res, 200, {
          subscriptions,
          availableEvents,
          config: config.eventSubscriptions || {}
        });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'PUT' && pathname === '/api/openclaw/events') {
      try {
        const isAuthorized = await checkAdmin(req, res);
        if (!isAuthorized) {
          return json(res, 403, { error: 'Forbidden: Admin access required' });
        }

        const body = await readJson(req);
        
        if (body.eventSubscriptions) {
          config.eventSubscriptions = body.eventSubscriptions;
          saveOpenClawConfig(DATA_DIR, config);
        }
        
        return json(res, 200, {
          success: true,
          eventSubscriptions: config.eventSubscriptions
        });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'POST' && pathname === '/api/openclaw/events/subscribe') {
      try {
        const body = await readJson(req);
        const { eventType, handlerType } = body;
        
        if (!eventType) {
          return json(res, 400, { error: 'Event type is required' });
        }

        let handler;
        
        if (handlerType === 'log') {
          handler = (data) => {
            console.log(`[OpenClaw Event] ${eventType}:`, JSON.stringify(data));
          };
        } else if (handlerType === 'emit-task-created') {
          handler = (data) => {
            if (eventType === 'task.created') {
              emitTaskCreated(data).catch(err => console.error('Failed to emit task.created:', err));
            }
          };
        } else if (handlerType === 'emit-task-completed') {
          handler = (data) => {
            if (eventType === 'task.completed' || eventType === 'agent.completed') {
              emitTaskCompleted(data).catch(err => console.error('Failed to emit task.completed:', err));
            }
          };
        } else if (handlerType === 'emit-workflow') {
          handler = (data) => {
            if (eventType === 'workflow.started') {
              emitWorkflowStarted(data).catch(err => console.error('Failed to emit workflow.started:', err));
            } else if (eventType === 'workflow.completed') {
              emitWorkflowCompleted(data).catch(err => console.error('Failed to emit workflow.completed:', err));
            }
          };
        } else if (handlerType === 'custom' && body.handlerCode) {
          try {
            handler = new Function('data', 'emitTaskCreated', 'emitTaskCompleted', 'emitWorkflowStarted', 'emitWorkflowCompleted', body.handlerCode);
            handler = handler.bind(null, body, emitTaskCreated, emitTaskCompleted, emitWorkflowStarted, emitWorkflowCompleted);
          } catch (e) {
            return json(res, 400, { error: 'Invalid handler code: ' + e.message });
          }
        } else {
          handler = (data) => {};
        }

        const subscription = openclawIntegration.subscribeToEvent(eventType, handler);
        
        return json(res, 200, {
          success: true,
          eventType,
          message: `Subscribed to ${eventType}`
        });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'GET' && pathname === '/api/openclaw/sessions') {
      try {
        const params = parsed.query;
        const result = await openclawIntegration.sessionsList(params);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'GET' && pathname === '/api/openclaw/sessions/history') {
      try {
        const params = parsed.query;
        const result = await openclawIntegration.sessionsHistory(params);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'POST' && pathname.match(/^\/api\/openclaw\/sessions\/[^\/]+\/send$/)) {
      try {
        const sessionId = pathname.split('/')[4];
        const body = await readJson(req);
        
        const result = await openclawIntegration.sessionsSend(sessionId, body.message);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'GET' && pathname === '/api/openclaw/subagents') {
      try {
        const result = await openclawIntegration.subagentsList();
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'POST' && pathname === '/api/openclaw/subagents/spawn') {
      try {
        const body = await readJson(req);
        const { agentId, prompt, options } = body;
        
        if (!agentId || !prompt) {
          return json(res, 400, { error: 'agentId and prompt are required' });
        }
        
        const result = await openclawIntegration.subagentsSpawn(agentId, prompt, options);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'GET' && pathname.startsWith('/api/openclaw/subagents/') && pathname.endsWith('/stop')) {
      try {
        const subagentId = pathname.split('/')[4];
        const result = await openclawIntegration.subagentsStop(subagentId);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'GET' && pathname === '/api/openclaw/agents') {
      try {
        const result = await openclawIntegration.agentsList();
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'GET' && pathname.startsWith('/api/openclaw/agents/')) {
      try {
        const agentId = pathname.split('/')[4];
        const result = await openclawIntegration.agentsInfo(agentId);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'GET' && pathname === '/api/openclaw/config') {
      try {
        return json(res, 200, {
          config: {
            gatewayUrl: config.gatewayUrl,
            token: config.token ? '***' + config.token.slice(-4) : '',
            eventSubscriptions: config.eventSubscriptions,
            autoConnect: config.autoConnect
          },
          integration: openclawIntegration.getConfig()
        });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (req.method === 'GET' && pathname === '/api/openclaw/test') {
      try {
        const result = await openclawIntegration.testConnection();
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }
  });
};

function parseRequest(req) {
  const url = require('url');
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return { pathname, parsed };
}
