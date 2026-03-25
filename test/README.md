# Test Suite

Automated test framework for Agent Orchestra using Node.js native `assert` module.

## Directory Structure

```
test/
├── run-tests.js           # Test runner (auto-discovers and runs tests)
├── helpers.js             # HTTP request wrappers and utilities
├── api/                   # API integration tests
│   ├── health.test.js     # Health check API tests
│   ├── tasks.test.js     # Task CRUD API tests
│   └── users.test.js     # User authentication tests
├── unit/                  # Unit tests
│   ├── task-filters.test.js  # Task filtering logic tests
│   └── quiet-hours.test.js   # Quiet hours logic tests
└── README.md             # This file
```

## Running Tests

### Run all tests
```bash
npm test
# or
node test/run-tests.js
```

### Run specific test file
```bash
node test/unit/task-filters.test.js
node test/api/health.test.js
```

## Test Structure

Each test file exports a `runTests(baseUrl)` function that executes test cases.

### API Tests
- Use HTTP requests to test actual API endpoints
- Test server runs on port 3211
- Include positive and negative test cases

### Unit Tests
- Test individual modules in isolation
- Mock dependencies as needed
- Focus on business logic

## Test Output

The test runner provides:
- Pass/Fail status for each test file
- Detailed error messages for failures
- Summary with exit code (0 = all passed, 1 = failures)

## Adding New Tests

1. Create test file in appropriate directory (`test/api/` or `test/unit/`)
2. File must end with `.test.js`
3. Export `runTests(baseUrl)` async function
4. Use Node.js `assert` module for assertions

Example:
```javascript
const assert = require('assert');

async function runTests(baseUrl) {
  describe('My Feature', () => {
    it('should do something', async () => {
      const result = await someFunction();
      assert.strictEqual(result, expectedValue);
    });
  });
}

module.exports = { runTests };
```