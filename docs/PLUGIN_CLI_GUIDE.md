# Agent Orchestra Plugin CLI Guide

> Version: 1.0.0
> Last Updated: 2026-03-29

---

## Overview

The Plugin CLI is a command-line tool for developing, testing, and publishing plugins for Agent Orchestra.

## Installation

The CLI is included with Agent Orchestra. To use it:

```bash
# Using npm scripts
npm run plugin:create -- my-plugin -t notification

# Or directly
node bin/orchestra-plugin-cli.js create my-plugin -t notification
```

For direct CLI access, you can also link it:

```bash
npm link
```

Then use:

```bash
orchestra-plugin <command>
```

---

## Commands

### create

Scaffold a new plugin from a template.

```bash
orchestra-plugin create <plugin-name> [options]
```

**Arguments:**
- `plugin-name` - Name of the plugin (lowercase, hyphens allowed)

**Options:**
- `-t, --template=<type>` - Plugin template type (notification, datasource, panel, automation)
- `-a, --author=<name>` - Author name
- `-o, --output=<dir>` - Output directory
- `-f, --force` - Overwrite existing plugin

**Examples:**

```bash
# Create a notification plugin
orchestra-plugin create slack-notify -t notification -a "John Doe"

# Create a datasource plugin
orchestra-plugin create weather-api -t datasource

# Create with custom output directory
orchestra-plugin create my-panel -t panel -o ./my-plugins
```

---

### validate

Validate plugin manifest and structure.

```bash
orchestra-plugin validate [path] [options]
```

**Arguments:**
- `path` - Plugin directory path (default: ./plugins)

**Options:**
- `-p, --path=<path>` - Plugin path
- `--strict` - Enable strict validation mode

**Examples:**

```bash
# Validate plugin in default location
orchestra-plugin validate

# Validate specific plugin
orchestra-plugin validate ./plugins/my-plugin

# Strict validation
orchestra-plugin validate ./plugins/my-plugin --strict
```

**Validation Checks:**
- Required manifest fields (name, version, type)
- Valid plugin type (panel, notification, datasource, automation)
- Semantic version format
- Required files (manifest.json, index.js)
- Configuration schema validity
- Event types validity

---

### test

Run plugin tests in isolation.

```bash
orchestra-plugin test [path] [options]
```

**Arguments:**
- `path` - Plugin directory path (default: ./plugins)

**Options:**
- `-p, --path=<path>` - Plugin path
- `--config=<json>` - JSON configuration for testing

**Examples:**

```bash
# Test default plugin
orchestra-plugin test

# Test specific plugin
orchestra-plugin test ./plugins/my-notification

# Test with config
orchestra-plugin test ./plugins/my-plugin --config='{"apiKey":"test-key"}'
```

**Test Coverage:**
- Plugin structure validation
- Required methods implementation
- Configuration loading
- Error handling

---

### publish

Upload plugin to the marketplace (requires authentication).

```bash
orchestra-plugin publish [path] [options]
```

**Arguments:**
- `path` - Plugin directory path (default: ./plugins)

**Options:**
- `-p, --path=<path>` - Plugin path
- `--auth-token=<token>` - Authentication token
- `--skip-auth` - Skip authentication (simulation mode)

**Examples:**

```bash
# Publish with auth token
orchestra-plugin publish ./plugins/my-plugin --auth-token=xxx

# Simulation mode (no actual upload)
orchestra-plugin publish ./plugins/my-plugin --skip-auth

# Using environment variable
ORCHESTRA_AUTH_TOKEN=xxx orchestra-plugin publish ./plugins/my-plugin
```

**Requirements for Publishing:**
- Valid manifest.json with all required fields
- index.js entry point
- README.md documentation
- Proper version format (semver)

---

### list-templates

Show available plugin templates.

```bash
orchestra-plugin list-templates
```

**Output:**
```
Available plugin templates:

  notification (notification-plugin)
    Notification channel plugin for sending messages

  datasource (datasource-plugin)
    Data source plugin for fetching external data

  panel (panel-plugin)
    Dashboard panel plugin for visualizations

  automation (automation-plugin)
    Task automation plugin for scheduled jobs
```

---

## Plugin Templates

### notification-plugin

Creates a notification channel plugin for sending messages via external services (Slack, Discord, etc.).

**Configuration:**
```json
{
  "webhookUrl": "required",
  "channel": "optional",
  "username": "optional"
}
```

**Required Methods:**
- `send(message, options)` - Send notification
- `test(config)` - Test connection

---

### datasource-plugin

Creates a data source plugin for fetching external data.

**Configuration:**
```json
{
  "apiKey": "required",
  "baseUrl": "optional",
  "timeout": "optional",
  "cacheEnabled": "optional"
}
```

**Required Methods:**
- `query(queryString, options)` - Fetch data
- `test(config)` - Test connection

---

### panel-plugin

Creates a dashboard panel component.

**Configuration:**
```json
{
  "refreshInterval": "optional",
  "showHeader": "optional",
  "dataSource": "optional"
}
```

**Required Properties:**
- `component` - Component identifier
- `renderMethod` - Rendering method

---

### automation-plugin

Creates an automation task that runs on schedule or events.

**Configuration:**
```json
{
  "enabled": "optional",
  "schedule": "optional",
  "retryCount": "optional",
  "retryDelay": "optional"
}
```

**Required Methods:**
- `execute(context)` - Run automation
- `validate(config)` - Validate configuration

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ORCHESTRA_AUTH_TOKEN` | Authentication token for marketplace |

---

## Error Codes

| Code | Description |
|------|-------------|
| `E001` | Invalid plugin name |
| `E002` | Template not found |
| `E003` | Plugin directory already exists |
| `E004` | Missing required files |
| `E005` | Invalid manifest |
| `E006` | Authentication required |

---

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Error |

---

## See Also

- [Plugin Development Guide](../PLUGIN_DEVELOPMENT_GUIDE.md)
- [Plugin Marketplace](../PLUGIN_MARKETPLACE_README.md)
