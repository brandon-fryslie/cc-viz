# Handoff: Fix Broken Token Economics Page

**Created**: 2026-01-20 21:15 (PST)
**For**: Agent tasked with debugging and fixing the Token Economics page
**Status**: in-progress (broken - charts not rendering, data not showing)

---

## Objective

Fix the Token Economics page so all charts, metrics, and data displays work correctly. The page was recently refactored to use real token data instead of fake estimates, but most functionality is now broken. Only "Tokens by Project" chart is working as a reference.

---

## Current State

### What's Been Done (Sprints 1-3 Complete)
- Backend API endpoints added for real token data
- Frontend refactored to remove `messageCount * 1000` estimates
- ErrorBoundary component added
- Unit tests written (9 tests passing)
- Validation script created

### What's Working
- **Tokens by Project chart** - This is the reference for what should work
  - Uses `useProjectTokenStats()` hook
  - Displays data from `/api/v2/stats/projects`
  - ProjectBreakdownChart renders correctly

### What's Broken (Not Working)
- Daily Burn Chart - No data displayed
- Tokens by Model chart - No data displayed
- Total Tokens stat card - Shows "--" or empty
- Avg per Day stat - Shows "--" or empty
- Peak Day stat - Shows "--" or empty
- Burn Rate stat - Shows "--" or empty
- Top Token Consumers table - No data or errors
- Anomaly Alerts - Not showing

### API Endpoints Status
```bash
# Test these endpoints:
curl http://localhost:8002/api/v2/stats                    # dailyStats - BROKEN?
curl http://localhost:8002/api/v2/conversations/with-tokens  # conversations with tokens
curl http://localhost:8002/api/v2/stats/projects            # projects - WORKING
```

---

## Context & Background

### Why We're Doing This
The Token Economics page was refactored to use real token counts from the database instead of fake estimates (`messageCount * 1000`). The backend was updated with new endpoints, but the frontend integration is broken - most charts and metrics don't display data despite tests passing.

### Key Decisions Made
| Decision | Rationale | Date |
|----------|-----------|------|
| Remove all `* 1000` multipliers | Fake estimates were useless for actual tracking | 2026-01-20 |
| Create new API endpoints | Needed real data from conversation_messages table | 2026-01-20 |
| Add IndexedConversationWithTokens type | Separate type for conversations with token fields | 2026-01-20 |

### Important Constraints
- Must use real token data from backend API
- Cannot revert to fake estimates
- Must maintain backward compatibility with existing charts
- ErrorBoundary must not crash on API failures

---

## Acceptance Criteria

How we'll know this is fixed:

- [ ] Daily Burn Chart displays actual token burn data
- [ ] Tokens by Model chart shows model breakdown
- [ ] All stat cards (Total, Avg, Peak, Burn Rate) display numbers
- [ ] Top Token Consumers table shows session data
- [ ] No console errors in browser dev tools
- [ ] Page works with both populated and empty data states

---

## Scope

### Files to Modify
- `frontend/src/pages/TokenEconomics.tsx` - Main page, likely has integration issues
- `frontend/src/lib/api.ts` - API hooks, may need debugging
- Backend files may need fixes too (see investigation needed)

### Related Components
- `ProjectBreakdownChart` - WORKING, use as reference
- `DailyBurnChart` - BROKEN
- `ModelBreakdownChart` - BROKEN
- `StatCard` - BROKEN (all show "--")
- `DataList` - BROKEN (top consumers table)
- `AnomalyAlerts` - BROKEN

### Out of Scope
- Don't add new features
- Don't change backend API structure (endpoints are fine)
- Don't remove error handling

---

## Implementation Approach

### Recommended Steps

1. **Debug API Responses**
   ```bash
   # Check each endpoint manually
   curl http://localhost:8002/api/v2/stats
   curl http://localhost:8002/api/v2/conversations/with-tokens
   curl http://localhost:8002/api/v2/stats/projects
   ```
   - Compare structure of working vs broken responses
   - Check for missing fields, type mismatches, null values

2. **Compare Working vs Broken Code**
   - `Tokens by Project` uses `useProjectTokenStats()` hook
   - Daily Burn uses `useWeeklyStats()` hook
   - Compare how data flows from hook → component → chart

3. **Check Data Flow in TokenEconomics.tsx**
   - Look at how `weeklyStats` data is used
   - Look at how `conversations` data is used
   - Check `useMemo` transformations
   - Verify `formatTokens` is being called correctly

