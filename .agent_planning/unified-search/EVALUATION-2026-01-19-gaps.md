# Universal Search Gap Analysis - Evaluation

**Date**: 2026-01-19
**Status**: EVALUATION COMPLETE
**Verdict**: CONTINUE (with identified gaps)

---

## Executive Summary

The user requested four improvements to the unified search that were **NOT completed**:

1. **Highlighting** - PARTIAL: Frontend has ad-hoc implementation, backend doesn't provide highlight offsets
2. **Preview/snippet/context display** - PARTIAL: Only RequestSearchResult has snippets; others return full objects
3. **Click to navigate and highlight** - NOT IMPLEMENTED: Navigation works but no highlighting on detail pages
4. **Session ID display** - NOT IMPLEMENTED: Session UUIDs are not shown in search results

A sprint plan (SPRINT-snippet-abstraction-PLAN.md) exists addressing items 1-2 but was **never executed**. Items 3-4 were never planned.

---

## 1. What Was Requested vs What Was Delivered

### 1.1 Highlighting

**Requested**: Search term highlighting in results

**Current State**:
- **Frontend has ad-hoc highlighting** (`UnifiedSearchModal.tsx:55-89`)
- `getContextWithHighlight()` manually finds search term and wraps in styled span
- This is **client-side only** - backend returns raw text
- **Not robust**: Only highlights first occurrence, case-sensitive search

**Gap**: SPRINT-snippet-abstraction-PLAN.md was created with solution but never executed. The plan specifies backend should return `{snippet, highlightStart, highlightEnd}` for proper highlighting.

### 1.2 Preview/Snippet/Context Display

**Requested**: Show snippet/context around matching text

**Current State**:
- **Requests** (SearchRequests): Returns `Snippet` field (first 120 chars of response_text) ✅
- **Conversations** (SearchConversations): Has `Preview` field but **never populated** ❌
- **Extensions** (SearchExtensions): Returns full `Extension` object, no snippet ❌
- **Todos** (SearchTodos): Returns full `Todo` object, no snippet ❌
- **Plans** (SearchPlans): Has `Preview` field populated at index time ✅

**Gap**: 3 of 5 search types don't return snippets. Frontend works around this by extracting from full content client-side.

### 1.3 Click to Navigate and Highlight

**Requested**: Clicking result should load detail page and highlight matched content

**Current State**:
- `getResultUrl()` in UnifiedSearchModal.tsx (lines 110-125) generates navigation URLs
- Navigation DOES work for most types
- **NO highlighting on detail pages** - just navigates to page
- Todos/Plans navigate to search pages (`/todos-search`, `/plans-search`) not detail views

**Gap**: Never planned or implemented. Would require:
1. Passing search query as URL param
2. Detail page reading param and scrolling/highlighting matching content

### 1.4 Session ID Display

**Requested**: Show session ID for items tied to sessions in copyable format

**Current State**:
- Types that have session_uuid: `Todo`, `Plan`, `ConversationMatch` (partial)
- **Search results don't return session_uuid** in most cases
- `UnifiedSearchModal.tsx` doesn't display session_uuid anywhere
- SessionData page shows truncated UUID but not in search results

**Gap**: Never planned. Would require:
1. Backend returning session_uuid in search results
2. Frontend displaying it with copy button

---

## 2. Why Were These Gaps Created?

### Root Cause Analysis

1. **Sprint 1 completed successfully** - Request search with snippets works
2. **Sprint 2 (Extension & Session Data Search)** was planned but incomplete
   - P0-P4 (FTS5 tables, endpoints) done
   - **P5 (Unified Search UI)** acceptance criteria incomplete:
     - "Clicking result navigates to relevant page and highlights result" - NOT DONE

3. **Sprint 3 (Consolidation)** was MEDIUM confidence and marked "defer after analysis"
4. **SPRINT-snippet-abstraction-PLAN.md** exists but was never started
   - Plan addresses highlighting + snippets
   - No completion report exists
   - No code was written

5. **Session ID requirement was never captured** in any planning document

### Process Failure

The implementation agent:
1. Created a detailed snippet abstraction plan
2. Asked user to choose between design options
3. User provided answers
4. Plan was created
5. **Work stopped** - no implementation followed

---

## 3. Current Implementation State

### Backend (Working)

| Endpoint | FTS5 Table | Snippet | Highlight |
|----------|-----------|---------|-----------|
| `/api/v2/requests/search` | ✅ | ✅ 120 chars | ❌ |
| `/api/v2/conversations/search` | ✅ | ❌ (field exists, unused) | ❌ |
| `/api/v2/claude/extensions/search` | ✅ | ❌ | ❌ |
| `/api/v2/session/todos/search` | ✅ | ❌ | ❌ |
| `/api/v2/session/plans/search` | ✅ | ✅ (pre-indexed preview) | ❌ |
| `/api/v2/search` (unified) | ✅ | Mixed | ❌ |

### Frontend (Working but Incomplete)

| Feature | Status | Location |
|---------|--------|----------|
| Search modal | ✅ | `UnifiedSearchModal.tsx` |
| Keyboard shortcut (Cmd+Shift+K) | ✅ | `router.tsx:51-61` |
| Type tabs | ✅ | Lines 337-364 |
| Client-side highlighting | ⚠️ Ad-hoc | `getContextWithHighlight()` lines 55-89 |
| Navigation on click | ✅ | `getResultUrl()` lines 110-125 |
| Highlight on detail page | ❌ | Not implemented |
| Session ID display | ❌ | Not implemented |

