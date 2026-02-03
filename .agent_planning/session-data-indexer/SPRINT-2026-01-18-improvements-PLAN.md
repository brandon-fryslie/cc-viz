# Sprint: session-data-indexer-improvements - Optional Enhancements
Generated: 2026-01-18
Confidence: HIGH
Status: OPTIONAL - Component is functional

## Sprint Goal
Improve test coverage and data hygiene for the session-data-indexer component.

## Context
The session-data-indexer was evaluated and found to be **fully functional** after the major refactor:
- 1378 todos indexed
- 1485 sessions tracked
- 16 plans stored
- All API endpoints working

These improvements are optional quality enhancements, not blockers.

## Scope

### P1: Add Unit Tests (MEDIUM Priority)
**Acceptance Criteria:**
- [ ] Create `internal/service/session_data_indexer_test.go`
- [ ] Test `IndexTodos()` with mock filesystem
- [ ] Test `IndexPlans()` with mock filesystem
- [ ] Test file name parsing for various formats
- [ ] Test error handling for malformed JSON
- [ ] Test aggregation of session statistics

**Technical Notes:**
- Follow existing test patterns from `indexer_test.go` and `subagent_indexer_test.go`
- Use `t.TempDir()` for test fixtures
- Test both happy path and edge cases

### P2: Stale Data Cleanup (LOW Priority)
**Acceptance Criteria:**
- [ ] Add method to detect deleted source files
- [ ] Remove stale records from `claude_todos` and `claude_todo_sessions`
- [ ] Run cleanup during reindex operation
- [ ] Log cleanup actions

**Technical Notes:**
- Query all file_paths from database
- Check `os.Stat()` for each
- Delete records for missing files

### P3: Model Consolidation (LOW Priority)
**Acceptance Criteria:**
- [ ] Move `TodoItem` struct to `internal/model/models.go`
- [ ] Update imports in `session_data_indexer.go`
- [ ] Verify no breaking changes to API responses

**Technical Notes:**
- Currently defined locally at line ~15 in session_data_indexer.go
- Should match API response structure

## Dependencies
None - these are independent improvements.

## Risks
- LOW: All improvements are additive, no risk to existing functionality
