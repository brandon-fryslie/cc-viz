# Token Economics - Implementation Checklist

**Project:** Make Token Economics 100% Production Ready
**Status:** READY FOR IMPLEMENTATION
**Date:** 2026-01-20

Use this checklist to track progress through all three sprints.

---

## SPRINT 1: Backend Data Endpoints

### P0: Storage Method - GetConversationTokenSummary

- [ ] Create method in `internal/service/storage_sqlite.go`
  - [ ] Method signature: `GetConversationTokenSummary(conversationID string) (*ConversationTokenSummary, error)`
  - [ ] Write SQL query with GROUP BY model
  - [ ] Handle zero messages gracefully (return zeros, not error)
  - [ ] Handle missing conversation (return zero struct, not error)

- [ ] Test storage method
  - [ ] Test with conversation that has 100 messages
  - [ ] Test with conversation that has 0 messages
  - [ ] Test with conversation that doesn't exist
  - [ ] Test query performance (< 100ms for 1000 messages)

### P0: Add ConversationTokenSummary Type

- [ ] Add types to `internal/model/models.go`
  - [ ] `ConversationTokenSummary` struct
  - [ ] `TokenBreakdown` struct
  - [ ] All fields properly JSON-tagged
  - [ ] Add helper method `AvgTokensPerMessage`

- [ ] Verify JSON marshaling
  - [ ] Test with `json.Marshal()`
  - [ ] Verify no circular references
  - [ ] Check field names match frontend expectations

### P1: API Endpoint - GetConversationTokenSummaryV2

- [ ] Add handler to `internal/handler/data_handler.go`
  - [ ] Method: `GetConversationTokenSummaryV2(w http.ResponseWriter, r *http.Request)`
  - [ ] Parse conversationID from URL
  - [ ] Validate UUID format
  - [ ] Call storage method
  - [ ] Handle errors (404, 500)
  - [ ] Return JSON response

- [ ] Register route in router
  - [ ] Route: `GET /api/v2/conversations/{id}/token-summary`
  - [ ] Add to main.go route setup
  - [ ] Test with curl

- [ ] Test endpoint
  - [ ] GET with valid conversation ID → 200 with JSON
  - [ ] GET with invalid UUID → 400
  - [ ] GET with non-existent conversation → 200 with zero struct
  - [ ] Verify JSON structure matches frontend expectations

### P1: API Endpoint - GetProjectTokenStatsV2

- [ ] Create storage method in `internal/service/storage_sqlite.go`
  - [ ] Method: `GetProjectTokenStats(start, end time.Time) ([]ProjectTokenStat, error)`
  - [ ] Write SQL with LEFT JOIN on conversations
  - [ ] Group by project_name
  - [ ] Order by total_tokens DESC
  - [ ] Include top 5 conversations per project

- [ ] Add handler to `internal/handler/data_handler.go`
  - [ ] Method: `GetProjectTokenStatsV2(w http.ResponseWriter, r *http.Request)`
  - [ ] Parse start/end from query string
  - [ ] Validate dates (end >= start)
  - [ ] Default to last 30 days if not specified
  - [ ] Call storage method
  - [ ] Return JSON response

- [ ] Register route in router
  - [ ] Route: `GET /api/v2/stats/projects?start=...&end=...`
  - [ ] Test with curl

- [ ] Test endpoint
  - [ ] GET with valid date range → 200 with projects array
  - [ ] GET with invalid dates → 400
  - [ ] GET with no dates → uses defaults, returns 200
  - [ ] Verify projects sorted by tokens DESC
  - [ ] Verify top conversations included

### P2: Update GetConversationsV2

- [ ] Update query in `internal/service/storage_sqlite.go`
  - [ ] Add LEFT JOIN conversation_messages
  - [ ] Add SUM(tokens) aggregation
  - [ ] Keep existing pagination/sorting
  - [ ] Test performance (< 1s for 1000 conversations)

- [ ] Update `Conversation` type in `internal/model/models.go`
  - [ ] Add `TotalTokens int64` field
  - [ ] Add `InputTokens int64` field
  - [ ] Add `OutputTokens int64` field
  - [ ] Verify JSON tags correct

- [ ] Test updated endpoint
  - [ ] GET /api/v2/conversations → 200 with token fields
  - [ ] Verify token counts > 0 where expected
  - [ ] Verify pagination still works
  - [ ] Verify sorting still works

### P2: Add Database Indexes

