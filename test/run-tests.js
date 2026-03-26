/**
 * Test Runner
 * Automatically discovers and runs all test files
 * Starts test server on port 3211 and executes tests sequentially
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const TEST_PORT = 3211;
const ROOT = __dirname;

let serverProcess = null;
let serverUrl = null;

const testResults = {
  passed: 0,
  failed: 0,
  errors: 0,
  total: 0
};

function log(message, type = 'info') {
  const prefix = {
    info: '[INFO]',
    success: '[PASS]',
    error: '[FAIL]',
    warn: '[WARN]',
    test: '[TEST]'
  }[type] || '[LOG]';
  console.log(`${prefix} ${message}`);
}

async function discoverTests() {
  const testFiles = [];
  
  const findTests = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findTests(fullPath);
      } else if (entry.name.endsWith('.test.js')) {
        testFiles.push(fullPath);
      }
    }
  };
  
  findTests(ROOT);
  return testFiles.sort();
}

async function startTestServer() {
  return new Promise((resolve, reject) => {
    log(`Starting test server on port ${TEST_PORT}...`, 'info');
    
    const requestHandlers = [];
    
    const mockServer = {
      on: (event, handler) => {
        if (event === 'request') {
          requestHandlers.push(handler);
        }
      }
    };
    
    const mockDeps = {
      readRuntime: async () => ({ status: 'running', port: TEST_PORT, agents: [] }),
      buildOverview: async () => ({ totals: { agents: 0, sessions: 0, busyAgents: 0, taskQueued: 0, taskRunning: 0, taskDone: 0, taskFailed: 0, taskCanceled: 0 }, agents: [], gateway: {} }),
      invalidateOverviewCache: () => {},
      readTasks: async () => [],
          json: (res, status, data) => {
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          },
          readJson: async (req) => mockDeps._body || {},
      verifyTokenFromRequest: async (req) => {
        const authHeader = req?.headers?.authorization || '';
        if (authHeader.startsWith('Bearer ')) {
          const token = authHeader.slice(7);
          if (token && !token.startsWith('invalid-')) {
            const users = require('../lib/users');
            const user = await users.verifyToken(token);
            if (user) {
              const fullUser = await users.getUserById(user.id);
              return fullUser ? { id: fullUser.id, name: fullUser.name } : { id: user.id, name: user.name };
            }
          }
        }
        return null;
      },
      addAuditEvent: async () => {},
      quietHours: require('../lib/quiet-hours'),
      parseTaskFilters: require('../lib/task-filters').parseTaskFilters,
      filterTasks: require('../lib/task-filters').filterTasks,
      formatTaskForUi: (task) => task,
      DATA_DIR: path.join(ROOT, 'data'),
      fsp: fs.promises,
      path: path,
          createTask: async (body) => {
            if (!body.title?.trim()) {
              throw new Error('任务标题不能为空');
            }
            if (!body.agents?.length) {
              throw new Error('至少选择一个 Agent');
            }
            if (!body.prompt?.trim()) {
              throw new Error('任务内容不能为空');
            }
            return {
              id: 'test-task-' + Date.now(),
              title: body.title.trim(),
              prompt: body.prompt.trim(),
              agents: body.agents,
              mode: body.mode === 'parallel' ? 'parallel' : 'broadcast',
              priority: body.priority || 'medium',
              status: 'queued',
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
          },
      getTask: async (id) => null,
      updateTask: async (id, mutator) => ({}),
      deleteTask: async () => {},
      cancelTask: async (task) => task,
      pauseTask: async (task) => task,
      resumeTask: async (task) => task,
      listTasks: async () => [],
      readLog: async () => '',
          register: async (body) => {
            const users = require('../lib/users');
            return await users.register(body.name, body.password);
          },
          login: async (body) => {
            const users = require('../lib/users');
            return await users.login(body.name, body.password);
          },
          logout: require('../lib/users').logout,
      verifyToken: require('../lib/users').verifyToken,
      getCurrentUser: async (userId) => ({ id: userId, name: 'test-user', role: 'user' }),
      getUsers: require('../lib/users').getUsers,
      getUserRole: require('../lib/users').getUserRole,
      isAdmin: require('../lib/users').isAdmin,
      setRole: require('../lib/users').setRole,
      setUserGroupId: require('../lib/users').setUserGroupId,
      getUserById: require('../lib/users').getUserById,
      getUserPermissions: require('../lib/users').getUserPermissions,
      setSecurityQuestion: require('../lib/users').setSecurityQuestion,
      resetPasswordBySecurityQuestion: require('../lib/users').resetPasswordBySecurityQuestion,
      getUserSessions: require('../lib/users').getUserSessions,
      invalidateUserSessions: require('../lib/users').invalidateUserSessions,
      invalidateToken: require('../lib/users').invalidateToken,
      generateTwoFactorSetup: require('../lib/users').generateTwoFactorSetup,
      enableTwoFactor: require('../lib/users').enableTwoFactor,
      disableTwoFactor: require('../lib/users').disableTwoFactor,
      loginWith2FA: require('../lib/users').loginWith2FA,
      loadTokens: require('../lib/users').loadTokens
    };
    
    require('../routes/health')(mockServer, mockDeps);
    require('../routes/tasks')(mockServer, mockDeps);
    require('../routes/auth')(mockServer, mockDeps);
    
    let requestBody = '';
    
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      
      requestBody = '';
      req.on('data', chunk => requestBody += chunk);
      req.on('end', async () => {
        let parsedBody = {};
        try {
          parsedBody = requestBody ? JSON.parse(requestBody) : {};
        } catch (e) {
          parsedBody = {};
        }
        
        const mockReq = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: parsedBody
        };
        
        mockDeps._body = parsedBody;
        
        try {
          for (const handler of requestHandlers) {
            await handler(mockReq, res);
            if (res.writableEnded) return;
          }
        } catch (error) {
          if (!res.writableEnded) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        }
      });
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${TEST_PORT} is already in use`));
      } else {
        reject(err);
      }
    });
    
    server.listen(TEST_PORT, () => {
      serverUrl = `http://127.0.0.1:${TEST_PORT}`;
      log(`Test server started at ${serverUrl}`, 'success');
      resolve({ server, url: serverUrl });
    });
  });
}

async function stopTestServer(server) {
  return new Promise((resolve) => {
    log('Stopping test server...', 'info');
    server.close(() => {
      log('Test server stopped', 'info');
      resolve();
    });
  });
}

async function runTestFile(filePath, serverUrl) {
  const relativePath = path.relative(ROOT, filePath);
  log(`\nRunning ${relativePath}...`, 'test');
  
  try {
    const testModule = require(filePath);
    
    if (typeof testModule.runTests === 'function') {
      await testModule.runTests(serverUrl);
    } else {
      log(`  No runTests function found in ${relativePath}`, 'warn');
    }
    
    testResults.passed++;
    log(`  ✓ ${relativePath} passed`, 'success');
  } catch (err) {
    testResults.failed++;
    log(`  ✗ ${relativePath} failed: ${err.message}`, 'error');
    if (err.stack) {
      console.log(err.stack.split('\n').slice(1, 3).join('\n'));
    }
  }
  
  testResults.total++;
}

async function runAllTests() {
  const testFiles = await discoverTests();
  
  if (testFiles.length === 0) {
    log('No test files found', 'warn');
    return 0;
  }
  
  log(`Discovered ${testFiles.length} test file(s)`, 'info');
  
  let server = null;
  
  try {
    const serverInfo = await startTestServer();
    server = serverInfo.server;
    serverUrl = serverInfo.url;
    
    log('Running tests sequentially...\n', 'info');
    
    for (const file of testFiles) {
      await runTestFile(file, serverUrl);
    }
    
  } catch (err) {
    log(`Failed to start test server: ${err.message}`, 'error');
    return 1;
  } finally {
    if (server) {
      await stopTestServer(server);
    }
  }
  
  printSummary();
  
  return testResults.failed > 0 ? 1 : 0;
}

function printSummary() {
  console.log('\n' + '='.repeat(50));
  log('Test Summary', 'info');
  console.log('='.repeat(50));
  log(`Total:  ${testResults.total}`, 'info');
  log(`Passed: ${testResults.passed}`, testResults.passed > 0 ? 'success' : 'warn');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'warn');
  console.log('='.repeat(50));
}

if (require.main === module) {
  runAllTests()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(err => {
      log(`Fatal error: ${err.message}`, 'error');
      process.exit(1);
    });
}

module.exports = { runAllTests, testResults };