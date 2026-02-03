# User Response - Unified Search Planning

**Date**: 2025-01-19
**Status**: APPROVED

---

## Architectural Decisions Confirmed

**1. Request Body Indexing Strategy: HYBRID**
- Index structured fields by default (method, endpoint, model, tools_used, provider)
- Optional `?full_body=true` parameter enables full request/response body search
- User chose: Best of both worlds - cleaner search by default, comprehensive option available

**2. Unified Search Scope: ALL DATA TYPES**
- Include: requests, conversations, extensions, todos, plans
- User chose: Comprehensive coverage for discoverability

**3. Search Result Context: SNIPPETS WITH CONTEXT**
- Show matching content with surrounding context (60 chars before/after)
- User chose: Recommended balance between UX and payload size

---

## Sprint Plan Summary

### Sprint 1: Request Search Implementation [HIGH CONFIDENCE]
- ✅ FTS5 request search table
- ✅ Backend search endpoint with snippet context
- ✅ Frontend request search UI
- ✅ Performance validation
- **Status**: READY FOR IMPLEMENTATION
- **Estimated Code**: ~500 lines

### Sprint 2: Extension & Session Data Search [HIGH CONFIDENCE]
- ✅ FTS5 extension search (replace keyword matching)
- ✅ FTS5 tables for todos and plans
- ✅ Backend search endpoints for all types
- ✅ Unified search endpoint (`/api/v2/search`)
- ✅ Frontend search UI for extensions, todos, plans
- ✅ Global unified search modal (Cmd+Shift+K)
- **Status**: READY FOR IMPLEMENTATION
- **Estimated Code**: ~400 lines

### Sprint 3: Search Consolidation & Deduplication [MEDIUM CONFIDENCE]
- ⚠️ Analyze duplicated search logic
- ⚠️ Centralize text extraction
- ⚠️ Unified query builder
- ⚠️ Remove frontend duplication
- ⚠️ Improve fallback search
- **Status**: RESEARCH & INTEGRATION REQUIRED (after sprints 1-2)
- **Estimated Code**: ~200 lines (refactoring)
- **Notes**: Run P0 (analysis) first to surface unknowns. Valuable for maintainability but not blocking for functionality.

---

## Planning Files Generated

```
.agent_planning/unified-search/
├── EVALUATION-20250119-001.md           # Current state analysis
├── SPRINT-20250119-001-PLAN.md          # Request search sprint
├── SPRINT-20250119-002-PLAN.md          # Extension/session data search sprint
├── SPRINT-20250119-003-PLAN.md          # Consolidation sprint
└── USER-RESPONSE-20250119-001.md        # This file
```

---

## Next Steps

**Immediate**: Start Sprint 1 (Request Search)
1. Begin with P0: Backend FTS5 table creation
2. Follow with P1: Search endpoint implementation
3. Then P3: Frontend UI integration

**Parallel**: Sprints 1 and 2 can run in parallel after Sprint 1 P0 (database schema) is stable. P3-P5 in Sprint 2 all depend on Sprint 1 being complete.

**Later**: Sprint 3 consolidation work should happen after Sprints 1-2 are production-ready. Prioritize functionality first, refactoring second.

---

## Recommended Command

To begin implementation:

```bash
/do:it unified-search
```

This will execute Sprint 1 work items with test-driven development approach.

