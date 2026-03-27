/**
 * 数据库抽象层模块
 * 提供统一的 CRUD 接口，支持 JSON（默认）和 SQLite 两种存储后端
 * 通过环境变量 STORAGE_BACKEND 切换（json 或 sqlite）
 */

const fs = require('fs').promises;
const path = require('path');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const SQLite = require('better-sqlite3');

const STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'json';

let db = null;
let jsonCache = {};

const FILE_MAPPINGS = {
  users: 'users.json',
  tokens: 'tokens.json',
  tasks: 'tasks.json',
  sessions: 'sessions.json',
  workflows: 'workflows.json',
  workflowRuns: 'workflow-runs.json',
  notifications: 'notifications.json',
  agentCombinations: 'agent-combinations.json',
  plugins: 'plugins.json',
  auditLogs: 'audit-events.json',
  agentGroups: 'agent-groups.json',
  notificationChannels: 'notification-channels.json',
  userGroups: 'user-groups.json',
  presets: 'presets.json',
  templates: 'templates.json',
  quietHoursConfig: 'quiet-hours-config.json',
  quietHoursQueue: 'quiet-hours-queue.json',
  scheduledBackupConfig: 'scheduled-backup-config.json',
  scheduledBackupHistory: 'scheduled-backup-history.json',
  notificationHistory: 'notification-history.json',
  notificationTemplates: 'notification-templates.json',
  runtime: 'runtime.json'
};

/**
 * 初始化数据库连接（SQLite 模式）
 */
function initSQLite() {
  if (db) return db;
  
  const dbPath = process.env.SQLITE_DB_PATH || path.join(DATA_DIR, 'agent-orchestra.db');
  db = new SQLite(dbPath);
  db.pragma('journal_mode = WAL');
  
  const schemaPath = path.join(DATA_DIR, 'schema.sql');
  const schema = require('fs').readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  
  return db;
}

/**
 * 获取数据目录路径
 * @returns {string} 数据目录路径
 */
function getDataDir() {
  return DATA_DIR;
}

/**
 * 切换存储后端
 * @param {string} backend - 存储后端类型 ('json' 或 'sqlite')
 */
function setBackend(backend) {
  if (backend === 'sqlite') {
    initSQLite();
  } else {
    if (db) {
      db.close();
      db = null;
    }
  }
}

/**
 * 获取当前存储后端类型
 * @returns {string} 当前存储后端类型
 */
function getBackend() {
  return STORAGE_BACKEND;
}

/**
 * JSON 模式：确保数据文件存在
 * @param {string} filePath - 文件路径
 */
async function ensureJsonFile(filePath) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, '[]\n');
  }
}

/**
 * JSON 模式：读取 JSON 文件
 * @param {string} collection - 集合名称
 * @returns {Promise<Array>} 数据数组
 */
