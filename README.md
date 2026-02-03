# CC-Viz

Visualization and analytics for Claude Code conversations, extensions, and API requests.

## Features

- **Conversation Browser**: View and search Claude Code conversations
- **Request Viewer**: Detailed API request/response inspection
- **Extension Discovery**: Browse Claude Code extensions and plugins
- **Full-Text Search**: Search across all conversations with FTS5
- **Queue Consumer**: Reads data from cc-proxy queue

## Quick Start

```bash
# Install dependencies
just install

# Copy and configure
cp config.yaml.example config.yaml

# Build and run
just run
```

## Configuration

See `config.yaml.example` for all options.

```yaml
server:
  port: 8002

queue:
  directory: "./queue"  # Same as cc-proxy output

storage:
  db_path: "./requests.db"

claude:
  projects_dir: "${HOME}/.claude/projects"
```

## Development

```bash
just dev          # Run viz-server + frontend dev server (HMR)
just test         # Run tests
just check        # Lint + typecheck
```

## Architecture

```
           [Queue Files from cc-proxy]
                    ↓
┌─────────────────────────────────────────────┐
│ cc-viz (port 8002)                          │
│ - GET /api/requests/* (request data)        │
│ - GET /api/conversations/* (conversations)  │
│ - GET /api/v2/claude/* (extensions)         │
│ - GET / (embedded visualization UI)         │
└─────────────────────────────────────────────┘
```

## Database

Uses SQLite with FTS5 for full-text search. The database stores:

- API requests and responses
- Parsed conversations
- Extension metadata
- Session data (plans, todos)

## License

MIT
