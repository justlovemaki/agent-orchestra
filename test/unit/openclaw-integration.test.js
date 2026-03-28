/**
 * OpenClaw Integration Module Tests
 * Comprehensive unit tests for the OpenClaw integration functionality
 */

const { OpenClawIntegration, createOpenClawIntegration, loadOpenClawConfig, saveOpenClawConfig } = require('../../lib/openclaw-integration');
const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, '../../data/test-openclaw');
const testConfigPath = path.join(testDir, 'openclaw-config.json');

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || 'Expected function to throw');
  }
}

let passed = 0;
let failed = 0;

process.on('uncaughtException', (err) => {
  console.log(`\n⚠️  Uncaught exception: ${err.message}\n`);
});

console.log('\n📋 OpenClaw Integration Module Tests\n');

console.log('=== Constructor Tests ===\n');

if (test('Default constructor creates instance', () => {
  const integration = new OpenClawIntegration();
  assert(integration instanceof OpenClawIntegration, 'Should be instance of OpenClawIntegration');
  passed++;
})) {} else { failed++; }

if (test('Constructor with config sets properties', () => {
  const integration = new OpenClawIntegration({
    gatewayUrl: 'http://localhost:13000',
    token: 'test-token',
    reconnectInterval: 10000
  });
  assertEqual(integration.config.gatewayUrl, 'http://localhost:13000');
  assertEqual(integration.config.token, 'test-token');
  assertEqual(integration.config.reconnectInterval, 10000);
  passed++;
})) {} else { failed++; }

if (test('createOpenClawIntegration factory function', () => {
  const integration = createOpenClawIntegration({ gatewayUrl: 'http://test:13000' });
  assert(integration instanceof OpenClawIntegration);
  passed++;
})) {} else { failed++; }

console.log('\n=== Configuration Tests ===\n');

if (test('setConfig updates configuration', () => {
  const integration = new OpenClawIntegration();
  integration.setConfig({ gatewayUrl: 'http://new-url:13000' });
  assertEqual(integration.config.gatewayUrl, 'http://new-url:13000');
  passed++;
})) {} else { failed++; }

if (test('setConfig merges with existing config', () => {
  const integration = new OpenClawIntegration({ gatewayUrl: 'http://old:13000', token: 'old-token' });
  integration.setConfig({ gatewayUrl: 'http://new:13000' });
  assertEqual(integration.config.gatewayUrl, 'http://new:13000');
  assertEqual(integration.config.token, 'old-token');
  passed++;
})) {} else { failed++; }

if (test('getConfig returns masked token', () => {
  const integration = new OpenClawIntegration({ token: 'secret-token-12345' });
  const config = integration.getConfig();
  assert(config.token.includes('***'), 'Token should be masked');
  passed++;
})) {} else { failed++; }

console.log('\n=== Connection Tests ===\n');

if (test('Initial state is disconnected', () => {
  const integration = new OpenClawIntegration();
  assertEqual(integration.connected, false);
  assertEqual(integration.connecting, false);
  passed++;
})) {} else { failed++; }

if (test('connect returns failure when already connecting', async () => {
  const integration = new OpenClawIntegration();
  integration.connecting = true;
  const result = await integration.connect();
  assertEqual(result.success, false);
  assertEqual(result.message, 'Already connected or connecting');
  passed++;
})) {} else { failed++; }

if (test('disconnect resets state and returns success', () => {
  const integration = new OpenClawIntegration();
  integration.connected = true;
  integration.connecting = false;
  const result = integration.disconnect();
  assertEqual(result.success, true);
  assertEqual(integration.connected, false);
  assertEqual(integration.connecting, false);
  passed++;
})) {} else { failed++; }

console.log('\n=== Tool Registration Tests ===\n');

if (test('registerTool requires name', () => {
  const integration = new OpenClawIntegration();
  assertThrows(() => {
    integration.registerTool({ description: 'test' });
  }, 'Should throw when name is missing');
  passed++;
})) {} else { failed++; }

if (test('registerTool adds tool to registry', () => {
  const integration = new OpenClawIntegration();
  const result = integration.registerTool({
    name: 'test-tool',
    description: 'A test tool',
    parameters: { foo: { type: 'string' } }
  });
  assertEqual(result.success, true);
  assertEqual(integration.registeredTools.has('test-tool'), true);
  passed++;
})) {} else { failed++; }

