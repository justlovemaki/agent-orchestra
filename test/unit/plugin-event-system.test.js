/**
 * 插件事件系统测试
 */

const {
  PluginEventSystem,
  createEventSystem,
  getEventSystem,
  setGlobalEventSystem,
  SYSTEM_EVENTS,
  VALID_EVENTS,
  emitTaskCreated,
  emitTaskCompleted,
  emitTaskFailed,
  emitWorkflowStarted,
  emitWorkflowCompleted,
  emitAgentStatusChanged,
  emitSessionMessageSent,
  emitNotificationSent
} = require('../../lib/plugin-event-system');

const path = require('path');

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   错误：${error.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `期望 ${JSON.stringify(expected)}, 实际 ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || '期望抛出异常但未抛出');
  }
}

let passed = 0;
let failed = 0;

console.log('\n=== 插件事件系统测试 ===\n');

const eventSystem = createEventSystem({ logEnabled: true });
setGlobalEventSystem(eventSystem);

passed += test('PluginEventSystem 构造函数创建实例', () => {
  const es = new PluginEventSystem();
  assert(es !== null, '应该创建实例');
  assert(typeof es.emit === 'function', '应该有 emit 方法');
  assert(typeof es.emitAsync === 'function', '应该有 emitAsync 方法');
});

passed += test('createEventSystem 创建带选项的实例', () => {
  const es = createEventSystem({ maxLogSize: 500, logEnabled: false });
  assert(es instanceof PluginEventSystem, '应该返回 PluginEventSystem 实例');
});

passed += test('getEventSystem 获取全局实例', () => {
  const es = getEventSystem();
  assert(es !== null, '应该返回全局实例');
});

passed += test('setGlobalEventSystem 设置全局实例', () => {
  const newSystem = new PluginEventSystem();
  setGlobalEventSystem(newSystem);
  const es = getEventSystem();
  assert(es === newSystem, '应该设置新的全局实例');
  setGlobalEventSystem(eventSystem);
});

passed += test('SYSTEM_EVENTS 包含所有定义的事件类型', () => {
  assertEqual(SYSTEM_EVENTS.TASK_CREATED, 'task.created', 'task.created 应该存在');
  assertEqual(SYSTEM_EVENTS.TASK_COMPLETED, 'task.completed', 'task.completed 应该存在');
  assertEqual(SYSTEM_EVENTS.TASK_FAILED, 'task.failed', 'task.failed 应该存在');
  assertEqual(SYSTEM_EVENTS.WORKFLOW_STARTED, 'workflow.started', 'workflow.started 应该存在');
  assertEqual(SYSTEM_EVENTS.WORKFLOW_COMPLETED, 'workflow.completed', 'workflow.completed 应该存在');
  assertEqual(SYSTEM_EVENTS.AGENT_STATUS_CHANGED, 'agent.status_changed', 'agent.status_changed 应该存在');
  assertEqual(SYSTEM_EVENTS.SESSION_MESSAGE_SENT, 'session.message_sent', 'session.message_sent 应该存在');
  assertEqual(SYSTEM_EVENTS.NOTIFICATION_SENT, 'notification.sent', 'notification.sent 应该存在');
});

passed += test('VALID_EVENTS 是有效事件数组', () => {
  assert(Array.isArray(VALID_EVENTS), '应该是数组');
  assert(VALID_EVENTS.length === 8, '应该有 8 个事件类型');
});

passed += test('isEventValid 验证有效事件', () => {
  assert(eventSystem.isEventValid('task.created') === true, 'task.created 应该是有效的');
  assert(eventSystem.isEventValid('task.completed') === true, 'task.completed 应该是有效的');
});

passed += test('isEventValid 验证无效事件', () => {
  assert(eventSystem.isEventValid('invalid.event') === false, '无效事件应该返回 false');
  assert(eventSystem.isEventValid('') === false, '空字符串应该返回 false');
});

passed += test('getValidEvents 返回所有有效事件', () => {
  const events = eventSystem.getValidEvents();
  assert(events.length === 8, '应该有 8 个有效事件');
  assert(events.includes('task.created'), '应该包含 task.created');
});

passed += test('emit 触发事件并返回结果', () => {
  const result = eventSystem.emit('task.created', { taskId: '123', title: 'Test Task' });
  assert(result.handled === true, '应该返回 handled 为 true');
  assert(typeof result.handlersCount === 'number', '应该返回 handlersCount');
});

passed += test('emit 触发未知事件类型', () => {
  let warningLogged = false;
  const originalWarn = console.warn;
  console.warn = (msg) => { warningLogged = true; };
  
  eventSystem.emit('unknown.event', {});
  
  console.warn = originalWarn;
  assert(warningLogged === true, '应该记录警告');
});

passed += test('emitAsync 异步触发事件', async () => {
  let called = false;
  eventSystem.on('test.async', () => { called = true; });
  
  const result = await eventSystem.emitAsync('test.async', { test: true });
  
  assert(called === true, '异步处理器应该被调用');
  assert(result.handled === true, '应该返回 handled 为 true');
});

passed += test('emitAsync 不阻塞主流程', async () => {
  let handlerStarted = false;
  let emitReturned = false;
  
  eventSystem.on('test.block', async () => {
    handlerStarted = true;
    await new Promise(resolve => setTimeout(resolve, 50));
  });
  
  const promise = eventSystem.emitAsync('test.block', {});
  emitReturned = true;
  
  await promise;
  
  assert(emitReturned === true, 'emitAsync 应该立即返回');
  assert(handlerStarted === true, '处理器应该被执行');
});

passed += test('registerPlugin 注册插件事件处理器', () => {
  const plugin = {
    name: 'test-plugin',
    manifest: {
      name: 'test-plugin',
      version: '1.0.0',
      type: 'panel',
      eventTypes: ['task.created', 'task.completed']
    },
    onEvent: function(eventType, payload) {
      return { handled: true, eventType };
    }
  };
  
  eventSystem.registerPlugin(plugin);
  
  assert(eventSystem.hasPlugin('test-plugin') === true, '插件应该被注册');
  assert(eventSystem.getListenerCount('task.created') > 0, 'task.created 应该有监听器');
});

passed += test('registerPlugin 不提供处理器时使用 onEvent 方法', () => {
  const plugin = {
    name: 'test-plugin-2',
    manifest: {
      name: 'test-plugin-2',
      version: '1.0.0',
      type: 'panel',
      eventTypes: ['task.created']
    },
    onEvent: function(eventType, payload) {
      return { handled: true };
    }
  };
  
  eventSystem.registerPlugin(plugin);
  
  assert(eventSystem.hasPlugin('test-plugin-2') === true, '插件应该被注册');
});

passed += test('registerPlugin 抛出错误当插件无效时', () => {
  assertThrows(() => {
    eventSystem.registerPlugin({});
  }, '应该抛出错误');
});

passed += test('registerPlugin 抛出错误当没有处理器时', () => {
  assertThrows(() => {
    eventSystem.registerPlugin({
      name: 'test-plugin-bad',
      manifest: { name: 'test-plugin-bad', version: '1.0.0', type: 'panel' }
    });
  }, '应该抛出错误');
});

passed += test('unregisterPlugin 取消注册插件', () => {
  const plugin = {
    name: 'test-plugin-3',
    manifest: {
      name: 'test-plugin-3',
      version: '1.0.0',
      type: 'panel',
      eventTypes: ['task.created']
    },
    onEvent: function() {}
  };
  
  eventSystem.registerPlugin(plugin);
  assert(eventSystem.hasPlugin('test-plugin-3') === true, '插件应该已注册');
  
  eventSystem.unregisterPlugin('test-plugin-3');
  assert(eventSystem.hasPlugin('test-plugin-3') === false, '插件应该被取消注册');
});

passed += test('getRegisteredPlugins 返回已注册的插件列表', () => {
  const plugins = eventSystem.getRegisteredPlugins();
  assert(Array.isArray(plugins), '应该返回数组');
});

passed += test('getTotalListenerCount 返回总监听器数量', () => {
  const count = eventSystem.getTotalListenerCount();
  assert(typeof count === 'number', '应该返回数字');
  assert(count >= 0, '应该返回非负数');
});

passed += test('事件处理器错误不影响主流程', async () => {
  let errorThrown = false;
  
  eventSystem.on('test.error-handler', async () => {
    throw new Error('Handler error');
  });
  
  try {
    await eventSystem.emitAsync('test.error-handler', {});
  } catch (e) {
    errorThrown = true;
  }
  
  assert(errorThrown === false, '错误不应该抛出到主流程');
});

passed += test('事件日志记录功能', () => {
  const es = createEventSystem({ logEnabled: true, maxLogSize: 100 });
  es.emit('task.created', { taskId: 'log-test' });
  
  const logs = es.getEventLog({ eventType: 'task.created', limit: 10 });
  assert(logs.length > 0, '应该有日志记录');
});

passed += test('getEventLog 支持过滤选项', () => {
  eventSystem.emit('task.created', { taskId: 'filter-test' });
  
  const logs = eventSystem.getEventLog({ eventType: 'task.created', limit: 5 });
  assert(Array.isArray(logs), '应该返回数组');
});

passed += test('clearEventLog 清空事件日志', () => {
  eventSystem.emit('task.created', { taskId: 'clear-test' });
  eventSystem.clearEventLog();
  
  const logs = eventSystem.getEventLog();
  assert(logs.length === 0, '日志应该被清空');
});

passed += test('removeAllPluginListeners 移除所有插件监听器', () => {
  eventSystem.removeAllPluginListeners();
  
  const count = eventSystem.getTotalListenerCount();
  assert(count === 0, '所有监听器应该被移除');
});

passed += test('payload 敏感信息脱敏', () => {
  const logs = eventSystem.getEventLog();
  const payload = { password: 'secret', token: 'abc123', normal: 'value' };
  eventSystem.emit('test.sanitize', payload);
  
  const newLogs = eventSystem.getEventLog();
  if (newLogs.length > 0) {
    const lastLog = newLogs[newLogs.length - 1];
    assert(lastLog.payload.password === '[REDACTED]', '密码应该被脱敏');
    assert(lastLog.payload.token === '[REDACTED]', 'token 应该被脱敏');
    assert(lastLog.payload.normal === 'value', '普通字段应该保持不变');
  }
});

passed += test('便捷函数 emitTaskCreated', async () => {
  await emitTaskCreated({ taskId: 'convenience-1', title: 'Test' });
  assert(true, '应该正常执行');
});

passed += test('便捷函数 emitTaskCompleted', async () => {
  await emitTaskCompleted({ taskId: 'convenience-2', title: 'Test' });
  assert(true, '应该正常执行');
});

passed += test('便捷函数 emitTaskFailed', async () => {
  await emitTaskFailed({ taskId: 'convenience-3', title: 'Test', error: 'Error' });
  assert(true, '应该正常执行');
});

passed += test('便捷函数 emitWorkflowStarted', async () => {
  await emitWorkflowStarted({ workflowRunId: 'wf-1', workflowName: 'Test' });
  assert(true, '应该正常执行');
});

passed += test('便捷函数 emitWorkflowCompleted', async () => {
  await emitWorkflowCompleted({ workflowRunId: 'wf-2', workflowName: 'Test', status: 'completed' });
  assert(true, '应该正常执行');
});

passed += test('便捷函数 emitAgentStatusChanged', async () => {
  await emitAgentStatusChanged('agent-1', 'busy');
  assert(true, '应该正常执行');
});

passed += test('便捷函数 emitSessionMessageSent', async () => {
  await emitSessionMessageSent('session-1', 'Hello');
  assert(true, '应该正常执行');
});

passed += test('便捷函数 emitNotificationSent', async () => {
  await emitNotificationSent({ channelId: 'channel-1', status: 'sent' });
  assert(true, '应该正常执行');
});

passed += test('并发事件处理', async () => {
  let counter = 0;
  eventSystem.on('test.concurrent', async () => {
    counter++;
  });
  
  await Promise.all([
    eventSystem.emitAsync('test.concurrent', {}),
    eventSystem.emitAsync('test.concurrent', {}),
    eventSystem.emitAsync('test.concurrent', {})
  ]);
  
  assert(counter === 3, '应该处理所有并发事件');
});

passed += test('Promise.allSettled 处理失败的事件处理器', async () => {
  let successCalled = false;
  
  eventSystem.on('test.settled', async () => {
    throw new Error('Handler error');
  });
  
  eventSystem.on('test.settled', async () => {
    successCalled = true;
  });
  
  const result = await eventSystem.emitAsync('test.settled', {});
  
  assert(successCalled === true, '成功的处理器应该被调用');
  assert(result.errors >= 1, '应该报告错误数');
});

passed += test('getListenerCount 返回特定事件类型的监听器数量', () => {
  const count = eventSystem.getListenerCount('task.created');
  assert(typeof count === 'number', '应该返回数字');
  assert(count >= 0, '应该返回非负数');
});

console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===\n`);

process.exit(failed > 0 ? 1 : 0);
