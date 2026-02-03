# Definition of Done: orphan-cleanup

## Acceptance Criteria

### 1. plan_session_map cleaned
- [ ] Query `SELECT COUNT(*) FROM plan_session_map WHERE plan_id NOT IN (SELECT id FROM claude_plans)` returns 0
- [ ] Startup log shows "Cleaned X orphaned plan_session_map entries" (if any existed)

### 2. session_conversation_map cleaned
- [ ] Query `SELECT COUNT(*) FROM session_conversation_map WHERE conversation_id NOT IN (SELECT id FROM conversations)` returns 0
- [ ] Startup log shows "Cleaned X orphaned session_conversation_map entries" (if any existed)

### 3. FK constraints enabled
- [ ] SQLite connection string includes `_foreign_keys=on`
- [ ] Attempting to insert invalid FK fails with constraint error
- [ ] Deleting a session cascades to session_conversation_map and session_file_changes

### 4. Startup integrity check
- [ ] New `runIntegrityChecks()` function exists in storage_sqlite.go
- [ ] Function runs after migrations, before relationship linker
- [ ] Function logs any orphans found and cleans them
- [ ] Server starts successfully with clean database

## Verification Commands

```bash
# After server restart, verify no orphans
sqlite3 ~/code/cc-viz/requests.db "
SELECT 'plan_session_map orphans: ' || COUNT(*) FROM plan_session_map WHERE plan_id NOT IN (SELECT id FROM claude_plans);
SELECT 'session_conversation_map orphans: ' || COUNT(*) FROM session_conversation_map WHERE conversation_id NOT IN (SELECT id FROM conversations);
"

# Verify FK constraint is enabled
sqlite3 ~/code/cc-viz/requests.db "PRAGMA foreign_keys;"
# Should return: 1
```