4. **Check for Type Mismatches**
   - Frontend types may not match backend response structure
   - Check `DailyTokens`, `ModelStats` types in types.ts

5. **Test with Browser DevTools**
   - Check Network tab for API responses
   - Check Console for errors
   - Check React DevTools for component state

### Patterns to Follow
- Use `ProjectBreakdownChart` implementation as template
- Follow same data flow pattern: hook → useMemo → component
- Handle loading states like working charts do

### Known Gotchas
- Tests pass but page doesn't work - test mocking may hide real issues
- Frontend types may not match actual API response structure
- `useWeeklyStats` may be returning data in different format than expected
- Empty arrays vs null vs undefined handling

---

## Reference Materials

### Planning Documents
- [PLAN.md](.agent_planning/token-economics/PLAN.md) - Full implementation plan
- [SPRINT-20260120-frontend-accurate-PLAN.md](.agent_planning/token-economics/SPRINT-20260120-frontend-accurate-PLAN.md) - Frontend implementation details
- [INDEX.md](.agent_planning/token-economics/INDEX.md) - Quick reference to all docs

### Beads Issues
- None created yet for this fix

### Codebase References
- `frontend/src/pages/TokenEconomics.tsx` - Main page (BROKEN)
- `frontend/src/lib/api.ts` - API hooks (check these)
- `frontend/src/lib/types.ts` - Type definitions (may have mismatches)
- Working chart: `frontend/src/components/charts/ProjectBreakdownChart.tsx`
- Reference for data flow: How `useProjectTokenStats` works vs `useWeeklyStats`

### Debugging Commands
```bash
# Start frontend dev server
cd frontend && npm run dev

# Start backend server
just run

# Test API endpoints
curl http://localhost:8002/api/v2/stats
curl http://localhost:8002/api/v2/conversations/with-tokens
curl http://localhost:8002/api/v2/stats/projects

# Run tests (pass but don't verify real functionality)
cd frontend && npm run test:unit
```

---

## Questions & Blockers

### Open Questions
- [ ] Is `useWeeklyStats` returning data in expected format?
- [ ] Are there console errors in browser?
- [ ] Is the backend `GetConversationsV2()` returning token fields?
- [ ] Is the date range filter affecting data display?

### Current Blockers
- Need to inspect actual API responses to diagnose
- Unit tests pass but don't test real data flow
- Need browser dev tools access to see errors

### Need User Input On
- Does the backend server need to be restarted?
- Are there specific test accounts/conversations to use?

---

## Testing Strategy

### Existing Tests
- `frontend/src/pages/TokenEconomics.test.tsx` - 9 passing unit tests
- Tests use mocked data, may not catch real integration issues

### New Tests Needed
- [ ] Integration test with real API data
- [ ] Test data transformation functions
- [ ] Test empty/null data handling

### Manual Testing
- [ ] Open http://localhost:5173/token-economics
- [ ] Check browser console for errors
- [ ] Check Network tab for API responses
- [ ] Compare working "Tokens by Project" with broken charts
- [ ] Verify data appears in all stat cards
- [ ] Verify charts render with data

---

## Success Metrics

How to validate fix:

- [ ] All 4 stat cards show token counts (not "--")
- [ ] Daily Burn Chart has data points visible
- [ ] Model Breakdown Chart shows models and counts
- [ ] Top Consumers table has rows of data
- [ ] Browser console has no errors
- [ ] Page works with both small and large datasets

---

## Next Steps for Agent

**Immediate actions**:
1. Run API endpoint tests to see which return data correctly
2. Open Token Economics page in browser with dev tools
3. Compare `useWeeklyStats` data flow with working `useProjectTokenStats`

**Before starting implementation**:
- [ ] Read `TokenEconomics.tsx` to understand current state
- [ ] Read `api.ts` to see hook implementations
- [ ] Check actual API responses via curl

**When complete**:
- [ ] Update this handoff with root cause and fix
- [ ] Document what was broken and how it was fixed
- [ ] Verify all acceptance criteria pass

---

## Quick Diagnostic Commands

```bash
# 1. Check if server is running
curl http://localhost:8002/health

# 2. Check stats endpoint (BROKEN - suspected)
curl http://localhost:8002/api/v2/stats | jq

# 3. Check conversations with tokens
curl http://localhost:8002/api/v2/conversations/with-tokens | jq

# 4. Check projects (WORKING - use as reference)
curl http://localhost:8002/api/v2/stats/projects | jq

# 5. Run frontend
cd frontend && npm run dev

# 6. Open in browser
# http://localhost:5173/token-economics
```
