# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CC-Viz provides visualization and analytics for Claude Code conversations, extensions, and API requests. It consumes HAR (HTTP Archive) files from a queue written by cc-proxy, stores them in SQLite with FTS5 full-text search, and serves a React dashboard.

## Commands

```bash
just install         # Install Go modules + npm packages
just build           # Build binary (requires CGO_ENABLED=1 -tags fts5)
just build-embedded  # Build with React frontend embedded in binary
just run             # Build and run viz-server
just dev             # Run viz-server + frontend dev server with HMR
just test            # Run Go tests (CGO_ENABLED=1 -tags fts5)
just check           # Run golangci-lint + TypeScript typecheck
just db              # Reset database (rm requests.db)
just fmt             # Format Go + frontend code
```

Run a single Go test:
```bash
CGO_ENABLED=1 go test -tags fts5 -run TestName ./internal/service/
```

## Architecture

```
cmd/viz-server/          # Entry point, route registration, embedded frontend
internal/
├── config/              # YAML + env var config loading
├── handler/
│   └── data_handler.go  # All /api/* endpoints (V1 and V2)
├── middleware/          # Request logging
├── model/models.go      # All domain types in one file
└── service/
    ├── storage.go           # StorageService interface
    ├── storage_sqlite.go    # SQLite implementation (~800 lines)
    ├── storage_fts5.go      # FTS5 search queries
    ├── queue_watcher.go     # fsnotify queue processing, HAR parsing
    ├── indexer.go           # Conversation indexer (~/.claude/projects/)
    ├── extension_indexer.go # Extension/plugin discovery
    ├── subagent_indexer.go  # Agent hierarchy tracking
    └── session_data_indexer.go  # Plans/todos extraction
frontend/                # React 19 + Vite + TanStack Router + Recharts
```

## Key Data Flows

**Queue Processing**: HAR file + .meta.json → `QueueWatcher.processFile()` → `harEntryToRequestLog()` → `SaveRequest()` → delete file

**Conversation Indexing**: `~/.claude/projects/*/` JSONL files → `ConversationIndexer` → SQLite FTS5 tables (incremental by mtime)

**Subagent Graph**: Conversation messages with agent_id/parent_agent_id → adjacency graph → tree depth calculation → hierarchy API

## API Structure

- `/api/requests/*` - Request CRUD and summaries
- `/api/stats/*` - Analytics (hourly, model, provider, tool, performance)
- `/api/conversations/*` - Conversation search and retrieval
- `/api/v2/*` - New dashboard format with pagination
- `/api/v2/claude/*` - Projects, extensions, subagent-graph, session data

## Build Requirements

- **CGO_ENABLED=1** and **-tags fts5** are required for SQLite FTS5 support
- Frontend embedding uses **-tags "fts5 embed_frontend"**

## Database

SQLite with FTS5. Schema created on first run. Tables: `requests`, `conversations`, `conversation_messages`, `extensions`, `subagent_graph_nodes`, `subagent_graph_edges`, `todos`, `plans`.

## Configuration

Copy `config.yaml.example` to `config.yaml`. Key paths:
- `queue.directory`: Where cc-proxy writes HAR files
- `claude.projects_dir`: `~/.claude/projects` for conversation discovery
- `claude.extensions_dir`: `~/.claude` for extension discovery
