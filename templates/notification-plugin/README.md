# {{PLUGIN_NAME_PASCAL}} Plugin

Notification channel plugin for Agent Orchestra.

## Description

This plugin enables sending notifications through {{PLUGIN_NAME_PASCAL}} to channels or users.

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
        "webhookUrl": "https://your-webhook-url",
        "channel": "alerts",
        "username": "Agent Orchestra"
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| webhookUrl | string | yes | - | Webhook URL for sending notifications |
| channel | string | no | general | Target channel or room |
| username | string | no | Agent Orchestra | Bot username to display |

## Usage

```javascript
const plugin = require('./index.js')({
  webhookUrl: 'https://example.com/webhook',
  channel: 'alerts'
});

await plugin.initialize();

// Send a notification
await plugin.send('Task completed successfully!', {
  channel: 'notifications'
});
```

## Events

This plugin can handle the following events:

- `task.completed` - Task completed successfully
- `task.failed` - Task failed
- `workflow.completed` - Workflow completed
- `workflow.failed` - Workflow failed

## Testing

```bash
# Run plugin tests
orchestra-plugin test ./plugins/{{PLUGIN_NAME}} --config='{"webhookUrl":"https://test.webhook"}'
```

## License

MIT
