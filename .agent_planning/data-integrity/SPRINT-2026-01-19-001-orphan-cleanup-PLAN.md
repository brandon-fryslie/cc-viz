# Sprint: orphan-cleanup - Clean Orphaned Data and Enable FK Constraints
Generated: 2026-01-19
Confidence: HIGH
Status: READY FOR IMPLEMENTATION

## Sprint Goal

Remove all orphaned foreign key references and enable SQLite FK constraint enforcement to prevent future orphans.

## Scope

**Deliverables:**
1. Clean orphaned plan_session_map entries (126 records)
2. Clean orphaned session_conversation_map entries (31 records)
3. Enable SQLite foreign key constraints
4. Add startup integrity check

## Work Items

### P0: Clean plan_session_map orphans

**Acceptance Criteria:**
- [ ] Delete plan_session_map entries where plan_id doesn't exist in claude_plans
- [ ] Verify 0 orphan entries remain
- [ ] Log count of cleaned entries

**Technical Notes:**
```sql
DELETE FROM plan_session_map
WHERE plan_id NOT IN (SELECT id FROM claude_plans);
```

### P1: Clean session_conversation_map orphans

**Acceptance Criteria:**
- [ ] Delete session_conversation_map entries where conversation_id doesn't exist in conversations
- [ ] Verify 0 orphan entries remain
- [ ] Log count of cleaned entries

**Technical Notes:**
```sql
DELETE FROM session_conversation_map
WHERE conversation_id NOT IN (SELECT id FROM conversations);
```

### P2: Enable SQLite FK constraints

**Acceptance Criteria:**
- [ ] Add `_foreign_keys=on` to SQLite connection string in NewSQLiteStorageService
- [ ] Verify FK constraints are enforced (test with intentional violation)
- [ ] Ensure CASCADE DELETE works for dependent tables

**Technical Notes:**
- Location: `internal/service/storage_sqlite.go:26`
- Current: `dbPath + "?_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL"`
- New: `dbPath + "?_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL&_foreign_keys=on"`

### P3: Add startup integrity check

**Acceptance Criteria:**
- [ ] Create `runIntegrityChecks()` function that runs on startup
- [ ] Check for orphaned FKs in all relationship tables
- [ ] Log warnings if orphans found (don't fail startup)
- [ ] Clean orphans automatically

**Technical Notes:**
- Add after migrations, before indexers start
- Run queries from audit to detect orphans
- Auto-clean to maintain integrity

## Dependencies

- None (this is the first sprint)

## Risks

| Risk | Mitigation |
|------|------------|
| FK enforcement fails on existing orphans | Run cleanup BEFORE enabling FKs |
| Performance impact of FK checks | Minimal - only on INSERT/UPDATE/DELETE |
