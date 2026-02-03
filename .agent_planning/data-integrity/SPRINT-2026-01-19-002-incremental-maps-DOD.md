# Definition of Done: incremental-maps

## Acceptance Criteria

### 1. session_conversation_map incremental
- [ ] Population query runs on every startup (moved outside table creation block)
- [ ] Query `SELECT COUNT(*) FROM session_conversation_map` returns ~4,208 (all pairs)
- [ ] No session-conversation pairs from conversation_messages are missing
- [ ] Startup log shows "Added X session-conversation mappings"

### 2. sessions.conversation_count accurate
- [ ] Query returns 0 mismatches:
```sql
SELECT COUNT(*) FROM sessions s WHERE s.conversation_count <> (
    SELECT COUNT(*) FROM session_conversation_map scm WHERE scm.session_id = s.id
);
```

### 3. sessions.agent_count accurate
- [ ] Query returns 0 mismatches:
```sql
SELECT COUNT(*) FROM sessions s WHERE s.agent_count <> (
    SELECT COUNT(*) FROM subagent_graph sg WHERE sg.session_id = s.id
);
```

### 4. sessions.todo_count accurate
- [ ] Query returns 0 mismatches:
```sql
SELECT COUNT(*) FROM sessions s WHERE s.todo_count <> (
    SELECT COUNT(*) FROM claude_todos ct WHERE ct.session_uuid = s.id
);
```

### 5. sessions.message_count accurate
- [ ] Query returns 0 mismatches:
```sql
SELECT COUNT(*) FROM sessions s WHERE s.message_count <> (
    SELECT COUNT(*) FROM conversation_messages cm WHERE cm.session_id = s.id
);
```

### 6. conversations.message_count accurate
- [ ] Query returns 0 mismatches:
```sql
SELECT COUNT(*) FROM conversations c WHERE c.message_count <> (
    SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id = c.id
);
```

## Verification Commands

```bash
# Full integrity check after restart
sqlite3 ~/code/cc-viz/requests.db "
SELECT '=== Counts Check ===' as info;
SELECT 'session_conversation_map: ' || COUNT(*) FROM session_conversation_map;
SELECT 'Expected pairs: ' || COUNT(DISTINCT session_id || '|' || conversation_id) FROM conversation_messages WHERE session_id IS NOT NULL AND session_id <> '';

SELECT '' as info;
SELECT '=== Aggregate Mismatches ===' as info;
SELECT 'sessions.conversation_count mismatches: ' || COUNT(*) FROM sessions s WHERE s.conversation_count <> COALESCE((SELECT COUNT(*) FROM session_conversation_map scm WHERE scm.session_id = s.id), 0);
SELECT 'sessions.agent_count mismatches: ' || COUNT(*) FROM sessions s WHERE s.agent_count <> COALESCE((SELECT COUNT(*) FROM subagent_graph sg WHERE sg.session_id = s.id), 0);
SELECT 'sessions.todo_count mismatches: ' || COUNT(*) FROM sessions s WHERE s.todo_count <> COALESCE((SELECT COUNT(*) FROM claude_todos ct WHERE ct.session_uuid = s.id), 0);
SELECT 'sessions.message_count mismatches: ' || COUNT(*) FROM sessions s WHERE s.message_count <> COALESCE((SELECT COUNT(*) FROM conversation_messages cm WHERE cm.session_id = s.id), 0);
SELECT 'conversations.message_count mismatches: ' || COUNT(*) FROM conversations c WHERE c.message_count <> COALESCE((SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id = c.id), 0);
"
```
