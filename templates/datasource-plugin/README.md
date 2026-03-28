# {{PLUGIN_NAME_PASCAL}} Datasource Plugin

Data source plugin for Agent Orchestra.

## Description

This plugin provides access to {{PLUGIN_NAME_PASCAL}} data for use in workflows and dashboards.

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
        "apiKey": "your-api-key",
        "baseUrl": "https://api.example.com",
        "timeout": 30000,
        "cacheEnabled": true
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| apiKey | string | yes | - | API key for data source |
| baseUrl | string | no | https://api.example.com | Base URL for API requests |
| timeout | number | no | 30000 | Request timeout in milliseconds |
| cacheEnabled | boolean | no | true | Enable caching of responses |

## Usage

```javascript
const datasource = require('./index.js')({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.example.com'
});

await datasource.initialize();

// Query data
const data = await datasource.query('SELECT * FROM metrics');

// Get schema
const schema = datasource.getSchema();
```

## Schema

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| name | string | Display name |
| value | number | Current value |
| timestamp | timestamp | Data timestamp |

## Testing

```bash
# Run plugin tests
orchestra-plugin test ./plugins/{{PLUGIN_NAME}} --config='{"apiKey":"test-key"}'
```

## License

MIT
