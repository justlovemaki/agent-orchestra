#!/usr/bin/env node

'use strict';

const path = require('path');
const {
  PluginCreator,
  PluginValidator,
  PluginTester,
  PluginPublisher,
  TemplateManager
} = require('../lib/plugin-cli');

const PLUGIN_CLI_VERSION = '1.0.0';

class PluginCLI {
  constructor() {
    this.pluginsDir = path.join(__dirname, '../plugins');
    this.templatesDir = path.join(__dirname, '../templates');
  }

  async run(args) {
    const command = args[0];
    const options = this.parseOptions(args.slice(1));

    try {
      switch (command) {
        case 'create':
          await this.create(args[1], options);
          break;
        case 'validate':
          await this.validate(options);
          break;
        case 'test':
          await this.test(options);
          break;
        case 'publish':
          await this.publish(options);
          break;
        case 'list-templates':
          await this.listTemplates();
          break;
        case 'help':
        case '--help':
        case '-h':
          this.showHelp();
          break;
        case 'version':
        case '--version':
        case '-v':
          this.showVersion();
          break;
        default:
          if (!command) {
            this.showHelp();
          } else {
            this.error(`Unknown command: ${command}`);
            this.showHelp();
            process.exit(1);
          }
      }
    } catch (err) {
      this.error(err.message);
      process.exit(1);
    }
  }

