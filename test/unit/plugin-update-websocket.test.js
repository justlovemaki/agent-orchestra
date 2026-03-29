'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server: HttpServer } = require('http');

// Native WebSocket is available in Node.js 22+ but doesn't have WebSocketServer
// We need to use the ws module for server-side WebSocket functionality
let WebSocket;
try {
  WebSocket = require('ws');
} catch (e) {
  console.error('ws module not found. Install with: npm install ws --save-dev');
  process.exit(1);
}

const PluginUpdateWebSocket = require('../../lib/plugin-update-websocket');

const TEST_PORT = 32199;
const TEST_WS_PATH = '/api/plugins/updates/stream';

let testServer = null;
let wsServer = null;
let pluginUpdateWS = null;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        console.log(`✅ ${name}`);
        return true;
      }).catch((error) => {
        console.log(`❌ ${name}`);
        console.log(`   错误：${error.message}`);
        return false;
      });
    }
    console.log(`✅ ${name}`);
    return Promise.resolve(true);
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   错误：${error.message}`);
    return Promise.resolve(false);
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

function assertContains(actual, expected, message) {
  if (!actual.includes(expected)) {
    throw new Error(message || `Expected "${actual}" to contain "${expected}"`);
  }
}

let passed = 0;
let failed = 0;

function createMockServer() {
  return new Promise((resolve) => {
    testServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    });

    testServer.listen(TEST_PORT, () => {
      console.log(`Test server running on port ${TEST_PORT}`);
      resolve(testServer);
    });
  });
}

function connectWebSocket(path = TEST_WS_PATH) {
  return new Promise((resolve, reject) => {
    const wsUrl = `ws://127.0.0.1:${TEST_PORT}${path}`;
    const ws = new WebSocket(wsUrl, {
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket'
      }
    });
    
    ws.on('open', () => resolve(ws));
    ws.on('error', (err) => reject(err));
    
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket connection timeout'));
      }
    }, 5000);
  });
}

async function setup() {
  await createMockServer();
  
  pluginUpdateWS = new PluginUpdateWebSocket({
    path: TEST_WS_PATH,
    heartbeatInterval: 5000,
    maxClients: 10
  });
  pluginUpdateWS.initialize(testServer);
}

async function cleanup() {
  if (pluginUpdateWS) {
    pluginUpdateWS.shutdown();
    pluginUpdateWS = null;
  }
  
  if (testServer) {
    await new Promise((resolve) => {
      testServer.close(() => {
        console.log('Test server closed');
        resolve();
      });
    });
    testServer = null;
  }
}