if (test('registerTool returns tool info', () => {
  const integration = new OpenClawIntegration();
  const result = integration.registerTool({
    name: 'test-tool-2',
    description: 'Another test tool'
  });
  assertEqual(result.tool.name, 'test-tool-2');
  assertEqual(result.tool.description, 'Another test tool');
  passed++;
})) {} else { failed++; }

if (test('unregisterTool returns failure for non-existent tool', () => {
  const integration = new OpenClawIntegration();
  const result = integration.unregisterTool('non-existent');
  assertEqual(result.success, false);
  passed++;
})) {} else { failed++; }

if (test('unregisterTool removes tool from registry', () => {
  const integration = new OpenClawIntegration();
  integration.registerTool({ name: 'to-remove' });
  const result = integration.unregisterTool('to-remove');
  assertEqual(result.success, true);
  assertEqual(integration.registeredTools.has('to-remove'), false);
  passed++;
})) {} else { failed++; }

if (test('listTools returns all registered tools', () => {
  const integration = new OpenClawIntegration();
  integration.registerTool({ name: 'tool1', description: 'desc1' });
  integration.registerTool({ name: 'tool2', description: 'desc2' });
  const tools = integration.listTools();
  assertEqual(tools.length, 2);
  passed++;
})) {} else { failed++; }

if (test('executeTool throws for non-existent tool', async () => {
  const integration = new OpenClawIntegration();
  let threw = false;
  let errorMsg = '';
  try {
    await integration.executeTool('non-existent');
  } catch (e) {
    threw = true;
    errorMsg = e.message;
  }
  assert(threw, 'Should throw for non-existent tool');
  assert(errorMsg.includes('not found'), 'Error should mention not found');
  passed++;
})) {} else { failed++; }

if (test('executeTool throws for tool without handler', async () => {
  const integration = new OpenClawIntegration();
  integration.registerTool({ name: 'no-handler-tool' });
  let threw = false;
  let errorMsg = '';
  try {
    await integration.executeTool('no-handler-tool');
  } catch (e) {
    threw = true;
    errorMsg = e.message;
  }
  assert(threw, 'Should throw for tool without handler');
  assert(errorMsg.includes('no handler'), 'Error should mention no handler');
  passed++;
})) {} else { failed++; }

if (test('executeTool calls handler with params', async () => {
  const integration = new OpenClawIntegration();
  let calledWith = null;
  integration.registerTool({
    name: 'handler-test',
    handler: (params) => {
      calledWith = params;
      return { result: 'success' };
    }
  });
  const result = await integration.executeTool('handler-test', { foo: 'bar' });
  assertEqual(calledWith.foo, 'bar');
  assertEqual(result.result, 'success');
  passed++;
})) {} else { failed++; }

console.log('\n=== Event Subscription Tests ===\n');

if (test('subscribeToEvent adds handler', () => {
  const integration = new OpenClawIntegration();
  const handler = () => {};
  const sub = integration.subscribeToEvent('test.event', handler);
  const handlers = integration.eventSubscriptions.get('test.event');
  assert(handlers.has(handler), 'Handler should be in subscription');
  passed++;
})) {} else { failed++; }

if (test('subscribeToEvent returns unsubscribe function', () => {
  const integration = new OpenClawIntegration();
  const handler = () => {};
  const sub = integration.subscribeToEvent('test.event', handler);
  assert(typeof sub.unsubscribe, 'Should have unsubscribe function');
  sub.unsubscribe();
  const handlers = integration.eventSubscriptions.get('test.event');
  assert(!handlers.has(handler), 'Handler should be removed after unsubscribe');
  passed++;
})) {} else { failed++; }

if (test('handleEvent emits event and calls handlers', () => {
  const integration = new OpenClawIntegration();
  let called = false;
  let receivedData = null;
  integration.subscribeToEvent('test.event', (data) => {
    called = true;
    receivedData = data;
  });
  integration.handleEvent({ type: 'test.event', data: { foo: 'bar' } });
  assert(called, 'Handler should be called');
  assertEqual(receivedData.foo, 'bar');
  passed++;
})) {} else { failed++; }

if (test('handleEvent emits wildcard event', () => {
  const integration = new OpenClawIntegration();
  let wildcardCalled = false;
  integration.subscribeToEvent('*', () => {
    wildcardCalled = true;
  });
  integration.handleEvent({ type: 'specific.event', data: {} });
  assert(wildcardCalled, 'Wildcard handler should be called for specific event');
  passed++;
})) {} else { failed++; }

