'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

class PluginDownloadVerifier {
  constructor(options = {}) {
    this.tempDir = options.tempDir || path.join(require('os').tmpdir(), 'plugin-downloads');
    this.maxFileSize = options.maxFileSize || 100 * 1024 * 1024;
    this.minFileSize = options.minFileSize || 1024;
    this.timeout = options.timeout || 120000;
    this.allowedExtensions = options.allowedExtensions || ['.zip', '.tar.gz', '.tgz', '.tar'];
  }

  async ensureTempDir() {
    await fs.promises.mkdir(this.tempDir, { recursive: true });
  }

  async downloadAndVerify(url, expectedHash = null, expectedSize = null) {
    const tempFile = path.join(this.tempDir, `download-${Date.now()}${this.getExtension(url)}`);
    
    try {
      await this.download(url, tempFile);
      
      const result = await this.verify(tempFile, expectedHash, expectedSize);
      
      return {
        success: true,
        filePath: tempFile,
        ...result
      };
    } catch (error) {
      await this.cleanup(tempFile);
      throw error;
    }
  }

  async download(url, destPath) {
    await this.ensureTempDir();
    
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Agent-Orchestra-Plugin-Download/1.0',
          'Accept': 'application/octet-stream'
        }
      };

      const request = client.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.download(res.headers.location, destPath)
            .then(resolve)
            .catch(reject);
        }
        
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: Download failed`));
        }

        const contentLength = parseInt(res.headers['content-length'], 10);
        if (contentLength && contentLength > this.maxFileSize) {
          res.destroy();
          return reject(new Error(`File too large: ${contentLength} bytes (max: ${this.maxFileSize})`));
        }

        const file = fs.createWriteStream(destPath);
        let downloadedBytes = 0;
        let lastProgress = 0;

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          file.write(chunk);
          
          const progress = Math.floor((downloadedBytes / (contentLength || downloadedBytes)) * 100);
          if (progress > lastProgress + 10) {
            lastProgress = progress;
          }
        });

        res.on('end', () => {
          file.end();
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

  async verify(filePath, expectedHash = null, expectedSize = null) {
    const stats = await fs.promises.stat(filePath);
    const fileSize = stats.size;

    if (fileSize < this.minFileSize) {
      throw new Error(`File too small: ${fileSize} bytes (min: ${this.minFileSize})`);
    }

    if (fileSize > this.maxFileSize) {
      throw new Error(`File too large: ${fileSize} bytes (max: ${this.maxFileSize})`);
    }

    const verification = {
      size: fileSize,
      sizeValid: true,
      hash: null,
      hashValid: true,
      extensionValid: this.isValidExtension(filePath),
      format: this.detectFormat(filePath)
    };

    if (expectedSize !== null && fileSize !== expectedSize) {
      verification.sizeValid = false;
      verification.expectedSize = expectedSize;
      verification.actualSize = fileSize;
    }

    if (expectedHash) {
      const actualHash = await this.calculateHash(filePath);
      verification.hash = actualHash;
      verification.hashValid = this.compareHash(expectedHash, actualHash);
      verification.expectedHash = expectedHash;
    }

    return verification;
  }

  async calculateHash(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  compareHash(expected, actual) {
    const normalizedExpected = expected.toLowerCase().replace(/^sha256:/, '');
    const normalizedActual = actual.toLowerCase();
    return normalizedExpected === normalizedActual;
  }

  getExtension(url) {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    if (pathname.endsWith('.tar.gz') || pathname.endsWith('.tgz')) {
      return '.tar.gz';
    }
    
    if (pathname.endsWith('.tar')) {
      return '.tar';
    }
    
    const ext = path.extname(pathname);
    return ext || '.zip';
  }

  isValidExtension(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.allowedExtensions.some(allowed => 
      filePath.toLowerCase().endsWith(allowed) || ext === allowed
    );
  }

  detectFormat(filePath) {
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    
    try {
      fs.readSync(fd, buffer, 0, 8, 0);
    } catch {
      return 'unknown';
    } finally {
      fs.closeSync(fd);
    }

    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
      return 'zip';
    }
    
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      return 'gzip';
    }

    if (buffer[0] === 0x42 && buffer[1] === 0x5a) {
      return 'bzip2';
    }

    if (buffer[0] === 0x37 && buffer[1] === 0x7a) {
      return '7z';
    }

    return 'unknown';
  }

  async cleanup(filePath) {
    try {
      await fs.promises.unlink(filePath);
    } catch {}
  }

  async extractAndValidateManifest(archivePath, extractDir) {
    const tar = require('tar');
    const zlib = require('zlib');
    const ext = path.extname(archivePath).toLowerCase();
    const baseName = path.basename(archivePath, ext);

    await fs.promises.mkdir(extractDir, { recursive: true });

    if (ext === '.zip') {
      await this.extractZip(archivePath, extractDir);
    } else if (ext === '.gz' || archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
      await this.extractTarGz(archivePath, extractDir);
    } else if (ext === '.tar') {
      await this.extractTar(archivePath, extractDir);
    } else {
      throw new Error(`Unsupported archive format: ${ext}`);
    }

    const manifestPath = await this.findManifest(extractDir);
    if (!manifestPath) {
      throw new Error('manifest.json not found in archive');
    }

    const manifestContent = await fs.promises.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    return {
      manifest,
      manifestPath: path.relative(extractDir, manifestPath),
      rootPath: path.dirname(manifestPath)
    };
  }

  async extractZip(archivePath, destPath) {
    const zlib = require('zlib');
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
      
      const nameLength = buffer.readUInt16LE(pos + 28);
      const extraLength = buffer.readUInt16LE(pos + 30);
      const commentLength = buffer.readUInt16LE(pos + 32);
      const localHeaderOffset = buffer.readUInt32LE(pos + 42);
      
      const nameBuffer = buffer.slice(pos + 46, pos + 46 + nameLength);
      const filename = nameBuffer.toString('utf8').replace(/\\/g, '/');
      
      files.push({
        filename,
        isDirectory: filename.endsWith('/'),
        compressionMethod: buffer.readUInt16LE(pos + 10),
        compressedSize: buffer.readUInt32LE(pos + 20),
        uncompressedSize: buffer.readUInt32LE(pos + 24),
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

  async extractTarGz(archivePath, destPath) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(archivePath);
      const decompressor = zlib.createGunzip();
      const extractor = tar.extract({
        cwd: destPath,
        strip: 1
      });

      readStream.pipe(decompressor).pipe(extractor)
        .on('finish', resolve)
        .on('error', reject);
    });
  }

  async extractTar(archivePath, destPath) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(archivePath);
      const extractor = tar.extract({
        cwd: destPath,
        strip: 1
      });

      readStream.pipe(extractor)
        .on('finish', resolve)
        .on('error', reject);
    });
  }

  async findManifest(dir) {
    const candidates = ['manifest.json', 'plugin.json', 'package.json'];
    
    for (const candidate of candidates) {
      const fullPath = path.join(dir, candidate);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = path.join(dir, entry.name);
        const found = await this.findManifest(subPath);
        if (found) return found;
      }
    }

    return null;
  }
}

module.exports = PluginDownloadVerifier;
