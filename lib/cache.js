/**
 * 缓存层模块
 * 提供 LRU 缓存实现，支持 TTL
 */

class LRUCache {
  /**
   * @param {number} maxSize - 最大缓存条目数
   * @param {number} defaultTTL - 默认 TTL（毫秒）
   */
  constructor(maxSize = 100, defaultTTL = 60000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.cache = new Map();
  }

  /**
   * 获取缓存值
   * @param {string} key - 缓存键
   * @returns {*} 缓存值，不存在或已过期返回 undefined
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    
    // LRU: 访问时移到末尾
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  /**
   * 设置缓存值
   * @param {string} key - 缓存键
   * @param {*} value - 缓存值
   * @param {number} ttl - TTL（毫秒），可选
   */
  set(key, value, ttl) {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttl || this.defaultTTL)
    });
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  stats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;
    
    for (const item of this.cache.values()) {
      if (now > item.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }
    
    return {
      size: this.cache.size,
      valid,
      expired,
      maxSize: this.maxSize
    };
  }

  /**
   * 清理过期条目
   */
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// 创建全局缓存实例
const overviewCache = new LRUCache(10, 8000); // overview 缓存：10 条，8 秒 TTL
const agentStatusCache = new LRUCache(50, 30000); // Agent 状态缓存：50 条，30 秒 TTL
const dataCache = new LRUCache(100, 60000); // 通用数据缓存：100 条，60 秒 TTL

module.exports = {
  LRUCache,
  overviewCache,
  agentStatusCache,
  dataCache
};