- [ ] Create indexes for performance
  - [ ] `idx_conversation_messages_conversation_id`
  - [ ] `idx_conversations_project_name_created_at`
  - [ ] `idx_conversation_messages_conversation_id_tokens`

- [ ] Verify indexes created
  - [ ] Check with: `PRAGMA index_list(table_name)`
  - [ ] Test query performance after indexes

### Sprint 1 Testing

- [ ] Run Go tests
  - [ ] `CGO_ENABLED=1 go test -tags fts5 ./internal/service/`
  - [ ] `CGO_ENABLED=1 go test -tags fts5 ./internal/handler/`
  - [ ] All tests pass

- [ ] Manual API testing
  - [ ] Test with curl/Postman
  - [ ] Test all three new endpoints
  - [ ] Test error cases (invalid IDs, missing data)

- [ ] Performance testing
  - [ ] Measure query times
  - [ ] Verify all under performance targets

- [ ] Data validation
  - [ ] Run validation script: `node scripts/validate-token-economics.js`
  - [ ] Verify no fake estimates remain
  - [ ] Verify daily/conversation totals reconcile

### Sprint 1 Sign-Off

- [ ] All acceptance criteria met
- [ ] No console errors or warnings
- [ ] All tests passing
- [ ] Performance targets met
- [ ] Ready to deploy

---

## SPRINT 2: Frontend Accurate Data + Error Handling

### P0: Update API Types

- [ ] Update `frontend/src/lib/types.ts`
  - [ ] Add `ConversationTokenSummary` interface
  - [ ] Add `TokenBreakdown` interface
  - [ ] Add `ProjectTokenStat` interface
  - [ ] Update `Conversation` interface with token fields

- [ ] Test type compatibility
  - [ ] Verify TypeScript compiles without errors
  - [ ] Check types match backend JSON structure

### P0: Add API Hooks

- [ ] Add hooks to `frontend/src/lib/api.ts`
  - [ ] `useConversationTokenSummary(conversationId)`
  - [ ] `useProjectTokenStats(dateRange)`
  - [ ] Both use React Query
  - [ ] Proper error handling

- [ ] Test hooks in browser
  - [ ] `useWeeklyStats()` returns correct type
  - [ ] `useConversations()` includes token fields
  - [ ] New hooks work with real data

### P1: Add ErrorBoundary Component

- [ ] Create `frontend/src/components/ui/ErrorBoundary.tsx`
  - [ ] Extends React.Component
  - [ ] Implements getDerivedStateFromError
  - [ ] Implements componentDidCatch
  - [ ] Renders error UI with Retry button
  - [ ] Logs errors to console

- [ ] Test ErrorBoundary
  - [ ] Wrap component that throws error
  - [ ] Verify error UI renders
  - [ ] Verify Retry button works
  - [ ] Verify logs error to console

### P1: Remove Token Estimates

- [ ] Edit `frontend/src/pages/TokenEconomics.tsx`
  - [ ] Remove `messageCount * 1000` in projectStats
  - [ ] Replace with `useProjectTokenStats(dateRange)`
  - [ ] Remove `messageCount * 1000` in sessionData
  - [ ] Replace with `conversation.totalTokens`
  - [ ] Remove `model: 'Claude'`
  - [ ] Use actual model from data (or 'Unknown')

- [ ] Verify no estimates remain
  - [ ] Search codebase: `grep -r "\* 1000" frontend/src`
  - [ ] Should return 0 results

- [ ] Test in browser
  - [ ] Page loads
  - [ ] Metrics display actual numbers
  - [ ] Charts render with real data
  - [ ] No console errors

### P2: Add Data Validation

- [ ] Create validation function in TokenEconomics.tsx
  - [ ] Validate total >= 0
  - [ ] Validate avgPerDay >= 0
  - [ ] Validate metrics reasonable (< 1B tokens)
  - [ ] Check dates are chronological

- [ ] Add validation to component
  - [ ] Call in useMemo
  - [ ] Return array of errors
  - [ ] Show warning banner if errors exist

- [ ] Test validation
  - [ ] With valid data → no warnings
  - [ ] With negative tokens → warning shows
  - [ ] With missing data → warning shows

### P2: Add Warning Badges

- [ ] Add warning UI in TokenEconomics.tsx
  - [ ] Show if validation errors exist
  - [ ] Show if data is stale (> 1 minute old)
  - [ ] Show if project breakdown is estimated
  - [ ] Use yellow color (var(--color-warning))

- [ ] Test in browser
  - [ ] Warnings appear when appropriate
  - [ ] Can dismiss or don't block viewing

