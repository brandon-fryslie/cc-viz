# Work Evaluation - 2026-01-20
Scope: work/token-economics/backend-data
Confidence: FRESH

## Goals Under Evaluation
From SPRINT-20260120-backend-data-PLAN.md:
1. GetConversationTokenSummary() storage method
2. GET /api/v2/conversations/{id}/token-summary endpoint
3. GET /api/v2/stats/projects endpoint
4. Update Conversation type with token fields

## Previous Evaluation Reference
None - this is the initial evaluation.

## Persistent Check Results
| Check | Status | Output Summary |
|-------|--------|----------------|
| `go build -tags fts5` | PASS | Binary builds successfully |
| `go test -tags fts5 ./...` | PASS | All tests pass |

## Manual Runtime Testing

### What I Tried
1. Built and started viz-server with CGO_ENABLED=1 -tags fts5
2. Tested all three new API endpoints with curl
3. Verified storage methods with direct SQL queries
4. Checked database schema against implementation

### What Actually Happened
1. **Build**: PASS - binary compiles without errors
2. **Tests**: PASS - all Go tests pass
3. **API Endpoints**: FAIL - all endpoints return empty/timeout
4. **Storage Methods**: PARTIAL - GetConversationTokenSummary works, GetProjectTokenStats fails

## Data Flow Verification
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| GetConversationTokenSummary SQL | Returns token aggregates | Returns correct data (verified via SQL) | ✅ |
| GetProjectTokenStats SQL | Returns project stats | FAILS: no such column 'created_at' | ❌ |
| GetIndexedConversationsWithTokens | Returns conversations with tokens | Works (verified via SQL) | ✅ |

## Break-It Testing
| Attack | Expected | Actual | Severity |
|--------|----------|--------|----------|
| Query non-existent conversation | Return zeros | Returns zeros (handled correctly) | N/A |
| Missing data for project stats | Handle gracefully | Query fails due to schema error | HIGH |
| Date range filtering | Filter by date | Query fails, can't test | HIGH |

## Evidence
- Database schema shows `conversations.start_time` exists, not `created_at`
- Direct SQL test confirms `GetConversationTokenSummary` returns correct data:
  ```
  total=20526241, input=188, output=19551, cache_read=20158228, cache_create=348274, messages=292
  ```
- API endpoints timeout due to blocking query with invalid column

## Assessment

### Working
- ConversationTokenSummary, TokenBreakdown, ProjectTokenStat types defined correctly
- GetConversationTokenSummary() storage method implemented correctly
- GetIndexedConversationsWithTokens() works and returns proper data
- API endpoint handlers registered correctly (3 routes at main.go:185-187)
- Conversation type NOT updated (but this is a valid design choice - see below)

### Not Working
- **GetProjectTokenStats() query uses invalid column** (`storage_sqlite.go:4451`)
  - Query: `WHERE c.created_at BETWEEN ? AND ?`
  - Should be: `WHERE c.start_time BETWEEN ? AND ?`
  - This causes the query to fail and blocks API responses

### Design Deviation (Not a Bug)
- PLAN specified updating `Conversation` type with token fields
- ACTUAL: Added separate `IndexedConversationWithTokens` type
- This is a valid architectural choice - keeps API response type separate from internal type
- The `/api/v2/conversations/with-tokens` endpoint uses `IndexedConversationWithTokens` correctly

### Ambiguities Found
| Decision | What Was Assumed | Should Have Asked | Impact |
|----------|------------------|-------------------|--------|
| Column name for date filter | 'created_at' exists | What date column exists in conversations table? | Bug in production |
| Conversation type modification | Add fields to existing type | Should API use same type as internal Conversation? | Design deviation |

## Missing Checks (implementer should create)
1. **Schema validation test** - Verify SQL queries match actual database schema
   ```go
   // In storage_sqlite_test.go
   func TestGetProjectTokenStats_Schema(t *testing.T) {
       // Query should not reference non-existent columns
       // Verify against actual .schema output
   }
   ```

2. **Integration test for project stats endpoint** - Test with real database
   ```go
   // Test that GetProjectTokenStats returns data without error
   func TestGetProjectTokenStats_Integration(t *testing.T) {
       stats, err := s.GetProjectTokenStats(start, end)
       require.NoError(t, err)
       assert.NotEmpty(t, stats)
   }
   ```

## Verdict: INCOMPLETE

## What Needs to Change

1. **Fix GetProjectTokenStats query** (`internal/service/storage_sqlite.go:4451`)
   ```go
   // FROM:
   WHERE c.created_at BETWEEN ? AND ?
   // TO:
   WHERE c.start_time BETWEEN ? AND ?
   ```

2. **Document design decision** - The Conversation type was not modified; `IndexedConversationWithTokens` is used for API responses instead. This should be noted in the sprint summary.

## Questions Needing Answers
1. Should the date filter use `start_time` or `end_time` for project statistics? (Currently using `start_time` in fix suggestion)
