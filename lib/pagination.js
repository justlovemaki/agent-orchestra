/**
 * 分页中间件模块
 * 为列表接口提供通用分页支持
 */

/**
 * 从请求中解析分页参数
 * @param {Object} req - HTTP 请求对象
 * @returns {Object} 分页参数 { page, limit, offset }
 */
function parsePagination(req) {
  const url = require('url');
  const query = url.parse(req.url, true).query;
  
  const page = Math.max(1, parseInt(query.page) || 1);
  const limitValue = parseInt(query.limit);
  const limit = isNaN(limitValue) ? 20 : Math.min(100, Math.max(1, limitValue));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

/**
 * 包装分页结果
 * @param {Array} data - 当前页数据
 * @param {number} total - 数据总数
 * @param {number} page - 当前页码
 * @param {number} limit - 每页数量
 * @returns {Object} 分页结果对象
 */
function paginate(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * 对数组进行分页切片
 * @param {Array} array - 原始数组
 * @param {number} offset - 偏移量
 * @param {number} limit - 限制数量
 * @returns {Array} 切片后的数组
 */
function sliceArray(array, offset, limit) {
  return array.slice(offset, offset + limit);
}

module.exports = {
  parsePagination,
  paginate,
  sliceArray
};