---

## 4. Files Requiring Changes

### Backend Changes

1. **`internal/service/snippet.go`** - NEW FILE
   - Create `ExtractSnippet()` function
   - Return `{snippet, highlightStart, highlightEnd}`

2. **`internal/service/storage_sqlite.go`**
   - Update `SearchConversations` - populate Preview field
   - Update `SearchExtensions` - return lightweight result type with snippet
   - Update `SearchTodos` - return lightweight result type with snippet
   - Add `session_uuid` to all result types

3. **`internal/model/models.go`**
   - Add `HighlightStart`, `HighlightEnd` to search result types
   - Ensure `session_uuid` returned in search results

### Frontend Changes

1. **`UnifiedSearchModal.tsx`**
   - Delete `getFullText()` and `getContextWithHighlight()`
   - Use backend-provided snippets + highlight offsets
   - Display session_uuid with copy button
   - Pass search query in navigation URL

2. **Detail pages** (`Conversations.tsx`, `Requests.tsx`, etc.)
   - Read `?q=` search param from URL
   - Scroll to and highlight matching content

3. **`types.ts`**
   - Add highlight offset fields to result types

---

## 5. Gaps Not Previously Identified

### 5.1 Navigation URLs Are Incomplete

From `UnifiedSearchModal.tsx` lines 110-125:

```typescript
case 'extension':
  return `/extensions?search=${item.name}`  // Not a valid route!
case 'todo':
  return `/todos-search`  // Goes to search page, not detail
case 'plan':
  return `/plans-search`  // Goes to search page, not detail
```

- Extension URL includes `?search=` but ExtensionsHubPage doesn't read it
- Todos/Plans go to search pages, not specific item detail

### 5.2 No Item-Level Routes for Todos/Plans

Router defines:
- `/todos-search` - page level
- `/plans-search` - page level

Missing:
- `/todos/$id` - no route exists
- `/plans/$id` - no route exists

---

## 6. Recommended Sprint Plan

### Sprint: Unified Search Completion

**Confidence**: HIGH
**Status**: READY FOR IMPLEMENTATION

#### P0: Backend Snippet Service (from existing plan)
- Create `internal/service/snippet.go`
- Implement `ExtractSnippet(text, query, contextChars) -> SnippetResult`
- Unit tests

#### P1: Backend Search Result Updates
- Update `SearchConversations` to populate Preview
- Update `SearchExtensions` to return snippet
- Update `SearchTodos` to return snippet
- Add `session_uuid` to all search results
- Add highlight offsets to all search results

#### P2: Frontend Unified Search Modal
- Use backend snippets (remove ad-hoc extraction)
- Use backend highlight offsets
- Display session_uuid with copy button
- Pass `?q=` param in navigation URLs

#### P3: Detail Page Highlighting
- Requests page: read `?q=` param, highlight matches
- Conversations page: read `?q=` param, highlight matches
- Add todo/plan detail routes if needed

#### P4: Navigation Fixes
- Fix extension navigation URL
- Consider todo/plan detail views or improve search page selection

---

## 7. Ambiguities Requiring User Input

### 7.1 Session ID Display Format

**Question**: How should session ID be displayed?

| Option | Format | Example |
|--------|--------|---------|
| A (Full) | Complete UUID | `01234567-89ab-cdef-0123-456789abcdef` |
| B (Truncated) | First 8 chars | `01234567...` |
| C (Hover) | Truncated with full on hover | Shows `01234567...`, tooltip shows full |

**Recommendation**: Option C - least intrusive but accessible

### 7.2 Detail Page Highlighting Approach

**Question**: How should matching content be highlighted on detail pages?

| Option | Approach | Complexity |
|--------|----------|------------|
| A (Scroll) | Scroll to first match, flash highlight | Medium |
| B (All) | Highlight all matches on page | Higher |
| C (Marker) | Show "N matches" badge, click to cycle | Higher |

**Recommendation**: Option A - simple, addresses immediate need

### 7.3 Todo/Plan Detail Navigation

**Question**: What should happen when clicking a todo/plan search result?

| Option | Behavior |
|--------|----------|
| A (Current) | Go to search page (loses context) |
| B (New Route) | Create `/todos/$id` and `/plans/$id` routes |
| C (Anchor) | Go to session-data page with item expanded |

**Recommendation**: Option C - leverages existing session-data page

---

## 8. Verdict

**CONTINUE** with sprint planning.

The existing SPRINT-snippet-abstraction-PLAN.md is a good foundation but needs expansion to cover:
1. Session ID display (never planned)
2. Detail page highlighting (acceptance criteria existed but not implemented)
3. Navigation fixes (newly discovered)

The work is well-understood and ready for implementation.

---

## Files Referenced

- `.agent_planning/unified-search/SPRINT-20250119-001-COMPLETION.md` - Sprint 1 completion
- `.agent_planning/unified-search/SPRINT-20250119-002-PLAN.md` - Sprint 2 plan (partial completion)
- `.agent_planning/unified-search/SPRINT-snippet-abstraction-PLAN.md` - Unexecuted plan
- `.agent_planning/unified-search/EVALUATION-snippet-abstraction.md` - Detailed gap analysis
- `frontend/src/components/UnifiedSearchModal.tsx` - Current implementation
- `internal/service/storage_sqlite.go` - Backend search implementations
