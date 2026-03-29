'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const TEST_DATA_DIR = path.join(__dirname, '../../data/test-download-verifier');

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

async function assertThrows(fn, message) {
  let threw = false;
  let errorMessage = '';
  try {
    await fn();
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

async function setup() {
  await fs.promises.mkdir(TEST_DATA_DIR, { recursive: true });
}

async function cleanup() {
  try {
    await fs.promises.rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch {}
}

async function runTests() {
  await setup();
  console.log('\n📋 插件下载验证器模块测试\n');

  const PluginDownloadVerifier = require('../../lib/plugin-download-verifier');

  if (test('PluginDownloadVerifier - 实例化', () => {
    const verifier = new PluginDownloadVerifier();
    assert(verifier !== null, '实例应存在');
    assert(verifier.maxFileSize === 100 * 1024 * 1024, '默认最大文件大小应为 100MB');
    assert(verifier.minFileSize === 1024, '默认最小文件大小应为 1KB');
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 自定义选项', () => {
    const verifier = new PluginDownloadVerifier({
      maxFileSize: 50 * 1024 * 1024,
      minFileSize: 512,
      timeout: 60000
    });
    assert(verifier.maxFileSize === 50 * 1024 * 1024, '最大文件大小应自定义');
    assert(verifier.minFileSize === 512, '最小文件大小应自定义');
    assert(verifier.timeout === 60000, '超时应自定义');
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 获取扩展名 - 标准扩展名', () => {
    const verifier = new PluginDownloadVerifier();
    
    assertEqual(verifier.getExtension('https://example.com/file.zip'), '.zip');
    assertEqual(verifier.getExtension('https://example.com/file.tar.gz'), '.tar.gz');
    assertEqual(verifier.getExtension('https://example.com/file.tgz'), '.tar.gz');
    assertEqual(verifier.getExtension('https://example.com/file.tar'), '.tar');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 获取扩展名 - 无扩展名', () => {
    const verifier = new PluginDownloadVerifier();
    
    assertEqual(verifier.getExtension('https://example.com/file'), '.zip', '无扩展名应返回 .zip');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 验证扩展名 - 有效', () => {
    const verifier = new PluginDownloadVerifier();
    
    assert(verifier.isValidExtension('/path/to/plugin.zip') === true, '.zip 应有效');
    assert(verifier.isValidExtension('/path/to/plugin.tar.gz') === true, '.tar.gz 应有效');
    assert(verifier.isValidExtension('/path/to/plugin.tgz') === true, '.tgz 应有效');
    assert(verifier.isValidExtension('/path/to/plugin.tar') === true, '.tar 应有效');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 验证扩展名 - 无效', () => {
    const verifier = new PluginDownloadVerifier();
    
    assert(verifier.isValidExtension('/path/to/plugin.exe') === false, '.exe 应无效');
    assert(verifier.isValidExtension('/path/to/plugin.js') === false, '.js 应无效');
    assert(verifier.isValidExtension('/path/to/plugin.dll') === false, '.dll 应无效');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 检测文件格式 - ZIP', () => {
    const verifier = new PluginDownloadVerifier();
    
    const testZipPath = path.join(TEST_DATA_DIR, 'test.zip');
    const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
    fs.writeFileSync(testZipPath, zipBuffer);
    
    const format = verifier.detectFormat(testZipPath);
    assertEqual(format, 'zip');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 检测文件格式 - GZIP', () => {
    const verifier = new PluginDownloadVerifier();
    
    const testGzPath = path.join(TEST_DATA_DIR, 'test.tar.gz');
    const gzBuffer = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);
    fs.writeFileSync(testGzPath, gzBuffer);
    
    const format = verifier.detectFormat(testGzPath);
    assertEqual(format, 'gzip');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 检测文件格式 - 未知', () => {
    const verifier = new PluginDownloadVerifier();
    
    const testPath = path.join(TEST_DATA_DIR, 'test.unknown');
    const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    fs.writeFileSync(testPath, buffer);
    
    const format = verifier.detectFormat(testPath);
    assertEqual(format, 'unknown');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 计算文件哈希', async () => {
    const verifier = new PluginDownloadVerifier();
    
    const testFilePath = path.join(TEST_DATA_DIR, 'hash-test.txt');
    fs.writeFileSync(testFilePath, 'Hello World');
    
    const hash = await verifier.calculateHash(testFilePath);
    assert(hash === 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e', 'SHA256 应正确');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 比较哈希', () => {
    const verifier = new PluginDownloadVerifier();
    
    assert(verifier.compareHash('abc123', 'abc123') === true, '相同哈希应匹配');
    assert(verifier.compareHash('abc123', 'ABC123') === true, '大小写应不敏感');
    assert(verifier.compareHash('SHA256:abc123', 'abc123') === true, '应忽略前缀');
    assert(verifier.compareHash('abc123', 'xyz789') === false, '不同哈希不应匹配');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 验证文件大小 - 有效', async () => {
    const verifier = new PluginDownloadVerifier({ minFileSize: 100, maxFileSize: 10000 });
    
    const testFilePath = path.join(TEST_DATA_DIR, 'size-valid.txt');
    fs.writeFileSync(testFilePath, 'x'.repeat(500));
    
    const result = await verifier.verify(testFilePath);
    assert(result.sizeValid === true, '大小应在有效范围内');
    assert(result.size === 500, '文件大小应正确');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 验证文件大小 - 太小', async () => {
    const verifier = new PluginDownloadVerifier({ minFileSize: 100 });
    
    const testFilePath = path.join(TEST_DATA_DIR, 'size-small.txt');
    fs.writeFileSync(testFilePath, 'x'.repeat(50));
    
    const errorMsg = await assertThrows(async () => {
      await verifier.verify(testFilePath);
    }, '文件太小时应抛出异常');
    assert(errorMsg.includes('too small'), '错误信息应包含 too small');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 验证文件大小 - 太大', async () => {
    const verifier = new PluginDownloadVerifier({ minFileSize: 10, maxFileSize: 100 });
    
    const testFilePath = path.join(TEST_DATA_DIR, 'size-large.txt');
    fs.writeFileSync(testFilePath, 'x'.repeat(200));
    
    const errorMsg = await assertThrows(async () => {
      await verifier.verify(testFilePath);
    }, '文件太大时应抛出异常');
    assert(errorMsg.includes('too large'), '错误信息应包含 too large');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 验证哈希', async () => {
    const verifier = new PluginDownloadVerifier({ minFileSize: 10, maxFileSize: 10000 });
    
    const testFilePath = path.join(TEST_DATA_DIR, 'hash-verify.txt');
    fs.writeFileSync(testFilePath, 'Hello World');
    const expectedHash = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';
    
    const result = await verifier.verify(testFilePath, expectedHash);
    assert(result.hashValid === true, '哈希应匹配');
    assert(result.hash === expectedHash, '计算出的哈希应正确');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 验证哈希 - 不匹配', async () => {
    const verifier = new PluginDownloadVerifier({ minFileSize: 10, maxFileSize: 10000 });
    
    const testFilePath = path.join(TEST_DATA_DIR, 'hash-mismatch.txt');
    fs.writeFileSync(testFilePath, 'Hello World');
    const wrongHash = 'wronghash123456789';
    
    const result = await verifier.verify(testFilePath, wrongHash);
    assert(result.hashValid === false, '哈希不应匹配');
    
    passed++;
  })) {} else { failed++; }

  if (test('PluginDownloadVerifier - 完整验证', async () => {
    const verifier = new PluginDownloadVerifier({ minFileSize: 10, maxFileSize: 10000 });
    
    const testFilePath = path.join(TEST_DATA_DIR, 'full-verify.txt');
    const content = 'Test Content';
    fs.writeFileSync(testFilePath, content);
    const hash = await verifier.calculateHash(testFilePath);
    
    const result = await verifier.verify(testFilePath, hash, Buffer.byteLength(content));
    
    assert(result.success === undefined, 'success 字段不在验证结果中');
    assert(result.sizeValid === true, '大小应有效');
    assert(result.hashValid === true, '哈希应有效');
    assert(result.extensionValid === true, '扩展名应有效');
    assert(result.format === 'unknown', '格式应正确');
    
    passed++;
  })) {} else { failed++; }

  await cleanup();

  console.log('\n📋 插件下载验证器扩展名过滤测试\n');

  if (test('PluginDownloadVerifier - 自定义允许扩展名', () => {
    const verifier = new PluginDownloadVerifier({
      allowedExtensions: ['.7z', '.rar']
    });
    
    assert(verifier.isValidExtension('/path/to/plugin.7z') === true, '.7z 应有效');
    assert(verifier.isValidExtension('/path/to/plugin.rar') === true, '.rar 应有效');
    assert(verifier.isValidExtension('/path/to/plugin.zip') === false, '.zip 应无效');
    
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
