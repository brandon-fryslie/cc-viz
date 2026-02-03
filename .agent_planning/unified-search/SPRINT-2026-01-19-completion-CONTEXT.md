# Sprint: Unified Search Completion - Context

**Sprint**: SPRINT-2026-01-19-completion
**Date**: 2026-01-19

---

## Background

The unified search feature was partially implemented across three prior sprints:
- **Sprint 1**: Request search with FTS5 - COMPLETED
- **Sprint 2**: Extension & Session Data search - PARTIAL
- **Sprint 3**: Consolidation - DEFERRED

User reported four missing features:
1. Highlighting of search terms in results
2. Preview/snippet/context display for all types
3. Click-to-navigate with highlighting on detail pages
4. Session ID display for session-tied items

---

## Current State

### What Works
- Unified search modal opens with Cmd+Shift+K
- All 5 FTS5 tables exist and are indexed
- Backend endpoints return results
- Basic navigation on click

### What's Missing
- Backend doesn't provide highlight offsets
- Only Requests and Plans have snippets
- ConversationMatch.Preview field is never populated
- Extensions/Todos return full objects (no snippets)
- No session_uuid in search results
- No detail page highlighting after navigation

---

## Key Files

### Backend

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `internal/service/snippet.go` | NEW | Create snippet extraction service |
| `internal/service/storage_sqlite.go` | Search implementations | Update all 5 search methods |
| `internal/service/storage.go` | Interface definitions | Add new result types |
| `internal/model/models.go` | Data models | Add fields and new types |

### Frontend

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `frontend/src/components/UnifiedSearchModal.tsx` | Search UI | Remove ad-hoc extraction, use backend data |
| `frontend/src/lib/types.ts` | TypeScript types | Add search result types |
| `frontend/src/pages/Conversations.tsx` | Detail page | Add highlight handling |
| `frontend/src/pages/Requests.tsx` | Detail page | Add highlight handling |
| `frontend/src/pages/SessionData.tsx` | Session view | Handle navigation params |

---

## Design Decisions

### 1. Snippet Extraction (Hybrid Approach)
- **Query-time extraction**: All search results use `ExtractSnippet()` at query time
- **Why**: Simpler than maintaining pre-indexed snippets, highlight offsets need search query anyway

### 2. Highlight Offsets
- Backend returns `{snippet, highlightStart, highlightEnd}`
- Frontend applies styling using byte offsets
- **Why**: Single source of truth, frontend just displays

### 3. Session ID Display (Middle Truncation)
- Format: `0123...cdef` (first 4 + last 4 chars)
- Click to copy full UUID
- Tooltip shows full UUID
- **Why**: User preference - more identifiable than prefix-only truncation

### 4. Detail Page Highlighting (Scroll and Flash)
- Read `?q=` param from URL
- Find first match in content
- Scroll into view
- Flash yellow highlight, then fade
- **Why**: Simple, addresses immediate need without over-engineering

---

## API Changes

### New/Modified Response Types

```go
// Snippet extraction result
type SnippetResult struct {
    Snippet        string `json:"snippet"`
    HighlightStart int    `json:"highlightStart"`
    HighlightEnd   int    `json:"highlightEnd"`
}

// Updated conversation match
type ConversationMatch struct {
    // ... existing fields ...
    Preview        string `json:"preview"`        // NOW POPULATED
    HighlightStart int    `json:"highlightStart"` // NEW
    HighlightEnd   int    `json:"highlightEnd"`   // NEW
}

// New lightweight result types
type ExtensionSearchResult struct { ... }
type TodoSearchResult struct { session_uuid, ... }
type PlanSearchResult struct { session_uuid, ... }
```

### URL Parameters for Highlighting

```
/conversations/:id?q=searchterm&highlight=true
/requests/:id?q=searchterm&highlight=true
/session-data?session=uuid&todo=id
/session-data?session=uuid&plan=id
```

---

## Testing Strategy

### Unit Tests
- `TestExtractSnippet_MatchFound` - verify context extraction
- `TestExtractSnippet_MatchNotFound` - verify first N chars returned
- `TestExtractSnippet_EmptyInput` - edge cases
- `TestExtractSnippet_MultiByteChars` - unicode handling

### Integration Tests
- Search → verify snippets returned
- Search → verify highlight offsets correct
- Search → verify session_uuid present

### Manual Tests
- Cmd+Shift+K → search → verify highlights
- Click result → verify navigation
- Click result → verify detail page highlights
- Click session ID → verify clipboard copy

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Multi-byte character offset bugs | Use rune-based counting in Go, test with unicode |
| Performance regression from snippet extraction | Limit text searched to first 10KB |
| Breaking existing API clients | Add fields, don't remove existing ones |
| Detail page content loads async | Use MutationObserver or retry logic |

---

## Success Metrics

1. All search results show highlighted snippets
2. Session IDs displayed and copyable for todos/plans
3. Clicking search result highlights content on detail page
4. No performance regression (search < 500ms)
5. No console errors during testing
