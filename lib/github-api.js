'use strict';

const https = require('https');
const http = require('http');
const crypto = require('crypto');

class GitHubAPI {
  constructor(options = {}) {
    this.token = options.token || process.env.GITHUB_TOKEN || null;
    this.owner = options.owner || null;
    this.repo = options.repo || null;
    this.baseUrl = 'api.github.com';
    this.timeout = options.timeout || 30000;
  }

  setCredentials(token) {
    this.token = token;
  }

  setRepo(owner, repo) {
    this.owner = owner;
    this.repo = repo;
  }

  parseRepoUrl(url) {
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/]+)(?:\/releases\/tag\/([^\/]+))?/,
      /github\.com\/([^\/]+)\/([^\/]+)\/archive\/([^\/]+)/,
      /api\.github\.com\/repos\/([^\/]+)\/([^\/]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, ''),
          tag: match[3] || null
        };
      }
    }
    return null;
  }

  buildHeaders() {
    const headers = {
      'User-Agent': 'Agent-Orchestra-Plugin-Marketplace/1.0',
      'Accept': 'application/vnd.github+json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const client = options.secure !== false ? https : http;
      
      const requestOptions = {
        hostname: this.baseUrl,
        path: path,
        method: options.method || 'GET',
        headers: this.buildHeaders(),
        timeout: this.timeout
      };

      const req = client.request(requestOptions, (res) => {
        if (res.statusCode === 404) {
          return reject(new Error('GitHub API: Resource not found (404)'));
        }
        if (res.statusCode === 403) {
          return reject(new Error('GitHub API: Rate limit exceeded or access forbidden (403)'));
        }
        if (res.statusCode >= 400) {
          return reject(new Error(`GitHub API: HTTP ${res.statusCode}`));
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  async getRepoInfo(owner, repo) {
    const data = await this.request(`/repos/${owner}/${repo}`);
    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      owner: data.owner.login,
      ownerAvatar: data.owner.avatar_url,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      license: data.license?.spdx_id,
      defaultBranch: data.default_branch,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      pushedAt: data.pushed_at,
      htmlUrl: data.html_url
    };
  }

  async getLatestRelease(owner, repo) {
    try {
      const data = await this.request(`/repos/${owner}/${repo}/releases/latest`);
      return this.formatRelease(data);
    } catch (error) {
      throw new Error(`Failed to get latest release: ${error.message}`);
    }
  }

  async getReleaseByTag(owner, repo, tag) {
    try {
      const data = await this.request(`/repos/${owner}/${repo}/releases/tags/${tag}`);
      return this.formatRelease(data);
    } catch (error) {
      throw new Error(`Failed to get release ${tag}: ${error.message}`);
    }
  }

  async getAllReleases(owner, repo, perPage = 30) {
    try {
      const data = await this.request(`/repos/${owner}/${repo}/releases?per_page=${perPage}`);
      return data.map(release => this.formatRelease(release));
    } catch (error) {
      throw new Error(`Failed to get releases: ${error.message}`);
    }
  }

  formatRelease(release) {
    const assets = (release.assets || []).map(asset => ({
      id: asset.id,
      name: asset.name,
      size: asset.size,
      downloadCount: asset.download_count,
      browserDownloadUrl: asset.browser_download_url,
      contentType: asset.content_type,
      createdAt: asset.created_at,
      updatedAt: asset.updated_at
    }));

    return {
      id: release.id,
      tagName: release.tag_name,
      name: release.name || release.tag_name,
      body: release.body,
      htmlUrl: release.html_url,
      draft: release.draft,
      prerelease: release.prerelease,
      createdAt: release.created_at,
      publishedAt: release.published_at,
      assets,
      zipballUrl: release.zipball_url,
      tarballUrl: release.tarball_url
    };
  }

  async getTags(owner, repo, perPage = 30) {
    try {
      const data = await this.request(`/repos/${owner}/${repo}/tags?per_page=${perPage}`);
      return data.map(tag => ({
        name: tag.name,
        commit: tag.commit.sha,
        zipballUrl: tag.zipball_url,
        tarballUrl: tag.tarball_url
      }));
    } catch (error) {
      throw new Error(`Failed to get tags: ${error.message}`);
    }
  }

  async getContents(owner, repo, path, ref = null) {
    try {
      const apiPath = `/repos/${owner}/${repo}/contents/${path}`;
      const query = ref ? `${apiPath}?ref=${ref}` : apiPath;
      const data = await this.request(query);
      
      if (Array.isArray(data)) {
        return data.map(item => ({
          name: item.name,
          path: item.path,
          type: item.type,
          size: item.size,
          downloadUrl: item.download_url,
          content: item.content ? Buffer.from(item.content, 'base64').toString('utf8') : null
        }));
      }
      
      return {
        name: data.name,
        path: data.path,
        type: data.type,
        size: data.size,
        downloadUrl: data.download_url,
        content: data.content ? Buffer.from(data.content, 'base64').toString('utf8') : null,
        encoding: data.encoding
      };
    } catch (error) {
      throw new Error(`Failed to get contents: ${error.message}`);
    }
  }

  async getDefaultBranch(owner, repo) {
    try {
      const data = await this.request(`/repos/${owner}/${repo}`);
      return data.default_branch;
    } catch (error) {
      throw new Error(`Failed to get default branch: ${error.message}`);
    }
  }

  findPluginAsset(assets) {
    const priorityExtensions = ['.zip', '.tar.gz', '.tgz'];
    
    for (const ext of priorityExtensions) {
      const asset = assets.find(a => a.name.toLowerCase().endsWith(ext));
      if (asset) return asset;
    }

    const priorityNames = ['plugin', 'dist', 'build', 'release'];
    for (const name of priorityNames) {
      const asset = assets.find(a => a.name.toLowerCase().includes(name));
      if (asset) return asset;
    }

    return assets[0] || null;
  }

  async getReleaseForUpload(githubUrl) {
    const parsed = this.parseRepoUrl(githubUrl);
    if (!parsed) {
      throw new Error('Invalid GitHub URL');
    }

    const { owner, repo, tag } = parsed;
    this.setRepo(owner, repo);

    let release;
    if (tag) {
      release = await this.getReleaseByTag(owner, repo, tag);
    } else {
      release = await this.getLatestRelease(owner, repo);
    }

    if (!release) {
      throw new Error('No release found');
    }

    const repoInfo = await this.getRepoInfo(owner, repo);
    
    const manifest = await this.extractManifestFromRelease(owner, repo, release);
    
    const asset = this.findPluginAsset(release.assets);

    return {
      valid: true,
      owner,
      repo,
      release: {
        tagName: release.tagName,
        name: release.name,
        body: release.body,
        htmlUrl: release.htmlUrl,
        prerelease: release.prerelease,
        publishedAt: release.publishedAt
      },
      repoInfo,
      manifest,
      asset: asset ? {
        name: asset.name,
        size: asset.size,
        downloadUrl: asset.browserDownloadUrl,
        contentType: asset.contentType
      } : null,
      downloadUrl: asset?.browserDownloadUrl || release.zipballUrl,
      version: release.tagName.replace(/^v/, '')
    };
  }

  async extractManifestFromRelease(owner, repo, release) {
    const branch = await this.getDefaultBranch(owner, repo);
    
    try {
      const contents = await this.getContents(owner, repo, 'manifest.json', branch);
      if (contents && contents.content) {
        return JSON.parse(contents.content);
      }
    } catch {}

    try {
      const contents = await this.getContents(owner, repo, 'plugin.json', branch);
      if (contents && contents.content) {
        return JSON.parse(contents.content);
      }
    } catch {}

    return null;
  }

  validateGitHubUrl(url) {
    const patterns = [
      /^https:\/\/github\.com\/[^\/]+\/[^\/]+$/,
      /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/releases$/,
      /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/releases\/tag\/[^\/]+$/,
      /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/archive\/.+$/,
      /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/tree\/[^\/]+\/.+$/
    ];
    return patterns.some(p => p.test(url));
  }

  extractTagFromUrl(url) {
    const match = url.match(/releases\/tag\/([^\/]+)/);
    return match ? match[1] : null;
  }
}

module.exports = GitHubAPI;
