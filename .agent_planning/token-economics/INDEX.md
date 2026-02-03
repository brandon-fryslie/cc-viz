# Token Economics Page - Planning Documents

**Goal:** Make the Token Economics page fully functional with real token data instead of fake estimates.

## Documents

### Core Documents
- **[PLAN.md](PLAN.md)** - Full implementation plan with 3 sprints (START HERE)
- **[STATUS.md](STATUS.md)** - Current state, target state, timeline overview

### Sprint Details
- **[SPRINT-20260120-backend-data-PLAN.md](SPRINT-20260120-backend-data-PLAN.md)** - Sprint 1: Backend API endpoints
- **[SPRINT-20260120-frontend-accurate-PLAN.md](SPRINT-20260120-frontend-accurate-PLAN.md)** - Sprint 2: Frontend real data + error handling
- **[SPRINT-20260120-qa-testing-PLAN.md](SPRINT-20260120-qa-testing-PLAN.md)** - Sprint 3: Testing & validation

### Evaluation
- **[EVALUATION-20260120.md](EVALUATION-20260120.md)** - Detailed analysis of current issues
- **[EVALUATION-20260120-plan-session.md](EVALUATION-20260120-plan-session.md)** - Planning session summary

---

## Quick Summary

### Problem
The page uses `messageCount * 1000` to estimate tokens - completely wrong. Real data exists in the database but isn't exposed.

### Solution
Three sprints:
1. **Backend** - Add API endpoints to expose real token data (4-6h)
2. **Frontend** - Replace estimates with real data, add error handling (4-6h)
3. **Testing** - Unit tests, integration tests, data validation (4-6h)

### Total Effort
**12-18 hours** of focused engineering

### Success Criteria
- ✅ Zero instances of `messageCount * 1000`
- ✅ Real token data from database
- ✅ Error handling that doesn't crash
- ✅ Data validation with warnings
- ✅ >80% test coverage
- ✅ All metrics reconcile with backend

---

## Getting Started

1. Read **[PLAN.md](PLAN.md)** for full implementation details
2. Start with **Sprint 1: Backend Data Endpoints**
3. Run `/do:it token-economics` to begin implementation

---

## Files Modified

### Backend
- `internal/model/models.go` - Add token types
- `internal/service/storage_sqlite.go` - Add storage methods
- `internal/handler/data_handler.go` - Add API endpoints

### Frontend
- `frontend/src/lib/types.ts` - Update types
- `frontend/src/lib/api.ts` - Add hooks
- `frontend/src/pages/TokenEconomics.tsx` - Major refactor
- `frontend/src/components/ui/ErrorBoundary.tsx` - New component

### Testing
- `frontend/src/pages/TokenEconomics.test.tsx` - Unit tests
- `token-economics-integration.test.ts` - Integration tests
- `scripts/validate-token-economics.js` - Data validation script
- `token-economics-testing-plan.md` - Test plan document

---

## Status

| Sprint | Status | Progress |
|--------|--------|----------|
| 1: Backend | NOT STARTED | 0% |
| 2: Frontend | NOT STARTED | 0% |
| 3: Testing | NOT STARTED | 0% |

---

Last Updated: 2026-01-20
