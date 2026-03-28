'use strict';

/**
 * Plugins Marketplace Routes
 * 
 * Plugin marketplace management API endpoints
 * Features:
 * - GitHub Releases integration for uploads
 * - Plugin review/approval mechanism
 * - Auto-update notifications
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const PluginInstaller = require('../lib/plugin-installer');
const PluginUpdateNotifier = require('../lib/plugin-update-notifier');

let pluginInstaller = null;
let pluginUpdateNotifier = null;

function pluginsMarketplaceRoutes(serverWithEvents, deps) {
  const { json, readJson, verifyTokenFromRequest } = deps;
  
  const dataFilePath = path.join(__dirname, '..', 'data', 'plugins-marketplace.json');
  const installedPluginsPath = path.join(__dirname, '..', 'data', 'installed-plugins.json');

  function readInstalledPlugins() {
    try {
      if (!fs.existsSync(installedPluginsPath)) {
        return {};
      }
      const data = fs.readFileSync(installedPluginsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('[Marketplace] Error reading installed plugins:', error);
      return {};
    }
  }

  function saveInstalledPlugins(data) {
    try {
      fs.writeFileSync(installedPluginsPath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('[Marketplace] Error saving installed plugins:', error);
      return false;
    }
  }

  function httpGet(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const request = client.get(url, { timeout: 10000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return httpGet(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  async function fetchFromGitHub(url) {
    try {
      const apiUrl = url.replace('github.com', 'api.github.com/repos')
        .replace('/releases/', '/releases/tags/')
        .replace('/download/', '/contents/');
      
      const data = await httpGet(apiUrl);
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`GitHub API 请求失败: ${error.message}`);
    }
  }

  async function extractFromGitHubRelease(releaseUrl, manifest) {
    try {
      const releaseData = await fetchFromGitHub(releaseUrl);
      
      if (releaseData.tag_name) {
        const version = releaseData.tag_name.replace(/^v/, '');
        if (manifest) {
          manifest.version = version;
        }
      }

      let downloadUrl = '';
      if (releaseData.assets && releaseData.assets.length > 0) {
        const asset = releaseData.assets.find(a => 
          a.name.endsWith('.zip') || 
          a.name.endsWith('.tar.gz') ||
          a.name.endsWith('.tgz')
        );
        if (asset) {
          downloadUrl = asset.browser_download_url;
        }
      }

      if (!downloadUrl && releaseData.zipball_url) {
        downloadUrl = releaseData.zipball_url;
      }

      return { downloadUrl, version: manifest?.version };
    } catch (error) {
      throw new Error(`从 GitHub Release 获取插件失败: ${error.message}`);
    }
  }

  function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  function readMarketplaceData() {
    try {
      if (!fs.existsSync(dataFilePath)) {
        return { plugins: [], categories: [] };
      }
      const data = fs.readFileSync(dataFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('[Marketplace] Error reading data:', error);
      return { plugins: [], categories: [] };
    }
  }

  function saveMarketplaceData(data) {
    try {
      fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('[Marketplace] Error saving data:', error);
      return false;
    }
  }

  function generatePluginId(name) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${sanitizedName}-${timestamp}-${random}`;
  }

  function validateManifest(manifest) {
    const required = ['name', 'version', 'description', 'author'];
    for (const field of required) {
      if (!manifest[field]) {
        return { valid: false, error: `缺少必需字段：${field}` };
      }
    }
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      return { valid: false, error: '版本号格式不正确，应为 x.y.z' };
    }
    if (manifest.name.length < 2 || manifest.name.length > 50) {
      return { valid: false, error: '插件名称长度应在 2-50 字符之间' };
    }
    return { valid: true };
  }

  function validateGitHubUrl(url) {
    const githubReleasePattern = /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/releases\/tag\/[^\/]+$/;
    const githubRawPattern = /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/raw\/[^\/]+\/[^\/]+$/;
    return githubReleasePattern.test(url) || githubRawPattern.test(url);
  }

  async function extractManifestFromGitHub(url) {
    try {
      const apiUrl = url.replace('github.com', 'api.github.com/repos')
        .replace('/releases/tag/', '/contents/')
        .replace('/raw/', '/contents/');
      
      const data = await httpGet(apiUrl);
      const content = JSON.parse(data);
      
      if (content.content) {
        const manifestContent = Buffer.from(content.content, 'base64').toString('utf8');
        return JSON.parse(manifestContent);
      }
      
      if (Array.isArray(content)) {
        const manifestFile = content.find(f => f.name === 'manifest.json');
        if (manifestFile) {
          const manifestUrl = manifestFile.download_url || manifestFile.url;
          const manifestData = await httpGet(manifestUrl);
          return JSON.parse(manifestData);
        }
      }
      
      throw new Error('未找到 manifest.json');
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('无效的 manifest.json 格式');
      }
      throw error;
    }
  }

  serverWithEvents.on('request', async (req, res) => {
    const parsed = new URL(req.url, `http://localhost`);
    const pathname = parsed.pathname;
    const method = req.method;

    // GET /api/plugins/marketplace/categories
    if (method === 'GET' && pathname === '/api/plugins/marketplace/categories') {
      try {
        const data = readMarketplaceData();
        return json(res, 200, { categories: data.categories || [] });
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }

    // POST /api/plugins/marketplace/upload
    if (method === 'POST' && pathname === '/api/plugins/marketplace/upload') {
      try {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '请先登录' });
        }
        const body = await readJson(req);
        let { manifest, downloadUrl, githubReleaseUrl } = body;
        
        if (githubReleaseUrl) {
          if (!validateGitHubUrl(githubReleaseUrl)) {
            return json(res, 400, { error: '无效的 GitHub URL 格式' });
          }
          try {
            const extracted = await extractFromGitHubRelease(githubReleaseUrl, manifest);
            if (extracted.downloadUrl) {
              downloadUrl = extracted.downloadUrl;
            }
            if (extracted.version && manifest) {
              manifest = { ...manifest, version: extracted.version };
            }
            const extractedManifest = await extractManifestFromGitHub(githubReleaseUrl.replace('/tag/', '/contents/'));
            manifest = { ...extractedManifest, ...manifest };
          } catch (err) {
            return json(res, 400, { error: `从 GitHub 获取插件信息失败: ${err.message}` });
          }
        }
        
        if (!manifest) {
          return json(res, 400, { error: '缺少 manifest 信息' });
        }
        
        const validation = validateManifest(manifest);
        if (!validation.valid) {
          return json(res, 400, { error: validation.error });
        }
        
        const data = readMarketplaceData();
        const category = data.categories.find(c => c.id === manifest.category);
        if (!category && manifest.category) {
          return json(res, 400, { error: '无效的分类' });
        }
        const existingPlugin = data.plugins.find(p => p.name === manifest.name);
        if (existingPlugin) {
          return json(res, 400, { error: '同名插件已存在' });
        }
        
        const now = Date.now();
        const newPlugin = {
          id: generatePluginId(manifest.name),
          name: manifest.name,
          description: manifest.description || '',
          version: manifest.version,
          author: manifest.author,
          category: manifest.category || 'other',
          downloads: 0,
          rating: 0,
          reviews: [],
          createdAt: now,
          updatedAt: now,
          downloadUrl: downloadUrl || githubReleaseUrl || '',
          manifest: manifest,
          uploadedBy: currentUser.id,
          uploadedByName: currentUser.name,
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
          installedBy: []
        };
        data.plugins.push(newPlugin);
        if (!saveMarketplaceData(data)) {
          return json(res, 500, { error: '保存失败' });
        }
        console.log(`[Marketplace] Plugin uploaded: ${newPlugin.name} by ${currentUser.name} (status: pending)`);
        return json(res, 201, { success: true, plugin: newPlugin, message: '插件已上传，待审核' });
      } catch (error) {
        console.error('[Marketplace] Upload error:', error);
        return json(res, 500, { error: error.message });
      }
    }

    // GET /api/plugins/marketplace/pending - List pending plugins (admin only)
    if (method === 'GET' && pathname === '/api/plugins/marketplace/pending') {
      try {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '请先登录' });
        }
        if (currentUser.role !== 'admin') {
          return json(res, 403, { error: '只有管理员可以查看待审核插件' });
        }
        const data = readMarketplaceData();
        const pendingPlugins = data.plugins.filter(p => p.status === 'pending');
        return json(res, 200, { plugins: pendingPlugins, total: pendingPlugins.length });
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }

    // POST /api/plugins/marketplace/:id/review - Review a plugin (admin only)
    const reviewMatch = pathname.match(/^\/api\/plugins\/marketplace\/([^\/]+)\/review$/);
    if (reviewMatch && method === 'POST') {
      const pluginId = reviewMatch[1];
      try {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '请先登录' });
        }
        if (currentUser.role !== 'admin') {
          return json(res, 403, { error: '只有管理员可以审核插件' });
        }
        const body = await readJson(req);
        const { action, comment } = body;
        if (!action || !['approve', 'reject'].includes(action)) {
          return json(res, 400, { error: '无效的审核操作，请使用 approve 或 reject' });
        }
        const data = readMarketplaceData();
        const plugin = data.plugins.find(p => p.id === pluginId);
        if (!plugin) {
          return json(res, 404, { error: '插件不存在' });
        }
        if (plugin.status !== 'pending' && plugin.status !== 'approved' && plugin.status !== 'rejected') {
          return json(res, 400, { error: '插件状态无法审核' });
        }
        
        const now = Date.now();
        plugin.status = action === 'approve' ? 'approved' : 'rejected';
        plugin.reviewedBy = currentUser.id;
        plugin.reviewedByName = currentUser.name;
        plugin.reviewedAt = now;
        if (comment) {
          plugin.reviewComment = comment;
        }
        
        if (!saveMarketplaceData(data)) {
          return json(res, 500, { error: '保存失败' });
        }
        console.log(`[Marketplace] Plugin ${plugin.name} ${plugin.status} by ${currentUser.name}`);
        return json(res, 200, { 
          success: true, 
          plugin,
          message: action === 'approve' ? '插件已审核通过' : '插件已拒绝'
        });
      } catch (error) {
        console.error('[Marketplace] Review error:', error);
        return json(res, 500, { error: error.message });
      }
    }

    // GET /api/plugins/marketplace/:id/check-update - Check for updates
    const checkUpdateMatch = pathname.match(/^\/api\/plugins\/marketplace\/([^\/]+)\/check-update$/);
    if (checkUpdateMatch && method === 'GET') {
      const pluginId = checkUpdateMatch[1];
      try {
        const query = parsed.searchParams;
        const installedVersion = query.get('version');
        
        const data = readMarketplaceData();
        const plugin = data.plugins.find(p => p.id === pluginId);
        if (!plugin) {
          return json(res, 404, { error: '插件不存在' });
        }
        if (plugin.status !== 'approved') {
          return json(res, 400, { error: '插件未通过审核，无法检查更新' });
        }
        
        const result = {
          pluginId: plugin.id,
          pluginName: plugin.name,
          currentVersion: installedVersion || null,
          latestVersion: plugin.version,
          hasUpdate: false,
          updateType: null
        };
        
        if (installedVersion) {
          const comparison = compareVersions(installedVersion, plugin.version);
          if (comparison < 0) {
            result.hasUpdate = true;
            const currentParts = installedVersion.split('.').map(Number);
            const latestParts = plugin.version.split('.').map(Number);
            if (latestParts[0] > currentParts[0]) {
              result.updateType = 'major';
            } else if (latestParts[1] > currentParts[1]) {
              result.updateType = 'minor';
            } else {
              result.updateType = 'patch';
            }
            result.downloadUrl = plugin.downloadUrl;
          }
        }
        
        return json(res, 200, result);
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }

    // GET /api/plugins/marketplace/:id/rate (handled before /api/plugins/marketplace/:id)
    const rateMatch = pathname.match(/^\/api\/plugins\/marketplace\/([^\/]+)\/rate$/);
    if (rateMatch && method === 'POST') {
      const pluginId = rateMatch[1];
      try {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '请先登录' });
        }
        const body = await readJson(req);
        const { rating, comment } = body;
        if (!rating || rating < 1 || rating > 5) {
          return json(res, 400, { error: '评分必须在 1-5 星之间' });
        }
        const data = readMarketplaceData();
        const plugin = data.plugins.find(p => p.id === pluginId);
        if (!plugin) {
          return json(res, 404, { error: '插件不存在' });
        }
        const existingReview = plugin.reviews.find(r => r.userId === currentUser.id);
        if (existingReview) {
          existingReview.rating = rating;
          existingReview.comment = comment || '';
          existingReview.updatedAt = Date.now();
        } else {
          plugin.reviews.push({
            userId: currentUser.id,
            userName: currentUser.name,
            rating,
            comment: comment || '',
            createdAt: Date.now()
          });
        }
        const totalRating = plugin.reviews.reduce((sum, r) => sum + r.rating, 0);
        plugin.rating = Math.round((totalRating / plugin.reviews.length) * 10) / 10;
        plugin.updatedAt = Date.now();
        if (!saveMarketplaceData(data)) {
          return json(res, 500, { error: '保存失败' });
        }
        console.log(`[Marketplace] Plugin rated: ${plugin.name} by ${currentUser.name} (${rating}星)`);
        return json(res, 200, { success: true, rating: plugin.rating, reviewCount: plugin.reviews.length });
      } catch (error) {
        console.error('[Marketplace] Rate error:', error);
        return json(res, 500, { error: error.message });
      }
    }

    // GET /api/plugins/marketplace/:id
    const pluginDetailMatch = pathname.match(/^\/api\/plugins\/marketplace\/([^\/\?]+)$/);
    if (pluginDetailMatch && method === 'GET') {
      const pluginId = pluginDetailMatch[1];
      // Skip special paths
      if (pluginId !== 'upload' && pluginId !== 'categories') {
        try {
          const data = readMarketplaceData();
          const plugin = data.plugins.find(p => p.id === pluginId);
          if (!plugin) {
            return json(res, 404, { error: '插件不存在' });
          }
          return json(res, 200, { plugin });
        } catch (error) {
          return json(res, 500, { error: error.message });
        }
      }
    }

    // GET /api/plugins/marketplace (must be last to avoid matching other routes)
    if (method === 'GET' && pathname === '/api/plugins/marketplace') {
      try {
        const data = readMarketplaceData();
        const query = parsed.searchParams;
        const showAll = query.get('showAll') === 'true';
        let plugins = data.plugins || [];
        
        if (!showAll) {
          plugins = plugins.filter(p => p.status === 'approved');
        }
        
        const category = query.get('category');
        if (category) {
          plugins = plugins.filter(p => p.category === category);
        }
        
        const search = query.get('search');
        if (search) {
          const searchLower = search.toLowerCase();
          plugins = plugins.filter(p => 
            p.name.toLowerCase().includes(searchLower) ||
            p.description.toLowerCase().includes(searchLower)
          );
        }
        
        const sortBy = query.get('sortBy') || 'createdAt';
        const order = query.get('order') || 'desc';
        plugins.sort((a, b) => {
          let aVal = a[sortBy];
          let bVal = b[sortBy];
          if (sortBy === 'rating') {
            aVal = a.reviews.length > 0 ? a.rating : 0;
            bVal = b.reviews.length > 0 ? b.rating : 0;
          }
          return order === 'desc' ? bVal - aVal : aVal - bVal;
        });
        
        return json(res, 200, { plugins, total: plugins.length });
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }

    // POST /api/plugins/marketplace/:id/install - Install a plugin (with real download & extract)
    const installMatch = pathname.match(/^\/api\/plugins\/marketplace\/([^\/]+)\/install$/);
    if (installMatch && method === 'POST') {
      const pluginId = installMatch[1];
      try {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '请先登录' });
        }

        const data = readMarketplaceData();
        const plugin = data.plugins.find(p => p.id === pluginId);
        if (!plugin) {
          return json(res, 404, { error: '插件不存在' });
        }
        if (plugin.status !== 'approved') {
          return json(res, 400, { error: '插件未通过审核，无法安装' });
        }

        if (!plugin.downloadUrl) {
          return json(res, 400, { error: '该插件没有可下载的资源' });
        }

        const pluginsDir = path.join(__dirname, '..', 'plugins');
        const marketDataPath = path.join(__dirname, '..', 'data', 'plugins-marketplace.json');

        if (!pluginInstaller) {
          pluginInstaller = new PluginInstaller(pluginsDir, {
            eventEmitter: serverWithEvents
          });
        }

        const installResult = await pluginInstaller.installPlugin(pluginId, currentUser.id, {
          downloadUrl: plugin.downloadUrl,
          marketDataPath
        });

        plugin.downloads = (plugin.downloads || 0) + 1;
        
        if (!plugin.installedBy) {
          plugin.installedBy = [];
        }
        if (!plugin.installedBy.includes(currentUser.id)) {
          plugin.installedBy.push(currentUser.id);
        }
        
        const installedPlugins = readInstalledPlugins();
        if (!installedPlugins[currentUser.id]) {
          installedPlugins[currentUser.id] = [];
        }
        const existingInstall = installedPlugins[currentUser.id].find(p => p.pluginId === pluginId);
        if (!existingInstall) {
          installedPlugins[currentUser.id].push({
            pluginId: plugin.id,
            pluginName: plugin.name,
            version: plugin.version,
            installedAt: Date.now()
          });
        } else {
          existingInstall.version = plugin.version;
          existingInstall.installedAt = Date.now();
        }
        
        if (!saveInstalledPlugins(installedPlugins)) {
          return json(res, 500, { error: '保存安装记录失败' });
        }
        
        plugin.updatedAt = Date.now();
        if (!saveMarketplaceData(data)) {
          return json(res, 500, { error: '保存失败' });
        }
        
        console.log(`[Marketplace] Plugin ${plugin.name} installed by ${currentUser.name}`);
        return json(res, 200, { 
          success: true, 
          plugin,
          installResult,
          message: '插件安装成功'
        });
      } catch (error) {
        console.error('[Marketplace] Install error:', error);
        return json(res, 500, { error: error.message });
      }
    }

    // POST /api/plugins/marketplace/:id/update - Update a plugin
    const updateMatch = pathname.match(/^\/api\/plugins\/marketplace\/([^\/]+)\/update$/);
    if (updateMatch && method === 'POST') {
      const pluginId = updateMatch[1];
      try {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '请先登录' });
        }

        const data = readMarketplaceData();
        const marketPlugin = data.plugins.find(p => p.id === pluginId);
        if (!marketPlugin) {
          return json(res, 404, { error: '插件不存在' });
        }

        const pluginsDir = path.join(__dirname, '..', 'plugins');
        const marketDataPath = path.join(__dirname, '..', 'data', 'plugins-marketplace.json');

        if (!pluginInstaller) {
          pluginInstaller = new PluginInstaller(pluginsDir, {
            eventEmitter: serverWithEvents
          });
        }

        const updateResult = await pluginInstaller.updatePlugin(marketPlugin.name, currentUser.id, {
          marketDataPath,
          downloadUrl: marketPlugin.downloadUrl
        });

        const installedPlugins = readInstalledPlugins();
        if (installedPlugins[currentUser.id]) {
          const installed = installedPlugins[currentUser.id].find(p => p.pluginName === marketPlugin.name);
          if (installed) {
            installed.version = marketPlugin.version;
            installed.updatedAt = Date.now();
          }
        }
        saveInstalledPlugins(installedPlugins);

        console.log(`[Marketplace] Plugin ${marketPlugin.name} updated by ${currentUser.name}`);
        return json(res, 200, { 
          success: true, 
          updateResult,
          message: `插件已更新至 ${marketPlugin.version} 版本`
        });
      } catch (error) {
        console.error('[Marketplace] Update error:', error);
        return json(res, 500, { error: error.message });
      }
    }

    // POST /api/plugins/marketplace/:id/uninstall - Uninstall a plugin
    const uninstallMatch = pathname.match(/^\/api\/plugins\/marketplace\/([^\/]+)\/uninstall$/);
    if (uninstallMatch && method === 'POST') {
      const pluginId = uninstallMatch[1];
      try {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '请先登录' });
        }

        const data = readMarketplaceData();
        const marketPlugin = data.plugins.find(p => p.id === pluginId);
        if (!marketPlugin) {
          return json(res, 404, { error: '插件不存在' });
        }

        const pluginsDir = path.join(__dirname, '..', 'plugins');
        const marketDataPath = path.join(__dirname, '..', 'data', 'plugins-marketplace.json');

        if (!pluginInstaller) {
          pluginInstaller = new PluginInstaller(pluginsDir, {
            eventEmitter: serverWithEvents
          });
        }

        const uninstallResult = await pluginInstaller.uninstallPlugin(marketPlugin.name, currentUser.id, {
          marketDataPath,
          keepBackup: true
        });

        const installedPlugins = readInstalledPlugins();
        if (installedPlugins[currentUser.id]) {
          installedPlugins[currentUser.id] = installedPlugins[currentUser.id].filter(
            p => p.pluginName !== marketPlugin.name
          );
        }
        saveInstalledPlugins(installedPlugins);

        console.log(`[Marketplace] Plugin ${marketPlugin.name} uninstalled by ${currentUser.name}`);
        return json(res, 200, { 
          success: true, 
          uninstallResult,
          message: '插件卸载成功'
        });
      } catch (error) {
        console.error('[Marketplace] Uninstall error:', error);
        return json(res, 500, { error: error.message });
      }
    }

    // GET /api/plugins/marketplace/:id/check-updates - Check for available updates
    const checkUpdatesMatch = pathname.match(/^\/api\/plugins\/marketplace\/([^\/]+)\/check-updates$/);
    if (checkUpdatesMatch && method === 'GET') {
      const pluginId = checkUpdatesMatch[1];
      try {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '请先登录' });
        }

        const data = readMarketplaceData();
        const marketPlugin = data.plugins.find(p => p.id === pluginId);
        if (!marketPlugin) {
          return json(res, 404, { error: '插件不存在' });
        }

        const pluginsDir = path.join(__dirname, '..', 'plugins');
        const pluginPath = path.join(pluginsDir, marketPlugin.name);

        let currentVersion = null;
        try {
          const manifestPath = path.join(pluginPath, 'manifest.json');
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          currentVersion = manifest.version;
        } catch {}

        const hasUpdate = currentVersion && compareVersions(currentVersion, marketPlugin.version) < 0;

        return json(res, 200, {
          pluginId: marketPlugin.id,
          pluginName: marketPlugin.name,
          currentVersion,
          latestVersion: marketPlugin.version,
          hasUpdate,
          downloadUrl: marketPlugin.downloadUrl
        });
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }

    // GET /api/plugins/updates - Get all available updates for user
    if (method === 'GET' && pathname === '/api/plugins/updates') {
      try {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '请先登录' });
        }

        const pluginsDir = path.join(__dirname, '..', 'plugins');
        const marketDataPath = path.join(__dirname, '..', 'data', 'plugins-marketplace.json');
        const installedPluginsPath = path.join(__dirname, '..', 'data', 'installed-plugins.json');

        if (!pluginUpdateNotifier) {
          pluginUpdateNotifier = new PluginUpdateNotifier({
            pluginsDir,
            marketDataPath,
            installedPluginsPath
          });
        }

        const updates = await pluginUpdateNotifier.checkAllUpdates(currentUser.id);

        return json(res, 200, {
          hasUpdates: updates.length > 0,
          updates,
          count: updates.length
        });
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }

    // POST /api/plugins/updates/notify - Generate update notification
    if (method === 'POST' && pathname === '/api/plugins/updates/notify') {
      try {
        const currentUser = await verifyTokenFromRequest(req);
        if (!currentUser) {
          return json(res, 401, { error: '请先登录' });
        }

        const pluginsDir = path.join(__dirname, '..', 'plugins');
        const marketDataPath = path.join(__dirname, '..', 'data', 'plugins-marketplace.json');
        const installedPluginsPath = path.join(__dirname, '..', 'data', 'installed-plugins.json');

        if (!pluginUpdateNotifier) {
          pluginUpdateNotifier = new PluginUpdateNotifier({
            pluginsDir,
            marketDataPath,
            installedPluginsPath
          });
        }

        const notification = await pluginUpdateNotifier.notifyUpdates(currentUser.id);

        return json(res, 200, notification);
      } catch (error) {
        return json(res, 500, { error: error.message });
      }
    }
  });
}

module.exports = pluginsMarketplaceRoutes;