### P3: Error Handling UI

- [ ] Add error state handling
  - [ ] Get `error` from all three hooks
  - [ ] Show error alert for API failures
  - [ ] Provide retry button
  - [ ] Don't crash page

- [ ] Create ErrorAlert component (if needed)
  - [ ] Shows error message
  - [ ] Has retry button
  - [ ] Styled consistently

- [ ] Test error scenarios
  - [ ] Disable /api/v2/stats in DevTools Network
  - [ ] Verify error message shows
  - [ ] Verify retry works
  - [ ] Disable other endpoints, verify per-chart error handling

### P3: Add Loading Skeletons

- [ ] Create ChartSkeleton component (if not exists)
  - [ ] Shows pulsing skeleton
  - [ ] Matches chart height
  - [ ] Prevents layout shift

- [ ] Update ChartWrapper to use skeletons
  - [ ] Show skeleton while loading
  - [ ] Show chart when data arrives
  - [ ] No visual jarring

- [ ] Test in browser
  - [ ] DevTools throttle to Slow 3G
  - [ ] Verify skeletons appear
  - [ ] Verify data loads and displays
  - [ ] Verify smooth transition

### P3: Add Accessibility

- [ ] Add ARIA labels to stat cards
  - [ ] `aria-label` on each metric
  - [ ] Describe what the number represents
  - [ ] Include unit (tokens, %)

- [ ] Add semantic HTML
  - [ ] `<main role="main">` on content area
  - [ ] Proper heading hierarchy
  - [ ] Alt text on images (if any)

- [ ] Add keyboard navigation
  - [ ] Date picker works with Tab/Enter
  - [ ] Focus visible on all interactive elements
  - [ ] Logical tab order

- [ ] Test with screen reader
  - [ ] VoiceOver (Mac) or NVDA (Windows)
  - [ ] Can navigate and understand content
  - [ ] All labels present

### P3: Enhance StatCard Component

- [ ] Update StatCard component
  - [ ] Add trend direction icon (up/down)
  - [ ] Color trend appropriately (green/red)
  - [ ] Add ARIA label for trend
  - [ ] Responsive font sizes

- [ ] Test in browser
  - [ ] Trends display correctly
  - [ ] Colors accessible (test with contrast checker)
  - [ ] Screen reader reads trends

### Sprint 2 Testing

- [ ] Run TypeScript check
  - [ ] `npm run type-check` in frontend/
  - [ ] No errors or warnings

- [ ] Run linting
  - [ ] `npm run lint` in frontend/
  - [ ] No errors

- [ ] Test in browser (Chrome)
  - [ ] Page loads without errors
  - [ ] All metrics display
  - [ ] All charts render
  - [ ] Date range changes work
  - [ ] Error handling works
  - [ ] No console errors

- [ ] Test in browser (Firefox, Safari)
  - [ ] Same tests as Chrome
  - [ ] Charts render correctly
  - [ ] Date picker works

- [ ] Test on mobile
  - [ ] iPhone Safari (or iOS emulator)
  - [ ] Android Chrome (or Android emulator)
  - [ ] Responsive layout
  - [ ] Touch interactions work

- [ ] Accessibility testing
  - [ ] Screen reader test
  - [ ] Keyboard navigation
  - [ ] Color contrast check (WebAIM or Axe)

### Sprint 2 Sign-Off

- [ ] All acceptance criteria met
- [ ] No console errors or warnings
- [ ] TypeScript passes
- [ ] Linting passes
- [ ] Works on all major browsers
- [ ] Accessible (WCAG AA)
- [ ] Ready for QA testing

---

## SPRINT 3: QA & Testing

### Unit Tests

- [ ] Create test file: `frontend/src/pages/TokenEconomics.test.tsx`
  - [ ] Test metric calculations
  - [ ] Test validation logic
  - [ ] Test component rendering
  - [ ] Test error state UI
  - [ ] Test accessibility features
  - [ ] Target coverage: >80%

- [ ] Run tests
  - [ ] `npm test` in frontend/
  - [ ] All tests pass
  - [ ] Coverage >80%

### Integration Tests

- [ ] Create integration test file
  - [ ] Test end-to-end data flow
  - [ ] Test API calls and data display
  - [ ] Test error recovery
  - [ ] Test date range changes

- [ ] Run integration tests
  - [ ] All tests pass
  - [ ] Test with real data fixtures

### Data Validation Script

