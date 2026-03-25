/**
 * Health API Tests
 * Tests for /api/health, /api/runtime, /api/overview, /api/stats endpoints
 */

const assert = require('assert');
const { get } = require('../helpers');

/**
 * Run all health API tests
 * @param {string} baseUrl - Base URL of the test server
 */
async function runTests(baseUrl) {
  const base = baseUrl || 'http://127.0.0.1:3211';
  
  console.log('  Health API Tests:');
  
  try {
    let response = await get(`${base}/api/health`);
    assert.strictEqual(response.status, 200, 'Health endpoint should return 200');
    assert(response.body, 'Response body should exist');
    assert.strictEqual(response.body.status, 'healthy', 'Status should be healthy');
    console.log('    ✓ GET /api/health returns healthy status');
    
    response = await get(`${base}/api/health`);
    assert.ok(response.body.tasks.queued !== undefined, 'Should have queued count');
    assert.ok(response.body.tasks.running !== undefined, 'Should have running count');
    assert.ok(response.body.tasks.completed !== undefined, 'Should have completed count');
    assert.ok(response.body.tasks.failed !== undefined, 'Should have failed count');
    console.log('    ✓ GET /api/health contains correct task status fields');
    
    response = await get(`${base}/api/runtime`);
    assert.strictEqual(response.status, 200, 'Runtime endpoint should return 200');
    assert(response.body, 'Response body should exist');
    console.log('    ✓ GET /api/runtime returns runtime info');
    
    response = await get(`${base}/api/overview`);
    assert.strictEqual(response.status, 200, 'Overview endpoint should return 200');
    assert(response.body, 'Response body should exist');
    assert.ok(response.body.totals, 'Should have totals');
    console.log('    ✓ GET /api/overview returns overview data');
    
    response = await get(`${base}/api/overview?refresh=true`);
    assert.strictEqual(response.status, 200, 'Overview with refresh should return 200');
    console.log('    ✓ GET /api/overview with refresh param works');
    
    response = await get(`${base}/api/stats`);
    assert.strictEqual(response.status, 200, 'Stats endpoint should return 200');
    assert(response.body, 'Response body should exist');
    assert.ok(response.body.total !== undefined, 'Should have total count');
    assert.ok(response.body.queued !== undefined, 'Should have queued count');
    console.log('    ✓ GET /api/stats returns task statistics');
    
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    response = await get(`${base}/api/stats?timeFrom=${dayAgo}&timeTo=${now}`);
    assert.strictEqual(response.status, 200, 'Stats with time filters should return 200');
    console.log('    ✓ GET /api/stats with time filters works');
    
    response = await get(`${base}/api/stats/trends`);
    assert.strictEqual(response.status, 200, 'Trends endpoint should return 200');
    assert(response.body, 'Response body should exist');
    assert.ok(response.body.trends, 'Should have trends array');
    console.log('    ✓ GET /api/stats/trends returns trends data');
    
    response = await get(`${base}/api/stats/trends?days=14`);
    assert.strictEqual(response.status, 200, 'Trends with days param should return 200');
    console.log('    ✓ GET /api/stats/trends with days param works');
    
    response = await get(`${base}/api/health`);
    assert.strictEqual(response.headers['content-type'], 'application/json', 'Should return JSON');
    console.log('    ✓ GET /api/health responds with correct content-type');
    
  } catch (err) {
    throw new Error(`Health API tests failed: ${err.message}`);
  }
}

module.exports = { runTests };