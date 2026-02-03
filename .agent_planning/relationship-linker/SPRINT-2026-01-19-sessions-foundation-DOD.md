# Definition of Done: sessions-foundation

**Sprint**: sessions-foundation
**Generated**: 2026-01-19

---

## Functional Acceptance Criteria

### Schema
- [ ] `sessions` table exists with columns: id, project_path, started_at, ended_at, conversation_count, message_count, agent_count, todo_count, created_at
- [ ] Indexes exist on project_path and started_at
- [ ] Primary key enforced on id column

### Migration
- [ ] Existing session_ids migrated from conversation_messages
- [ ] Session count matches: `SELECT COUNT(DISTINCT session_id) FROM conversation_messages WHERE session_id IS NOT NULL`
- [ ] All migrated sessions have non-null started_at and ended_at
- [ ] Migration is idempotent (can run multiple times without duplication)

### API Endpoints
- [ ] `GET /api/v2/claude/sessions` returns 200 with JSON array
- [ ] `GET /api/v2/claude/sessions?limit=5` returns exactly 5 sessions
- [ ] `GET /api/v2/claude/sessions?offset=10` skips first 10 sessions
- [ ] `GET /api/v2/claude/sessions/{valid-id}` returns 200 with session object
- [ ] `GET /api/v2/claude/sessions/{invalid-id}` returns 404
- [ ] `GET /api/v2/claude/sessions/stats` returns 200 with stats object

### Response Format
Sessions list:
```json
{
  "sessions": [
    {
      "id": "abc123...",
      "project_path": "/path/to/project",
      "started_at": "2026-01-15T10:00:00Z",
      "ended_at": "2026-01-15T11:30:00Z",
      "conversation_count": 2,
      "message_count": 45,
      "agent_count": 3,
      "todo_count": 5
    }
  ],
  "total": 1000,
  "limit": 50,
  "offset": 0
}
```

Stats:
```json
{
  "total_sessions": 1000,
  "active_sessions": 5,
  "total_messages": 350000,
  "unique_projects": 25
}
```

---

## Non-Functional Requirements

### Performance
- [ ] GetSessions query executes in <50ms for 50 results
- [ ] GetSession query executes in <10ms
- [ ] Migration completes in <30s for ~1,000 sessions

### Quality
- [ ] `just test` passes (all existing tests still work)
- [ ] `just check` passes (golangci-lint + TypeScript typecheck)
- [ ] No new warnings introduced

---

## Verification Commands

```bash
# Schema verification
sqlite3 requests.db ".schema sessions"

# Migration count verification
sqlite3 requests.db "SELECT COUNT(*) FROM sessions"
sqlite3 requests.db "SELECT COUNT(DISTINCT session_id) FROM conversation_messages WHERE session_id IS NOT NULL"

# API verification
curl http://localhost:8080/api/v2/claude/sessions | jq '.total'
curl http://localhost:8080/api/v2/claude/sessions/stats | jq '.'
curl http://localhost:8080/api/v2/claude/sessions/{known-session-id} | jq '.id'
```
