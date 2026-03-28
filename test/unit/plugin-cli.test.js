/**
 * Plugin CLI Tests
 */

const PluginCreator = require('../../lib/plugin-cli/creator');
const PluginValidator = require('../../lib/plugin-cli/validator');
const PluginTester = require('../../lib/plugin-cli/tester');
const PluginPublisher = require('../../lib/plugin-cli/publisher');
const TemplateManager = require('../../lib/plugin-cli/templates');
const path = require('path');
const fs = require('fs').promises;

const TEST_TEMP_DIR = path.join(__dirname, '../../data/test-plugin-cli');
const TEMPLATES_DIR = path.join(__dirname, '../../templates');

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
    return true;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
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

async function setup() {
  await fs.mkdir(TEST_TEMP_DIR, { recursive: true });
}

async function cleanup() {
  try {
    await fs.rm(TEST_TEMP_DIR, { recursive: true, force: true });
  } catch {}
}

let passed = 0;
let failed = 0;

async function runTests() {
  await setup();

  console.log('\n📋 PluginCreator Tests\n');

  await test('Create PluginCreator instance', () => {
    const creator = new PluginCreator({ templatesDir: TEMPLATES_DIR });
    assert(creator !== null, 'Should create instance');
    passed++;
  });

  await test('Create PluginCreator with custom outputDir', () => {
    const creator = new PluginCreator({
      templatesDir: TEMPLATES_DIR,
      outputDir: TEST_TEMP_DIR
    });
    assert(creator.outputDir === TEST_TEMP_DIR, 'Should set outputDir');
    passed++;
  });

  await test('isValidPluginName - valid names', () => {
    const creator = new PluginCreator({ templatesDir: TEMPLATES_DIR });
    assert(creator.isValidPluginName('my-plugin') === true, 'my-plugin should be valid');
    assert(creator.isValidPluginName('abc') === true, 'abc should be valid');
    assert(creator.isValidPluginName('test-123') === true, 'test-123 should be valid');
    passed++;
  });

  await test('isValidPluginName - invalid names', () => {
    const creator = new PluginCreator({ templatesDir: TEMPLATES_DIR });
    assert(creator.isValidPluginName('ab') === false, 'ab should be invalid (too short)');
    assert(creator.isValidPluginName('MyPlugin') === false, 'MyPlugin should be invalid (uppercase)');
    assert(creator.isValidPluginName('my_plugin') === false, 'my_plugin should be invalid (underscore)');
    passed++;
  });

  await test('toCamelCase conversion', () => {
    const creator = new PluginCreator({ templatesDir: TEMPLATES_DIR });
    assertEqual(creator.toCamelCase('my-plugin'), 'myPlugin');
    assertEqual(creator.toCamelCase('slack-notify'), 'slackNotify');
    passed++;
  });

  await test('toPascalCase conversion', () => {
    const creator = new PluginCreator({ templatesDir: TEMPLATES_DIR });
    assertEqual(creator.toPascalCase('my-plugin'), 'MyPlugin');
    assertEqual(creator.toPascalCase('slack-notify'), 'SlackNotify');
    passed++;
  });

  await test('createPlugin - invalid name', async () => {
    const creator = new PluginCreator({ templatesDir: TEMPLATES_DIR, outputDir: TEST_TEMP_DIR });
    try {
      await creator.createPlugin('ab', 'notification');
      assert(false, 'Should throw error');
    } catch (err) {
      assert(err.message.includes('Invalid plugin name'), 'Should throw invalid name error');
    }
    passed++;
  });

  await test('createPlugin - invalid template', async () => {
    const creator = new PluginCreator({ templatesDir: TEMPLATES_DIR, outputDir: TEST_TEMP_DIR });
    try {
      await creator.createPlugin('test-plugin', 'invalid-template');
      assert(false, 'Should throw error');
    } catch (err) {
      assert(err.message.includes('Template not found'), 'Should throw template not found error');
    }
    passed++;
  });

  console.log('\n📋 PluginValidator Tests\n');

  await test('Create PluginValidator instance', () => {
    const validator = new PluginValidator();
    assert(validator !== null, 'Should create instance');
    passed++;
  });

  await test('Create PluginValidator with strict mode', () => {
    const validator = new PluginValidator({ strictMode: true });
    assert(validator.strictMode === true, 'Should set strictMode');
    passed++;
  });

  await test('validateManifestFields - missing required fields', async () => {
    const validator = new PluginValidator();
    const result = { errors: [], warnings: [], manifest: {} };
    validator.validateManifestFields(result);
    assert(result.errors.length > 0, 'Should have errors');
    passed++;
  });

  await test('validateManifestFields - valid manifest', async () => {
    const validator = new PluginValidator();
    const result = {
      errors: [],
      warnings: [],
      manifest: {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'notification',
        description: 'Test plugin description'
      }
    };
    validator.validateManifestFields(result);
    assert(result.errors.length === 0, 'Should have no errors');
    passed++;
  });

  await test('isValidVersion - valid versions', () => {
    const validator = new PluginValidator();
    assert(validator.isValidVersion('1.0.0') === true, '1.0.0 should be valid');
    assert(validator.isValidVersion('1.0.0-beta') === true, '1.0.0-beta should be valid');
    assert(validator.isValidVersion('2.1.3') === true, '2.1.3 should be valid');
    passed++;
  });

  await test('isValidVersion - invalid versions', () => {
    const validator = new PluginValidator();
    assert(validator.isValidVersion('1.0') === false, '1.0 should be invalid');
    assert(validator.isValidVersion('v1.0.0') === false, 'v1.0.0 should be invalid');
    assert(validator.isValidVersion('1.0.0.0') === false, '1.0.0.0 should be invalid');
    passed++;
  });

  await test('validateConfigSchema - valid schema', async () => {
    const validator = new PluginValidator();
    const result = {
      errors: [],
      warnings: [],
      manifest: {
        name: 'test',
        version: '1.0.0',
        type: 'notification',
        configSchema: {
          apiKey: { type: 'string', required: true }
        }
      }
    };
    validator.validateConfigSchema(result);
    assert(result.errors.length === 0, 'Should have no errors');
    passed++;
  });

  await test('validateConfigSchema - invalid schema', async () => {
    const validator = new PluginValidator();
    const result = {
      errors: [],
      warnings: [],
      manifest: {
        name: 'test',
        version: '1.0.0',
        type: 'notification',
        configSchema: {
          apiKey: { required: 'yes' }
        }
      }
    };
    validator.validateConfigSchema(result);
    assert(result.errors.length > 0, 'Should have errors');
    passed++;
  });

  console.log('\n📋 PluginTester Tests\n');

  await test('Create PluginTester instance', () => {
    const tester = new PluginTester({ pluginsDir: TEST_TEMP_DIR });
    assert(tester !== null, 'Should create instance');
    passed++;
  });

  await test('Create PluginTester with custom timeout', () => {
    const tester = new PluginTester({ pluginsDir: TEST_TEMP_DIR, timeout: 30000 });
    assert(tester.timeout === 30000, 'Should set timeout');
    passed++;
  });

  await test('runWithTimeout - success', async () => {
    const tester = new PluginTester({ pluginsDir: TEST_TEMP_DIR });
    const result = await tester.runWithTimeout(Promise.resolve('success'), 1000);
    assert(result === 'success', 'Should resolve with value');
    passed++;
  });

  await test('runWithTimeout - timeout', async () => {
    const tester = new PluginTester({ pluginsDir: TEST_TEMP_DIR });
    try {
      await tester.runWithTimeout(new Promise(resolve => setTimeout(resolve, 100)), 50);
      assert(false, 'Should throw timeout error');
    } catch (err) {
      assert(err.message.includes('timed out'), 'Should throw timeout error');
    }
    passed++;
  });

  console.log('\n📋 PluginPublisher Tests\n');

  await test('Create PluginPublisher instance', () => {
    const publisher = new PluginPublisher();
    assert(publisher !== null, 'Should create instance');
    passed++;
  });

  await test('setAuthToken', () => {
    const publisher = new PluginPublisher();
    publisher.setAuthToken('test-token');
    assert(publisher.authToken === 'test-token', 'Should set auth token');
    passed++;
  });

  await test('publish - no auth should throw', async () => {
    const publisher = new PluginPublisher();
    try {
      await publisher.publish(TEST_TEMP_DIR);
      assert(false, 'Should throw error');
    } catch (err) {
      assert(err.message.includes('Authentication'), 'Should require auth');
    }
    passed++;
  });

  console.log('\n📋 TemplateManager Tests\n');

  await test('Create TemplateManager instance', () => {
    const manager = new TemplateManager({ templatesDir: TEMPLATES_DIR });
    assert(manager !== null, 'Should create instance');
    passed++;
  });

  await test('listTemplates', async () => {
    const manager = new TemplateManager({ templatesDir: TEMPLATES_DIR });
    const templates = await manager.listTemplates();
    assert(templates.length >= 4, 'Should have at least 4 templates');
    passed++;
  });

  await test('templateExists - existing template', async () => {
    const manager = new TemplateManager({ templatesDir: TEMPLATES_DIR });
    const exists = await manager.templateExists('notification');
    assert(exists === true, 'Template should exist');
    passed++;
  });

  await test('templateExists - non-existing template', async () => {
    const manager = new TemplateManager({ templatesDir: TEMPLATES_DIR });
    const exists = await manager.templateExists('nonexistent');
    assert(exists === false, 'Template should not exist');
    passed++;
  });

  await test('getTemplate', async () => {
    const manager = new TemplateManager({ templatesDir: TEMPLATES_DIR });
    const template = await manager.getTemplate('notification');
    assert(template.name === 'notification', 'Should return notification template');
    assert(template.files.length > 0, 'Should have files');
    passed++;
  });

  console.log('\n📋 Integration Tests\n');

  await test('Validate valid plugin structure', async () => {
    const pluginDir = path.join(TEST_TEMP_DIR, 'valid-plugin');
    await fs.mkdir(pluginDir, { recursive: true });
    await fs.writeFile(path.join(pluginDir, 'manifest.json'), JSON.stringify({
      name: 'test-plugin',
      version: '1.0.0',
      type: 'notification',
      description: 'Test plugin',
      author: 'Test Author'
    }) + '\n');
    await fs.writeFile(path.join(pluginDir, 'index.js'), 'module.exports = function() {};\n');
    await fs.writeFile(path.join(pluginDir, 'README.md',), '# Test Plugin\n');

    const validator = new PluginValidator();
    const result = await validator.validatePlugin(pluginDir);
    assert(result.valid === true, 'Should be valid');
    passed++;
  });

  await test('Validate missing manifest', async () => {
    const pluginDir = path.join(TEST_TEMP_DIR, 'no-manifest');
    await fs.mkdir(pluginDir, { recursive: true });

    const validator = new PluginValidator();
    const result = await validator.validatePlugin(pluginDir);
    assert(result.valid === false, 'Should be invalid');
    assert(result.errors.some(e => e.includes('manifest.json')), 'Should mention missing manifest');
    passed++;
  });

  await cleanup();

  console.log('\n' + '='.repeat(50));
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  cleanup().then(() => process.exit(1));
});
