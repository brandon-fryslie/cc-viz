# Definition of Done: relationship-maps

**Sprint**: relationship-maps
**Generated**: 2026-01-19

---

## Functional Acceptance Criteria

### Schema - session_conversation_map
- [ ] Table exists with columns: id, session_id, conversation_id, first_message_uuid, last_message_uuid, message_count, created_at
- [ ] UNIQUE constraint on (session_id, conversation_id)
- [ ] Foreign keys to sessions and conversations tables
- [ ] Indexes on session_id and conversation_id

### Schema - session_file_changes
- [ ] Table exists with columns: id, session_id, file_path, change_type, tool_name, message_uuid, timestamp, created_at
- [ ] Foreign key to sessions table
- [ ] Indexes on session_id and file_path

### Data Population
- [ ] session_conversation_map populated from existing conversation_messages
- [ ] Row count matches expected: `SELECT COUNT(DISTINCT session_id || '|' || conversation_id) FROM conversation_messages WHERE session_id IS NOT NULL`
- [ ] session_file_changes populated from Write/Edit tool outputs
- [ ] File changes have correct tool_name values

### API - Session Detail Extended
```json
GET /api/v2/claude/sessions/{id}
{
  "id": "...",
  "project_path": "...",
  "started_at": "...",
  "ended_at": "...",
  "conversations": [
    {"id": "...", "title": "...", "message_count": 45}
  ],
  "files": [
    {"file_path": "/path/to/file.go", "change_type": "write", "tool_name": "Write"}
  ],
  ...
}
```

### API - New Endpoints
- [ ] `GET /api/v2/claude/sessions/{id}/conversations` returns conversations array
- [ ] `GET /api/v2/claude/sessions/{id}/files` returns file changes array
- [ ] `GET /api/v2/claude/conversations/{id}/sessions` returns sessions array
- [ ] `GET /api/v2/claude/files?path=/prefix` returns file changes filtered by path

### Bidirectional Navigation
- [ ] Can navigate: session → conversation → session
- [ ] Can navigate: session → file → session (via file path)
- [ ] All UUIDs in responses are valid references

---

## Non-Functional Requirements

### Performance
- [ ] GetSessionConversations executes in <50ms
- [ ] GetConversationSessions executes in <50ms
- [ ] GetSessionFileChanges executes in <50ms
- [ ] File extraction completes in <60s for full dataset

---

## Verification Commands

```bash
# Schema verification
sqlite3 requests.db ".schema session_conversation_map"
sqlite3 requests.db ".schema session_file_changes"

# Population counts
sqlite3 requests.db "SELECT COUNT(*) FROM session_conversation_map"
sqlite3 requests.db "SELECT COUNT(*) FROM session_file_changes"
sqlite3 requests.db "SELECT change_type, COUNT(*) FROM session_file_changes GROUP BY change_type"

# API verification
curl http://localhost:8080/api/v2/claude/sessions/{id}/conversations | jq 'length'
curl http://localhost:8080/api/v2/claude/sessions/{id}/files | jq 'length'
curl http://localhost:8080/api/v2/claude/conversations/{id}/sessions | jq 'length'
```
