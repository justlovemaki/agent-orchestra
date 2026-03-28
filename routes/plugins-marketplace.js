'use strict';

/**
 * Plugins Marketplace Routes
 * 
 * Plugin marketplace management API endpoints
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function pluginsMarketplaceRoutes(serverWithEvents, deps) {
  const { json, readJson, verifyTokenFromRequest } = deps;
  
  const dataFilePath = path.join(__dirname, '..', 'data', 'plugins-marketplace.json');

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
        const { manifest, downloadUrl } = body;
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
          downloadUrl: downloadUrl || '',
          manifest: manifest,
          uploadedBy: currentUser.id,
          uploadedByName: currentUser.name
        };
        data.plugins.push(newPlugin);
        if (!saveMarketplaceData(data)) {
          return json(res, 500, { error: '保存失败' });
        }
        console.log(`[Marketplace] Plugin uploaded: ${newPlugin.name} by ${currentUser.name}`);
        return json(res, 201, { success: true, plugin: newPlugin });
      } catch (error) {
        console.error('[Marketplace] Upload error:', error);
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
        let plugins = data.plugins || [];
        
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
  });
}

module.exports = pluginsMarketplaceRoutes;
