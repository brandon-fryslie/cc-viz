# Sprint: incremental-maps - Make Relationship Maps Incremental
Generated: 2026-01-19
Confidence: HIGH
Status: READY FOR IMPLEMENTATION

## Sprint Goal

Make session_conversation_map populate incrementally on every startup (like sessions table), and fix all aggregate count mismatches.

## Scope

**Deliverables:**
1. Make session_conversation_map incremental (run every startup)
2. Fix sessions table aggregate counts (conversation_count, agent_count, todo_count)
3. Fix conversations.message_count accuracy

## Work Items

### P0: Make session_conversation_map incremental

**Acceptance Criteria:**
- [ ] session_conversation_map populates on every startup, not just table creation
- [ ] Uses INSERT OR IGNORE to avoid duplicates
- [ ] All 4,208 session-conversation pairs from conversation_messages are mapped
- [ ] Log shows count of new mappings added

**Technical Notes:**
- Location: `internal/service/storage_sqlite.go` in `runRelationshipMapsMigrations()`
- Move population query outside the `if scmExists == 0` block
- Pattern: Same as sessions migration fix

```go
// Always ensure all session-conversation pairs are mapped
populateQuery := `
INSERT OR IGNORE INTO session_conversation_map
    (session_id, conversation_id, first_message_uuid, last_message_uuid, message_count)
SELECT
    session_id,
    conversation_id,
    MIN(uuid),
    MAX(uuid),
    COUNT(*)
FROM conversation_messages
WHERE session_id IS NOT NULL AND session_id <> ''
GROUP BY session_id, conversation_id
`
```

### P1: Fix sessions aggregate counts

**Acceptance Criteria:**
- [ ] sessions.conversation_count reflects actual count from session_conversation_map
- [ ] sessions.agent_count reflects actual count from subagent_graph
- [ ] sessions.todo_count reflects actual count from claude_todos
- [ ] sessions.message_count reflects actual count from conversation_messages
- [ ] All 496+ sessions with wrong counts are fixed

**Technical Notes:**
- Add UPDATE queries after the INSERT migration
- Run on every startup to keep counts accurate

```sql
-- Update conversation_count
UPDATE sessions SET conversation_count = (
    SELECT COUNT(*) FROM session_conversation_map scm WHERE scm.session_id = sessions.id
);

-- Update agent_count
UPDATE sessions SET agent_count = (
    SELECT COUNT(*) FROM subagent_graph sg WHERE sg.session_id = sessions.id
);

-- Update todo_count
UPDATE sessions SET todo_count = (
    SELECT COUNT(*) FROM claude_todos ct WHERE ct.session_uuid = sessions.id
);

-- Update message_count (accurate)
UPDATE sessions SET message_count = (
    SELECT COUNT(*) FROM conversation_messages cm WHERE cm.session_id = sessions.id
);
```

### P2: Fix conversations.message_count accuracy

**Acceptance Criteria:**
- [ ] conversations.message_count matches actual deduplicated count in conversation_messages
- [ ] All 1,050 mismatched conversations are fixed
- [ ] Run on every startup after conversation indexing

**Technical Notes:**
- Add to conversation indexer or as a post-indexing step

```sql
UPDATE conversations SET message_count = (
    SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id = conversations.id
);
```

## Dependencies

- Sprint 1 (orphan-cleanup) must complete first
- FK constraints must be enabled before running

## Risks

| Risk | Mitigation |
|------|------------|
| Slow startup with large datasets | Run queries asynchronously if needed |
| Count updates interfere with indexers | Run after indexers complete |
