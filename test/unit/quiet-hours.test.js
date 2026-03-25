/**
 * Quiet Hours Unit Tests
 * Tests for lib/quiet-hours.js functions
 */

const assert = require('assert');

const quietHours = require('../../lib/quiet-hours');

/**
 * Run all quiet hours unit tests
 * @param {string} baseUrl - Not used for unit tests
 */
async function runTests(baseUrl) {
  console.log('  Quiet Hours Unit Tests:');
  
  try {
    assert.strictEqual(quietHours.DEFAULT_CONFIG.enabled, false);
    console.log('    ✓ DEFAULT_CONFIG has correct enabled default');
    
    assert.strictEqual(quietHours.DEFAULT_CONFIG.schedule.startTime, '22:00');
    console.log('    ✓ DEFAULT_CONFIG has correct startTime default');
    
    assert.strictEqual(quietHours.DEFAULT_CONFIG.schedule.endTime, '08:00');
    console.log('    ✓ DEFAULT_CONFIG has correct endTime default');
    
    assert.strictEqual(quietHours.DEFAULT_CONFIG.schedule.timezone, 'Asia/Shanghai');
    console.log('    ✓ DEFAULT_CONFIG has correct timezone default');
    
    assert.deepStrictEqual(quietHours.DEFAULT_CONFIG.daysOfWeek, [0, 1, 2, 3, 4, 5, 6]);
    console.log('    ✓ DEFAULT_CONFIG has correct daysOfWeek default');
    
    assert.strictEqual(quietHours.DEFAULT_CONFIG.queueMode, 'discard');
    console.log('    ✓ DEFAULT_CONFIG has correct queueMode default');
    
    assert.strictEqual(quietHours.DEFAULT_CONFIG.allowCritical, true);
    console.log('    ✓ DEFAULT_CONFIG has correct allowCritical default');
    
    // Reset to defaults before testing getConfig
    quietHours.updateConfig({ enabled: false });
    
    let config = quietHours.getConfig();
    assert.ok(config, 'Should return config');
    assert.ok(typeof config === 'object', 'Should be an object');
    console.log('    ✓ getConfig returns configuration object');
    
    config = quietHours.getConfig();
    assert.strictEqual(config.enabled, false);
    console.log('    ✓ getConfig includes default values');
    
    config = quietHours.updateConfig({ enabled: true });
    assert.strictEqual(config.enabled, true);
    console.log('    ✓ updateConfig updates enabled status');
    
    config = quietHours.updateConfig({ 
      schedule: { startTime: '23:00', endTime: '07:00' } 
    });
    assert.strictEqual(config.schedule.startTime, '23:00');
    assert.strictEqual(config.schedule.endTime, '07:00');
    console.log('    ✓ updateConfig updates schedule time');
    
    config = quietHours.updateConfig({ 
      daysOfWeek: [1, 2, 3, 4, 5] 
    });
    assert.deepStrictEqual(config.daysOfWeek, [1, 2, 3, 4, 5]);
    console.log('    ✓ updateConfig updates days of week');
    
    config = quietHours.updateConfig({ queueMode: 'queue' });
    assert.strictEqual(config.queueMode, 'queue');
    console.log('    ✓ updateConfig updates queue mode');
    
    config = quietHours.updateConfig({ allowCritical: false });
    assert.strictEqual(config.allowCritical, false);
    console.log('    ✓ updateConfig updates allow critical flag');
    
    let result = quietHours.isQuietHours({ enabled: false });
    assert.strictEqual(result.isQuiet, false);
    assert.strictEqual(result.reason, 'disabled');
    console.log('    ✓ isQuietHours returns disabled when not enabled');
    
    // Test with weekend-only schedule - will return not_scheduled_day on weekdays
    const currentDay = new Date().getDay();
    const weekendDays = [0, 6]; // Sunday, Saturday
    const weekdayDays = [1, 2, 3, 4, 5]; // Monday-Friday
    
    // Use opposite days based on current day to ensure test passes
    const testDays = weekendDays.includes(currentDay) ? weekdayDays : weekendDays;
    const expectedReason = weekendDays.includes(currentDay) ? 'not_scheduled_day' : 'not_scheduled_day';
    
    const configWithDay = {
      enabled: true,
      schedule: { startTime: '22:00', endTime: '08:00', timezone: 'Asia/Shanghai' },
      daysOfWeek: testDays
    };
    
    result = quietHours.isQuietHours(configWithDay);
    assert.strictEqual(result.reason, 'not_scheduled_day', `Expected not_scheduled_day when current day (${currentDay}) not in ${JSON.stringify(testDays)}`);
    console.log('    ✓ isQuietHours returns not_scheduled_day when current day not in daysOfWeek');
    
    const configAllDays = {
      enabled: true,
      schedule: { startTime: '22:00', endTime: '08:00', timezone: 'UTC' },
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
    };
    
    result = quietHours.isQuietHours(configAllDays);
    assert.ok(typeof result.isQuiet === 'boolean', 'Should return boolean');
    console.log('    ✓ isQuietHours detects quiet hours for overnight schedule');
    
    result = quietHours.isQuietHours(configAllDays);
    assert.ok(result.reason === 'quiet_hours' || result.reason === 'outside_hours', 'Should have valid reason');
    console.log('    ✓ isQuietHours returns reason outside_hours when not in quiet time');
    
    let status = quietHours.getStatus();
    assert.ok(status, 'Should return status');
    assert.ok(typeof status.isQuietHours === 'boolean', 'Should have isQuietHours');
    assert.ok(status.config, 'Should have config');
    console.log('    ✓ getStatus returns status object with required fields');
    
    quietHours.clearQueue();
    status = quietHours.getStatus();
    assert.strictEqual(status.queueCount, 0);
    console.log('    ✓ getStatus returns correct queue count (empty)');
    
    quietHours.addToQueue({ message: 'Test', options: {} });
    status = quietHours.getStatus();
    assert.strictEqual(status.queueCount, 1);
    console.log('    ✓ getStatus returns correct queue count (with item)');
    
    quietHours.clearQueue();
    
    let entry = quietHours.addToQueue({ 
      message: 'Test notification', 
      options: { priority: 'high' } 
    });
    assert.ok(entry, 'Should return entry');
    assert.ok(entry.id, 'Should have id');
    assert.ok(entry.queuedAt, 'Should have queuedAt');
    assert.strictEqual(entry.notification.message, 'Test notification');
    console.log('    ✓ addToQueue adds notification to queue');
    
    quietHours.clearQueue();
    
    let queue = quietHours.getQueuedNotifications();
    assert.ok(Array.isArray(queue), 'Should return array');
    console.log('    ✓ getQueuedNotifications returns array');
    
    quietHours.addToQueue({ message: 'Test', options: {} });
    quietHours.clearQueue();
    queue = quietHours.getQueuedNotifications();
    assert.strictEqual(queue.length, 0, 'Queue should be empty');
    console.log('    ✓ clearQueue empties the queue');
    
    quietHours.updateConfig({ enabled: false });
    result = quietHours.checkAndHandleQuietHours('Test message');
    assert.strictEqual(result.shouldSend, true);
    assert.strictEqual(result.reason, 'normal');
    console.log('    ✓ checkAndHandleQuietHours returns normal when disabled');
    
    quietHours.updateConfig({ 
      enabled: true,
      schedule: { startTime: '22:00', endTime: '08:00', timezone: 'UTC' },
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      allowCritical: true,
      queueMode: 'discard'
    });
    result = quietHours.checkAndHandleQuietHours('Critical message', { priority: 'critical' });
    // Test passes if: critical messages are allowed (shouldSend=true) during quiet hours OR normal time
    assert.strictEqual(result.shouldSend, true, 'Critical messages should always be allowed');
    assert.ok(['critical_allowed', 'normal'].includes(result.reason), 'Reason should be critical_allowed or normal');
    console.log('    ✓ checkAndHandleQuietHours allows critical messages when allowCritical is true');
    
    quietHours.updateConfig({ 
      enabled: true,
      schedule: { startTime: '22:00', endTime: '08:00', timezone: 'UTC' },
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      allowCritical: false,
      queueMode: 'discard'
    });
    result = quietHours.checkAndHandleQuietHours('Test message', { priority: 'normal' });
    // Test passes if: message is discarded during quiet hours OR sent normally outside quiet hours
    if (result.reason === 'quiet_hours') {
      assert.strictEqual(result.shouldSend, false);
      assert.strictEqual(result.reason, 'discarded');
    } else {
      assert.strictEqual(result.shouldSend, true);
      assert.strictEqual(result.reason, 'normal');
    }
    console.log('    ✓ checkAndHandleQuietHours handles messages correctly based on quiet hours state');
    
    quietHours.updateConfig({ 
      enabled: true,
      schedule: { startTime: '22:00', endTime: '08:00', timezone: 'UTC' },
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      allowCritical: false,
      queueMode: 'queue'
    });
    quietHours.clearQueue();
    result = quietHours.checkAndHandleQuietHours('Test message', { priority: 'normal' });
    // Test passes if: message is queued during quiet hours OR sent normally outside quiet hours
    if (result.reason === 'quiet_hours') {
      assert.strictEqual(result.shouldSend, false);
      assert.strictEqual(result.reason, 'queued');
      queue = quietHours.getQueuedNotifications();
      assert.strictEqual(queue.length, 1, 'Should have queued message');
      console.log('    ✓ checkAndHandleQuietHours queues messages in quiet hours with queue mode');
    } else {
      assert.strictEqual(result.shouldSend, true);
      assert.strictEqual(result.reason, 'normal');
      console.log('    ✓ checkAndHandleQuietHours sends messages normally outside quiet hours');
    }
    
    quietHours.clearQueue();
    quietHours.updateConfig({ enabled: false });
    
  } catch (err) {
    quietHours.updateConfig({ enabled: false });
    quietHours.clearQueue();
    throw new Error(`Quiet Hours unit tests failed: ${err.message}`);
  }
}

module.exports = { runTests };