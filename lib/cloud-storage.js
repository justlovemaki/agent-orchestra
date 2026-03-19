// lib/cloud-storage.js - S3 兼容云存储客户端
// 支持阿里云 OSS、AWS S3、MinIO 等 S3 兼容存储

const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../data/cloud-storage-config.json');

/**
 * 云存储配置数据结构
 * {
 *   provider: 'oss' | 's3' | 'minio',
 *   bucket: string,
 *   region: string,
 *   endpoint: string,
 *   accessKeyId: string,
 *   accessKeySecret: string,
 *   enabled: boolean,
 *   retentionDays: number
 * }
 */

let s3Client = null;
let cloudConfig = null;

/**
 * 获取云存储配置
 */
function getCloudConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      cloudConfig = JSON.parse(data);
      return cloudConfig;
    }
  } catch (error) {
    console.error('[CloudStorage] Failed to load config:', error.message);
  }
  
  // 默认配置
  cloudConfig = {
    provider: 'oss',
    bucket: '',
    region: 'oss-cn-hangzhou',
    endpoint: '',
    accessKeyId: '',
    accessKeySecret: '',
    enabled: false,
    retentionDays: 30
  };
  return cloudConfig;
}

/**
 * 保存云存储配置
 */
function saveCloudConfig(config) {
  try {
    // 读取时不返回敏感信息，但保存时需要完整保存
    cloudConfig = { ...config };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cloudConfig, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('[CloudStorage] Failed to save config:', error.message);
    return false;
  }
}

/**
 * 初始化 S3 客户端
 */
function initS3Client() {
  if (!cloudConfig || !cloudConfig.enabled) {
    return null;
  }

  const config = getCloudConfig();
  
  // 构建 S3 客户端配置
  const clientConfig = {
    region: config.region || 'us-east-1',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.accessKeySecret
    }
  };

  // 自定义 endpoint（用于 OSS/MinIO）
  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
    // 强制使用路径样式寻址（MinIO 需要）
    clientConfig.forcePathStyle = true;
  }

  s3Client = new S3Client(clientConfig);
  return s3Client;
}

/**
 * 上传文件到云存储
 * @param {string} localPath - 本地文件路径
 * @param {string} cloudKey - 云端存储键（文件名）
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function uploadFile(localPath, cloudKey) {
  try {
    const client = s3Client || initS3Client();
    if (!client) {
      return { success: false, error: 'Cloud storage not configured' };
    }

    const config = getCloudConfig();
    const fileContent = fs.readFileSync(localPath);
    
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: cloudKey,
      Body: fileContent,
      ContentType: 'application/json'
    });

    await client.send(command);
    console.log(`[CloudStorage] Uploaded ${cloudKey} to ${config.bucket}`);
    return { success: true };
  } catch (error) {
    console.error('[CloudStorage] Upload failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 从云存储下载文件
 * @param {string} cloudKey - 云端存储键
 * @param {string} localPath - 本地保存路径
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function downloadFile(cloudKey, localPath) {
  try {
    const client = s3Client || initS3Client();
    if (!client) {
      return { success: false, error: 'Cloud storage not configured' };
    }

    const config = getCloudConfig();
    
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: cloudKey
    });

    const response = await client.send(command);
    const fileContent = await streamToBuffer(response.Body);
    
    fs.writeFileSync(localPath, fileContent);
    console.log(`[CloudStorage] Downloaded ${cloudKey} to ${localPath}`);
    return { success: true };
  } catch (error) {
    console.error('[CloudStorage] Download failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 列出云端备份文件
 * @param {string} prefix - 文件名前缀（可选）
 * @returns {Promise<{success: boolean, files?: Array, error?: string}>}
 */
async function listFiles(prefix = 'backups/') {
  try {
    const client = s3Client || initS3Client();
    if (!client) {
      return { success: false, error: 'Cloud storage not configured' };
    }

    const config = getCloudConfig();
    
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix
    });

    const response = await client.send(command);
    const files = (response.Contents || []).map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified
    }));

    return { success: true, files };
  } catch (error) {
    console.error('[CloudStorage] List failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 删除云端文件
 * @param {string} cloudKey - 云端存储键
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteFile(cloudKey) {
  try {
    const client = s3Client || initS3Client();
    if (!client) {
      return { success: false, error: 'Cloud storage not configured' };
    }

    const config = getCloudConfig();
    
    const command = new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: cloudKey
    });

    await client.send(command);
    console.log(`[CloudStorage] Deleted ${cloudKey} from ${config.bucket}`);
    return { success: true };
  } catch (error) {
    console.error('[CloudStorage] Delete failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 将流转换为 Buffer
 */
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * 测试云存储连接
 */
async function testConnection() {
  try {
    const client = s3Client || initS3Client();
    if (!client) {
      return { success: false, error: 'Cloud storage not configured' };
    }

    const config = getCloudConfig();
    
    // 尝试列出文件来测试连接
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      MaxKeys: 1
    });

    await client.send(command);
    return { success: true };
  } catch (error) {
    console.error('[CloudStorage] Connection test failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 重置客户端（配置更改后调用）
 */
function resetClient() {
  s3Client = null;
  cloudConfig = null;
}

module.exports = {
  getCloudConfig,
  saveCloudConfig,
  initS3Client,
  uploadFile,
  downloadFile,
  listFiles,
  deleteFile,
  testConnection,
  resetClient
};
