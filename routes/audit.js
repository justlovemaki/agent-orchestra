/**
 * Audit Routes
 * Handles audit event logging and querying
 * @param {Object} server - HTTP server instance
 * @param {Object} deps - Dependencies object containing helper functions and lib modules
 */
module.exports = function registerAuditRoutes(server, deps) {
  const {
    json,
    readJson,
    addAuditEvent,
    queryAuditEvents,
    getAuditEventTypes
  } = deps;
  
  const { parsePagination, paginate, sliceArray } = require('../lib/pagination');

  /**
   * POST /api/audit - Create an audit event
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/audit') {
      const body = await readJson(req);
      if (!body.type) {
        throw new Error('Audit event type is required');
      }
      const event = await addAuditEvent(body.type, body.details || {}, body.user || 'system');
      return json(res, 201, { event });
    }
  });

  /**
   * GET /api/audit - Query audit events with pagination
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/audit') {
      const filters = {
        eventType: parsed.query.eventType || null,
        user: parsed.query.user || null,
        timeFrom: parsed.query.timeFrom || null,
        timeTo: parsed.query.timeTo || null,
        keyword: parsed.query.keyword || null,
        limit: parsed.query.limit ? parseInt(parsed.query.limit, 10) : null,
        offset: parsed.query.offset ? parseInt(parsed.query.offset, 10) : null
      };
      const allEvents = await queryAuditEvents(filters);
      
      // 应用分页（如果未指定 limit/offset，则使用默认分页）
      const { page, limit, offset } = parsePagination(req);
      const paginated = paginate(sliceArray(allEvents, offset, limit), allEvents.length, page, limit);
      
      return json(res, 200, paginated);
    }
  });

  /**
   * GET /api/audit/types - Get available audit event types
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/audit/types') {
      return json(res, 200, { types: getAuditEventTypes() });
    }
  });
};

function parseRequest(req) {
  const url = require('url');
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return { pathname, parsed };
}