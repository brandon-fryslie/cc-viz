# Token Economics Page - Test Plan

**Document Version:** 1.0
**Date:** 2026-01-20
**Scope:** Token Economics page testing for production readiness

## 1. Overview

This test plan defines comprehensive testing requirements for the Token Economics page, ensuring accurate token tracking, proper error handling, and production readiness for paying customers.

### 1.1 Test Objectives

- Verify all metrics display correctly with real data (not estimates)
- Validate data reconciliation between daily stats and conversations
- Ensure graceful error handling for API failures
- Confirm no fake estimates (`* 1000`) exist in the codebase

### 1.2 Test Environment

- **Frontend:** React 19 + Vite + TanStack Router
- **Backend:** Go + SQLite with FTS5
- **Test Framework:** Playwright for E2E, React Testing Library for unit tests

---

## 2. Functional Testing

### 2.1 Dashboard Loads Correctly

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| TE-FUNC-001 | Page loads without console errors | 1. Navigate to `/token-economics` 2. Check console for errors | Page loads, no errors in console | Pending |
| TE-FUNC-002 | All stat cards display | 1. Load page 2. Verify 4 stat cards visible | Total Tokens, Avg per Day, Peak Day, Burn Rate all visible | Pending |
| TE-FUNC-003 | All charts render | 1. Load page 2. Check chart areas | Daily Burn, Model Breakdown, Project Breakdown charts render | Pending |
| TE-FUNC-004 | Date range picker works | 1. Change date range 2. Verify data updates | Charts and metrics update to reflect selected range | Pending |

### 2.2 Metric Calculations

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| TE-FUNC-005 | Total Tokens sums correctly | 1. View page 2. Check Total Tokens value | Total = sum of daily tokens for selected range | Pending |
| TE-FUNC-006 | Avg per Day calculation | 1. View page 2. Calculate Avg per Day | Avg = Total / number of days in range | Pending |
| TE-FUNC-007 | Peak Day shows highest | 1. View page 2. Identify Peak Day | Peak Day shows maximum single-day token count | Pending |
| TE-FUNC-008 | Burn Rate shows daily average | 1. View page 2. Check Burn Rate | Burn Rate matches Avg per Day value | Pending |

### 2.3 Charts Display Real Data

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| TE-FUNC-009 | Daily Burn chart has data points | 1. Select date range 2. Check chart | Chart shows data points for each day in range | Pending |
| TE-FUNC-010 | Model Breakdown shows actual models | 1. View Model Breakdown chart | Chart displays actual model names from data | Pending |
| TE-FUNC-011 | Project Breakdown shows real projects | 1. View Project Breakdown chart | Chart displays actual project names from data | Pending |
| TE-FUNC-012 | Charts are interactive | 1. Hover over chart elements | Tooltips display with detailed information | Pending |

### 2.4 Table Operations

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| TE-FUNC-013 | Table loads top consumers | 1. Scroll to Top Token Consumers table | Table displays up to 100 sessions sorted by tokens | Pending |
| TE-FUNC-014 | Sorting by columns | 1. Click column headers | Table sorts by selected column (Session, Project, Model, Tokens, Date) | Pending |
| TE-FUNC-015 | Table scrolls smoothly | 1. Scroll table vertically | Table scrolls smoothly without jank | Pending |

---

## 3. Data Accuracy Testing

### 3.1 Token Count Verification

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| TE-DATA-001 | Daily stats total = conversation sum | 1. Run validation script 2. Verify output | Daily stats total matches sum of conversation tokens | Pending |
| TE-DATA-002 | Project tokens sum correctly | 1. Verify project breakdown 2. Sum all project tokens | Sum = total tokens for all conversations in project | Pending |
| TE-DATA-003 | No session has zero tokens (with messages) | 1. Query sessions with messageCount > 0 | All such sessions have totalTokens > 0 | Pending |
| TE-DATA-004 | No fake estimates in code | 1. Search codebase for `* 1000` patterns | No instances of `messageCount * 1000` or similar estimates | Pending |

**SQL Verification Query:**
```sql
SELECT
  DATE(created_at) as date,
  SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens) as total
FROM conversation_messages
WHERE DATE(created_at) BETWEEN ? AND ?
GROUP BY DATE(created_at)
-- Result should match displayed "Daily Token Burn"
```

### 3.2 Project Breakdown Accuracy

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| TE-DATA-005 | Project tokens sum to daily total | 1. Sum all project tokens 2. Compare to daily total | Project tokens sum equals or is within 1% of daily total | Pending |
| TE-DATA-006 | Conversation count is correct | 1. Count conversations per project 2. Verify with API | Count matches actual conversations in database | Pending |
| TE-DATA-007 | API response correctly aggregated | 1. Call /api/v2/stats/projects 2. Verify response | Response correctly aggregates tokens by project | Pending |

### 3.3 Session Table Accuracy

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| TE-DATA-008 | Session token count is real | 1. Query session by ID 2. Compare to displayed value | Displayed tokens match actual from database | Pending |
| TE-DATA-009 | Table sorted by tokens descending | 1. Check table order 2. Verify sorting | Sessions ordered by token count (highest first) | Pending |
| TE-DATA-010 | No duplicate sessions | 1. Check for duplicate IDs | Each session appears exactly once | Pending |

---

## 4. Error Handling Testing

### 4.1 API Failure Scenarios

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| TE-ERR-001 | Weekly stats API fails | 1. Mock API failure 2. Observe page behavior | Error message displays, page doesn't crash | Pending |
| TE-ERR-002 | Retry button works after API failure | 1. Trigger error 2. Click Retry | Data loads successfully after retry | Pending |
| TE-ERR-003 | Conversations API fails | 1. Mock API failure 2. Check error display | Project breakdown shows error, daily burn still works | Pending |
| TE-ERR-004 | Project stats API fails | 1. Mock API failure 2. Observe page | Project breakdown shows error, other charts work | Pending |

