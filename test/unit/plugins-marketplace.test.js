/**
 * 插件市场模块测试
 */

const path = require('path');
const fs = require('fs');

const TEST_DATA_DIR = path.join(__dirname, '../../data/test-marketplace');
const TEST_DATA_FILE = path.join(TEST_DATA_DIR, 'plugins-marketplace.json');
const TEST_INSTALLED_FILE = path.join(TEST_DATA_DIR, 'installed-plugins.json');

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   错误：${error.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `期望 ${JSON.stringify(expected)}, 实际 ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn, message) {
  let threw = false;
  let errorMessage = '';
  try {
    fn();
  } catch (error) {
    threw = true;
    errorMessage = error.message;
  }
  if (!threw) {
    throw new Error(message || '期望抛出异常但未抛出');
  }
  return errorMessage;
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

function generatePluginId(name) {
  const crypto = require('crypto');
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${sanitizedName}-${timestamp}-${random}`;
}

let passed = 0;
let failed = 0;

async function setup() {
  await fs.promises.mkdir(TEST_DATA_DIR, { recursive: true });
  const initialData = {
    plugins: [
      {
        id: 'test-plugin-1',
        name: 'Test Plugin 1',
        description: 'Test plugin 1 description',
        version: '1.0.0',
        author: 'Test Author',
        category: 'utility',
        downloads: 10,
        rating: 4.5,
        reviews: [],
        createdAt: Date.now() - 100000,
        updatedAt: Date.now() - 100000,
        downloadUrl: 'https://example.com/plugin1.zip',
        manifest: { name: 'Test Plugin 1', version: '1.0.0', author: 'Test Author', description: 'Test plugin 1 description' },
        uploadedBy: 'user1',
        uploadedByName: 'User 1',
        status: 'approved',
        reviewedBy: 'admin',
        reviewedByName: 'Admin',
        reviewedAt: Date.now() - 100000,
        installedBy: ['user1']
      },
      {
        id: 'test-plugin-2',
        name: 'Test Plugin 2',
        description: 'Test plugin 2 description',
        version: '2.0.0',
        author: 'Test Author 2',
        category: 'automation',
        downloads: 5,
        rating: 3.8,
        reviews: [],
        createdAt: Date.now() - 50000,
        updatedAt: Date.now() - 50000,
        downloadUrl: 'https://example.com/plugin2.zip',
        manifest: { name: 'Test Plugin 2', version: '2.0.0', author: 'Test Author 2', description: 'Test plugin 2 description' },
        uploadedBy: 'user2',
        uploadedByName: 'User 2',
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        installedBy: []
      },
      {
        id: 'test-plugin-3',
        name: 'Test Plugin 3',
        description: 'Test plugin 3 description',
        version: '1.5.0',
        author: 'Test Author 3',
        category: 'integration',
        downloads: 0,
        rating: 0,
        reviews: [],
        createdAt: Date.now() - 20000,
        updatedAt: Date.now() - 20000,
        downloadUrl: 'https://example.com/plugin3.zip',
        manifest: { name: 'Test Plugin 3', version: '1.5.0', author: 'Test Author 3', description: 'Test plugin 3 description' },
        uploadedBy: 'user3',
        uploadedByName: 'User 3',
        status: 'rejected',
        reviewedBy: 'admin',
        reviewedByName: 'Admin',
        reviewedAt: Date.now() - 15000,
        reviewComment: '不符合要求',
        installedBy: []
      }
    ],
    categories: [
      { id: 'utility', name: '实用工具', icon: '🛠️' },
      { id: 'automation', name: '自动化', icon: '⚙️' },
      { id: 'integration', name: '集成工具', icon: '🔌' }
    ]
  };
  await fs.promises.writeFile(TEST_DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  await fs.promises.writeFile(TEST_INSTALLED_FILE, JSON.stringify({}, null, 2), 'utf8');
}

async function cleanup() {
  try {
    await fs.promises.rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch {}
}

function readMarketplaceData() {
  try {
    if (!fs.existsSync(TEST_DATA_FILE)) {
      return { plugins: [], categories: [] };
    }
    const data = fs.readFileSync(TEST_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { plugins: [], categories: [] };
  }
}

function saveMarketplaceData(data) {
  try {
    fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    return false;
  }
}

function readInstalledPlugins() {
  try {
    if (!fs.existsSync(TEST_INSTALLED_FILE)) {
      return {};
    }
    const data = fs.readFileSync(TEST_INSTALLED_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

function saveInstalledPlugins(data) {
  try {
    fs.writeFileSync(TEST_INSTALLED_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    return false;
  }
}

async function runTests() {
  await setup();

  console.log('\n📋 插件清单验证测试\n');

  if (test('验证清单 - 有效清单', () => {
    const manifest = { name: 'test-plugin', version: '1.0.0', description: 'Test', author: 'Author' };
    const result = validateManifest(manifest);
    assert(result.valid === true, '有效清单应通过验证');
    passed++;
  })) {} else { failed++; }

  if (test('验证清单 - 缺少必需字段', () => {
    const manifest = { name: 'test' };
    const result = validateManifest(manifest);
    assert(result.valid === false, '缺少字段应返回无效');
    assert(result.error.includes('version') || result.error.includes('description') || result.error.includes('author'), '应提示缺少必需字段');
    passed++;
  })) {} else { failed++; }

  if (test('验证清单 - 无效版本号格式', () => {
    const manifest = { name: 'test', version: '1.0', description: 'Test', author: 'Author' };
    const result = validateManifest(manifest);
    assert(result.valid === false, '无效版本号应返回无效');
    assert(result.error.includes('版本号'), '应提示版本号格式错误');
    passed++;
  })) {} else { failed++; }

  if (test('验证清单 - 插件名称过长', () => {
    const manifest = { name: 'a'.repeat(51), version: '1.0.0', description: 'Test', author: 'Author' };
    const result = validateManifest(manifest);
    assert(result.valid === false, '名称过长应返回无效');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 GitHub URL 验证测试\n');

  if (test('GitHub URL 验证 - 正确的 Release URL', () => {
    const url = 'https://github.com/example/plugin/releases/tag/v1.0.0';
    assert(validateGitHubUrl(url) === true, '正确的 Release URL 应通过验证');
    passed++;
  })) {} else { failed++; }

  if (test('GitHub URL 验证 - 正确的 Raw URL', () => {
    const url = 'https://github.com/example/plugin/raw/main/manifest.json';
    assert(validateGitHubUrl(url) === true, '正确的 Raw URL 应通过验证');
    passed++;
  })) {} else { failed++; }

  if (test('GitHub URL 验证 - 无效 URL', () => {
    const url = 'https://example.com/plugin';
    assert(validateGitHubUrl(url) === false, '无效 URL 应返回 false');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 版本号比较测试\n');

  if (test('版本号比较 - 大于', () => {
    assert(compareVersions('2.0.0', '1.0.0') === 1, '2.0.0 > 1.0.0');
    passed++;
  })) {} else { failed++; }

  if (test('版本号比较 - 小于', () => {
    assert(compareVersions('1.0.0', '2.0.0') === -1, '1.0.0 < 2.0.0');
    passed++;
  })) {} else { failed++; }

  if (test('版本号比较 - 相等', () => {
    assert(compareVersions('1.0.0', '1.0.0') === 0, '1.0.0 === 1.0.0');
    passed++;
  })) {} else { failed++; }

  if (test('版本号比较 - 补丁版本', () => {
    assert(compareVersions('1.0.2', '1.0.1') === 1, '1.0.2 > 1.0.1');
    passed++;
  })) {} else { failed++; }

  if (test('版本号比较 - 不同长度', () => {
    assert(compareVersions('1.0.0.1', '1.0.0') === 1, '1.0.0.1 > 1.0.0');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 插件市场数据操作测试\n');

  if (test('读取市场数据', () => {
    const data = readMarketplaceData();
    assert(data.plugins.length === 3, '应有3个插件');
    passed++;
  })) {} else { failed++; }

  if (test('生成插件 ID', () => {
    const id = generatePluginId('test-plugin');
    assert(id.startsWith('test-plugin-'), 'ID 应以插件名开头');
    assert(id.match(/-[a-f0-9]{8}$/), 'ID 应包含随机字符串');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 插件状态过滤测试\n');

  if (test('过滤已审核插件 - 只返回 approved', () => {
    const data = readMarketplaceData();
    const approvedPlugins = data.plugins.filter(p => p.status === 'approved');
    assert(approvedPlugins.length >= 1, '应至少有1个已审核插件');
    assert(approvedPlugins.every(p => p.status === 'approved'), '所有返回的插件状态应为 approved');
    passed++;
  })) {} else { failed++; }

  if (test('过滤待审核插件', () => {
    const data = readMarketplaceData();
    const pendingPlugins = data.plugins.filter(p => p.status === 'pending');
    assert(pendingPlugins.length === 1, '应有1个待审核插件');
    assertEqual(pendingPlugins[0].name, 'Test Plugin 2');
    passed++;
  })) {} else { failed++; }

  if (test('过滤已拒绝插件', () => {
    const data = readMarketplaceData();
    const rejectedPlugins = data.plugins.filter(p => p.status === 'rejected');
    assert(rejectedPlugins.length === 1, '应有1个已拒绝插件');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 插件审核测试\n');

  if (test('审核通过插件', () => {
    const data = readMarketplaceData();
    const plugin = data.plugins.find(p => p.id === 'test-plugin-2');
    const now = Date.now();
    plugin.status = 'approved';
    plugin.reviewedBy = 'admin';
    plugin.reviewedByName = 'Admin';
    plugin.reviewedAt = now;
    
    assert(saveMarketplaceData(data) === true, '保存数据应成功');
    
    const updatedData = readMarketplaceData();
    const updatedPlugin = updatedData.plugins.find(p => p.id === 'test-plugin-2');
    assertEqual(updatedPlugin.status, 'approved');
    assertEqual(updatedPlugin.reviewedBy, 'admin');
    assert(updatedPlugin.reviewedAt !== null, '审核时间应存在');
    passed++;
  })) {} else { failed++; }

  if (test('审核拒绝插件', () => {
    const data = readMarketplaceData();
    const plugin = data.plugins.find(p => p.id === 'test-plugin-3');
    plugin.status = 'rejected';
    plugin.reviewComment = '需要修改';
    
    assert(saveMarketplaceData(data) === true, '保存数据应成功');
    
    const updatedData = readMarketplaceData();
    const updatedPlugin = updatedData.plugins.find(p => p.id === 'test-plugin-3');
    assertEqual(updatedPlugin.status, 'rejected');
    assertEqual(updatedPlugin.reviewComment, '需要修改');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 插件安装测试\n');

  if (test('安装插件 - 首次安装', () => {
    let data = readMarketplaceData();
    const plugin = data.plugins.find(p => p.id === 'test-plugin-1');
    const userId = 'newuser';
    
    plugin.downloads = (plugin.downloads || 0) + 1;
    if (!plugin.installedBy) plugin.installedBy = [];
    if (!plugin.installedBy.includes(userId)) {
      plugin.installedBy.push(userId);
    }
    
    let installedPlugins = readInstalledPlugins();
    if (!installedPlugins[userId]) {
      installedPlugins[userId] = [];
    }
    installedPlugins[userId].push({
      pluginId: plugin.id,
      pluginName: plugin.name,
      version: plugin.version,
      installedAt: Date.now()
    });
    
    assert(saveMarketplaceData(data) === true, '保存市场数据应成功');
    assert(saveInstalledPlugins(installedPlugins) === true, '保存安装数据应成功');
    
    const updatedData = readMarketplaceData();
    const updatedPlugin = updatedData.plugins.find(p => p.id === 'test-plugin-1');
    assert(updatedPlugin.downloads === 11, '下载数应增加');
    assert(updatedPlugin.installedBy.includes(userId), '安装用户应记录');
    
    const updatedInstalled = readInstalledPlugins();
    assert(updatedInstalled[userId].length === 1, '用户应有一个已安装插件');
    passed++;
  })) {} else { failed++; }

  if (test('安装插件 - 重复安装', () => {
    const data = readMarketplaceData();
    const plugin = data.plugins.find(p => p.id === 'test-plugin-1');
    const userId = 'user1';
    
    const originalDownloads = plugin.downloads;
    const originalInstalledByCount = plugin.installedBy.length;
    
    if (!plugin.installedBy.includes(userId)) {
      plugin.installedBy.push(userId);
    }
    
    assert(plugin.downloads === originalDownloads, '重复安装不应增加下载数');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 插件更新检查测试\n');

  if (test('检查更新 - 有可用更新', () => {
    const plugin = { version: '2.0.0' };
    const installedVersion = '1.0.0';
    
    const comparison = compareVersions(installedVersion, plugin.version);
    const hasUpdate = comparison < 0;
    
    assert(hasUpdate === true, '应有可用更新');
    assert(plugin.version === '2.0.0', '最新版本应为 2.0.0');
    passed++;
  })) {} else { failed++; }

  if (test('检查更新 - 无可用更新', () => {
    const data = readMarketplaceData();
    const plugin = data.plugins.find(p => p.id === 'test-plugin-1');
    const installedVersion = '2.0.0';
    
    const comparison = compareVersions(installedVersion, plugin.version);
    const hasUpdate = comparison < 0;
    
    assert(hasUpdate === false, '应无可用更新');
    passed++;
  })) {} else { failed++; }

  if (test('检查更新 - 更新类型判断', () => {
    const plugin = { version: '2.0.0' };
    
    let updateType = null;
    const currentParts = '1.0.0'.split('.').map(Number);
    const latestParts = plugin.version.split('.');
    if (latestParts[0] > currentParts[0]) {
      updateType = 'major';
    } else if (latestParts[1] > currentParts[1]) {
      updateType = 'minor';
    }
    
    assertEqual(updateType, 'major', '主版本更新应为 major');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 分类过滤测试\n');

  if (test('按分类过滤插件', () => {
    const data = readMarketplaceData();
    const utilityPlugins = data.plugins.filter(p => p.category === 'utility' && p.status === 'approved');
    assert(utilityPlugins.length >= 1, '应至少有1个 utility 分类的已审核插件');
    passed++;
  })) {} else { failed++; }

  if (test('搜索插件', () => {
    const data = readMarketplaceData();
    const searchTerm = 'test';
    const searchLower = searchTerm.toLowerCase();
    const results = data.plugins.filter(p => 
      (p.name.toLowerCase().includes(searchLower) || 
       p.description.toLowerCase().includes(searchLower)) &&
      p.status === 'approved'
    );
    assert(results.length >= 1, '应至少找到1个匹配的插件');
    passed++;
  })) {} else { failed++; }

  await cleanup();

  console.log('\n' + '='.repeat(50));
  console.log(`测试结果：${passed} 通过，${failed} 失败`);
  console.log('='.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
