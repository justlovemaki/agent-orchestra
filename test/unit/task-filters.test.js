/**
 * Task Filters Unit Tests
 * Tests for lib/task-filters.js functions
 */

const assert = require('assert');
const { filterTasks, parseTaskFilters, normalizeFilterValues, parseDateValue } = require('../../lib/task-filters');

/**
 * Run all task filters unit tests
 * @param {string} baseUrl - Not used for unit tests
 */
async function runTests(baseUrl) {
  console.log('  Task Filters Unit Tests:');
  
  try {
    assert.deepStrictEqual(normalizeFilterValues(null), []);
    console.log('    ✓ normalizeFilterValues returns empty array for null');
    
    assert.deepStrictEqual(normalizeFilterValues(undefined), []);
    console.log('    ✓ normalizeFilterValues returns empty array for undefined');
    
    assert.deepStrictEqual(normalizeFilterValues(['a', 'b']), ['a', 'b']);
    console.log('    ✓ normalizeFilterValues returns array as-is if already array');
    
    assert.deepStrictEqual(normalizeFilterValues('a,b,c'), ['a', 'b', 'c']);
    console.log('    ✓ normalizeFilterValues splits comma-separated string');
    
    assert.deepStrictEqual(normalizeFilterValues('a, b, c'), ['a', 'b', 'c']);
    console.log('    ✓ normalizeFilterValues handles whitespace in comma-separated string');
    
    assert.deepStrictEqual(normalizeFilterValues('a,,b'), ['a', 'b']);
    console.log('    ✓ normalizeFilterValues filters empty values');
    
    assert.strictEqual(parseDateValue(null), null);
    console.log('    ✓ parseDateValue returns null for null');
    
    assert.strictEqual(parseDateValue(undefined), null);
    console.log('    ✓ parseDateValue returns null for undefined');
    
    const timestamp = parseDateValue('2024-01-15T10:30:00Z');
    assert.ok(Number.isFinite(timestamp), 'Should return timestamp');
    console.log('    ✓ parseDateValue parses ISO date string');
    
    assert.strictEqual(parseDateValue('invalid-date'), null);
    console.log('    ✓ parseDateValue returns null for invalid date string');
    
    const now = Date.now();
    assert.strictEqual(parseDateValue(now), now);
    console.log('    ✓ parseDateValue handles number as timestamp');
    
    const mockTasks = [
      { id: '1', title: 'Task One', prompt: 'First task prompt', status: 'queued', priority: 'high', mode: 'broadcast', agents: ['agent-1', 'agent-2'], createdAt: Date.now() - 1000 },
      { id: '2', title: 'Task Two', prompt: 'Second task prompt', status: 'running', priority: 'medium', mode: 'parallel', agents: ['agent-3'], createdAt: Date.now() },
      { id: '3', title: 'Completed Task', prompt: 'Done task', status: 'completed', priority: 'low', mode: 'broadcast', agents: ['agent-1'], createdAt: Date.now() - 2000 },
      { id: '4', title: 'Failed Task', prompt: 'Error task', status: 'failed', priority: 'high', mode: 'parallel', agents: ['agent-2'], createdAt: Date.now() - 500 },
    ];
    
    let result = filterTasks(mockTasks, {});
    assert.strictEqual(result.length, 4, 'Should return all tasks');
    console.log('    ✓ filterTasks returns all tasks when no filters');
    
    result = filterTasks(mockTasks, { keyword: 'First' });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, '1');
    console.log('    ✓ filterTasks filters by keyword in title');
    
    result = filterTasks(mockTasks, { keyword: 'Second' });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, '2');
    console.log('    ✓ filterTasks filters by keyword in prompt');
    
    result = filterTasks(mockTasks, { keyword: 'task' });
    assert.strictEqual(result.length, 4, 'Should match all tasks with "task"');
    console.log('    ✓ filterTasks filters by keyword case-insensitive');
    
    result = filterTasks(mockTasks, { status: 'queued' });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, '1');
    console.log('    ✓ filterTasks filters by status');
    
    result = filterTasks(mockTasks, { status: 'queued,running' });
    assert.strictEqual(result.length, 2);
    console.log('    ✓ filterTasks filters by multiple statuses');
    
    result = filterTasks(mockTasks, { priority: 'high' });
    assert.strictEqual(result.length, 2);
    console.log('    ✓ filterTasks filters by priority');
    
    result = filterTasks(mockTasks, { mode: 'parallel' });
    assert.strictEqual(result.length, 2);
    console.log('    ✓ filterTasks filters by mode');
    
    result = filterTasks(mockTasks, { agent: 'agent-1' });
    assert.strictEqual(result.length, 2);
    console.log('    ✓ filterTasks filters by agent');
    
    const now2 = Date.now();
    // Time range: from 2000ms ago to 500ms ago (inclusive)
    // Should include: task 1 (1000ms ago), task 3 (2000ms ago, at boundary), task 4 (500ms ago, at boundary)
    result = filterTasks(mockTasks, { 
      timeFrom: new Date(now2 - 2000).toISOString(),
      timeTo: new Date(now2 - 500).toISOString()
    });
    assert.ok(result.length >= 2 && result.length <= 3, 'Should include 2-3 tasks in time range');
    console.log('    ✓ filterTasks filters by time range');
    
    result = filterTasks(mockTasks, { 
      status: 'queued,running',
      priority: 'high'
    });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, '1');
    console.log('    ✓ filterTasks combines multiple filters');
    
    result = filterTasks([], {});
    assert.strictEqual(result.length, 0);
    console.log('    ✓ filterTasks handles empty tasks array');
    
    result = filterTasks(null, {});
    assert.strictEqual(result.length, 0);
    console.log('    ✓ filterTasks handles non-array input');
    
    let parsed = parseTaskFilters({ keyword: 'test' });
    assert.strictEqual(parsed.keyword, 'test');
    console.log('    ✓ parseTaskFilters parses keyword from query');
    
    parsed = parseTaskFilters({ keyword: '  test  ' });
    assert.strictEqual(parsed.keyword, 'test');
    console.log('    ✓ parseTaskFilters trims keyword whitespace');
    
    parsed = parseTaskFilters({ status: 'queued,running' });
    assert.deepStrictEqual(parsed.status, ['queued', 'running']);
    console.log('    ✓ parseTaskFilters parses status array');
    
    parsed = parseTaskFilters({ priority: 'high,medium' });
    assert.deepStrictEqual(parsed.priority, ['high', 'medium']);
    console.log('    ✓ parseTaskFilters parses priority array');
    
    parsed = parseTaskFilters({ mode: 'parallel' });
    assert.deepStrictEqual(parsed.mode, ['parallel']);
    console.log('    ✓ parseTaskFilters parses mode array');
    
    parsed = parseTaskFilters({ agent: 'agent-1,agent-2' });
    assert.deepStrictEqual(parsed.agent, ['agent-1', 'agent-2']);
    console.log('    ✓ parseTaskFilters parses agent array');
    
    parsed = parseTaskFilters({ 
      timeFrom: '2024-01-01', 
      timeTo: '2024-12-31' 
    });
    assert.strictEqual(parsed.timeFrom, '2024-01-01');
    assert.strictEqual(parsed.timeTo, '2024-12-31');
    console.log('    ✓ parseTaskFilters parses timeFrom and timeTo');
    
    parsed = parseTaskFilters({ 
      keyword: '',
      status: '',
      priority: undefined
    });
    assert.strictEqual(Object.keys(parsed).length, 0, 'Should have no keys');
    console.log('    ✓ parseTaskFilters filters out empty filters');
    
    parsed = parseTaskFilters({ 
      status: [],
      priority: 'high'
    });
    assert.strictEqual(parsed.status, undefined);
    assert.deepStrictEqual(parsed.priority, ['high']);
    console.log('    ✓ parseTaskFilters filters out empty arrays');
    
  } catch (err) {
    throw new Error(`Task Filters unit tests failed: ${err.message}`);
  }
}

module.exports = { runTests };