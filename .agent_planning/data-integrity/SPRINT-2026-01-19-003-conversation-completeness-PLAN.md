# Sprint: conversation-completeness - Handle Subagent Conversations
Generated: 2026-01-19
Confidence: HIGH
Status: READY FOR IMPLEMENTATION

## Sprint Goal

Ensure all conversation_messages have valid conversation references, either by creating conversations entries for subagent files or by properly handling the agent-* pattern.

## Scope

**Deliverables:**
1. Create conversations entries for subagent (agent-*) conversation IDs
2. Clean up or properly handle orphaned conversation_messages
3. Ensure bidirectional navigation works for all message types

## Work Items

### P0: Create conversations for subagent IDs

**Acceptance Criteria:**
- [ ] All conversation_messages with agent-* pattern have matching conversations entry
- [ ] Query `SELECT COUNT(*) FROM conversation_messages WHERE conversation_id NOT IN (SELECT id FROM conversations)` returns 0
- [ ] Subagent conversations have appropriate metadata (project_path derived from session)

**Technical Notes:**
- The audit found 2,229 orphaned messages (1,372 from 29 agent-* IDs, 857 from 2 UUID IDs)
- Create synthetic conversations entries for agent-* IDs:

```sql
INSERT OR IGNORE INTO conversations (id, project_path, project_name, start_time, end_time, message_count)
SELECT DISTINCT
    cm.conversation_id,
    s.project_path,
    'Subagent: ' || cm.conversation_id,
    MIN(cm.timestamp),
    MAX(cm.timestamp),
    COUNT(*)
FROM conversation_messages cm
LEFT JOIN sessions s ON cm.session_id = s.id
WHERE cm.conversation_id LIKE 'agent-%'
  AND cm.conversation_id NOT IN (SELECT id FROM conversations)
GROUP BY cm.conversation_id;
```

### P1: Handle non-agent orphaned messages

**Acceptance Criteria:**
- [ ] Investigate the 857 orphaned messages with UUID conversation IDs
- [ ] Either create missing conversations entries OR document why they're orphaned
- [ ] Decide: clean up or preserve with synthetic entries

**Technical Notes:**
- These 857 messages reference 2 specific UUID conversation IDs that don't exist
- May be from deleted/moved conversation JSONL files
- Options:
  A. Create synthetic conversations (preserves data)
  B. Delete orphaned messages (loses data)

Recommend Option A - create synthetic entries to preserve data integrity.

### P2: Verify bidirectional navigation

**Acceptance Criteria:**
- [ ] API endpoint `/api/v2/conversations/{id}` works for agent-* IDs
- [ ] API endpoint `/api/v2/conversations/{id}/messages` returns messages for agent-* IDs
- [ ] Session → Conversation → Messages navigation works for all types

**Technical Notes:**
- Test with: `curl http://localhost:8002/api/v2/conversations/agent-a29101c`
- Verify GetConversationByIDV2 handles synthetic entries

## Dependencies

- Sprint 1 (orphan-cleanup) - FK constraints enabled
- Sprint 2 (incremental-maps) - session_conversation_map populated

## Risks

| Risk | Mitigation |
|------|------------|
| Creating synthetic entries pollutes conversations table | Use clear naming: "Subagent: agent-XXX" |
| Performance with large subagent queries | Index on conversation_id pattern if needed |
| Orphaned UUIDs may indicate deeper indexing issue | Investigate source files during implementation |
