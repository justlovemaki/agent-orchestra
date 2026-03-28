# {{PLUGIN_NAME_PASCAL}} Automation Plugin

Task automation plugin for Agent Orchestra.

## Description

This plugin provides automated task execution capabilities for Agent Orchestra.

## Installation

```bash
# Clone or download this plugin to your plugins directory
cp -r {{PLUGIN_NAME}} /path/to/agent-orchestra/plugins/

# Validate the plugin
orchestra-plugin validate ./plugins/{{PLUGIN_NAME}}
```

## Configuration

Add the following to your Agent Orchestra configuration:

```json
{
  "plugins": {
    "{{PLUGIN_NAME}}": {
      "enabled": true,
      "config": {
        "schedule": "0 * * * *",
        "retryCount": 3,
        "retryDelay": 5000
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| enabled | boolean | no | true | Enable or disable automation |
| schedule | string | no | 0 * * * * | Cron expression |
| retryCount | number | no | 3 | Number of retries on failure |
| retryDelay | number | no | 5000 | Delay between retries (ms) |

## Usage

### Cron Expressions

The automation uses cron expressions for scheduling:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6)
│ │ │ │ │
* * * * *
```

Examples:
- `0 * * * *` - Every hour
- `0 0 * * *` - Daily at midnight
- `*/15 * * * *` - Every 15 minutes

### API

```javascript
const Automation = require('./index.js');

const automation = new Automation(manifest, config);
await automation.initialize();

// Execute manually
const result = await automation.execute({ context: 'data' });

// Handle events
await automation.onEvent('task.completed', { taskId: '123' });

// Get status
const status = automation.getStatus();
```

### Enable/Disable

```javascript
automation.enable();
automation.disable();
```

## Events

This automation can handle the following events:

- `task.created` - When a new task is created
- `task.completed` - When a task completes
- `workflow.completed` - When a workflow completes

## Testing

```bash
# Run plugin tests
orchestra-plugin test ./plugins/{{PLUGIN_NAME}}
```

## License

MIT
