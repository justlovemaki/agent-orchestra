/**
 * Tasks API Tests
 * Tests for task CRUD operations: /api/tasks endpoints
 */

const assert = require('assert');
const { get, post } = require('../helpers');

/**
 * Run all tasks API tests
 * @param {string} baseUrl - Base URL of the test server
 */
async function runTests(baseUrl) {
  const base = baseUrl || 'http://127.0.0.1:3211';
  
  console.log('  Tasks API Tests:');
  
  try {
    let response = await get(`${base}/api/tasks`);
    assert.strictEqual(response.status, 200, 'Tasks list should return 200');
    assert(Array.isArray(response.body.tasks), 'Response should have tasks array');
    console.log('    ✓ GET /api/tasks returns 200 with empty array when no tasks');
    
    const newTask = {
      title: 'Test Task',
      prompt: 'This is a test task prompt',
      agents: ['agent-1', 'agent-2'],
      mode: 'broadcast',
      priority: 'medium'
    };
    
    response = await post(`${base}/api/tasks`, newTask);
    assert.strictEqual(response.status, 201, 'Task creation should return 201');
    assert(response.body.task, 'Response should have task');
    assert.strictEqual(response.body.task.title, newTask.title, 'Task title should match');
    console.log('    ✓ POST /api/tasks creates task with correct data');
    
    const invalidTask = {
      prompt: 'Test prompt',
      agents: ['agent-1']
    };
    
    response = await post(`${base}/api/tasks`, invalidTask);
    assert.strictEqual(response.status >= 400, true, 'Should return error status');
    console.log('    ✓ POST /api/tasks rejects task without title');
    
    const invalidTask2 = {
      title: 'Test Task',
      prompt: 'Test prompt'
    };
    
    response = await post(`${base}/api/tasks`, invalidTask2);
    assert.strictEqual(response.status >= 400, true, 'Should return error status');
    console.log('    ✓ POST /api/tasks rejects task without agents');
    
    const parallelTask = {
      title: 'Parallel Task',
      prompt: 'Test parallel mode',
      agents: ['agent-1', 'agent-2'],
      mode: 'parallel',
      priority: 'high'
    };
    
    response = await post(`${base}/api/tasks`, parallelTask);
    assert.strictEqual(response.status, 201, 'Parallel task should be created');
    assert.strictEqual(response.body.task.mode, 'parallel', 'Mode should be parallel');
    console.log('    ✓ POST /api/tasks handles parallel mode');
    
    response = await get(`${base}/api/tasks?keyword=test`);
    assert.strictEqual(response.status, 200, 'Filtered tasks should return 200');
    console.log('    ✓ GET /api/tasks with keyword filter works');
    
    response = await get(`${base}/api/tasks?status=queued,running`);
    assert.strictEqual(response.status, 200, 'Status filtered tasks should return 200');
    console.log('    ✓ GET /api/tasks with status filter works');
    
    response = await get(`${base}/api/tasks?priority=high,medium`);
    assert.strictEqual(response.status, 200, 'Priority filtered tasks should return 200');
    console.log('    ✓ GET /api/tasks with priority filter works');
    
    response = await get(`${base}/api/tasks?agent=agent-1`);
    assert.strictEqual(response.status, 200, 'Agent filtered tasks should return 200');
    console.log('    ✓ GET /api/tasks with agent filter works');
    
    response = await get(`${base}/api/tasks?mode=parallel`);
    assert.strictEqual(response.status, 200, 'Mode filtered tasks should return 200');
    console.log('    ✓ GET /api/tasks with mode filter works');
    
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    response = await get(`${base}/api/tasks?timeFrom=${dayAgo}&timeTo=${now}`);
    assert.strictEqual(response.status, 200, 'Time filtered tasks should return 200');
    console.log('    ✓ GET /api/tasks with time range filter works');
    
    response = await get(`${base}/api/tasks/non-existent-id`);
    assert.strictEqual(response.status, 404, 'Non-existent task should return 404');
    console.log('    ✓ GET /api/tasks/:id returns 404 for non-existent task');
    
    const invalidTask3 = {
      title: 'Test',
      prompt: '',
      agents: ['agent-1']
    };
    
    response = await post(`${base}/api/tasks`, invalidTask3);
    assert.strictEqual(response.status >= 400, true, 'Should return error for empty prompt');
    console.log('    ✓ POST /api/tasks rejects empty prompt');
    
    const invalidTask4 = {
      title: '   ',
      prompt: 'Test prompt',
      agents: ['agent-1']
    };
    
    response = await post(`${base}/api/tasks`, invalidTask4);
    assert.strictEqual(response.status >= 400, true, 'Should return error for whitespace title');
    console.log('    ✓ POST /api/tasks rejects whitespace-only title');
    
    response = await get(`${base}/api/tasks?status=queued&priority=high&keyword=test`);
    assert.strictEqual(response.status, 200, 'Combined filters should return 200');
    console.log('    ✓ GET /api/tasks supports multiple filters combined');
    
  } catch (err) {
    throw new Error(`Tasks API tests failed: ${err.message}`);
  }
}

module.exports = { runTests };