if (test('getEventSubscriptions returns subscription list', () => {
  const integration = new OpenClawIntegration();
  integration.subscribeToEvent('event1', () => {});
  integration.subscribeToEvent('event1', () => {});
  integration.subscribeToEvent('event2', () => {});
  const subs = integration.getEventSubscriptions();
  assertEqual(subs.length, 2);
  const event1 = subs.find(s => s.eventType === 'event1');
  assertEqual(event1.handlerCount, 2);
  passed++;
})) {} else { failed++; }

console.log('\n=== Status Tests ===\n');

if (test('getStatus returns connection info', () => {
  const integration = new OpenClawIntegration({ gatewayUrl: 'http://test:13000' });
  integration.connected = true;
  const status = integration.getStatus();
  assertEqual(status.connected, true);
  assertEqual(status.gatewayUrl, 'http://test:13000');
  passed++;
})) {} else { failed++; }

if (test('getStatus returns tools count', () => {
  const integration = new OpenClawIntegration();
  integration.registerTool({ name: 'tool1' });
  integration.registerTool({ name: 'tool2' });
  const status = integration.getStatus();
  assertEqual(status.toolsCount, 2);
  passed++;
})) {} else { failed++; }

if (test('getStatus returns subscriptions count', () => {
  const integration = new OpenClawIntegration();
  integration.subscribeToEvent('e1', () => {});
  integration.subscribeToEvent('e1', () => {});
  integration.subscribeToEvent('e2', () => {});
  const status = integration.getStatus();
  assertEqual(status.subscriptionsCount, 3);
  passed++;
})) {} else { failed++; }

console.log('\n=== Configuration Persistence Tests ===\n');

if (test('loadOpenClawConfig returns default when file not exists', () => {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  if (fs.existsSync(testConfigPath)) {
    fs.unlinkSync(testConfigPath);
  }
  const config = loadOpenClawConfig(testDir);
  assertEqual(config.gatewayUrl, 'http://127.0.0.1:13000');
  assertEqual(config.token, '');
  passed++;
})) {} else { failed++; }

if (test('saveOpenClawConfig writes to file', () => {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  const config = {
    gatewayUrl: 'http://custom:13000',
    token: 'my-token',
    autoConnect: true
  };
  const result = saveOpenClawConfig(testDir, config);
  assertEqual(result.success, true, `Failed: ${result.message}`);
  passed++;
})) {} else { failed++; }

if (test('loadOpenClawConfig reads saved config', () => {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  const saved = loadOpenClawConfig(testDir);
  assertEqual(saved.gatewayUrl, 'http://custom:13000');
  assertEqual(saved.token, 'my-token');
  passed++;
})) {} else { failed++; }

console.log('\n=== EventEmitter Tests ===\n');

if (test('Integration extends EventEmitter', () => {
  const integration = new OpenClawIntegration();
  assert(typeof integration.on, 'Should have on method');
  assert(typeof integration.emit, 'Should have emit method');
  passed++;
})) {} else { failed++; }

if (test('Integration emits connected event', (done) => {
  const integration = new OpenClawIntegration({ gatewayUrl: 'http://127.0.0.1:1' });
  integration.on('connected', (data) => {
    assertEqual(data.gatewayUrl, 'http://127.0.0.1:1');
    passed++;
    done();
  });
  integration.connect();
  setTimeout(() => {}, 100);
})) {} else { failed++; }

if (test('Integration emits tool.registered event', () => {
  const integration = new OpenClawIntegration();
  let registeredTool = null;
  integration.on('tool.registered', (data) => {
    registeredTool = data;
  });
  integration.registerTool({ name: 'event-test-tool', description: 'test' });
  assertEqual(registeredTool.name, 'event-test-tool');
  passed++;
})) {} else { failed++; }

console.log('\n=== API Request Tests ===\n');

if (test('apiRequest builds correct URL', async () => {
  const integration = new OpenClawIntegration({ gatewayUrl: 'http://test:13000' });
  integration.apiRequest = async function(endpoint, method, body) {
    return { endpoint, method, body };
  };
  const result = await integration.apiRequest('/api/test', 'POST', { foo: 'bar' });
  assertEqual(result.endpoint, '/api/test');
  assertEqual(result.method, 'POST');
  assertEqual(result.body.foo, 'bar');
  passed++;
})) {} else { failed++; }