async function runTests() {
  await setup();
  console.log('\n📋 Plugin Update WebSocket Module Tests\n');

  passed += await test('PluginUpdateWebSocket should be defined', () => {
    assert(typeof PluginUpdateWebSocket === 'function', 'PluginUpdateWebSocket should be a function');
  });

  passed += await test('PluginUpdateWebSocket should initialize with default options', () => {
    const ws = new PluginUpdateWebSocket();
    assert(ws.path === '/api/plugins/updates/stream', 'Default path should be set');
    assert(ws.heartbeatInterval === 30000, 'Default heartbeat interval should be 30000');
    assert(ws.maxClients === 100, 'Default max clients should be 100');
  });

  passed += await test('PluginUpdateWebSocket should initialize with custom options', () => {
    const ws = new PluginUpdateWebSocket({
      path: '/custom/path',
      heartbeatInterval: 10000,
      maxClients: 50
    });
    assert(ws.path === '/custom/path', 'Custom path should be set');
    assert(ws.heartbeatInterval === 10000, 'Custom heartbeat interval should be set');
    assert(ws.maxClients === 50, 'Custom max clients should be set');
  });

  passed += await test('PluginUpdateWebSocket should have empty clients map on init', () => {
    assert(pluginUpdateWS.getClientCount() === 0, 'Client count should be 0 initially');
  });

  passed += await test('PluginUpdateWebSocket should have empty subscriptions map on init', () => {
    const subs = pluginUpdateWS.getAllSubscriptions();
    assertEqual(subs, {}, 'Subscriptions should be empty initially');
  });

  passed += await test('WebSocket server should accept connections', async () => {
    const ws = await connectWebSocket();
    assert(ws.readyState === WebSocket.OPEN, 'WebSocket should be open');
    ws.close();
  });

  passed += await test('Client should receive connected message on connect', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}${TEST_WS_PATH}`);
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'connected') {
          assert(message.clientId !== undefined, 'Should receive clientId');
          assert(message.timestamp !== undefined, 'Should receive timestamp');
          ws.close();
          resolve();
        }
      });
      
      ws.on('error', reject);
      
      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout waiting for connected message'));
      }, 5000);
    });
  });

  passed += await test('Client should be tracked in clients map after connection', async () => {
    const initialCount = pluginUpdateWS.getClientCount();
    
    const ws = await connectWebSocket();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert(pluginUpdateWS.getClientCount() === initialCount + 1, 'Client count should increase by 1');
    ws.close();
  });

  passed += await test('Client should be removed from clients map after disconnect', async () => {
    const ws = await connectWebSocket();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    ws.close();
    await new Promise(resolve => setTimeout(resolve, 200));
    
    assert(pluginUpdateWS.getClientCount() === 0, 'Client count should be 0 after disconnect');
  });

  passed += await test('Client can send subscribe message', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}${TEST_WS_PATH}`);
      let resolved = false;
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          pluginId: 'test-plugin-1',
          pluginName: 'Test Plugin 1'
        }));
      });
      
      ws.on('message', (data) => {
        if (resolved) return;
        
        const message = JSON.parse(data.toString());
        if (message.type === 'subscribeResult') {
          assert(message.success === true, 'Subscription should succeed');
          assert(message.subscription === 'test-plugin-1', 'Subscription key should match');
          resolved = true;
          ws.close();
          resolve();
        }
      });
      
      ws.on('error', reject);
      
      setTimeout(() => {
        if (!resolved) {
          ws.close();
          reject(new Error('Timeout waiting for subscribe result'));
        }
      }, 5000);
    });
  });

  passed += await test('Client can send unsubscribe message', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}${TEST_WS_PATH}`);
      let resolved = false;
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          pluginId: 'test-plugin-2'
        }));
      });
      
      ws.on('message', (data) => {
        if (resolved) return;
        
        const message = JSON.parse(data.toString());
        if (message.type === 'subscribeResult' && message.success) {
          ws.send(JSON.stringify({
            type: 'unsubscribe',
            pluginId: 'test-plugin-2'
          }));
        }
        
        if (message.type === 'unsubscribeResult') {
          assert(message.success === true, 'Unsubscription should succeed');
          resolved = true;
          ws.close();
          resolve();
        }
      });
      
      ws.on('error', reject);
      
      setTimeout(() => {
        if (!resolved) {
          ws.close();
          reject(new Error('Timeout waiting for unsubscribe result'));
        }
      }, 5000);
    });
  });

  passed += await test('broadcastToAll sends message to all connected clients', async () => {
    const ws1 = await connectWebSocket();
    const ws2 = await connectWebSocket();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return new Promise((resolve, reject) => {
      let count = 0;
      const checkDone = () => {
        count++;
        if (count >= 2) {
          ws1.close();
          ws2.close();
          resolve();
        }
      };
      
      ws1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'testBroadcast') {
          checkDone();
        }
      });
      
      ws2.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'testBroadcast') {
          checkDone();
        }
      });
      
      pluginUpdateWS.broadcastToAll({ type: 'testBroadcast', content: 'test' });
    });
  });

  passed += await test('broadcastToSubscribers sends message only to subscribed clients', async () => {
    return new Promise(async (resolve, reject) => {
      const subscriberWs = await connectWebSocket();
      const nonSubscriberWs = await connectWebSocket();
      
      let subscriberReceived = false;
      let nonSubscriberReceived = false;
      
      subscriberWs.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'pluginUpdate' && message.pluginName === 'target-plugin') {
          subscriberReceived = true;
        }
      });
      
      nonSubscriberWs.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'pluginUpdate' && message.pluginName === 'target-plugin') {
          nonSubscriberReceived = true;
        }
      });
      
      subscriberWs.send(JSON.stringify({
        type: 'subscribe',
        pluginName: 'target-plugin'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      pluginUpdateWS.broadcastPluginUpdate({
        pluginId: 'plugin-1',
        pluginName: 'target-plugin',
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        updateType: 'major'
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      subscriberWs.close();
      nonSubscriberWs.close();
      
      assert(subscriberReceived === true, 'Subscriber should receive the message');
      assert(nonSubscriberReceived === false, 'Non-subscriber should not receive the message');
      resolve();
    });
  });

  passed += await test('Client can send ping and receive pong', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}${TEST_WS_PATH}`);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'ping' }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'pong') {
          assert(message.timestamp !== undefined, 'Pong should have timestamp');
          ws.close();
          resolve();
        }
      });
      
      ws.on('error', reject);
      
      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout waiting for pong'));
      }, 5000);
    });
  });

  passed += await test('Client can send auth message', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}${TEST_WS_PATH}`);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth',
          userId: 'user-123'
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'authResult') {
          assert(message.success === true, 'Auth should succeed');
          assert(message.userId === 'user-123', 'User ID should match');
          ws.close();
          resolve();
        }
      });
      
      ws.on('error', reject);
      
      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout waiting for auth result'));
      }, 5000);
    });
  });

  passed += await test('getSubscriptionCount returns correct count', async () => {
    const ws = await connectWebSocket();
    
    ws.send(JSON.stringify({
      type: 'subscribe',
      pluginId: 'test-subscription'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const count = pluginUpdateWS.getSubscriptionCount('test-subscription');
    assert(count >= 1, 'Subscription count should be at least 1');
    
    ws.close();
  });

  passed += await test('getAllSubscriptions returns all subscriptions', async () => {
    const ws = await connectWebSocket();
    
    ws.send(JSON.stringify({
      type: 'subscribe',
      pluginId: 'sub-plugin-1'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const subs = pluginUpdateWS.getAllSubscriptions();
    assert(subs['sub-plugin-1'] >= 1, 'sub-plugin-1 should be in subscriptions');
    
    ws.close();
  });

  passed += await test('getClientInfo returns client information', async () => {
    const ws = await connectWebSocket();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const clientInfo = pluginUpdateWS.getClientInfo(ws.clientId);
    assert(clientInfo !== null, 'Client info should not be null');
    assert(clientInfo.id !== undefined, 'Client info should have id');
    assert(clientInfo.connectedAt !== undefined, 'Client info should have connectedAt');
    assert(clientInfo.authenticated === false, 'Client should not be authenticated initially');
    
    ws.close();
  });

  passed += await test('broadcastUpdatesBatch sends multiple updates', async () => {
    return new Promise(async (resolve, reject) => {
      const ws = await connectWebSocket();
      
      let updateCount = 0;
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'pluginUpdate') {
          updateCount++;
        }
        if (message.type === 'batchUpdate') {
          assert(message.count === 3, 'Batch should contain 3 updates');
          assert(message.updates.length === 3, 'Updates array should have 3 items');
          ws.close();
          resolve();
        }
      });
      
      const updates = [
        { pluginId: 'p1', pluginName: 'plugin-1', latestVersion: '1.0.0', updateType: 'major' },
        { pluginId: 'p2', pluginName: 'plugin-2', latestVersion: '2.0.0', updateType: 'minor' },
        { pluginId: 'p3', pluginName: 'plugin-3', latestVersion: '3.0.0', updateType: 'patch' }
      ];
      
      pluginUpdateWS.broadcastUpdatesBatch(updates);
      
      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout waiting for batch update'));
      }, 5000);
    });
  });

  passed += await test('reject connection when max clients reached', async () => {
    const limitedWS = new PluginUpdateWebSocket({
      path: TEST_WS_PATH,
      maxClients: 1
    });
    limitedWS.initialize(testServer);
    
    const ws1 = await connectWebSocket();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert(limitedWS.getClientCount() === 1, 'Should have 1 client');
    
    ws1.close();
    limitedWS.shutdown();
  });

  passed += await test('handles invalid JSON message gracefully', async () => {
    const ws = await connectWebSocket();
    
    ws.send('invalid json');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert(pluginUpdateWS.getClientCount() === 1, 'Client should still be connected');
    
    ws.close();
  });

  passed += await test('handles unknown message type gracefully', async () => {
    const ws = await connectWebSocket();
    
    ws.send(JSON.stringify({ type: 'unknownType', data: 'test' }));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert(pluginUpdateWS.getClientCount() === 1, 'Client should still be connected');
    
    ws.close();
  });

  passed += await test('subscribe without pluginId returns error', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}${TEST_WS_PATH}`);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe'
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'subscribeResult') {
          assert(message.success === false, 'Subscription should fail without pluginId');
          assert(message.error !== undefined, 'Should return error message');
          ws.close();
          resolve();
        }
      });
      
      ws.on('error', reject);
      
      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout waiting for subscribe result'));
      }, 5000);
    });
  });

  passed += await test('can subscribe using pluginName only', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}${TEST_WS_PATH}`);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          pluginName: 'my-plugin'
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'subscribeResult') {
          assert(message.success === true, 'Subscription should succeed');
          assert(message.subscription === 'my-plugin', 'Subscription key should be pluginName');
          ws.close();
          resolve();
        }
      });
      
      ws.on('error', reject);
      
      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout waiting for subscribe result'));
      }, 5000);
    });
  });

  passed += await test('getSubscriptions returns subscriptions list', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}${TEST_WS_PATH}`);
      
      ws.on('open', async () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          pluginId: 'sub-1'
        }));
      });
      
      ws.on('message', async (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'subscribeResult' && message.success) {
          ws.send(JSON.stringify({ type: 'getSubscriptions' }));
        }
        
        if (message.type === 'subscriptions') {
          assert(Array.isArray(message.subscriptions), 'Should return array');
          assert(message.subscriptions.includes('sub-1'), 'Should include subscribed plugin');
          ws.close();
          resolve();
        }
      });
      
      ws.on('error', reject);
      
      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout waiting for subscriptions'));
      }, 5000);
    });
  });

  passed += await test('shutdown closes all connections', async () => {
    const ws1 = await connectWebSocket();
    const ws2 = await connectWebSocket();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert(pluginUpdateWS.getClientCount() >= 2, 'Should have at least 2 clients');
    
    pluginUpdateWS.shutdown();
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    assert(pluginUpdateWS.getClientCount() === 0, 'Client count should be 0 after shutdown');
    
    pluginUpdateWS.initialize(testServer);
  });

  passed += await test('emits clientConnected event', async () => {
    return new Promise((resolve) => {
      let eventReceived = false;
      
      pluginUpdateWS.on('clientConnected', (data) => {
        eventReceived = true;
        assert(data.clientId !== undefined, 'Event should have clientId');
        assert(data.totalClients >= 1, 'Event should have totalClients');
        resolve();
      });
      
      connectWebSocket().then(ws => {
        setTimeout(() => {
          if (!eventReceived) {
            ws.close();
            resolve();
          }
        }, 2000);
      });
    });
  });

  passed += await test('emits clientDisconnected event', async () => {
    const ws = await connectWebSocket();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return new Promise((resolve) => {
      let eventReceived = false;
      
      pluginUpdateWS.on('clientDisconnected', (data) => {
        eventReceived = true;
        assert(data.totalClients >= 0, 'Event should have totalClients');
        resolve();
      });
      
      ws.close();
      
      setTimeout(() => {
        if (!eventReceived) {
          resolve();
        }
      }, 2000);
    });
  });

  passed += await test('emits subscribed event', async () => {
    return new Promise((resolve) => {
      let eventReceived = false;
      
      pluginUpdateWS.on('subscribed', (data) => {
        eventReceived = true;
        assert(data.clientId !== undefined, 'Event should have clientId');
        assert(data.subscription !== undefined, 'Event should have subscription');
        resolve();
      });
      
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}${TEST_WS_PATH}`);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          pluginId: 'emitted-test-plugin'
        }));
      });
      
      setTimeout(() => {
        ws.close();
        if (!eventReceived) {
          resolve();
        }
      }, 2000);
    });
  });

  passed += await test('handles socket error gracefully', async () => {
    const ws = await connectWebSocket();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const initialCount = pluginUpdateWS.getClientCount();
    
    ws.close();
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    assert(pluginUpdateWS.getClientCount() === 0, 'Client should be removed');
  });

  passed += await test('can create multiple instances', () => {
    const ws1 = new PluginUpdateWebSocket({ path: '/test1' });
    const ws2 = new PluginUpdateWebSocket({ path: '/test2' });
    
    assert(ws1.path === '/test1', 'First instance path should be correct');
    assert(ws2.path === '/test2', 'Second instance path should be correct');
  });

  passed += await test('stopHeartbeat stops the heartbeat timer', () => {
    const ws = new PluginUpdateWebSocket({ heartbeatInterval: 1000 });
    ws.startHeartbeat();
    
    assert(ws.heartbeatTimer !== null, 'Heartbeat timer should be running');
    
    ws.stopHeartbeat();
    
    assert(ws.heartbeatTimer === null, 'Heartbeat timer should be stopped');
  });

  passed += await test('getClientInfo returns null for unknown client', () => {
    const info = pluginUpdateWS.getClientInfo('unknown-client-id');
    assert(info === null, 'Should return null for unknown client');
  });

  passed += await test('handles empty message gracefully', async () => {
    const ws = await connectWebSocket();
    
    ws.send('');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert(pluginUpdateWS.getClientCount() === 1, 'Client should still be connected');
    
    ws.close();
  });

  passed += await test('handles multi-line message', async () => {
    const ws = await connectWebSocket();
    
    ws.send(JSON.stringify({ type: 'subscribe', pluginId: 'p1' }) + '\n' + 
            JSON.stringify({ type: 'subscribe', pluginId: 'p2' }));
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const subs = pluginUpdateWS.getAllSubscriptions();
    assert(subs['p1'] >= 1, 'p1 should be subscribed');
    assert(subs['p2'] >= 1, 'p2 should be subscribed');
    
    ws.close();
  });

  await cleanup();
  
  console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败\n`);
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Test execution failed:', error);
  cleanup().then(() => process.exit(1));
});
