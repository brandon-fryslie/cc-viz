# EVALUATION: Extension Workshop Feature

**Date**: 2026-01-13
**Feature**: extension-workshop [PROPOSED]
**Epic**: EXTENSION-WORKSHOP-1
**Dependency Status**: conversation-indexer (COMPLETE ✅)
**Scope**: Phase 4 - Extension Management

---

## 1. Current State Analysis

### 1.1 Existing ~/.claude Extension Structure

**Agents Directory** (`~/.claude/agents/`)
- 5 custom agents discovered in user's environment
- File format: `{name}.md`
- Metadata structure: YAML frontmatter with fields like:
  - `name`: Identifier for the agent
  - `description`: Human-readable description of agent purpose
  - `model`: LLM model to use (e.g., "opus")
  - `color`: Visual identifier for the agent
- Content: Markdown system prompt defining agent behavior

**Commands Directory** (`~/.claude/commands/`)
- 3 custom commands discovered
- File format: `{name}.md`
- Metadata structure: YAML frontmatter with:
  - `description`: What the command does
  - `allowed-tools`: List of permitted tools (Bash, Read, Write, Edit)
  - `argument-hint`: Help text for arguments
  - `model`: Optional model specification
- Content: Markdown instructions or implementations

**Skills Directory** (`~/.claude/skills/`)
- Does NOT currently exist in explored user environment
- Potential future extension type (mentioned in roadmap but not present yet)

**Plugins Configuration** (`~/.claude/plugins-config/`)
- Empty directory currently
- Likely intended for plugin-specific configuration files

**MCP Configuration** (`~/.claude/.mcp.json`)
- Structured JSON format containing MCP server definitions
- Example structure shows fields like `command`, `args`, `env`, `type`

### 1.2 Disabled Extensions Structure

Each main extension directory has a corresponding disabled variant:
- `agents/` → `agents-disabled/`
- `commands/` → `commands-disabled/`

This suggests a simple disable mechanism: move files to the disabled directory.

### 1.3 Existing Codebase Patterns

**Backend Stack**:
- Go services (proxy-core, proxy-data)
- SQLite database with FTS5 search
- RESTful API endpoints (v2 API pattern)
- Indexer pattern for scanning and ingesting data

**Session Data Indexer Pattern** (`session_data_indexer.go`):
- Scans `~/.claude/todos/` and `~/.claude/plans/` directories
- Parses JSON/Markdown files
- Extracts metadata (filename, content, size, modification time)
- Stores in SQLite tables with indexed columns
- Supports reindexing via API endpoint

**Frontend Stack**:
- React + TypeScript
- React Query for data fetching
- Existing pages for Todos, Plans, Conversations, Projects
- Tab-based UI patterns (SessionData.tsx)
- API contract types defined in `src/lib/types.ts`

---

## 2. What Needs to be Built

### 2.1 Backend: Data Model & Storage

**New Database Tables Needed**:

```sql
CREATE TABLE claude_extensions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,  -- 'agent' | 'command' | 'skill' | 'plugin'
  name TEXT NOT NULL,
  file_name TEXT UNIQUE NOT NULL,
  description TEXT,
  metadata_json TEXT,  -- Raw YAML frontmatter as JSON
  file_size INTEGER,
  file_path TEXT NOT NULL,
  modified_at DATETIME,
  enabled BOOLEAN DEFAULT TRUE,
  indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type, name)
);

CREATE INDEX idx_extensions_type ON claude_extensions(type);
CREATE INDEX idx_extensions_name ON claude_extensions(name);
CREATE INDEX idx_extensions_enabled ON claude_extensions(enabled);
```

### 2.2 Backend: Extension Indexer Service

Similar to `SessionDataIndexer` pattern:
- Scan `~/.claude/agents/`, `~/.claude/commands/`, `~/.claude/agents-disabled/`, `~/.claude/commands-disabled/`
- For each file, extract metadata (YAML frontmatter parsing)
- Distinguish enabled vs disabled by directory location
- Store/upsert in database
- Support reindexing via API

### 2.3 Backend: HTTP Handlers & API Endpoints

```
GET  /api/v2/claude/extensions              # List all extensions (with filtering)
GET  /api/v2/claude/extensions/{type}       # List by type (agents, commands, skills, plugins)
GET  /api/v2/claude/extensions/{type}/{name} # Get single extension details
POST /api/v2/claude/extensions/{type}/{name}/enable
POST /api/v2/claude/extensions/{type}/{name}/disable
POST /api/v2/claude/extensions/reindex       # Trigger full reindex
```

### 2.4 Frontend: Extension Workshop Page

**UI Sections**:
1. **Type Tabs**: Agent | Command | Skill | Plugin
2. **Summary Cards**: Total count by type, enabled/disabled counts
3. **Extension List**: Virtualized table with columns
4. **Detail Panel**: Metadata, content preview, enable/disable toggle

---

## 3. Dependencies & Risks

### 3.1 Confirmed Dependencies

✅ **conversation-indexer**: COMPLETE
✅ **session-data-indexer**: COMPLETE

### 3.2 Technical Risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| YAML Parsing | Frontmatter parsing can be fragile | Parse only between `---` lines |
| Enable/Disable | File move vs DB flag | Use DB flag (safer) |
| Symlinks | ~/.claude has symlinks | Resolve explicitly |
| Usage Stats | No data on when extensions used | MVP: show 0 usage, defer tracking |

---

## 4. Ambiguities & Open Questions

### ❓ Q1: What is a "skill"?
- Mentioned in feature description but no examples exist
- Is this separate from agents/commands?
- **NEEDS DECISION**

### ❓ Q2: Enable/Disable Implementation
- Move files to disabled directory? Or DB flag?
- **Recommendation**: DB flag (safer, no filesystem race conditions)
- **NEEDS DECISION**

### ❓ Q3: Quick Actions - "Edit" and "Create New"
- "Edit" should open external editor or in-browser?
- "Create New" should show form or template?
- **Recommendation**: Defer to future sprint
- **NEEDS DECISION**

### ❓ Q4: Plugin Management Scope
- Manage installed plugins or just display config?
- **Recommendation**: MCP servers only for MVP
- **NEEDS DECISION**

### ❓ Q5: Usage Statistics
- How to detect when extensions are used?
- **Recommendation**: Defer to Phase 5
- **NEEDS DECISION**

---

## 5. Scope Recommendation

### In Scope for MVP (Phase 4)
- List, filter, search extensions (all types)
- View extension metadata and content
- Enable/disable extensions (DB flag approach)
- Reindex on demand

### Out of Scope for MVP (Defer to Phase 5+)
- Edit/create/delete extensions from UI
- Usage statistics correlation
- Full plugin marketplace
- Script generation

---

## 6. Success Criteria

✅ User can view all extension types (agents, commands)
✅ User can filter by type, name, enabled/disabled status
✅ User can see extension metadata: name, description, model, tools
✅ User can enable/disable extensions from UI
✅ Reindex updates UI without page reload

---

## 7. Verdict

**Status**: PAUSE - Ambiguities need resolution

The feature is feasible and patterns exist. However, 5 open questions need answers before planning can proceed:

1. Skills definition
2. Enable/disable mechanism
3. Quick actions scope
4. Plugin management scope
5. Usage statistics scope

**Recommended next step**: Resolve ambiguities with user, then generate sprint plan.
