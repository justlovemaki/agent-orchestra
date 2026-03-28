# OpenClaw Integration

Agent Orchestra can be deeply integrated with OpenClaw, transforming from an "external management panel" into an "OpenClaw native component".

## Overview

The OpenClaw integration module provides:

- **Gateway API Client**: Direct communication with OpenClaw Gateway API
- **Bidirectional Communication**: WebSocket/SSE for real-time events
- **Tool Registration**: Register Orchestra as an OpenClaw tool
- **Configuration Management**: Persistent gateway URL, tokens, and subscriptions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Orchestra                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           OpenClaw Integration Module                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │   API       │  │   Event     │  │   Tool     │  │   │
│  │  │   Client    │  │   System    │  │   Registry │  │   │
│  │  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                       │ HTTP/WS
                       ▼
        ┌────────────────────────────┐
        │    OpenClaw Gateway       │
        │    (localhost:13000)       │
        └────────────────────────────┘
```

## Features

### 1. Gateway API Client

The integration provides a full API client for OpenClaw Gateway:

- `sessionsList(params)` - List active sessions
- `sessionsHistory(params)` - Get session history
- `sessionsSend(sessionId, message)` - Send message to session
- `subagentsSpawn(agentId, prompt, options)` - Spawn a subagent
- `subagentsList()` - List all subagents
- `agentsList()` - List all agents
- `gatewayStatus()` - Get gateway status

### 2. Event Subscriptions

Subscribe to OpenClaw events:

- `agent.spawned` - Agent spawned
- `agent.completed` - Agent completed
- `agent.error` - Agent error
- `session.created` - Session created
- `session.ended` - Session ended
- `session.message` - Session message received
- `task.created` - Task created
- `task.completed` - Task completed
- `task.failed` - Task failed
- `workflow.started` - Workflow started
- `workflow.completed` - Workflow completed

### 3. Tool Registration

Register Orchestra as an OpenClaw tool:

- `orchestra-tasks` - Create and manage tasks
- `orchestra-status` - Get system status

Custom tools can be registered via the API.

## API Endpoints

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/openclaw/connect` | Configure and connect to OpenClaw |
| GET | `/api/openclaw/status` | Get connection status |
| POST | `/api/openclaw/disconnect` | Disconnect from OpenClaw |
| GET | `/api/openclaw/config` | Get current configuration |

### Tools

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/openclaw/register-tool` | Register a new tool |
| GET | `/api/openclaw/tools` | List registered tools |
| DELETE | `/api/openclaw/tools/:name` | Unregister a tool |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/openclaw/events` | Get event subscriptions |
| PUT | `/api/openclaw/events` | Update event subscriptions |
| POST | `/api/openclaw/events/subscribe` | Subscribe to an event |

### Sessions & Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/openclaw/sessions` | List sessions |
| GET | `/api/openclaw/sessions/history` | Get session history |
| POST | `/api/openclaw/sessions/:id/send` | Send message |
| GET | `/api/openclaw/agents` | List agents |
| GET | `/api/openclaw/agents/:id` | Get agent info |
| GET | `/api/openclaw/subagents` | List subagents |
| POST | `/api/openclaw/subagents/spawn` | Spawn subagent |

## Usage

### Connecting to OpenClaw

```bash
curl -X POST http://localhost:3210/api/openclaw/connect \
  -H "Content-Type: application/json" \
  -d '{
    "gatewayUrl": "http://127.0.0.1:13000",
    "token": "your-token",
    "autoConnect": true
  }'
```

### Checking Status

```bash
curl http://localhost:3210/api/openclaw/status
```

### Registering a Tool

```bash
curl -X POST http://localhost:3210/api/openclaw/register-tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-tool",
    "description": "My custom tool",
    "handlerType": "orchestra-api"
  }'
```

## Frontend

The integration includes a settings page accessible from the admin panel:

1. Navigate to the "OpenClaw Integration" section
2. Configure Gateway URL and Token
3. Enable auto-connect if desired
4. Register custom tools
5. Configure event subscriptions

## Events Flow

```
OpenClaw Gateway
      │
      │──── agent.spawned
      │──── agent.completed
      │──── session.created
      │──── session.ended
      │         │
      ▼         ▼
Agent Orchestra
      │
      ├──▶ Emit to SSE clients
      ├──▶ Record in audit log
      └──▶ Trigger workflows
```

## Configuration File

Configuration is persisted in `data/openclaw-config.json`:

```json
{
  "gatewayUrl": "http://127.0.0.1:13000",
  "token": "",
  "autoConnect": false,
  "eventSubscriptions": {
    "agent.spawned": true,
    "agent.completed": true,
    "session.created": true,
    "session.ended": true
  }
}
```

## Running Tests

```bash
npm test
# or specifically
node test/unit/openclaw-integration.test.js
```

## Troubleshooting

### Connection Failed

1. Verify OpenClaw Gateway is running
2. Check Gateway URL is correct
3. Ensure token is valid

### Events Not Received

1. Check connection status
2. Verify event subscriptions are enabled
3. Check audit logs for event history

### Tool Execution Failed

1. Verify tool is registered
2. Check tool handler is implemented
3. Review error logs

## Security Considerations

- Token is masked in configuration display
- API endpoints require admin authentication
- Event handlers run in sandboxed context