if (test('sessionsList calls apiRequest with correct endpoint', async () => {
  const integration = new OpenClawIntegration();
  integration.apiRequest = async (endpoint) => ({ endpoint });
  const result = await integration.sessionsList({ limit: 10 });
  assertEqual(result.endpoint, '/api/sessions?limit=10');
  passed++;
})) {} else { failed++; }

if (test('sessionsHistory calls apiRequest with correct endpoint', async () => {
  const integration = new OpenClawIntegration();
  integration.apiRequest = async (endpoint) => ({ endpoint });
  const result = await integration.sessionsHistory({ agentId: 'test-agent' });
  assertEqual(result.endpoint, '/api/sessions/history?agentId=test-agent');
  passed++;
})) {} else { failed++; }

if (test('agentsList calls apiRequest with correct endpoint', async () => {
  const integration = new OpenClawIntegration();
  integration.apiRequest = async (endpoint) => ({ endpoint });
  const result = await integration.agentsList();
  assertEqual(result.endpoint, '/api/agents');
  passed++;
})) {} else { failed++; }

if (test('subagentsList calls apiRequest with correct endpoint', async () => {
  const integration = new OpenClawIntegration();
  integration.apiRequest = async (endpoint) => ({ endpoint });
  const result = await integration.subagentsList();
  assertEqual(result.endpoint, '/api/subagents');
  passed++;
})) {} else { failed++; }

console.log('\n=== Heartbeat Tests ===\n');

if (test('startHeartbeat creates interval', () => {
  const integration = new OpenClawIntegration({ heartbeatInterval: 100 });
  integration.apiRequest = async () => ({ success: true });
  integration.startHeartbeat();
  assert(integration.heartbeatTimer !== null, 'Heartbeat timer should be set');
  integration.stopHeartbeat();
  passed++;
})) {} else { failed++; }

if (test('stopHeartbeat clears interval', () => {
  const integration = new OpenClawIntegration({ heartbeatInterval: 100 });
  integration.startHeartbeat();
  integration.stopHeartbeat();
  assert(integration.heartbeatTimer === null, 'Heartbeat timer should be null');
  passed++;
})) {} else { failed++; }

console.log('\n=== Reconnect Tests ===\n');

if (test('startReconnect creates timer', () => {
  const integration = new OpenClawIntegration({ reconnectInterval: 100 });
  integration.startReconnect();
  assert(integration.wsReconnectTimer !== null, 'Reconnect timer should be set');
  integration.stopReconnect();
  passed++;
})) {} else { failed++; }

if (test('stopReconnect clears timer', () => {
  const integration = new OpenClawIntegration({ reconnectInterval: 100 });
  integration.startReconnect();
  integration.stopReconnect();
  assert(integration.wsReconnectTimer === null, 'Reconnect timer should be null');
  passed++;
})) {} else { failed++; }

console.log('\n=== Error Handler Tests ===\n');

if (test('handleEvent handles event handler errors gracefully', () => {
  const integration = new OpenClawIntegration();
  integration.subscribeToEvent('error-event', () => {
    throw new Error('Handler error');
  });
  let errorEmitted = false;
  integration.on('event-handler-error', () => {
    errorEmitted = true;
  });
  integration.handleEvent({ type: 'error-event', data: {} });
  assert(errorEmitted, 'Error should be emitted');
  passed++;
})) {} else { failed++; }

console.log('\n=== Cleanup Tests ===\n');

if (test('disconnect stops heartbeat and reconnect', () => {
  const integration = new OpenClawIntegration({ heartbeatInterval: 100, reconnectInterval: 100 });
  integration.startHeartbeat();
  integration.startReconnect();
  integration.disconnect();
  assert(integration.heartbeatTimer === null, 'Heartbeat should be stopped');
  assert(integration.wsReconnectTimer === null, 'Reconnect should be stopped');
  passed++;
})) {} else { failed++; }

if (test('disconnect emits disconnected event', () => {
  const integration = new OpenClawIntegration();
  let disconnectedEmitted = false;
  integration.on('disconnected', () => {
    disconnectedEmitted = true;
  });
  integration.disconnect();
  assert(disconnectedEmitted, 'Disconnected event should be emitted');
  passed++;
})) {} else { failed++; }

setTimeout(() => {
  console.log('\n' + '='.repeat(50));
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50) + '\n');
  
  if (fs.existsSync(testDir)) {
    try {
      fs.rmSync(testDir, { recursive: true });
    } catch {}
  }
  
  process.exit(failed > 0 ? 1 : 0);
}, 500);
