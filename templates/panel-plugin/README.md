# {{PLUGIN_NAME_PASCAL}} Panel Plugin

Dashboard panel plugin for Agent Orchestra.

## Description

This plugin provides a custom panel component for the Agent Orchestra dashboard.

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
        "refreshInterval": 30000,
        "showHeader": true,
        "dataSource": "my-datasource"
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| refreshInterval | number | no | 30000 | Panel refresh interval in ms |
| showHeader | boolean | no | true | Show panel header |
| dataSource | string | no | - | Data source plugin to use |

## Usage

The panel can be added to your dashboard through the UI configuration:

1. Open the dashboard editor
2. Add a new panel
3. Select "{{PLUGIN_NAME_PASCAL}} Panel" from the panel type list
4. Configure the panel settings

## Development

### Component Properties

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | string | {{PLUGIN_NAME_PASCAL}} Panel | Panel title |
| icon | string | 📊 | Panel icon |
| refreshInterval | number | 30000 | Auto-refresh interval |
| height | number | 200 | Panel height |
| width | string | full | Panel width |

### Events

The panel emits the following events:

- `configure` - When user clicks configure button
- `refresh` - When panel data is refreshed
- `error` - When an error occurs

### API

```javascript
const Panel = require('./index.js');

const panel = new Panel(manifest, config);
await panel.initialize();
await panel.render(container);
await panel.refresh();
```

## Testing

```bash
# Run plugin tests
orchestra-plugin test ./plugins/{{PLUGIN_NAME}}
```

## License

MIT
