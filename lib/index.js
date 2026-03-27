/**
 * lib/index.js - 模块导出入口
 * 导出数据库抽象层等核心模块
 */

const database = require('./database');

module.exports = {
  database
};