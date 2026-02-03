# EVALUATION: relationship-linker Feature

**Generated**: 2026-01-19
**Topic**: relationship-linker - Final piece of Phase 1 Graph Foundation
**Verdict**: PAUSE (3 design decisions required)

---

## Executive Summary

The relationship-linker feature is ready to implement. All dependencies are verified functional:
- conversation-indexer: 4,418 conversations, 350K messages
- subagent-graph: 772 records, 168 sessions, 732 agents
- session-data-indexer: 1,389 todos, 1,491 sessions, 16 plans

**However**, 3 architectural decisions must be made before implementation can begin.

---

## 1. Entity Inventory (Current State)

| Table | Records | Primary Key | Relevant Relationships |
|-------|---------|-------------|------------------------|
| **conversations** | 4,418 | id (UUID) | project_path |
| **conversation_messages** | 350,614 | uuid | conversation_id, session_id, agent_id |
| **subagent_graph** | 772 | session_id + agent_id | parent_agent_id |
| **claude_todos** | 1,389 | file_path + item_index | session_uuid, agent_uuid |
| **claude_todo_sessions** | 1,491 | file_path | session_uuid |
| **claude_plans** | 16 | file_name | (no session link) |
| **extensions** | 184 | id | source, project_path |

### Cross-Reference Fields Already Present

| Field | Table | References | Notes |
|-------|-------|-----------|-------|
| `session_id` | conversation_messages | implicit | 1,023 unique values |
| `agent_id` | conversation_messages | subagent_graph.agent_id | 732 unique agents |
| `conversation_id` | conversation_messages | conversations.id | FK enforced |
| `session_uuid` | claude_todos | implicit | Links todos to sessions |
| `parent_agent_id` | subagent_graph | subagent_graph.agent_id | Agent hierarchy |

---

## 2. Relationships Needed (vs What Exists)

| Relationship | Status | Implementation |
|--------------|--------|----------------|
| Session → Conversations | **PARTIAL** | Can query via conversation_messages.session_id but no aggregation table |
| Session → Todos | **AVAILABLE** | Direct via claude_todos.session_uuid |
| Session → Subagents | **AVAILABLE** | Direct via subagent_graph.session_id |
| **Session → File Changes** | **MISSING** | No data source exists |
| **Plan → Sessions** | **MISSING** | claude_plans has no session link |
| Conversation → Agent | **PARTIAL** | Can join via messages but not optimized |

---

## 3. CRITICAL: Decisions Required

### Decision 1: Session Representation

**Issue**: Sessions are implicit (referenced by session_id in multiple tables, but no `sessions` table exists).

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **A (Standard)** | Keep sessions implicit, derive from session_id values | No migration, simpler | Can't add session metadata, harder to track session lifecycle |
| **B (Better Architecture)** | Create explicit `sessions` table | Single source of truth, can track metadata (start/end time, project, summary) | Requires migration, must reconcile ~1,000 existing session_ids |

**Recommendation**: Option B - An explicit sessions table is essential for relationship-linker to be fully functional. Without it, "session" is just a string that appears in various places.

### Decision 2: File Change Tracking

**Issue**: No mechanism exists to know which files a session modified.

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **A (Standard)** | Parse tool_use blocks (Write, Bash) from existing conversation_messages | Uses existing data, no new collection needed | May miss file changes, parsing is imperfect |
| **B (More Complete)** | Git history integration | Accurate file tracking, handles all change types | Assumes git usage, complex integration, may be slow |
| **C (Alternative)** | Defer file tracking to Phase 2 | Unblocks relationship-linker v1 | Incomplete feature, file→session links missing |

**Recommendation**: Option A initially, with C as acceptable fallback. Parse existing tool outputs first; git integration can be Phase 2.

### Decision 3: Plan-Session Linkage

**Issue**: claude_plans has `file_name` but no way to know which session created/referenced the plan.

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **A (Standard)** | Temporal proximity: match plan file mtime to session activity window | Simple, works without content parsing | Imprecise, could attribute wrongly |
| **B (More Accurate)** | Content analysis: look for session UUID patterns in plan content | Most accurate if plans contain UUIDs | Requires parsing, may not always find UUID |
| **C (Alternative)** | Add session_uuid field to claude_plans, populate going forward | Clean schema, forward-compatible | Doesn't help existing plans |

**Recommendation**: Option B + C combined. Parse existing plans for UUIDs, add field for future plans.

---

## 4. Proposed Schema (Pending Decisions)

```sql
-- If Decision 1 = B (sessions table)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- UUID
  project_path TEXT,             -- Which project this session was in
  started_at DATETIME,           -- First message timestamp
  ended_at DATETIME,             -- Last message timestamp
  conversation_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  agent_count INTEGER DEFAULT 0,
  todo_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Aggregation table for fast lookups
CREATE TABLE session_conversation_map (
  session_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  first_message_uuid TEXT,
  last_message_uuid TEXT,
  message_count INTEGER DEFAULT 0,
  UNIQUE(session_id, conversation_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Plan linkage (Decision 3)
CREATE TABLE plan_session_map (
  plan_id INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  relationship TEXT,             -- 'created', 'referenced'
  discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, session_id),
  FOREIGN KEY (plan_id) REFERENCES claude_plans(id),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- File changes (Decision 2 = A)
CREATE TABLE session_file_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  change_type TEXT,              -- 'write', 'edit', 'delete', 'bash'
  tool_name TEXT,                -- 'Write', 'Edit', 'Bash'
  message_uuid TEXT,             -- Source message
  timestamp DATETIME,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

---

## 5. API Endpoints Needed

```
GET /api/v2/claude/sessions                    -- List all sessions
GET /api/v2/claude/sessions/{id}               -- Session detail with all relationships
  ├── conversations: [...]
  ├── todos: [...]
  ├── subagents: [...]
  └── file_changes: [...]

GET /api/v2/claude/conversations/{id}/sessions -- Sessions contributing to this conversation
GET /api/v2/claude/plans/{id}/sessions         -- Sessions that created/referenced plan
GET /api/v2/claude/files/{path}/sessions       -- Sessions that modified this file (bidirectional)
```

---

## 6. Success Criteria

- [ ] Any session UUID → shows all related conversations, todos, subagents
- [ ] Any conversation UUID → shows which sessions contributed to it
- [ ] Any plan → shows which session(s) created/referenced it
- [ ] Query "everything in session X" executes in <100ms
- [ ] Schema migration without data loss

---

## 7. Verdict

**PAUSE** - Awaiting decisions on:
1. Sessions table (explicit vs implicit)
2. File change tracking (parse tools vs defer)
3. Plan-session linkage (temporal vs content parsing)

Once these are resolved, implementation can proceed with HIGH confidence.
