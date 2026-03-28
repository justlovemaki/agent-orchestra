'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const tar = require('tar');
const crypto = require('crypto');

class PluginInstaller {
  constructor(pluginsDir, options = {}) {
    this.pluginsDir = pluginsDir;
    this.tempDir = options.tempDir || path.join(require('os').tmpdir(), 'plugin-installs');
    this.downloadTimeout = options.downloadTimeout || 60000;
    this.maxConcurrent = options.maxConcurrent || 3;
    this.eventEmitter = options.eventEmitter || null;
  }

  async ensureTempDir() {
    await fs.promises.mkdir(this.tempDir, { recursive: true });
  }

  async downloadPlugin(pluginUrl, destPath) {
    await this.ensureTempDir();
    
    return new Promise((resolve, reject) => {
      const client = pluginUrl.startsWith('https') ? https : http;
      const urlObj = new URL(pluginUrl);
      
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: this.downloadTimeout,
        headers: {
          'User-Agent': 'Agent-Orchestra-Plugin-Installer/1.0'
        }
      };

      const request = client.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.downloadPlugin(res.headers.location, destPath)
            .then(resolve)
            .catch(reject);
        }
        
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: Failed to download plugin`));
        }

        const file = fs.createWriteStream(destPath);
        let downloadedBytes = 0;
        
        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          this.emit('downloadProgress', { url: pluginUrl, bytes: downloadedBytes });
        });

        res.pipe(file);
        
        file.on('finish', () => {
          file.close();
          this.emit('downloadComplete', { url: pluginUrl, destPath });
          resolve(destPath);
        });

        file.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        fs.unlink(destPath, () => {});
        reject(new Error('Download timeout'));
      });

      request.end();
    });
  }

  async extractPlugin(archivePath, destPath) {
    const ext = path.extname(archivePath).toLowerCase();
    const baseName = path.basename(archivePath, ext);
    
    await fs.promises.mkdir(destPath, { recursive: true });
    
    this.emit('extractStart', { archivePath, destPath });

    try {
      if (ext === '.zip') {
        await this.extractZip(archivePath, destPath);
      } else if (ext === '.gz' || baseName.endsWith('.tar')) {
        await this.extractTar(archivePath, destPath);
      } else {
        throw new Error(`Unsupported archive format: ${ext}`);
      }

      this.emit('extractComplete', { archivePath, destPath });
      return destPath;
    } catch (error) {
      this.emit('extractError', { archivePath, destPath, error: error.message });
      throw error;
    }
  }

  async extractZip(archivePath, destPath) {
    return new Promise((resolve, reject) => {
      const zlib = require('zlib');
      const fs = require('fs');
      
      const buffer = fs.readFileSync(archivePath);
      const centralDirectory = this.parseZipCentralDirectory(buffer);
      
      for (const file of centralDirectory) {
        const filePath = path.join(destPath, file.filename);
        
        if (file.isDirectory) {
          fs.mkdirSync(filePath, { recursive: true });
        } else {
          const fileDir = path.dirname(filePath);
          if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
          }
          
          const compressed = buffer.slice(file.compressedStart, file.compressedStart + file.compressedSize);
          let decompressed;
          
          if (file.compressionMethod === 0) {
            decompressed = compressed;
          } else if (file.compressionMethod === 8) {
            decompressed = zlib.inflateRawSync(compressed);
          } else {
            decompressed = zlib.unzipSync(compressed);
          }
          
          fs.writeFileSync(filePath, decompressed);
        }
      }
      
      resolve();
    });
  }

  parseZipCentralDirectory(buffer) {
    const files = [];
    const signature = buffer.readUInt32LE(buffer.length - 4);
    
    if (signature !== 0x06054b50) {
      throw new Error('Invalid ZIP file: end of central directory not found');
    }
    
    const numEntries = buffer.readUInt16LE(buffer.length - 6);
    const centralDirSize = buffer.readUInt32LE(buffer.length - 12);
    const centralDirOffset = buffer.readUInt32LE(buffer.length - 16);
    
    let pos = centralDirOffset;
    for (let i = 0; i < numEntries; i++) {
      if (buffer.readUInt32LE(pos) !== 0x02014b50) break;
      
      const versionMade = buffer.readUInt16LE(pos + 4);
      const versionNeeded = buffer.readUInt16LE(pos + 6);
      const flags = buffer.readUInt16LE(pos + 8);
      const compressionMethod = buffer.readUInt16LE(pos + 10);
      const crc32 = buffer.readUInt32LE(pos + 16);
      const compressedSize = buffer.readUInt32LE(pos + 20);
      const uncompressedSize = buffer.readUInt32LE(pos + 24);
      const nameLength = buffer.readUInt16LE(pos + 28);
      const extraLength = buffer.readUInt16LE(pos + 30);
      const commentLength = buffer.readUInt16LE(pos + 32);
      const localHeaderOffset = buffer.readUInt32LE(pos + 42);
      
      const nameBuffer = buffer.slice(pos + 46, pos + 46 + nameLength);
      const filename = nameBuffer.toString('utf8').replace(/\\/g, '/');
      
      files.push({
        filename,
        isDirectory: filename.endsWith('/'),
        compressionMethod,
        compressedSize,
        uncompressedSize,
        compressedStart: this.getLocalFileHeaderOffset(buffer, localHeaderOffset, filename)
      });
      
      pos += 46 + nameLength + extraLength + commentLength;
    }
    
    return files;
  }

  getLocalFileHeaderOffset(buffer, localHeaderOffset, filename) {
    let pos = localHeaderOffset;
    
    if (buffer.readUInt32LE(pos) !== 0x04034b50) return 0;
    
    const nameLength = buffer.readUInt16LE(pos + 26);
    const extraLength = buffer.readUInt16LE(pos + 28);
    
    return pos + 30 + nameLength + extraLength;
  }

  async extractTar(archivePath, destPath) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(archivePath);
      let decompressor;
      
      if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
        decompressor = zlib.createGunzip();
      } else if (archivePath.endsWith('.tar')) {
        decompressor = null;
      } else {
        decompressor = zlib.createGunzip();
      }

      const extractor = tar.extract({
        cwd: destPath,
        strip: 1
      });

      if (decompressor) {
        readStream.pipe(decompressor).pipe(extractor).on('finish', resolve).on('error', reject);
      } else {
        readStream.pipe(extractor).on('finish', resolve).on('error', reject);
      }
    });
  }

  async installPlugin(pluginId, userId, options = {}) {
    const { downloadUrl, marketDataPath, onProgress } = options;
    
    if (!downloadUrl) {
      throw new Error('Download URL is required');
    }

    const marketData = await this.loadMarketData(marketDataPath);
    const plugin = marketData.plugins.find(p => p.id === pluginId);
    
    if (!plugin) {
      throw new Error(`Plugin not found in marketplace: ${pluginId}`);
    }

    if (plugin.status !== 'approved') {
      throw new Error('Plugin is not approved for installation');
    }

    const pluginName = plugin.name;
    const targetDir = path.join(this.pluginsDir, pluginName);
    const tempFile = path.join(this.tempDir, `${pluginName}-${Date.now()}.tar.gz`);

    try {
      this.emit('installStart', { pluginId, pluginName, userId });

      await this.downloadPlugin(downloadUrl, tempFile);

      const extractDir = path.join(this.tempDir, `extract-${Date.now()}`);
      await this.extractPlugin(tempFile, extractDir);

      const manifestPath = path.join(extractDir, 'manifest.json');
      const validation = await this.validatePlugin(extractDir);
      if (!validation.valid) {
        throw new Error(`Plugin validation failed: ${validation.error}`);
      }

      if (fs.existsSync(targetDir)) {
        await this.backupPlugin(pluginName);
        await fs.promises.rm(targetDir, { recursive: true, force: true });
      }

      await fs.promises.rename(extractDir, targetDir);

      await this.registerPluginInstallation(pluginName, userId, plugin, marketDataPath);

      await fs.promises.unlink(tempFile).catch(() => {});

      this.emit('installComplete', { pluginId, pluginName, userId });

      return {
        success: true,
        pluginName,
        version: plugin.version,
        message: `Plugin ${pluginName} installed successfully`
      };
    } catch (error) {
      this.emit('installError', { pluginId, pluginName, userId, error: error.message });
      await fs.promises.unlink(tempFile).catch(() => {});
      throw error;
    }
  }

  async updatePlugin(pluginName, userId, options = {}) {
    const { marketDataPath, downloadUrl, newVersion } = options;

    const pluginDir = path.join(this.pluginsDir, pluginName);
    if (!fs.existsSync(pluginDir)) {
      throw new Error(`Plugin not installed: ${pluginName}`);
    }

    const validation = await this.validatePlugin(pluginDir);
    if (!validation.valid) {
      throw new Error(`Current plugin validation failed: ${validation.error}`);
    }

    const currentVersion = validation.manifest.version;
    const marketData = await this.loadMarketData(marketDataPath);
    const marketPlugin = marketData.plugins.find(p => p.name === pluginName);
    
    if (!marketPlugin) {
      throw new Error(`Plugin not found in marketplace: ${pluginName}`);
    }

    const latestVersion = newVersion || marketPlugin.version;
    if (!this.compareVersions(currentVersion, latestVersion)) {
      throw new Error(`Plugin is already at latest version: ${currentVersion}`);
    }

    const targetDownloadUrl = downloadUrl || marketPlugin.downloadUrl;
    if (!targetDownloadUrl) {
      throw new Error('No download URL available for update');
    }

    const installResult = await this.installPlugin(marketPlugin.id, userId, {
      downloadUrl: targetDownloadUrl,
      marketDataPath
    });

    return {
      success: true,
      pluginName,
      previousVersion: currentVersion,
      newVersion: latestVersion,
      message: `Plugin updated from ${currentVersion} to ${latestVersion}`
    };
  }

  async validatePlugin(pluginPath) {
    const manifestPath = path.join(pluginPath, 'manifest.json');
    
    try {
      await fs.promises.access(manifestPath);
    } catch {
      return { valid: false, error: 'manifest.json not found' };
    }

    try {
      const content = await fs.promises.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(content);

      const required = ['name', 'version', 'type', 'description', 'author'];
      for (const field of required) {
        if (!manifest[field]) {
          return { valid: false, error: `Missing required field: ${field}` };
        }
      }

      if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
        return { valid: false, error: 'Invalid version format (expected x.y.z)' };
      }

      const validTypes = ['panel', 'notification', 'datasource'];
      if (!validTypes.includes(manifest.type)) {
        return { valid: false, error: `Invalid plugin type: ${manifest.type}` };
      }

      const indexPath = path.join(pluginPath, 'index.js');
      try {
        await fs.promises.access(indexPath);
      } catch {
        return { valid: false, error: 'index.js not found' };
      }

      return { valid: true, manifest };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async uninstallPlugin(pluginName, userId, options = {}) {
    const { marketDataPath, keepBackup = true } = options;
    
    const pluginDir = path.join(this.pluginsDir, pluginName);
    if (!fs.existsSync(pluginDir)) {
      throw new Error(`Plugin not installed: ${pluginName}`);
    }

    const validation = await this.validatePlugin(pluginDir);
    if (!validation.valid) {
      throw new Error(`Cannot uninstall invalid plugin: ${validation.error}`);
    }

    if (!keepBackup) {
      await this.removePluginBackup(pluginName);
    }

    await fs.promises.rm(pluginDir, { recursive: true, force: true });

    await this.unregisterPluginInstallation(pluginName, userId, marketDataPath);

    this.emit('uninstallComplete', { pluginName, userId });

    return {
      success: true,
      pluginName,
      message: `Plugin ${pluginName} uninstalled successfully`
    };
  }

  async loadMarketData(marketDataPath) {
    const dataPath = marketDataPath || path.join(__dirname, '..', 'data', 'plugins-marketplace.json');
    
    try {
      const content = await fs.promises.readFile(dataPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load market data: ${error.message}`);
    }
  }

  async registerPluginInstallation(pluginName, userId, plugin, marketDataPath) {
    const installedPath = path.join(__dirname, '..', 'data', 'installed-plugins.json');
    
    let installed = {};
    try {
      const content = await fs.promises.readFile(installedPath, 'utf8');
      installed = JSON.parse(content);
    } catch {}

    if (!installed[userId]) {
      installed[userId] = [];
    }

    const existingIdx = installed[userId].findIndex(p => p.pluginName === pluginName);
    const record = {
      pluginId: plugin.id,
      pluginName: plugin.name,
      version: plugin.version,
      installedAt: Date.now(),
      marketplaceId: plugin.id
    };

    if (existingIdx >= 0) {
      installed[userId][existingIdx] = record;
    } else {
      installed[userId].push(record);
    }

    await fs.promises.writeFile(installedPath, JSON.stringify(installed, null, 2));
  }

  async unregisterPluginInstallation(pluginName, userId, marketDataPath) {
    const installedPath = path.join(__dirname, '..', 'data', 'installed-plugins.json');
    
    try {
      const content = await fs.promises.readFile(installedPath, 'utf8');
      const installed = JSON.parse(content);

      if (installed[userId]) {
        installed[userId] = installed[userId].filter(p => p.pluginName !== pluginName);
        await fs.promises.writeFile(installedPath, JSON.stringify(installed, null, 2));
      }
    } catch (error) {
      throw new Error(`Failed to unregister plugin: ${error.message}`);
    }
  }

  async backupPlugin(pluginName) {
    const pluginDir = path.join(this.pluginsDir, pluginName);
    const backupDir = path.join(this.pluginsDir, '.backups');
    
    await fs.promises.mkdir(backupDir, { recursive: true });
    
    const backupPath = path.join(backupDir, `${pluginName}-${Date.now()}.tar.gz`);
    
    return new Promise((resolve, reject) => {
      const archive = tar.create({ gzip: true }, [pluginName]);
      const writeStream = fs.createWriteStream(backupPath);
      
      archive.pipe(writeStream);
      archive.on('finish', () => {
        this.emit('backupCreated', { pluginName, backupPath });
        resolve(backupPath);
      });
      archive.on('error', reject);
    });
  }

  async removePluginBackup(pluginName) {
    const backupDir = path.join(this.pluginsDir, '.backups');
    
    try {
      const files = await fs.promises.readdir(backupDir);
      const matching = files.filter(f => f.startsWith(pluginName));
      
      for (const file of matching) {
        await fs.promises.unlink(path.join(backupDir, file));
      }
    } catch {}
  }

  compareVersions(v1, v2) {
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

  emit(event, data) {
    if (this.eventEmitter) {
      this.eventEmitter.emit(event, data);
    }
    console.log(`[PluginInstaller] ${event}:`, data);
  }
}

module.exports = PluginInstaller;
