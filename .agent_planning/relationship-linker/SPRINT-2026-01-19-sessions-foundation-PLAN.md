# Sprint: sessions-foundation

**Generated**: 2026-01-19
**Confidence**: HIGH
**Status**: READY FOR IMPLEMENTATION

---

## Sprint Goal

Create the authoritative `sessions` table and migrate existing session_ids from conversation_messages.

---

## Scope

**Deliverables**:
1. Sessions table schema with migration
2. Session model structs
3. Session API endpoints (list, detail, stats)

---

## Work Items

### P0: Sessions Schema and Migration

**Files to Modify**:
- `internal/service/storage_sqlite.go`

**Implementation**:
1. Add `runSessionsMigrations()` function following existing pattern
2. Create `sessions` table:
```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_path TEXT,
  started_at DATETIME,
  ended_at DATETIME,
  conversation_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  agent_count INTEGER DEFAULT 0,
  todo_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
```
3. Add migration to populate from existing data:
```sql
INSERT INTO sessions (id, project_path, started_at, ended_at, message_count)
SELECT DISTINCT
  cm.session_id,
  c.project_path,
  MIN(cm.timestamp),
  MAX(cm.timestamp),
  COUNT(*)
FROM conversation_messages cm
JOIN conversations c ON cm.conversation_id = c.id
WHERE cm.session_id IS NOT NULL
GROUP BY cm.session_id
```
4. Hook into `createTables()` call chain

**Acceptance Criteria**:
- [ ] `sessions` table exists after startup
- [ ] Migration populates ~1,000 sessions from existing data
- [ ] Session count matches `SELECT COUNT(DISTINCT session_id) FROM conversation_messages`
- [ ] All sessions have valid started_at/ended_at timestamps
- [ ] No null session_ids in sessions table

---

### P1: Session Model Structs

**Files to Modify**:
- `internal/model/models.go`

**Implementation**:
```go
type Session struct {
    ID                string     `json:"id"`
    ProjectPath       string     `json:"project_path,omitempty"`
    StartedAt         *time.Time `json:"started_at,omitempty"`
    EndedAt           *time.Time `json:"ended_at,omitempty"`
    ConversationCount int        `json:"conversation_count"`
    MessageCount      int        `json:"message_count"`
    AgentCount        int        `json:"agent_count"`
    TodoCount         int        `json:"todo_count"`
    CreatedAt         time.Time  `json:"created_at"`
}

type SessionStats struct {
    TotalSessions     int `json:"total_sessions"`
    ActiveSessions    int `json:"active_sessions"`  // Sessions with activity in last 24h
    TotalMessages     int `json:"total_messages"`
    UniqueProjects    int `json:"unique_projects"`
}
```

**Acceptance Criteria**:
- [ ] Session struct JSON serializes correctly
- [ ] SessionStats struct matches API response format
- [ ] Time fields handle null values gracefully

---

### P2: Storage Interface Methods

**Files to Modify**:
- `internal/service/storage.go` (interface)
- `internal/service/storage_sqlite.go` (implementation)

**Methods to Add**:
```go
// In StorageService interface
GetSessions(limit int, offset int) ([]*model.Session, error)
GetSession(sessionID string) (*model.Session, error)
GetSessionStats() (*model.SessionStats, error)
```

**Implementation Notes**:
- GetSessions: ORDER BY started_at DESC, support pagination
- GetSession: Single row lookup by primary key
- GetSessionStats: Aggregate query

**Acceptance Criteria**:
- [ ] GetSessions returns sessions in descending start order
- [ ] GetSessions supports limit/offset pagination
- [ ] GetSession returns nil for non-existent session (not error)
- [ ] GetSessionStats aggregates correctly across all sessions

---

### P3: Session API Endpoints

**Files to Modify**:
- `internal/handler/data_handler.go`
- `cmd/viz-server/main.go` (route registration)

**Endpoints**:
```
GET /api/v2/claude/sessions              - List sessions (paginated)
GET /api/v2/claude/sessions/{id}         - Session detail
GET /api/v2/claude/sessions/stats        - Aggregate statistics
```

**Handler Implementations**:
- GetSessionsV2: Parse limit/offset query params, call storage
- GetSessionDetailV2: Extract {id} path param, call storage
- GetSessionStatsV2: Call GetSessionStats()

**Acceptance Criteria**:
- [ ] GET /api/v2/claude/sessions returns JSON array of sessions
- [ ] GET /api/v2/claude/sessions?limit=10&offset=0 paginates correctly
- [ ] GET /api/v2/claude/sessions/{id} returns 404 for unknown ID
- [ ] GET /api/v2/claude/sessions/{id} returns full session object
- [ ] GET /api/v2/claude/sessions/stats returns SessionStats JSON
- [ ] All endpoints return proper Content-Type: application/json

---

## Dependencies

- None (foundational sprint)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Migration takes too long with large dataset | Run as background job after startup |
| Duplicate session_ids in source data | UNIQUE constraint + ON CONFLICT IGNORE |
| Null timestamps in conversation_messages | Filter with WHERE timestamp IS NOT NULL |

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] `just test` passes
- [ ] `just check` passes (lint + typecheck)
- [ ] Manual verification: API returns expected data
- [ ] Session count verified against source data
