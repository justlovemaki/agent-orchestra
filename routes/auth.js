/**
 * Auth Routes
 * Handles authentication, user registration, login, and user management
 * @param {Object} server - HTTP server instance
 * @param {Object} deps - Dependencies object containing helper functions and lib modules
 */
module.exports = function registerAuthRoutes(server, deps) {
  const {
    json,
    readJson,
    verifyTokenFromRequest,
    addAuditEvent,
    register,
    login,
    logout,
    verifyToken,
    getCurrentUser,
    getUsers,
    getUserRole,
    isAdmin,
    setRole,
    setUserGroupId,
    getUserById,
    getUserPermissions,
    userGroups,
    setSecurityQuestion,
    resetPasswordBySecurityQuestion,
    getUserSessions,
    invalidateUserSessions,
    invalidateToken,
    generateTwoFactorSetup,
    enableTwoFactor,
    disableTwoFactor,
    loginWith2FA,
    loadTokens
  } = deps;

  /**
   * POST /api/auth/register - Register a new user
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/auth/register') {
      try {
        const body = await readJson(req);
        const result = await register(body);
        return json(res, 201, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }
  });

  /**
   * POST /api/auth/login - User login
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/auth/login') {
      try {
        const body = await readJson(req);
        const result = await login(body);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 401, { error: error.message });
      }
    }
  });

  /**
   * POST /api/auth/logout - User logout
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      await logout(req);
      return json(res, 200, { success: true });
    }
  });

  /**
   * GET /api/auth/me - Get current user info
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/auth/me') {
      const currentUser = await verifyTokenFromRequest(req);
      if (!currentUser) {
        return json(res, 401, { error: '未登录' });
      }
      const user = await getCurrentUser(currentUser.id);
      return json(res, 200, { user });
    }
  });

  /**
   * GET /api/users - List all users (admin)
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/users') {
      const currentUser = await verifyTokenFromRequest(req);
      if (!currentUser) {
        return json(res, 401, { error: '未登录' });
      }
      const admin = await isAdmin(currentUser.id);
      if (!admin) {
        return json(res, 403, { error: '需要管理员权限' });
      }
      const users = await getUsers();
      return json(res, 200, { users });
    }
  });

  /**
   * GET /api/users/:id - Get a specific user
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/users\/([^\/]+)$/);
    if (req.method === 'GET' && match) {
      const userId = match[1];
      const user = await getUserById(userId);
      if (!user) {
        return json(res, 404, { error: '用户不存在' });
      }
      return json(res, 200, { user });
    }
  });

  /**
   * PUT /api/users/:id/role - Set user role
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/users\/([^\/]+)\/role$/);
    if (req.method === 'PUT' && match) {
      const userId = match[1];
      const body = await readJson(req);
      const currentUser = await verifyTokenFromRequest(req);
      
      const admin = await isAdmin(currentUser.id);
      if (!admin) {
        return json(res, 403, { error: '需要管理员权限' });
      }
      
      await setRole(userId, body.role);
      await addAuditEvent('user.role_changed', { userId, newRole: body.role }, currentUser.name, currentUser.id);
      
      return json(res, 200, { success: true });
    }
  });

  /**
   * PUT /api/users/:id/group - Set user group
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/users\/([^\/]+)\/group$/);
    if (req.method === 'PUT' && match) {
      const userId = match[1];
      const body = await readJson(req);
      const currentUser = await verifyTokenFromRequest(req);
      
      const admin = await isAdmin(currentUser.id);
      if (!admin) {
        return json(res, 403, { error: '需要管理员权限' });
      }
      
      await setUserGroupId(userId, body.groupId);
      await addAuditEvent('user.group_changed', { userId, groupId: body.groupId }, currentUser.name, currentUser.id);
      
      return json(res, 200, { success: true });
    }
  });

  /**
   * GET /api/users/me/permissions - Get current user permissions
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/users/me/permissions') {
      const currentUser = await verifyTokenFromRequest(req);
      if (!currentUser) {
        return json(res, 401, { error: '未登录' });
      }
      const permissions = await getUserPermissions(currentUser.id);
      return json(res, 200, { permissions });
    }
  });

  /**
   * POST /api/auth/security-question - Set security question
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/auth/security-question') {
      const currentUser = await verifyTokenFromRequest(req);
      if (!currentUser) {
        return json(res, 401, { error: '未登录' });
      }
      try {
        const body = await readJson(req);
        const result = await setSecurityQuestion(currentUser.id, body.question, body.answer);
        await addAuditEvent('user.security_question_set', { userId: currentUser.id }, currentUser.name, currentUser.id);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }
  });

  /**
   * POST /api/auth/reset-password - Reset password via security question
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/auth/reset-password') {
      try {
        const body = await readJson(req);
        const result = await resetPasswordBySecurityQuestion(body.name, body.answer, body.newPassword);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }
  });

  /**
   * GET /api/auth/sessions - Get current user sessions
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/auth/sessions') {
      const currentUser = await verifyTokenFromRequest(req);
      if (!currentUser) {
        return json(res, 401, { error: '未登录' });
      }
      try {
        const sessions = await getUserSessions(currentUser.id);
        return json(res, 200, { sessions });
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }
  });

  /**
   * POST /api/auth/sessions/invalidate - Invalidate all other sessions
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/auth/sessions/invalidate') {
      const currentUser = await verifyTokenFromRequest(req);
      if (!currentUser) {
        return json(res, 401, { error: '未登录' });
      }
      const authHeader = req.headers['authorization'] || '';
      const currentToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      try {
        const result = await invalidateUserSessions(currentUser.id, currentToken);
        await addAuditEvent('user.sessions_invalidated', { userId: currentUser.id }, currentUser.name, currentUser.id);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }
  });

  /**
   * DELETE /api/auth/sessions/:token - Invalidate specific session (admin can invalidate any)
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/auth\/sessions\/([^\/]+)$/);
    if (req.method === 'DELETE' && match) {
      const token = match[1];
      const currentUser = await verifyTokenFromRequest(req);
      if (!currentUser) {
        return json(res, 401, { error: '未登录' });
      }
      try {
        const tokens = await loadTokens();
        const tokenUserId = tokens[token];
        if (!tokenUserId) {
          return json(res, 404, { error: '会话不存在' });
        }
        const admin = await isAdmin(currentUser.id);
        if (tokenUserId !== currentUser.id && !admin) {
          return json(res, 403, { error: '无权限' });
        }
        await invalidateToken(token);
        await addAuditEvent('session.invalidated', { token: token.substring(0, 16) + '...' }, currentUser.name, currentUser.id);
        return json(res, 200, { success: true });
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }
  });

  /**
   * POST /api/auth/2fa/setup - Start 2FA setup
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/auth/2fa/setup') {
      const currentUser = await verifyTokenFromRequest(req);
      if (!currentUser) {
        return json(res, 401, { error: '未登录' });
      }
      try {
        const result = await generateTwoFactorSetup(currentUser.id);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }
  });

  /**
   * POST /api/auth/2fa/enable - Enable 2FA
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/auth/2fa/enable') {
      const currentUser = await verifyTokenFromRequest(req);
      if (!currentUser) {
        return json(res, 401, { error: '未登录' });
      }
      try {
        const body = await readJson(req);
        const result = await enableTwoFactor(currentUser.id, body.code);
        await addAuditEvent('user.two_factor_enabled', { userId: currentUser.id }, currentUser.name, currentUser.id);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }
  });

  /**
   * POST /api/auth/2fa/disable - Disable 2FA
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/auth/2fa/disable') {
      const currentUser = await verifyTokenFromRequest(req);
      if (!currentUser) {
        return json(res, 401, { error: '未登录' });
      }
      try {
        const body = await readJson(req);
        const result = await disableTwoFactor(currentUser.id, body.code);
        await addAuditEvent('user.two_factor_disabled', { userId: currentUser.id }, currentUser.name, currentUser.id);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }
  });

  /**
   * POST /api/auth/login/2fa - Login with 2FA
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/auth/login/2fa') {
      try {
        const body = await readJson(req);
        const result = await loginWith2FA(body.name, body.password, body.code);
        return json(res, 200, result);
      } catch (error) {
        return json(res, 401, { error: error.message });
      }
    }
  });

  /**
   * GET /api/auth/2fa/status - Get 2FA status for current user
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/auth/2fa/status') {
      const currentUser = await verifyTokenFromRequest(req);
      if (!currentUser) {
        return json(res, 401, { error: '未登录' });
      }
      const user = await getUserById(currentUser.id);
      return json(res, 200, { 
        enabled: user?.twoFactorEnabled || false,
        hasSecret: !!user?.twoFactorSecret
      });
    }
  });
};

function parseRequest(req) {
  const url = require('url');
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return { pathname, parsed };
}