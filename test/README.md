# Test Suite

Automated test framework for Agent Orchestra using Node.js native `assert` module and Playwright for E2E tests.

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
├── e2e/                   # End-to-End tests (Playwright)
│   ├── app.spec.js       # Main E2E tests
│   └── helpers.js        # E2E test utilities
└── README.md             # This file
```

## E2E Tests (Playwright)

E2E tests use Playwright to test the full application flow in a real browser.

### Prerequisites

```bash
# Install Playwright browsers
npx playwright install chromium
```

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with visible browser (headed mode)
npm run test:e2e:headed

# Run with interactive UI
npm run test:e2e:ui

# Run specific test file
npx playwright test test/e2e/app.spec.js

# Run specific test
npx playwright test test/e2e/app.spec.js -g "should load the dashboard"
```

### Environment Variables

```bash
# Override base URL (default: http://127.0.0.1:3210)
BASE_URL=http://127.0.0.1:3210 npm run test:e2e
```

### E2E Test Coverage

The E2E tests cover:
- Dashboard page loading
- User registration
- User login/logout
- Task creation form
- Workflow panel display
- System status panel
- Authentication error handling

### Notes

- E2E tests automatically start the server if not already running
- Tests use Chromium browser by default
- Screenshots and videos are captured on test failures
- Trace files are saved for debugging failed tests

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