### 4.2 Missing Data Scenarios

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| TE-ERR-005 | No data for date range | 1. Select date range with no data | Charts show empty state, metrics show 0, no errors | Pending |
| TE-ERR-006 | Invalid date range | 1. Set end date before start date | API returns error, user sees error message | Pending |
| TE-ERR-007 | Conversations without tokens | 1. Load page with partial data | Sessions without token data show "View details" for model | Pending |

---

## 5. Accessibility Testing

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| TE-A11Y-001 | Keyboard navigation | 1. Tab through page | All interactive elements are focusable | Pending |
| TE-A11Y-002 | Screen reader labels | 1. Check ARIA labels | Stat cards and charts have proper labels | Pending |
| TE-A11Y-003 | Color contrast | 1. Check color contrast ratios | All text meets WCAG AA standards | Pending |

---

## 6. Performance Testing

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| TE-PERF-001 | Page load time | 1. Measure Time to Interactive | Page loads in < 2 seconds | Pending |
| TE-PERF-002 | Lighthouse score | 1. Run Lighthouse audit | Score >= 90 for Performance | Pending |
| TE-PERF-003 | Large dataset handling | 1. Test with 1000+ sessions | Page remains responsive | Pending |

---

## 7. Test Cases - Automated

### 7.1 Unit Tests (React Testing Library)

**File:** `frontend/src/pages/TokenEconomics.test.tsx`

```typescript
describe('TokenEconomics', () => {
  describe('Metric Calculations', () => {
    it('calculates total tokens from daily stats', () => {})
    it('calculates average tokens per day', () => {})
    it('identifies peak day correctly', () => {})
    it('handles empty daily stats', () => {})
  })

  describe('Data Validation', () => {
    it('validates negative token counts', () => {})
    it('validates suspiciously high values', () => {})
    it('validates zero values', () => {})
  })

  describe('Error States', () => {
    it('renders error message on API failure', () => {})
    it('shows retry button on error', () => {})
    it('does not crash on missing data', () => {})
  })
})
```

### 7.2 Integration Tests (Playwright)

**File:** `token-economics-integration.test.ts`

```typescript
describe('TokenEconomics Integration', () => {
  it('loads and displays data correctly', async () => {})
  it('reconciles daily stats with conversation totals', async () => {})
  it('retries on API failure', async () => {})
  it('updates when date range changes', async () => {})
})
```

---

## 8. Manual Testing Checklist

### Pre-requisites
- [ ] Backend API endpoints are operational
- [ ] Database contains test conversations with real token data
- [ ] Frontend dev server is running

### Execution Steps

1. **Load the page**
   - [ ] Navigate to `/token-economics`
   - [ ] Verify no console errors
   - [ ] Confirm 4 stat cards are visible

2. **Verify metrics**
   - [ ] Note Total Tokens value
   - [ ] Verify Avg per Day = Total / days
   - [ ] Check Peak Day matches highest daily value

3. **Verify charts**
   - [ ] Daily Burn chart has data points
   - [ ] Model Breakdown shows actual models
   - [ ] Hover over charts to see tooltips

4. **Test date filtering**
   - [ ] Change to "Week" preset
   - [ ] Change to "Month" preset
   - [ ] Select custom date range

5. **Test error scenarios**
   - [ ] Simulate API failure
   - [ ] Click retry button
   - [ ] Verify page recovers

6. **Run validation script**
   ```bash
   node scripts/validate-token-economics.js
   ```

---

## 9. Validation Script Usage

### Running the Validation Script

```bash
# From project root
node scripts/validate-token-economics.js

# Or with API URL
API_URL=http://localhost:8002 node scripts/validate-token-economics.js
```

### Expected Output

```
=== Token Economics Data Validation ===

Checking for fake estimates...
  No token estimation found

Verifying daily stats vs conversations...
  Daily total: 1,234,567 tokens
  Conversation total: 1,234,000 tokens
  Difference: 0.05% (within 1% threshold)
  Totals reconcile: PASS

Verifying project stats...
  Project total: 1,234,567 tokens
  Daily total: 1,234,567 tokens
  Project stats reconcile: PASS

=== ALL VALIDATIONS PASSED ===
```

### Exit Codes

- `0` - All validations passed
- `1` - Validation failed (check output for details)

---

## 10. Test Data Requirements

### Minimum Test Data

| Data Type | Minimum Quantity | Purpose |
|-----------|------------------|---------|
| Conversations | 10 | Table display and sorting |
| Days with data | 7 | Daily burn chart |
| Projects | 3 | Project breakdown |
| Models | 2 | Model breakdown |

### Test Data Fixture Location

- **Frontend fixtures:** `frontend/tests/fixtures/token-economics/`
- **Backend test data:** SQLite database with seeded data

---

## 11. Known Issues and Workarounds

| Issue ID | Description | Workaround | Status |
|----------|-------------|------------|--------|
| - | None currently | - | - |

---

## 12. Sign-off Criteria

- [ ] All functional tests pass
- [ ] Data accuracy tests pass (no discrepancies > 1%)
- [ ] Error handling tests pass
- [ ] Validation script passes with no fake estimates
- [ ] Lighthouse score >= 90
- [ ] Manual testing checklist completed
- [ ] No console errors in browser

**Tester Signature:** ___________________

**Date:** ___________________

---

## 13. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-20 | AI | Initial test plan |