async function jsonRead(collection) {
  const fileName = FILE_MAPPINGS[collection];
  if (!fileName) {
    throw new Error(`Unknown collection: ${collection}`);
  }
  
  const filePath = path.join(DATA_DIR, fileName);
  await ensureJsonFile(filePath);
  
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

/**
 * JSON 模式：写入 JSON 文件
 * @param {string} collection - 集合名称
 * @param {Array} data - 数据数组
 */
async function jsonWrite(collection, data) {
  const fileName = FILE_MAPPINGS[collection];
  if (!fileName) {
    throw new Error(`Unknown collection: ${collection}`);
  }
  
  const filePath = path.join(DATA_DIR, fileName);
  await ensureJsonFile(filePath);
  
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
  jsonCache[collection] = data;
}

/**
 * SQLite 模式：通用查询
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Object} 查询结果
 */
function sqliteQuery(sql, params = []) {
  if (!db) initSQLite();
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

/**
 * SQLite 模式：执行语句
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Object} 执行结果
 */
function sqliteRun(sql, params = []) {
  if (!db) initSQLite();
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

/**
 * SQLite 模式：获取单条记录
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Object|null} 记录对象
 */
function sqliteGet(sql, params = []) {
  if (!db) initSQLite();
  const stmt = db.prepare(sql);
  return stmt.get(...params) || null;
}

/**
 * SQLite 模式：插入记录
 * @param {string} table - 表名
 * @param {Object} data - 数据对象
 * @returns {Object} 插入结果
 */
function sqliteInsert(table, data) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  return sqliteRun(sql, values);
}

/**
 * SQLite 模式：更新记录
 * @param {string} table - 表名
 * @param {Object} data - 数据对象
 * @param {string} where - WHERE 条件
 * @param {Array} whereParams - WHERE 参数
 * @returns {Object} 更新结果
 */
function sqliteUpdate(table, data, where, whereParams = []) {
  const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(data), ...whereParams];
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
  return sqliteRun(sql, values);
}

/**
 * SQLite 模式：删除记录
 * @param {string} table - 表名
 * @param {string} where - WHERE 条件
 * @param {Array} params - 参数数组
 * @returns {Object} 删除结果
 */
function sqliteDelete(table, where, params = []) {
  const sql = `DELETE FROM ${table} WHERE ${where}`;
  return sqliteRun(sql, params);
}

/**
 * 将 JSON 字符串转换为对象（SQLite 存储的 JSON 字段）
 * @param {string|null} jsonStr - JSON 字符串
 * @returns {*} 解析后的对象
 */
function parseJsonField(jsonStr) {
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * 将对象序列化为 JSON 字符串
 * @param {*} obj - 要序列化的对象
 * @returns {string} JSON 字符串
 */
function stringifyJsonField(obj) {
  if (obj === null || obj === undefined) return null;
  return JSON.stringify(obj);
}

function getTableName(collection) {
  const tableMap = {
    users: 'users',
    tokens: 'tokens',
    tasks: 'tasks',
    sessions: 'sessions',
    workflows: 'workflows',
    workflowRuns: 'workflow_runs',
    notifications: 'notifications',
    agentCombinations: 'agent_combinations',
    plugins: 'plugins',
    auditLogs: 'audit_logs',
    agentGroups: 'agent_groups',
    notificationChannels: 'notification_channels',
    userGroups: 'user_groups',
    presets: 'presets',
    templates: 'templates',
    quietHoursConfig: 'quiet_hours_config',
    quietHoursQueue: 'quiet_hours_queue',
    scheduledBackupConfig: 'scheduled_backup_config',
    scheduledBackupHistory: 'scheduled_backup_history',
    notificationHistory: 'notification_history',
    notificationTemplates: 'notification_templates',
    runtime: 'runtime'
  };
  return tableMap[collection] || collection;
}

/**
 * 查找单条记录
 * @param {string} collection - 集合名称
 * @param {Object} query - 查询条件
 * @returns {Promise<Object|null>} 找到的记录或 null
 */
async function findOne(collection, query) {
  if (STORAGE_BACKEND === 'sqlite') {
    const table = getTableName(collection);
    const conditions = Object.keys(query).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(query);
    return sqliteGet(`SELECT * FROM ${table} WHERE ${conditions} LIMIT 1`, values);
  } else {
    const data = await jsonRead(collection);
    return data.find(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  }
}

/**
 * 查找多条记录
 * @param {string} collection - 集合名称
 * @param {Object} query - 查询条件
 * @param {Object} options - 查询选项（limit, offset, sort）
 * @returns {Promise<Array>} 匹配的记录数组
 */
async function findMany(collection, query = {}, options = {}) {
  const { limit, offset = 0, sort, sortBy = 'createdAt' } = options;
  
  if (STORAGE_BACKEND === 'sqlite') {
    const table = getTableName(collection);
    let sql = 'SELECT * FROM ';
    
    if (Object.keys(query).length > 0) {
      const conditions = Object.keys(query).map(key => `${key} = ?`).join(' AND ');
      sql += `${table} WHERE ${conditions}`;
    } else {
      sql += table;
    }
    
    if (sort) {
      sql += ` ORDER BY ${sortBy} ${sort === -1 ? 'DESC' : 'ASC'}`;
    }
    
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }
    
    if (offset) {
      sql += ` OFFSET ${offset}`;
    }
    
    const values = Object.values(query);
    return sqliteQuery(sql, values);
  } else {
    let data = await jsonRead(collection);
    
    if (Object.keys(query).length > 0) {
      data = data.filter(item => {
        for (const key in query) {
          if (item[key] !== query[key]) return false;
        }
        return true;
      });
    }
    
    if (sort) {
      data.sort((a, b) => {
        const aVal = a[sortBy] || 0;
        const bVal = b[sortBy] || 0;
        return sort === -1 ? bVal - aVal : aVal - bVal;
      });
    }
    
    if (offset) {
      data = data.slice(offset);
    }
    
    if (limit) {
      data = data.slice(0, limit);
    }
    
    return data;
  }
}

/**
 * 插入单条记录
 * @param {string} collection - 集合名称
 * @param {Object} data - 要插入的数据
 * @returns {Promise<Object>} 插入的记录（包含生成的 ID）
 */
async function insertOne(collection, data) {
  if (STORAGE_BACKEND === 'sqlite') {
    const table = getTableName(collection);
    
    const dataWithDefaults = {
      ...data,
      createdAt: data.createdAt || Date.now()
    };
    
    const columns = Object.keys(dataWithDefaults);
    const values = Object.values(dataWithDefaults).map(v => 
      typeof v === 'object' ? stringifyJsonField(v) : v
    );
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    const result = sqliteRun(sql, values);
    return { ...dataWithDefaults, id: dataWithDefaults.id || result.lastInsertRowid };
  } else {
    const dataWithDefaults = {
      ...data,
      id: data.id || require('crypto').randomUUID(),
      createdAt: data.createdAt || Date.now()
    };
    
    const dataArray = await jsonRead(collection);
    dataArray.push(dataWithDefaults);
    await jsonWrite(collection, dataArray);
    
    return dataWithDefaults;
  }
}

/**
 * 更新单条记录
 * @param {string} collection - 集合名称
 * @param {Object} query - 查询条件
 * @param {Object} updates - 要更新的字段
 * @returns {Promise<Object>} 更新结果
 */
async function updateOne(collection, query, updates) {
  const updatedData = {
    ...updates,
    updatedAt: Date.now()
  };
  
  if (STORAGE_BACKEND === 'sqlite') {
    const table = getTableName(collection);
    const whereConditions = Object.keys(query).map(key => `${key} = ?`).join(' AND ');
    const whereValues = Object.values(query);
    
    const setClause = Object.keys(updatedData).map(key => `${key} = ?`).join(', ');
    const setValues = Object.values(updatedData).map(v => 
      typeof v === 'object' ? stringifyJsonField(v) : v
    );
    
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereConditions}`;
    return sqliteRun(sql, [...setValues, ...whereValues]);
  } else {
    const dataArray = await jsonRead(collection);
    const index = dataArray.findIndex(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });
    
    if (index === -1) {
      return { changes: 0 };
    }
    
    dataArray[index] = { ...dataArray[index], ...updatedData };
    await jsonWrite(collection, dataArray);
    
    return { changes: 1 };
  }
}

/**
 * 更新多条记录
 * @param {string} collection - 集合名称
 * @param {Object} query - 查询条件
 * @param {Object} updates - 要更新的字段
 * @returns {Promise<Object>} 更新结果
 */
async function updateMany(collection, query, updates) {
  const updatedData = {
    ...updates,
    updatedAt: Date.now()
  };
  
  if (STORAGE_BACKEND === 'sqlite') {
    const table = getTableName(collection);
    let sql;
    let values;
    
    if (Object.keys(query).length > 0) {
      const whereConditions = Object.keys(query).map(key => `${key} = ?`).join(' AND ');
      const setClause = Object.keys(updatedData).map(key => `${key} = ?`).join(', ');
      sql = `UPDATE ${table} SET ${setClause} WHERE ${whereConditions}`;
      values = [...Object.values(updatedData).map(v => typeof v === 'object' ? stringifyJsonField(v) : v), ...Object.values(query)];
    } else {
      const setClause = Object.keys(updatedData).map(key => `${key} = ?`).join(', ');
      sql = `UPDATE ${table} SET ${setClause}`;
      values = Object.values(updatedData).map(v => typeof v === 'object' ? stringifyJsonField(v) : v);
    }
    
    return sqliteRun(sql, values);
  } else {
    const dataArray = await jsonRead(collection);
    let changeCount = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
      const item = dataArray[i];
      let match = true;
      
      for (const key in query) {
        if (item[key] !== query[key]) {
          match = false;
          break;
        }
      }
      
      if (match) {
        dataArray[i] = { ...item, ...updatedData };
        changeCount++;
      }
    }
    
    await jsonWrite(collection, dataArray);
    return { changes: changeCount };
  }
}

/**
 * 删除单条记录
 * @param {string} collection - 集合名称
 * @param {Object} query - 查询条件
 * @returns {Promise<Object>} 删除结果
 */
async function deleteOne(collection, query) {
  if (STORAGE_BACKEND === 'sqlite') {
    const table = getTableName(collection);
    const whereConditions = Object.keys(query).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(query);
    return sqliteDelete(table, whereConditions, values);
  } else {
    const dataArray = await jsonRead(collection);
    const index = dataArray.findIndex(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });
    
    if (index === -1) {
      return { changes: 0 };
    }
    
    dataArray.splice(index, 1);
    await jsonWrite(collection, dataArray);
    
    return { changes: 1 };
  }
}

/**
 * 删除多条记录
 * @param {string} collection - 集合名称
 * @param {Object} query - 查询条件
 * @returns {Promise<Object>} 删除结果
 */
async function deleteMany(collection, query) {
  if (STORAGE_BACKEND === 'sqlite') {
    const table = getTableName(collection);
    let sql;
    let values;
    
    if (Object.keys(query).length > 0) {
      const whereConditions = Object.keys(query).map(key => `${key} = ?`).join(' AND ');
      sql = `DELETE FROM ${table} WHERE ${whereConditions}`;
      values = Object.values(query);
    } else {
      sql = `DELETE FROM ${table}`;
      values = [];
    }
    
    return sqliteRun(sql, values);
  } else {
    const dataArray = await jsonRead(collection);
    const initialLength = dataArray.length;
    
    const filteredArray = dataArray.filter(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return true;
      }
      return false;
    });
    
    await jsonWrite(collection, filteredArray);
    
    return { changes: initialLength - filteredArray.length };
  }
}

/**
 * 统计记录数量
 * @param {string} collection - 集合名称
 * @param {Object} query - 查询条件
 * @returns {Promise<number>} 记录数量
 */
async function count(collection, query = {}) {
  if (STORAGE_BACKEND === 'sqlite') {
    const table = getTableName(collection);
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    
    if (Object.keys(query).length > 0) {
      const conditions = Object.keys(query).map(key => `${key} = ?`).join(' AND ');
      sql += ` WHERE ${conditions}`;
      const result = sqliteGet(sql, Object.values(query));
      return result ? result.count : 0;
    }
    
    const result = sqliteGet(sql);
    return result ? result.count : 0;
  } else {
    const data = await jsonRead(collection);
    
    if (Object.keys(query).length === 0) {
      return data.length;
    }
    
    return data.filter(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    }).length;
  }
}

/**
 * 执行事务（仅 SQLite 模式）
 * @param {Function} callback - 事务回调函数
 * @returns {Promise<any>} 事务执行结果
 */
async function transaction(callback) {
  if (STORAGE_BACKEND !== 'sqlite') {
    throw new Error('Transactions are only supported in SQLite mode');
  }
  
  if (!db) initSQLite();
  
  return db.transaction(callback)();
}

/**
 * 关闭数据库连接
 */
function close() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * 获取数据库实例（仅 SQLite 模式）
 * @returns {Object|null} SQLite 数据库实例
 */
function getDb() {
  if (STORAGE_BACKEND === 'sqlite') {
    if (!db) initSQLite();
    return db;
  }
  return null;
}

module.exports = {
  getDataDir,
  setBackend,
  getBackend,
  findOne,
  findMany,
  insertOne,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
  count,
  transaction,
  close,
  getDb,
  parseJsonField,
  stringifyJsonField,
  FILE_MAPPINGS
};