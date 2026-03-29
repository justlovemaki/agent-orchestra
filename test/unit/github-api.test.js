'use strict';

const path = require('path');
const fs = require('fs');

const TEST_DATA_DIR = path.join(__dirname, '../../data/test-github-api');

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

let passed = 0;
let failed = 0;

async function runTests() {
  console.log('\n📋 GitHub API 模块测试\n');

  const GitHubAPI = require('../../lib/github-api');

  if (test('GitHubAPI - 实例化', () => {
    const api = new GitHubAPI();
    assert(api !== null, 'GitHubAPI 实例应存在');
    assert(api.baseUrl === 'api.github.com', '默认 baseUrl 应为 api.github.com');
    passed++;
  })) {} else { failed++; }

  if (test('GitHubAPI - 设置凭据', () => {
    const api = new GitHubAPI();
    api.setCredentials('test-token');
    assert(api.token === 'test-token', 'Token 应正确设置');
    passed++;
  })) {} else { failed++; }

  if (test('GitHubAPI - 设置仓库', () => {
    const api = new GitHubAPI();
    api.setRepo('owner', 'repo');
    assert(api.owner === 'owner', 'Owner 应正确设置');
    assert(api.repo === 'repo', 'Repo 应正确设置');
    passed++;
  })) {} else { failed++; }

  if (test('GitHubAPI - 解析仓库 URL', () => {
    const api = new GitHubAPI();
    
    const result1 = api.parseRepoUrl('https://github.com/owner/repo');
    assert(result1 !== null, '应解析成功');
    assertEqual(result1.owner, 'owner');
    assertEqual(result1.repo, 'repo');
    
    const result2 = api.parseRepoUrl('https://github.com/owner/repo/releases/tag/v1.0.0');
    assert(result2 !== null, '应解析成功');
    assertEqual(result2.owner, 'owner');
    assertEqual(result2.repo, 'repo');
    assertEqual(result2.tag, 'v1.0.0');
    
    const result3 = api.parseRepoUrl('https://github.com/owner/repo/archive/v1.0.0.zip');
    assert(result3 !== null, '应解析成功');
    assertEqual(result3.owner, 'owner');
    assertEqual(result3.repo, 'repo');
    
    passed++;
  })) {} else { failed++; }

  if (test('GitHubAPI - 验证 GitHub URL - 有效', () => {
    const api = new GitHubAPI();
    
    assert(api.validateGitHubUrl('https://github.com/owner/repo') === true, '基础 URL 应有效');
    assert(api.validateGitHubUrl('https://github.com/owner/repo/releases') === true, 'Releases URL 应有效');
    assert(api.validateGitHubUrl('https://github.com/owner/repo/releases/tag/v1.0.0') === true, 'Release tag URL 应有效');
    assert(api.validateGitHubUrl('https://github.com/owner/repo/archive/main') === true, 'Archive URL 应有效');
    
    passed++;
  })) {} else { failed++; }

  if (test('GitHubAPI - 验证 GitHub URL - 无效', () => {
    const api = new GitHubAPI();
    
    assert(api.validateGitHubUrl('https://example.com/repo') === false, '非 GitHub URL 应无效');
    assert(api.validateGitHubUrl('https://github.com/owner') === false, '不完整 URL 应无效');
    assert(api.validateGitHubUrl('not-a-url') === false, '非 URL 应无效');
    
    passed++;
  })) {} else { failed++; }

  if (test('GitHubAPI - 从 URL 提取标签', () => {
    const api = new GitHubAPI();
    
    assertEqual(api.extractTagFromUrl('https://github.com/owner/repo/releases/tag/v1.0.0'), 'v1.0.0');
    assertEqual(api.extractTagFromUrl('https://github.com/owner/repo/releases/tag/1.0.0'), '1.0.0');
    assertEqual(api.extractTagFromUrl('https://github.com/owner/repo'), null);
    
    passed++;
  })) {} else { failed++; }

  if (test('GitHubAPI - 构建请求头', () => {
    const api = new GitHubAPI();
    
    const headers1 = api.buildHeaders();
    assert(headers1['User-Agent'] === 'Agent-Orchestra-Plugin-Marketplace/1.0', '应有正确的 User-Agent');
    assert(headers1['Accept'] === 'application/vnd.github+json', '应有正确的 Accept');
    assert(!headers1['Authorization'], '无 token 时不应有 Authorization');
    
    api.setCredentials('test-token');
    const headers2 = api.buildHeaders();
    assert(headers2['Authorization'] === 'Bearer test-token', '有 token 时应有 Authorization');
    
    passed++;
  })) {} else { failed++; }

  if (test('GitHubAPI - 构建请求头 - 使用环境变量 token', () => {
    const api = new GitHubAPI({ token: 'env-token' });
    const headers = api.buildHeaders();
    assert(headers['Authorization'] === 'Bearer env-token', '应使用环境变量 token');
    passed++;
  })) {} else { failed++; }

  console.log('\n📋 GitHub API 格式化测试\n');

  if (test('GitHubAPI - 格式化 Release', () => {
    const api = new GitHubAPI();
    
    const releaseData = {
      id: 123,
      tag_name: 'v1.0.0',
      name: 'Release 1.0.0',
      body: 'Release notes',
      html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0',
      draft: false,
      prerelease: false,
      created_at: '2024-01-01T00:00:00Z',
      published_at: '2024-01-02T00:00:00Z',
      assets: [
        {
          id: 1,
          name: 'plugin.zip',
          size: 1024,
          download_count: 100,
          browser_download_url: 'https://example.com/plugin.zip',
          content_type: 'application/zip',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      zipball_url: 'https://api.github.com/repos/owner/repo/zipball/v1.0.0',
      tarball_url: 'https://api.github.com/repos/owner/repo/tarball/v1.0.0'
    };
    
    const formatted = api.formatRelease(releaseData);
    
    assert(formatted.id === 123, 'ID 应正确');
    assert(formatted.tagName === 'v1.0.0', 'tagName 应正确');
    assert(formatted.name === 'Release 1.0.0', 'name 应正确');
    assert(formatted.assets.length === 1, '应有 1 个 asset');
    assert(formatted.assets[0].name === 'plugin.zip', 'asset name 应正确');
    assert(formatted.zipballUrl === releaseData.zipball_url, 'zipballUrl 应正确');
    
    passed++;
  })) {} else { failed++; }

  if (test('GitHubAPI - 查找插件资源 - 按扩展名优先级', () => {
    const api = new GitHubAPI();
    
    const assets = [
      { name: 'readme.txt', size: 100 },
      { name: 'plugin.zip', size: 1000 },
      { name: 'source.tar.gz', size: 2000 },
      { name: 'docs.pdf', size: 500 }
    ];
    
    const found = api.findPluginAsset(assets);
    assert(found.name === 'plugin.zip', '应优先找到 .zip 文件');
    
    const assets2 = [
      { name: 'readme.txt', size: 100 },
      { name: 'build.tar.gz', size: 2000 }
    ];
    
    const found2 = api.findPluginAsset(assets2);
    assert(found2.name === 'build.tar.gz', '应找到 .tar.gz 文件');
    
    passed++;
  })) {} else { failed++; }

  if (test('GitHubAPI - 查找插件资源 - 按名称优先级', () => {
    const api = new GitHubAPI();
    
    const assets = [
      { name: 'readme.txt', size: 100 },
      { name: 'release-1.0.0.zip', size: 1000 }
    ];
    
    const found = api.findPluginAsset(assets);
    assert(found.name === 'release-1.0.0.zip', '应找到包含 release 的文件');
    
    passed++;
  })) {} else { failed++; }

  if (test('GitHubAPI - 查找插件资源 - 无匹配时返回第一个', () => {
    const api = new GitHubAPI();
    
    const assets = [
      { name: 'readme.txt', size: 100 },
      { name: 'data.json', size: 200 }
    ];
    
    const found = api.findPluginAsset(assets);
    assert(found.name === 'readme.txt', '应返回第一个资源');
    
    const emptyAssets = [];
    const found2 = api.findPluginAsset(emptyAssets);
    assert(found2 === null, '空数组应返回 null');
    
    passed++;
  })) {} else { failed++; }

  console.log('\n' + '='.repeat(50));
  console.log(`测试结果：${passed} 通过，${failed} 失败`);
  console.log('='.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