  parseOptions(args) {
    const options = {};
    const positional = [];
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=');
        if (value !== undefined) {
          options[key] = value;
        } else if (args[i + 1] && !args[i + 1].startsWith('-')) {
          options[key] = args[++i];
        } else {
          options[key] = true;
        }
      } else if (arg.startsWith('-')) {
        const key = arg.slice(1);
        options[key] = true;
      } else {
        positional.push(arg);
      }
    }
    
    options._ = positional;
    return options;
  }

  async create(pluginName, options) {
    if (!pluginName) {
      this.error('Plugin name is required');
      this.info('Usage: orchestra-plugin create <plugin-name> [--template=<type>] [--author=<name>]');
      process.exit(1);
    }

    const templateType = options.template || options.t || 'notification';
    const author = options.author || options.a || 'Plugin Developer';
    const outputDir = options.output || options.o || process.cwd();

    this.info(`Creating plugin: ${pluginName}`);
    this.info(`Template: ${templateType}`);
    this.info(`Output: ${outputDir}`);

    const creator = new PluginCreator({
      templatesDir: this.templatesDir,
      outputDir
    });

    const result = await creator.createPlugin(pluginName, templateType, {
      author,
      force: options.force || options.f
    });

    if (result.success) {
      this.success(`Plugin created successfully at: ${result.pluginDir}`);
      this.info(`\nNext steps:`);
      this.info(`  cd ${result.pluginDir}`);
      this.info(`  npm install`);
      this.info(`  orchestra-plugin validate`);
    }
  }

  async validate(options) {
    const pluginPath = options._[0] || options.path || options.p || this.pluginsDir;

    this.info(`Validating plugin at: ${pluginPath}`);

    const validator = new PluginValidator({ strictMode: options.strict });
    const result = await validator.validatePlugin(pluginPath);

    if (result.valid) {
      this.success('Plugin validation passed!');
      
      if (result.warnings.length > 0) {
        this.info('\nWarnings:');
        result.warnings.forEach(w => this.warn(`  - ${w}`));
      }
    } else {
      this.error('Plugin validation failed!');
      
      if (result.errors.length > 0) {
        this.error('\nErrors:');
        result.errors.forEach(e => this.error(`  - ${e}`));
      }
      
      process.exit(1);
    }

    if (result.manifest) {
      this.info('\nManifest:');
      this.info(`  Name: ${result.manifest.name}`);
      this.info(`  Version: ${result.manifest.version}`);
      this.info(`  Type: ${result.manifest.type}`);
      this.info(`  Author: ${result.manifest.author || 'Unknown'}`);
    }
  }

  async test(options) {
    const pluginPath = options._[0] || options.path || options.p || this.pluginsDir;

    this.info(`Running tests for plugin at: ${pluginPath}`);

    const tester = new PluginTester({ pluginsDir: this.pluginsDir });
    const result = await tester.runTests(pluginPath, {
      config: options.config ? JSON.parse(options.config) : {}
    });

    this.info(`\nTests: ${result.passed} passed, ${result.failed} failed`);

    if (result.errors.length > 0) {
      this.error('\nErrors:');
      result.errors.forEach(e => this.error(`  - ${e}`));
    }

    if (result.warnings && result.warnings.length > 0) {
      this.warn('\nWarnings:');
      result.warnings.forEach(w => this.warn(`  - ${w}`));
    }

    if (result.success) {
      this.success('\nAll tests passed!');
    } else {
      this.error('\nSome tests failed!');
      process.exit(1);
    }
  }

  async publish(options) {
    const pluginPath = options._[0] || options.path || options.p || this.pluginsDir;
    const authToken = options['auth-token'] || options.token || process.env.ORCHESTRA_AUTH_TOKEN;

    if (!authToken) {
      this.warn('No auth token provided. Use --auth-token or set ORCHESTRA_AUTH_TOKEN.');
      this.info('Run in simulation mode (no actual upload):');
    }

    this.info(`Publishing plugin from: ${pluginPath}`);

    const publisher = new PluginPublisher({
      authToken: authToken,
      skipAuth: !authToken
    });

    const result = await publisher.publish(pluginPath, options);

    if (result.success) {
      this.success(`Published: ${result.pluginName}@${result.version}`);
      this.info(`Marketplace URL: ${result.marketplaceUrl}`);
    } else {
      this.error(`Publish failed: ${result.message}`);
      process.exit(1);
    }
  }

  async listTemplates() {
    this.info('Available plugin templates:\n');

    const manager = new TemplateManager({ templatesDir: this.templatesDir });
    const templates = await manager.listTemplates();

    if (templates.length === 0) {
      this.warn('No templates found');
      return;
    }

    templates.forEach(t => {
      this.info(`  ${t.name} (${t.type})`);
      this.info(`    ${t.description}`);
      this.info(`    Files: ${t.files.join(', ')}`);
      this.info('');
    });
  }

  showHelp() {
    console.log(`
Agent Orchestra Plugin CLI v${PLUGIN_CLI_VERSION}

Usage:
  orchestra-plugin <command> [options]

Commands:
  create <plugin-name>     Scaffold a new plugin from template
  validate [path]          Validate plugin manifest and structure
  test [path]              Run plugin tests in isolation
  publish [path]           Upload plugin to marketplace (requires auth)
  list-templates           Show available plugin templates

Options:
  -t, --template=<type>     Plugin template type (default: notification)
  -a, --author=<name>      Author name for new plugin
  -o, --output=<dir>       Output directory for new plugin
  -p, --path=<path>        Plugin path for validate/test/publish
  --auth-token=<token>     Authentication token for marketplace
  --config=<json>         JSON config for testing
  --strict                Enable strict validation mode
  -f, --force              Overwrite existing plugin
  -h, --help               Show this help message
  -v, --version            Show version

Examples:
  orchestra-plugin create my-slack-notify -t notification -a "John Doe"
  orchestra-plugin validate ./plugins/my-plugin
  orchestra-plugin test ./plugins/my-panel --config='{"apiKey":"test"}'
  orchestra-plugin publish ./plugins/my-plugin --auth-token=xxx

Templates:
  notification-plugin      Notification channel (Slack, Discord, etc.)
  datasource-plugin        Data source (Weather, Stocks, etc.)
  panel-plugin             Dashboard panel (Charts, Graphs, etc.)
  automation-plugin        Task automation (Scheduled tasks, etc.)
`);
  }

  showVersion() {
    console.log(`orchestra-plugin v${PLUGIN_CLI_VERSION}`);
  }

  info(message) {
    console.log(message);
  }

  success(message) {
    console.log(`✅ ${message}`);
  }

  warn(message) {
    console.log(`⚠️  ${message}`);
  }

  error(message) {
    console.error(`❌ ${message}`);
  }
}

if (require.main === module) {
  const cli = new PluginCLI();
  cli.run(process.argv.slice(2));
}

module.exports = PluginCLI;