- [ ] Create script: `scripts/validate-token-economics.js`
  - [ ] Check for fake estimates
  - [ ] Verify daily stats = sum of conversations
  - [ ] Verify project stats = sum of conversations
  - [ ] Check for negative tokens
  - [ ] Check for unreasonable values

- [ ] Run validation script
  - [ ] All checks pass
  - [ ] No data discrepancies

### Performance Testing

- [ ] Run Lighthouse audit
  - [ ] Open page in Chrome
  - [ ] DevTools → Lighthouse
  - [ ] Run audit
  - [ ] Verify score >= 90
  - [ ] Verify LCP < 1.5s

- [ ] Test with slow network
  - [ ] DevTools → Network → Slow 3G
  - [ ] Load page
  - [ ] Verify loading states
  - [ ] Verify smooth render
  - [ ] Measure load time

- [ ] Test with large dataset
  - [ ] Load page with 10k+ conversations
  - [ ] Measure page load time (target: < 2s)
  - [ ] Scroll table smoothly
  - [ ] Verify no memory leaks

### Manual Testing

- [ ] Print manual testing checklist
- [ ] Complete all test cases
  - [ ] Smoke tests
  - [ ] Functional tests
  - [ ] Error scenario tests
  - [ ] Accessibility tests
  - [ ] Browser compatibility tests
  - [ ] Mobile tests

- [ ] Document any issues
  - [ ] Screenshot problems
  - [ ] Note reproduction steps
  - [ ] Categorize by severity

- [ ] Fix critical issues
  - [ ] Re-test after fixes
  - [ ] Re-run automated tests

- [ ] Get stakeholder sign-off
  - [ ] QA lead approves
  - [ ] PM approves
  - [ ] Engineering lead approves

### Sprint 3 Deliverables

- [ ] Test plan document (complete)
- [ ] Unit tests (>80% coverage, all passing)
- [ ] Integration tests (all passing)
- [ ] Validation script (all checks passing)
- [ ] Lighthouse audit (score >= 90)
- [ ] Manual testing checklist (signed off)
- [ ] Any issues documented and resolved

### Sprint 3 Sign-Off

- [ ] All tests passing
- [ ] All manual tests complete and signed off
- [ ] No critical issues remaining
- [ ] Performance targets met
- [ ] Accessibility compliant
- [ ] **READY FOR PRODUCTION DEPLOYMENT**

---

## FINAL VERIFICATION BEFORE DEPLOYMENT

- [ ] All three sprints complete
- [ ] No fake estimates remain in code
- [ ] All metrics reconcile with backend data
- [ ] Error handling tested and working
- [ ] Accessibility compliant (WCAG AA)
- [ ] Performance targets met (Lighthouse >= 90)
- [ ] All tests passing (unit, integration, validation)
- [ ] Manual QA sign-off complete
- [ ] Documentation updated
- [ ] Code reviewed and approved
- [ ] Ready for production deployment

---

## DEPLOYMENT

### Pre-Deployment

- [ ] Back up production database (if applicable)
- [ ] Create deployment plan
  - [ ] Deploy backend first
  - [ ] Verify API endpoints work
  - [ ] Deploy frontend
  - [ ] Monitor for errors

### Deployment Steps

1. **Deploy Backend**
   - [ ] Run migrations (if any)
   - [ ] Deploy new API endpoints
   - [ ] Verify endpoints responding
   - [ ] Run validation script
   - [ ] Monitor error rates

2. **Deploy Frontend**
   - [ ] Deploy new frontend build
   - [ ] Clear cache
   - [ ] Verify page loading
   - [ ] Monitor for errors
   - [ ] Check Sentry/error logs

3. **Post-Deployment**
   - [ ] Monitor metrics
   - [ ] Check for user reports
   - [ ] Verify data accuracy
   - [ ] Get stakeholder confirmation

### Rollback Plan

- [ ] If critical issues: Revert frontend to previous version
- [ ] If data issues: Investigate with validation script
- [ ] If performance issues: Check indexes, optimize queries
- [ ] Document what went wrong, fix, and re-deploy

---

## MAINTENANCE

### Ongoing Monitoring

- [ ] Monitor API performance
- [ ] Watch for data discrepancies
- [ ] Check error rates
- [ ] Monitor user feedback

### Post-Deployment Updates

- [ ] Remove any TODO comments
- [ ] Archive old estimation code
- [ ] Update documentation
- [ ] Share learnings with team

---

## Sign-Off

**Planning Complete:** ✅
**Ready to Start Sprint 1:** ✅

Use this checklist to track progress. Update as you go.
