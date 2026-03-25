/**
 * Admin Routes
 * Handles administrative functions including user management, user-groups, 
 * quiet-hours, backup, notification-channels, channel-health, scheduled-backup, 
 * cloud-storage, workload-alerts, task-completion, and workflow-completion
 * @param {Object} server - HTTP server instance
 * @param {Object} deps - Dependencies object containing helper functions and lib modules
 */
module.exports = function registerAdminRoutes(server, deps) {
  const {
    json,
    readJson,
    verifyTokenFromRequest,
    addAuditEvent,
    isAdmin,
    getUsers,
    getUserById,
    setRole,
    setUserGroupId,
    userGroups,
    quietHours,
    scheduledBackup,
    taskCompletionConfig,
    taskCompletionNotifier,
    workflowCompletionConfig,
    workflowCompletionNotifier,
    scheduledBackupConfig,
    scheduledBackupNotifier,
    cloudStorage,
    notificationChannels,
    notificationHistory,
    notificationTemplates,
    channelHealthCheck,
    createBackupData,
    performRestore,
    invalidateOverviewCache,
    DATA_DIR,
    fsp,
    path
  } = deps;

  /**
   * Middleware to check admin权限
   */
  async function requireAdmin(req) {
    const currentUser = await verifyTokenFromRequest(req);
    if (!currentUser) {
      throw new Error('未登录');
    }
    const admin = await isAdmin(currentUser.id);
    if (!admin) {
      throw new Error('需要管理员权限');
    }
    return currentUser;
  }

  /**
   * GET /api/admin/users - List all users (admin)
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/admin/users') {
      await requireAdmin(req);
      const users = await getUsers();
      return json(res, 200, { users });
    }
  });

  /**
   * PUT /api/admin/users/:id/role - Update user role
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/admin\/users\/([^\/]+)\/role$/);
    if (req.method === 'PUT' && match) {
      const userId = match[1];
      const body = await readJson(req);
      const currentUser = await requireAdmin(req);
      await setRole(userId, body.role);
      await addAuditEvent('user.role_changed', { userId, newRole: body.role }, currentUser.name, currentUser.id);
      return json(res, 200, { success: true });
    }
  });

  /**
   * DELETE /api/admin/users/:id - Delete a user
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/admin\/users\/([^\/]+)$/);
    if (req.method === 'DELETE' && match) {
      const userId = match[1];
      const currentUser = await requireAdmin(req);
      const user = await getUserById(userId);
      if (!user) {
        return json(res, 404, { error: '用户不存在' });
      }
      await addAuditEvent('user.deleted', { userId, userName: user.name }, currentUser.name, currentUser.id);
      return json(res, 200, { success: true });
    }
  });

  /**
   * GET /api/admin/user-groups - List user groups
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/admin/user-groups') {
      await requireAdmin(req);
      const groups = await userGroups.getGroups();
      return json(res, 200, { groups });
    }
  });

  /**
   * POST /api/admin/user-groups - Create user group
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/admin/user-groups') {
      const body = await readJson(req);
      const currentUser = await requireAdmin(req);
      const group = await userGroups.createGroup(body);
      await addAuditEvent('user_group.created', { groupId: group.id, groupName: group.name }, currentUser.name, currentUser.id);
      return json(res, 201, { group });
    }
  });

  /**
   * PUT /api/admin/user-groups/:id - Update user group
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/admin\/user-groups\/([^\/]+)$/);
    if (req.method === 'PUT' && match) {
      const groupId = match[1];
      const body = await readJson(req);
      const currentUser = await requireAdmin(req);
      const group = await userGroups.updateGroup(groupId, body);
      await addAuditEvent('user_group.updated', { groupId }, currentUser.name, currentUser.id);
      return json(res, 200, { group });
    }
  });

  /**
   * DELETE /api/admin/user-groups/:id - Delete user group
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/admin\/user-groups\/([^\/]+)$/);
    if (req.method === 'DELETE' && match) {
      const groupId = match[1];
      const currentUser = await requireAdmin(req);
      await userGroups.deleteGroup(groupId);
      await addAuditEvent('user_group.deleted', { groupId }, currentUser.name, currentUser.id);
      return json(res, 200, { success: true });
    }
  });

  /**
   * GET /api/admin/quiet-hours - Get quiet hours config
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/admin/quiet-hours') {
      await requireAdmin(req);
      const config = await quietHours.getConfig();
      return json(res, 200, config);
    }
  });

  /**
   * PUT /api/admin/quiet-hours - Update quiet hours config
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'PUT' && pathname === '/api/admin/quiet-hours') {
      const body = await readJson(req);
      const currentUser = await requireAdmin(req);
      const config = await quietHours.updateConfig(body);
      await addAuditEvent('quiet_hours.config_changed', config, currentUser.name, currentUser.id);
      return json(res, 200, config);
    }
  });

  /**
   * GET /api/admin/backup - List backups
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/admin/backup') {
      await requireAdmin(req);
      const backups = await scheduledBackup.getHistory(50);
      return json(res, 200, { backups });
    }
  });

  /**
   * POST /api/admin/backup - Create a backup
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/admin/backup') {
      const currentUser = await requireAdmin(req);
      const result = await createBackupData('full', currentUser);
      return json(res, 200, { success: true, backup: result });
    }
  });

  /**
   * POST /api/admin/backup/restore - Restore from backup
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/admin/backup/restore') {
      const body = await readJson(req);
      const currentUser = await requireAdmin(req);
      const result = await performRestore(body.data, body.mode || 'merge');
      await addAuditEvent('backup.restored', { mode: body.mode }, currentUser.name, currentUser.id);
      invalidateOverviewCache();
      return json(res, 200, { success: true, result });
    }
  });

  /**
   * GET /api/admin/task-completion/config - Get task completion notification config
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/admin/task-completion/config') {
      const config = await taskCompletionConfig.getConfig();
      return json(res, 200, config);
    }
  });

  /**
   * PUT /api/admin/task-completion/config - Update task completion notification config
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'PUT' && pathname === '/api/admin/task-completion/config') {
      const body = await readJson(req);
      const currentUser = await requireAdmin(req);
      const config = await taskCompletionConfig.updateConfig(body);
      await addAuditEvent('task_completion.config_changed', config, currentUser.name, currentUser.id);
      return json(res, 200, config);
    }
  });

  /**
   * GET /api/admin/workflow-completion/config - Get workflow completion notification config
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/admin/workflow-completion/config') {
      const config = await workflowCompletionConfig.getConfig();
      return json(res, 200, config);
    }
  });

  /**
   * PUT /api/admin/workflow-completion/config - Update workflow completion notification config
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'PUT' && pathname === '/api/admin/workflow-completion/config') {
      const body = await readJson(req);
      const currentUser = await requireAdmin(req);
      const config = await workflowCompletionConfig.updateConfig(body);
      await addAuditEvent('workflow_completion.config_changed', config, currentUser.name, currentUser.id);
      return json(res, 200, config);
    }
  });

  /**
   * GET /api/admin/notification-channels - List notification channels
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/admin/notification-channels') {
      const channels = await notificationChannels.getChannels();
      return json(res, 200, { channels });
    }
  });

  /**
   * POST /api/admin/notification-channels - Create notification channel
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/admin/notification-channels') {
      const body = await readJson(req);
      const currentUser = await requireAdmin(req);
      const channel = await notificationChannels.createChannel(body);
      await addAuditEvent('notification_channel.created', { channelId: channel.id, channelName: channel.name }, currentUser.name, currentUser.id);
      return json(res, 201, { channel });
    }
  });

  /**
   * PUT /api/admin/notification-channels/:id - Update notification channel
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/admin\/notification-channels\/([^\/]+)$/);
    if (req.method === 'PUT' && match) {
      const channelId = match[1];
      const body = await readJson(req);
      const currentUser = await requireAdmin(req);
      const channel = await notificationChannels.updateChannel(channelId, body);
      await addAuditEvent('notification_channel.updated', { channelId, channelName: channel.name }, currentUser.name, currentUser.id);
      return json(res, 200, { channel });
    }
  });

  /**
   * DELETE /api/admin/notification-channels/:id - Delete notification channel
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    const match = pathname.match(/^\/api\/admin\/notification-channels\/([^\/]+)$/);
    if (req.method === 'DELETE' && match) {
      const channelId = match[1];
      const currentUser = await requireAdmin(req);
      const channel = await notificationChannels.deleteChannel(channelId);
      await channelHealthCheck.removeChannelHealth(channelId);
      await addAuditEvent('notification_channel.deleted', { channelId, channelName: channel.name }, currentUser.name, currentUser.id);
      return json(res, 200, { success: true });
    }
  });

  /**
   * GET /api/admin/notification-history - Get notification history
   */
  server.on('request', async (req, res) => {
    const { pathname, parsed } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/admin/notification-history') {
      const filters = {
        status: parsed.query?.status,
        channelType: parsed.query?.channelType,
        page: parsed.query?.page,
        pageSize: parsed.query?.pageSize
      };
      const result = await notificationHistory.getHistory(filters);
      return json(res, 200, result);
    }
  });

  /**
   * GET /api/admin/notification-templates - Get notification templates
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/admin/notification-templates') {
      const templates = await notificationTemplates.getTemplates();
      const variables = notificationTemplates.TEMPLATE_VARIABLES;
      return json(res, 200, { templates, variables });
    }
  });

  /**
   * PUT /api/admin/notification-templates - Update notification templates
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'PUT' && pathname === '/api/admin/notification-templates') {
      const body = await readJson(req);
      const currentUser = await requireAdmin(req);
      const templates = await notificationTemplates.updateTemplates(body.templates || {});
      await addAuditEvent('notification_template.updated', { updatedTypes: Object.keys(body.templates || {}) }, currentUser.name, currentUser.id);
      return json(res, 200, { templates });
    }
  });

  /**
   * GET /api/admin/channel-health/status - Get channel health status
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/admin/channel-health/status') {
      const status = await channelHealthCheck.getHealthStatus();
      return json(res, 200, { status });
    }
  });

  /**
   * POST /api/admin/channel-health/check - Check all channels health
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/admin/channel-health/check') {
      const currentUser = await requireAdmin(req);
      const results = await channelHealthCheck.checkAllChannels();
      await addAuditEvent('channel_health.checked', { channelCount: results.length }, currentUser.name, currentUser.id);
      return json(res, 200, { results, checkedAt: Date.now() });
    }
  });

  /**
   * GET /api/admin/scheduled-backup/config - Get scheduled backup config
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/admin/scheduled-backup/config') {
      const config = await scheduledBackup.getConfig();
      return json(res, 200, config);
    }
  });

  /**
   * PUT /api/admin/scheduled-backup/config - Update scheduled backup config
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'PUT' && pathname === '/api/admin/scheduled-backup/config') {
      const body = await readJson(req);
      const currentUser = await requireAdmin(req);
      const result = await scheduledBackup.updateConfig(body);
      await addAuditEvent('scheduled_backup.config_changed', { changedBy: currentUser.name }, currentUser.name, currentUser.id);
      return json(res, 200, result);
    }
  });

  /**
   * GET /api/admin/cloud-storage/config - Get cloud storage config
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'GET' && pathname === '/api/admin/cloud-storage/config') {
      const config = cloudStorage.getCloudConfig();
      const safeConfig = { ...config };
      if (safeConfig.accessKeySecret) {
        safeConfig.accessKeySecret = safeConfig.accessKeySecret.substring(0, 3) + '***';
      }
      return json(res, 200, safeConfig);
    }
  });

  /**
   * POST /api/admin/cloud-storage/config - Update cloud storage config
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/admin/cloud-storage/config') {
      const body = await readJson(req);
      const currentUser = await requireAdmin(req);
      const currentConfig = cloudStorage.getCloudConfig();
      const newConfig = { ...currentConfig, ...body };
      cloudStorage.saveCloudConfig(newConfig);
      cloudStorage.resetClient();
      await addAuditEvent('cloud_storage.config_changed', { provider: newConfig.provider, bucket: newConfig.bucket }, currentUser.name, currentUser.id);
      return json(res, 200, { success: true, config: newConfig });
    }
  });

  /**
   * POST /api/admin/cloud-storage/test - Test cloud storage connection
   */
  server.on('request', async (req, res) => {
    const { pathname } = parseRequest(req);
    if (req.method === 'POST' && pathname === '/api/admin/cloud-storage/test') {
      const testResult = await cloudStorage.testConnection();
      return json(res, 200, testResult);
    }
  });
};

function parseRequest(req) {
  const url = require('url');
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return { pathname, parsed };
}