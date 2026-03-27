/**
 * 数据库抽象层单元测试
 * 测试 JSON 和 SQLite 两种存储后端
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const TEST_DATA_DIR = path.join(ROOT, 'test-data-temp');

async function setup() {
  try {
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  } catch (e) {}
}

async function cleanup() {
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch (e) {}
}

function generateId() {
  return crypto.randomUUID();
}

function setBackend(backend) {
  process.env.STORAGE_BACKEND = backend;
  delete require.cache[require.resolve('./database.js')];
  return require('./database.js');
}

describe('Database Abstraction Layer', function() {
  this.timeout(10000);
  
  before(setup);
  after(cleanup);
  
  describe('JSON Mode', function() {
    let db;
    
    beforeEach(function() {
      db = setBackend('json');
    });
    
    afterEach(async function() {
      const dataDir = db.getDataDir();
      const testFiles = Object.values(db.FILE_MAPPINGS);
      for (const file of testFiles) {
        try {
          await fs.unlink(path.join(dataDir, file));
        } catch (e) {}
      }
    });
    
    it('should get data directory', function() {
      assert.ok(db.getDataDir().endsWith('data'));
    });
    
    it('should get current backend type', function() {
      assert.strictEqual(db.getBackend(), 'json');
    });
    
    it('should insert and find a user', async function() {
      const userId = generateId();
      const testUser = {
        id: userId,
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        createdAt: Date.now()
      };
      await db.insertOne('users', testUser);
      const found = await db.findOne('users', { id: userId });
      assert.strictEqual(found.id, userId);
      assert.strictEqual(found.name, 'Test User');
    });
    
    it('should insert multiple records and find many', async function() {
      const id1 = generateId();
      const id2 = generateId();
      const id3 = generateId();
      await db.insertOne('users', { id: id1, name: 'User1', createdAt: Date.now() });
      await db.insertOne('users', { id: id2, name: 'User2', createdAt: Date.now() });
      await db.insertOne('users', { id: id3, name: 'User3', createdAt: Date.now() });
      
      const allUsers = await db.findMany('users');
      assert.strictEqual(allUsers.length, 3);
    });
    
    it('should update a record', async function() {
      const userId = generateId();
      await db.insertOne('users', { id: userId, name: 'Original', createdAt: Date.now() });
      await db.updateOne('users', { id: userId }, { name: 'Updated Name' });
      
      const updated = await db.findOne('users', { id: userId });
      assert.strictEqual(updated.name, 'Updated Name');
    });
    
    it('should update multiple records', async function() {
      const id1 = generateId();
      const id2 = generateId();
      await db.insertOne('users', { id: id1, role: 'user', status: 'pending' });
      await db.insertOne('users', { id: id2, role: 'user', status: 'pending' });
      await db.updateMany('users', { role: 'user' }, { status: 'active' });
      
      const all = await db.findMany('users');
      assert.strictEqual(all[0].status, 'active');
      assert.strictEqual(all[1].status, 'active');
    });
    
    it('should delete a record', async function() {
      const userId = generateId();
      await db.insertOne('users', { id: userId, name: 'Test', createdAt: Date.now() });
      await db.deleteOne('users', { id: userId });
      
      const found = await db.findOne('users', { id: userId });
      assert.strictEqual(found, null);
    });
    
    it('should delete multiple records', async function() {
      const id1 = generateId();
      const id2 = generateId();
      await db.insertOne('users', { id: id1, role: 'user' });
      await db.insertOne('users', { id: id2, role: 'user' });
      await db.deleteMany('users', { role: 'user' });
      
      const remaining = await db.findMany('users');
      assert.strictEqual(remaining.length, 0);
    });
    
    it('should count records', async function() {
      const id1 = generateId();
      const id2 = generateId();
      await db.insertOne('users', { id: id1, name: 'User1', createdAt: Date.now() });
      await db.insertOne('users', { id: id2, name: 'User2', createdAt: Date.now() });
      
      const count = await db.count('users');
      assert.strictEqual(count, 2);
    });
    
    it('should support query filters', async function() {
      const id1 = generateId();
      const id2 = generateId();
      await db.insertOne('users', { id: id1, role: 'user' });
      await db.insertOne('users', { id: id2, role: 'admin' });
      
      const admins = await db.findMany('users', { role: 'admin' });
      assert.strictEqual(admins.length, 1);
      assert.strictEqual(admins[0].role, 'admin');
    });
    
    it('should support limit and offset', async function() {
      for (let i = 1; i <= 5; i++) {
        await db.insertOne('users', { id: generateId(), name: 'User' + i, createdAt: Date.now() + i });
      }
      
      const limited = await db.findMany('users', {}, { limit: 2 });
      assert.strictEqual(limited.length, 2);
      
      const offset = await db.findMany('users', {}, { limit: 2, offset: 2 });
      assert.strictEqual(offset.length, 2);
    });
    
    it('should support sorting', async function() {
      await db.insertOne('users', { id: generateId(), name: 'A', createdAt: 1000 });
      await db.insertOne('users', { id: generateId(), name: 'C', createdAt: 3000 });
      await db.insertOne('users', { id: generateId(), name: 'B', createdAt: 2000 });
      
      const ascending = await db.findMany('users', {}, { sort: 1, sortBy: 'createdAt' });
      assert.strictEqual(ascending[0].createdAt, 1000);
      
      const descending = await db.findMany('users', {}, { sort: -1, sortBy: 'createdAt' });
      assert.strictEqual(descending[0].createdAt, 3000);
    });
    
    it('should return null for non-existent findOne', async function() {
      const found = await db.findOne('users', { id: 'non-existent' });
      assert.strictEqual(found, null);
    });
    
    it('should handle empty collections', async function() {
      const all = await db.findMany('users');
      assert.strictEqual(all.length, 0);
      
      const cnt = await db.count('users');
      assert.strictEqual(cnt, 0);
    });
  });
  
  describe('SQLite Mode', function() {
    let db;
    
    beforeEach(function() {
      const testDbPath = path.join(ROOT, 'data', 'test-' + Date.now() + '-' + Math.random() + '.db');
      process.env.SQLITE_DB_PATH = testDbPath;
      db = setBackend('sqlite');
    });
    
    afterEach(function() {
      if (db) {
        db.close();
      }
      const testDbPath = process.env.SQLITE_DB_PATH;
      if (testDbPath) {
        try {
          require('fs').unlinkSync(testDbPath);
        } catch (e) {}
      }
    });
    
    it('should get sqlite backend type', function() {
      assert.strictEqual(db.getBackend(), 'sqlite');
    });
    
    it('should insert and find a user in SQLite', async function() {
      const userId = generateId();
      const testUser = {
        id: userId,
        name: 'SQLite User ' + Date.now(),
        passwordHash: 'hash123',
        role: 'user',
        createdAt: Date.now()
      };
      await db.insertOne('users', testUser);
      const found = await db.findOne('users', { id: userId });
      assert.strictEqual(found.id, userId);
      assert.strictEqual(found.name, testUser.name);
    });
    
    it('should update a record in SQLite', async function() {
      const userId = generateId();
      const userName = 'Update Test ' + Date.now();
      await db.insertOne('users', {
        id: userId,
        name: userName,
        passwordHash: 'hash123',
        createdAt: Date.now()
      });
      await db.updateOne('users', { id: userId }, { name: 'Updated Name' });
      
      const updated = await db.findOne('users', { id: userId });
      assert.strictEqual(updated.name, 'Updated Name');
    });
    
    it('should delete a record in SQLite', async function() {
      const userId = generateId();
      await db.insertOne('users', {
        id: userId,
        name: 'Delete Test ' + Date.now(),
        passwordHash: 'hash123',
        createdAt: Date.now()
      });
      await db.deleteOne('users', { id: userId });
      
      const found = await db.findOne('users', { id: userId });
      assert.strictEqual(found, null);
    });
    
    it('should count records in SQLite', async function() {
      const id1 = generateId();
      const id2 = generateId();
      await db.insertOne('users', { id: id1, name: 'User1', passwordHash: 'hash1', createdAt: Date.now() });
      await db.insertOne('users', { id: id2, name: 'User2', passwordHash: 'hash2', createdAt: Date.now() });
      
      const cnt = await db.count('users');
      assert.strictEqual(cnt, 2);
    });
    
    it('should support transactions', async function() {
      const result = await db.transaction(async () => {
        await db.insertOne('users', { id: generateId(), name: 'Trans1', passwordHash: 'h1', createdAt: Date.now() });
        await db.insertOne('users', { id: generateId(), name: 'Trans2', passwordHash: 'h2', createdAt: Date.now() });
        return { success: true };
      });
      
      assert.strictEqual(result.success, true);
      
      const cnt = await db.count('users');
      assert.strictEqual(cnt, 2);
    });
    
    it('should get database instance', function() {
      const instance = db.getDb();
      assert.ok(instance !== null);
    });
    
    it('should handle JSON fields', function() {
      const testObj = { key: 'value', nested: { a: 1 } };
      const jsonStr = db.stringifyJsonField(testObj);
      const parsed = db.parseJsonField(jsonStr);
      assert.deepStrictEqual(parsed, testObj);
      
      const nullResult = db.parseJsonField(null);
      assert.strictEqual(nullResult, null);
    });
  });
  
  describe('Collection Mappings', function() {
    it('should have correct file mappings', function() {
      const db = setBackend('json');
      assert.strictEqual(db.FILE_MAPPINGS.users, 'users.json');
      assert.strictEqual(db.FILE_MAPPINGS.tasks, 'tasks.json');
      assert.strictEqual(db.FILE_MAPPINGS.workflows, 'workflows.json');
      assert.strictEqual(db.FILE_MAPPINGS.notifications, 'notifications.json');
      assert.strictEqual(db.FILE_MAPPINGS.auditLogs, 'audit-events.json');
      assert.strictEqual(db.FILE_MAPPINGS.agentGroups, 'agent-groups.json');
    });
  });
  
  describe('Error Handling', function() {
    it('should throw error for unknown collection in JSON mode', async function() {
      const db = setBackend('json');
      try {
        await db.findOne('unknownCollection', { id: 'test' });
        assert.fail('Should have thrown error');
      } catch (e) {
        assert.ok(e.message.includes('Unknown collection'));
      }
    });
    
    it('should throw error for transactions in JSON mode', async function() {
      const db = setBackend('json');
      try {
        await db.transaction(async () => {});
        assert.fail('Should have thrown error');
      } catch (e) {
        assert.ok(e.message.includes('Transactions are only supported'));
      }
    });
    
    it('should handle delete of non-existent record', async function() {
      const db = setBackend('json');
      const result = await db.deleteOne('users', { id: 'non-existent' });
      assert.strictEqual(result.changes, 0);
    });
    
    it('should handle update of non-existent record', async function() {
      const db = setBackend('json');
      const result = await db.updateOne('users', { id: 'non-existent' }, { name: 'Test' });
      assert.strictEqual(result.changes, 0);
    });
  });
});