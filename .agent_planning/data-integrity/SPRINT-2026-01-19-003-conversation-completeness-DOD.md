# Definition of Done: conversation-completeness

## Acceptance Criteria

### 1. All conversation_messages have valid conversation references
- [ ] Query returns 0:
```sql
SELECT COUNT(*) FROM conversation_messages cm
WHERE cm.conversation_id NOT IN (SELECT id FROM conversations);
```

### 2. Subagent conversations created
- [ ] Conversations table contains entries for all agent-* IDs
- [ ] Each synthetic entry has:
  - id: the agent-* ID
  - project_name: "Subagent: agent-XXX"
  - project_path: derived from session (may be NULL)
  - message_count: accurate count from conversation_messages

### 3. Orphaned UUID messages handled
- [ ] The 857 orphaned messages with UUID conversation IDs are resolved
- [ ] Either: synthetic conversation entries created OR documented as expected

### 4. API endpoints work for all conversation types
- [ ] `GET /api/v2/conversations` includes synthetic subagent entries
- [ ] `GET /api/v2/conversations/{agent-id}` returns valid response
- [ ] `GET /api/v2/conversations/{agent-id}/messages` returns messages

### 5. Bidirectional navigation complete
- [ ] Session → Conversations: includes agent-* conversations
- [ ] Conversation → Messages: works for agent-* IDs
- [ ] Message → Conversation: conversation_id FK is valid

## Verification Commands

```bash
# Check for orphaned messages
sqlite3 ~/code/cc-viz/requests.db "
SELECT 'Orphaned messages: ' || COUNT(*) FROM conversation_messages cm
WHERE cm.conversation_id NOT IN (SELECT id FROM conversations);
"

# Check agent-* conversations exist
sqlite3 ~/code/cc-viz/requests.db "
SELECT 'Agent conversations: ' || COUNT(*) FROM conversations WHERE id LIKE 'agent-%';
"

# Test API
curl -s "http://localhost:8002/api/v2/conversations?limit=5" | jq '.conversations | length'
```
