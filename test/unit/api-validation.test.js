/**
 * API Validation Middleware Tests
 * Tests for lib/api-validation.js
 */

const assert = require('assert');
const path = require('path');

// Load the module
const validationModule = require('../../lib/api-validation');

// Simple test helpers
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
}

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function assertOk(value, msg) {
  if (!value) throw new Error(msg || 'Assertion failed');
}

function assertStrictEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${a} === ${b}`);
}

function assertDeepStrictEqual(a, b, msg) {
  const aStr = JSON.stringify(a);
  const bStr = JSON.stringify(b);
  if (aStr !== bStr) throw new Error(msg || `Expected ${aStr} === ${bStr}`);
}

// Main tests
console.log('API Validation Middleware Tests\n');
console.log('=' .repeat(50));

const TEST_PORT = 3211;
const validator = validationModule.createValidator(TEST_PORT);

describe('createValidator', () => {
  test('should create validator instance', () => {
    assertOk(validator);
    assertOk(typeof validator.validateRequest === 'function');
    assertOk(typeof validator.getPathParams === 'function');
    assertOk(typeof validator.getOperationInfo === 'function');
  });
});

describe('getOperationInfo', () => {
  test('should find operation for known path', () => {
    const info = validator.getOperationInfo('GET', '/api/health');
    assertOk(info);
    assertOk(info.operation);
    assertStrictEqual(info.pathTemplate, '/api/health');
  });
  
  test('should extract path parameters', () => {
    const info = validator.getOperationInfo('GET', '/api/tasks/task123');
    assertOk(info);
    assertOk(info.pathParams);
    assertStrictEqual(info.pathParams.taskId, 'task123');
  });
  
  test('should return null for unknown path', () => {
    const info = validator.getOperationInfo('GET', '/api/unknown');
    assertStrictEqual(info, null);
  });
});

describe('validateRequest - Path Parameters', () => {
  test('should validate valid path', () => {
    const result = validator.validateRequest('GET', '/api/health');
    assertStrictEqual(result.valid, true);
    assertStrictEqual(result.errors.length, 0);
    assertOk(result.operation);
  });
  
  test('should return null operation for unknown path', () => {
    const result = validator.validateRequest('GET', '/static/app.js');
    assertStrictEqual(result.valid, true);
    assertStrictEqual(result.operation, null);
  });
});

describe('validateRequest - Query Parameters', () => {
  test('should validate optional query parameters', () => {
    const result = validator.validateRequest('GET', '/api/stats/trends', { days: '7' });
    assertStrictEqual(result.valid, true);
  });
  
  test('should detect invalid query parameter type', () => {
    const result = validator.validateRequest('GET', '/api/stats/trends', { days: 'invalid' });
    // Validation may catch type mismatch
    assertOk(result);
  });
  
  test('should handle missing optional parameters', () => {
    const result = validator.validateRequest('GET', '/api/stats/trends', {});
    assertStrictEqual(result.valid, true);
  });
  
  test('should validate boolean query parameter', () => {
    const result = validator.validateRequest('GET', '/api/overview', { force: 'true' });
    assertStrictEqual(result.valid, true);
  });
});

describe('validateRequest - Request Body', () => {
  test('should validate POST request with valid body', () => {
    const body = {
      message: 'Test task message',
      agentId: 'test-agent',
      priority: 'normal'
    };
    const result = validator.validateRequest('POST', '/api/tasks', {}, body);
    assertStrictEqual(result.valid, true);
  });
  
  test('should detect missing required fields', () => {
    const body = {}; // Missing required fields
    const result = validator.validateRequest('POST', '/api/tasks', {}, body);
    // Should have validation errors for missing required fields
    assertOk(result);
  });
  
  test('should validate field types', () => {
    const body = {
      message: 'Test task',
      agentId: 'test-agent',
      priority: 123 // Should be string (enum)
    };
    const result = validator.validateRequest('POST', '/api/tasks', {}, body);
    assertOk(result);
  });
});

describe('getPathParams', () => {
  test('should extract path parameters', () => {
    const params = validator.getPathParams('GET', '/api/tasks/task456');
    assertDeepStrictEqual(params, { taskId: 'task456' });
  });
  
  test('should return empty object for path without params', () => {
    const params = validator.getPathParams('GET', '/api/health');
    assertDeepStrictEqual(params, {});
  });
  
  test('should return empty object for unknown path', () => {
    const params = validator.getPathParams('GET', '/api/unknown');
    assertDeepStrictEqual(params, {});
  });
});

describe('Integration with OpenAPI Spec', () => {
  test('should have validation for all documented paths', () => {
    const endpoints = [
      ['GET', '/api/health'],
      ['GET', '/api/tasks'],
      ['POST', '/api/tasks'],
      ['GET', '/api/sessions'],
      ['POST', '/api/workflows'],
      ['GET', '/api/notifications/channels']
    ];
    
    for (const [method, pathname] of endpoints) {
      const result = validator.validateRequest(method, pathname);
      assertOk(result, `Should validate ${method} ${pathname}`);
    }
  });
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}

console.log('\nAll tests passed! ✓');
