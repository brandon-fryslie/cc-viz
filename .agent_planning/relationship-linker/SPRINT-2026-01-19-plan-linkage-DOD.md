# Definition of Done: plan-linkage

**Sprint**: plan-linkage
**Generated**: 2026-01-19

---

## Functional Acceptance Criteria

### Schema - plan_session_map
- [ ] Table exists with columns: id, plan_id, session_id, relationship, confidence, discovered_at
- [ ] UNIQUE constraint on (plan_id, session_id)
- [ ] Foreign keys to claude_plans and sessions
- [ ] Indexes on both plan_id and session_id

### Schema - claude_plans
- [ ] session_uuid column exists (nullable TEXT)
- [ ] Index on session_uuid

### Data Population
- [ ] Existing plans scanned for UUID patterns
- [ ] Valid UUIDs matched against sessions table
- [ ] Links created with appropriate confidence levels
- [ ] At least some plans have 'high' confidence links (if UUIDs exist in content)

### API - Full Session Detail
```json
GET /api/v2/claude/sessions/{id}
{
  "id": "abc...",
  "project_path": "/path/to/project",
  "started_at": "2026-01-15T10:00:00Z",
  "ended_at": "2026-01-15T11:30:00Z",
  "conversation_count": 2,
  "message_count": 45,
  "conversations": [
    {"id": "...", "title": "...", "message_count": 30}
  ],
  "files": [
    {"file_path": "/path/to/file.go", "change_type": "write", "tool_name": "Write"}
  ],
  "plans": [
    {"id": 1, "display_name": "Sprint 1", "relationship": "created", "confidence": "high"}
  ],
  "todos": [
    {"id": 1, "content": "Fix bug", "status": "completed"}
  ],
  "subagents": [
    {"agent_id": "xyz...", "agent_type": "Explore", "message_count": 15}
  ]
}
```

### API - Plan Sessions
```json
GET /api/v2/claude/plans/{id}/sessions
{
  "plan_id": 1,
  "sessions": [
    {
      "id": "abc...",
      "relationship": "created",
      "confidence": "high",
      "started_at": "2026-01-15T10:00:00Z"
    }
  ]
}
```

### API - Session Plans
- [ ] `GET /api/v2/claude/sessions/{id}/plans` returns plans array
- [ ] Returns 200 with empty array when no plans linked

### Bidirectional Navigation Complete
- [ ] Session → Conversations ✓ (Sprint 2)
- [ ] Session → Files ✓ (Sprint 2)
- [ ] Session → Plans ✓ (this sprint)
- [ ] Session → Todos ✓ (this sprint)
- [ ] Session → Subagents ✓ (this sprint)
- [ ] Conversation → Sessions ✓ (Sprint 2)
- [ ] File → Sessions ✓ (Sprint 2)
- [ ] Plan → Sessions ✓ (this sprint)

---

## Non-Functional Requirements

### Performance
- [ ] Full session detail query executes in <100ms
- [ ] Plan-session linking completes in <30s
- [ ] All bidirectional queries execute in <50ms

---

## Verification Commands

```bash
# Schema verification
sqlite3 requests.db ".schema plan_session_map"
sqlite3 requests.db "PRAGMA table_info(claude_plans)" | grep session_uuid

# Population counts
sqlite3 requests.db "SELECT COUNT(*) FROM plan_session_map"
sqlite3 requests.db "SELECT confidence, COUNT(*) FROM plan_session_map GROUP BY confidence"

# API verification
curl http://localhost:8080/api/v2/claude/sessions/{id} | jq 'keys'
curl http://localhost:8080/api/v2/claude/plans/1/sessions | jq '.sessions | length'
curl http://localhost:8080/api/v2/claude/sessions/{id}/plans | jq 'length'
```
