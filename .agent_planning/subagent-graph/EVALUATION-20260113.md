# EVALUATION-20260113.md - Subagent Graph Implementation Status

**Timestamp**: 2026-01-13
**Evaluator**: Claude Code Exploration Agent
**Scope**: Subagent Graph feature readiness for Phase 1c
**Confidence**: COMPREHENSIVE - Full codebase exploration completed

## Executive Summary

**Status**: READY FOR IMPLEMENTATION - All prerequisites in place, significant data volume confirmed
**Blocker Risk**: LOW - No technical blockers identified
**Architectural Fit**: EXCELLENT - Can reuse established patterns from Conversation Indexer
**Data Volume**: 530 subagent files, 106 unique sessions, 493 unique agents, 22,928 parent-child references

---

## 1. WHAT EXISTS - Current Infrastructure

### 1.1 Database Schema - SUBAGENT-CAPABLE

**Location**: `proxy/internal/service/storage_sqlite.go`

The `conversation_messages` table already supports subagent tracking:
```
- session_id TEXT         (root session identifier)
- agent_id TEXT           (which agent generated this message)
- parent_uuid TEXT        (reference to parent message - KEY FOR GRAPH)
- is_sidechain BOOLEAN    (sidechain vs main agent indicator)
```

**Gap Identified**: NO dedicated subagent hierarchy table exists. The current schema stores **messages** with parent references, but NOT the parent-child **relationships between agents** themselves.

**Required Schema Addition**:
```sql
CREATE TABLE subagent_graph (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,              -- Root session UUID
    parent_agent_id TEXT,                  -- Parent agent UUID (NULL for root)
    agent_id TEXT NOT NULL,                -- Child agent UUID
    first_message_uuid TEXT,               -- First message from this agent
    last_message_uuid TEXT,                -- Last message from this agent
    message_count INTEGER DEFAULT 0,       -- Number of messages from this agent
    spawn_time DATETIME,                   -- When agent was first invoked
    end_time DATETIME,                     -- When agent completed
    status TEXT,                           -- "active", "completed", "failed"
    is_sidechain BOOLEAN DEFAULT FALSE,
    file_path TEXT,                        -- Path to subagents/agent-*.jsonl
    file_mtime DATETIME,
    indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(session_id, agent_id),
    FOREIGN KEY(session_id) REFERENCES conversations(id)
);
CREATE INDEX idx_session_agent ON subagent_graph(session_id, agent_id);
CREATE INDEX idx_parent_child ON subagent_graph(parent_agent_id, agent_id);
CREATE INDEX idx_spawn_time ON subagent_graph(spawn_time DESC);
```

### 1.2 JSONL Subagent File Format - WELL UNDERSTOOD

**Location**: `~/.claude/projects/-Users-bmf-code-*/*/subagents/agent-*.jsonl`
**Total Count**: 530 files

**File Structure**:
```json
{
  "sessionId": "be891ac4-9c95-44ed-b044-54d61bf581cc",
  "agentId": "a7e8568",
  "uuid": "bb88069f-41ed-4264-a123-ae628290407e",
  "parentUuid": null,
  "timestamp": "2026-01-11T21:17:21.542Z",
  "type": "user" | "assistant" | "system",
  "cwd": "/Users/bmf/code/claude-anchor",
  "gitBranch": "",
  "version": "2.1.4",
  "isSidechain": true,
  "userType": "external",
  "message": { "role": "user", "content": "..." },
  "requestId": null
}
```

**Parent-Child Relationships**:
- `parentUuid` field: 22,928 references to parent messages (NOT null)
- These create a **message chain graph** within each agent

### 1.3 Existing Services - REUSABLE PATTERNS

**Conversation Indexer** (`indexer.go`):
- Directory walking with modification time tracking
- Transaction-based batch inserts
- File watcher for incremental updates
- Error collection (don't fail on single file)

**Session Data Indexer** (`session_data_indexer.go`):
- UUID extraction from filenames
- JSON parsing with error handling

Both patterns are DIRECTLY APPLICABLE to subagent indexing.

---

## 2. WHAT'S MISSING - Gaps to Fill

### 2.1 Subagent Graph Indexer - NOT IMPLEMENTED

**New file needed**: `proxy/internal/service/subagent_indexer.go`

Structure mirrors `indexer.go`:
- `NewSubagentIndexer(storage *SQLiteStorageService) (*SubagentIndexer, error)`
- `Start() error`
- `Stop()`
- `initialIndex() error`
- `indexFile(filePath string) error`
- `needsIndexing(filePath string, mtime time.Time) (bool, error)`
- `watchFiles()`
- `processIndexQueue()`

### 2.2 Parent-Child Relationship Extraction

**Algorithm**:
```
For each agent-N.jsonl:
  1. Parse all messages (chronologically)
  2. Find first message where parentUuid != null
  3. Query conversation_messages table for that parentUuid
  4. Extract agent_id from that message → parent_agent_id
  5. Insert into subagent_graph with relationship
```

---

## 3. FILES TO MODIFY

| File | Change |
|------|--------|
| `storage_sqlite.go` | Add `subagent_graph` table schema |
| `subagent_indexer.go` | NEW - Main indexer service |
| `subagent_indexer_test.go` | NEW - Integration tests |

---

## 4. DEPENDENCIES AND RISKS

### 4.1 Hard Dependencies
- ✅ Conversation Indexer running (to look up parent messages)
- ✅ Database schema migrations

### 4.2 Risks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Parent message not found in DB | Medium | Log orphans, allow NULL parent |
| Circular spawning | Low | Detect cycles, reject |
| Large spawn chains | Low | Query with depth limit |

---

## 5. AMBIGUITIES AND OPEN QUESTIONS

### 5.1 Parent-Child Definition
**Question**: How do we determine if Agent A spawned Agent B?

**Recommended**: Use "First Message Rule" - look at first message in Agent B's transcript. If parentUuid points to a message from Agent A, then A spawned B.

### 5.2 Sidechain Agent Handling
**Question**: Should sidechain agents be in the parent-child graph?

**Recommended**: Include as children with `is_sidechain=true` flag.

### 5.3 Agent UUID Scope
**Question**: Are agent UUIDs globally unique or only within session?

**Current data**: 493 unique agents across 106 sessions - appears globally unique.

### 5.4 Empty Subagent Files
**Question**: How to handle empty files?

**Recommended**: Skip with warning log.

---

## 6. DATA INVENTORY

| Metric | Value |
|--------|-------|
| Total subagent files | 530 |
| Unique sessions | 106 |
| Unique agents | 493 |
| Parent refs (non-null) | 22,928 |
| Avg messages per file | ~43 |
| Date range | 2025-12-28 to 2026-01-13 |

---

## 7. SUCCESS CRITERIA

Phase 1c will be COMPLETE when:

1. ✅ Subagent graph table created and integrated
2. ✅ SubagentIndexer service built with Start/Stop lifecycle
3. ✅ All 530 subagent files successfully indexed
4. ✅ Parent-child relationships correctly extracted
5. ✅ Integration tests pass with real data
6. ✅ Performance: Full indexing completes in <30 seconds
7. ✅ Validation: No orphaned agents, no cycles

---

## CONCLUSION

**Status**: IMPLEMENTATION-READY
**Blockers**: NONE
**Estimated effort**: 12-16 hours

The ambiguities are minor and can be resolved with sensible defaults (First Message Rule, include sidechains, skip empty files). Implementation can proceed.
