# Data Integrity Fixes - Sprint Completion Report
Date: 2026-01-19
Status: COMPLETE

## Summary

All 3 sprints completed successfully. The data integrity issues discovered during the relationship-linker audit have been fixed.

## Sprint Results

### Sprint 1: orphan-cleanup ✅
- Enabled SQLite FK constraints (`_foreign_keys=on`)
- Added `runIntegrityChecks()` function that runs on every startup
- Cleans orphaned plan_session_map, session_conversation_map, and session_file_changes entries

### Sprint 2: incremental-maps ✅
- Made session_conversation_map populate on every startup (not just table creation)
- Added aggregate count updates for sessions table (conversation_count, agent_count, todo_count, message_count)
- Added conversations.message_count accuracy fix

### Sprint 3: conversation-completeness ✅
- Creates synthetic conversation entries for orphaned messages (agent-* subagents and orphaned UUIDs)
- Uses synthetic file_path (`synthetic/{id}.jsonl`) to satisfy NOT NULL UNIQUE constraint
- All conversation_messages now have valid FK references

## Final Metrics

| Metric | Before | After |
|--------|--------|-------|
| conversation_messages orphans | 2,229 | 0 |
| plan_session_map orphans | 126 | 0 |
| session_conversation_map orphans | 31 | 0 |
| session_file_changes orphans | ? | 0 |
| session_conversation_map entries | 1,647 | 4,135 |
| Synthetic conversations created | 0 | 40 |
| FK constraints | OFF | ON |

## Files Modified

- `internal/service/storage_sqlite.go`
  - Line 26: Added `_foreign_keys=on` to connection string
  - Line 131: Added call to `runIntegrityChecks()`
  - Lines 597-636: Added aggregate count updates in `runSessionsMigrations()`
  - Lines 668-715: Made `session_conversation_map` population incremental
  - Lines 783-848: Added `runIntegrityChecks()` function

## Verification

Run this query to verify integrity:
```sql
SELECT 'conversation_messages orphans: ' || COUNT(*) FROM conversation_messages cm
WHERE cm.conversation_id NOT IN (SELECT id FROM conversations);

SELECT 'plan_session_map orphans: ' || COUNT(*) FROM plan_session_map WHERE plan_id NOT IN (SELECT id FROM claude_plans);
SELECT 'scm conversation orphans: ' || COUNT(*) FROM session_conversation_map WHERE conversation_id NOT IN (SELECT id FROM conversations);
SELECT 'scm session orphans: ' || COUNT(*) FROM session_conversation_map WHERE session_id NOT IN (SELECT id FROM sessions);
SELECT 'sfc session orphans: ' || COUNT(*) FROM session_file_changes WHERE session_id NOT IN (SELECT id FROM sessions);
```

All values should be 0.

## Notes

- Small aggregate count mismatches may appear due to async indexers - system self-corrects on restart
- Synthetic conversations are marked with `project_name` prefix "Subagent:" or "Synthetic:"
- FK constraints prevent future orphans from being created
