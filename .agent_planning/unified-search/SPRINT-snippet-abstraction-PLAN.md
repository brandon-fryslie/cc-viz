# Sprint: Unified Search Snippet Abstraction

**Generated**: 2026-01-19
**Confidence**: HIGH
**Status**: READY FOR IMPLEMENTATION

---

## Sprint Goal

Create a unified snippet extraction system where the backend returns pre-extracted snippets with highlight offsets for all search types, eliminating frontend duplication.

---

## Design Decisions (Per User)

1. **Extraction**: Hybrid - query-time for search results, index-time for display-only
2. **Highlighting**: Backend returns byte offsets `{snippet, highlightStart, highlightEnd}`, frontend applies span
3. **Types**: Base + subtype composition - `BaseSearchResult` + type-specific fields

---

## Work Items

### P0: Backend - Create Snippet Service (NEW FILE)

**File**: `internal/service/snippet.go`

**Deliverable**:
```go
type SnippetResult struct {
    Snippet        string `json:"snippet"`
    HighlightStart int    `json:"highlightStart"`
    HighlightEnd   int    `json:"highlightEnd"`
}

func ExtractSnippet(fullText, searchQuery string, contextChars int) SnippetResult
```

**Acceptance Criteria**:
- [ ] Case-insensitive search term matching
- [ ] ~100 chars before/after match
- [ ] Ellipsis when truncated
- [ ] Handle: term not found (first N chars), empty text, multi-term (use first term)
- [ ] Unit tests passing

---

### P0: Backend - Add BaseSearchResult Type

**File**: `internal/model/models.go`

```go
type BaseSearchResult struct {
    ID             string `json:"id"`
    Type           string `json:"type"` // "conversation", "request", "extension", "todo", "plan"
    Title          string `json:"title"`
    Snippet        string `json:"snippet"`
    HighlightStart int    `json:"highlightStart"`
    HighlightEnd   int    `json:"highlightEnd"`
}
```

---

### P1: Backend - Update Each Search Method

**File**: `internal/service/storage_sqlite.go`

| Method | Change |
|--------|--------|
| `SearchRequests` | Already has snippet - add highlight offsets |
| `SearchConversations` | Populate `Preview` field + add highlight offsets to `ConversationMatch` |
| `SearchExtensions` | Create `ExtensionSearchResult`, return snippet instead of full `Extension` |
| `SearchTodos` | Create `TodoSearchResult`, return snippet instead of full `Todo` |
| `SearchPlans` | Add highlight offsets (preview already exists) |

**For each**:
- [ ] Call `ExtractSnippet()` on content field
- [ ] Populate snippet + highlight offsets
- [ ] Return lightweight result type

---

### P2: Frontend - Use Backend Snippets

**File**: `frontend/src/components/UnifiedSearchModal.tsx`

**Changes**:
- [ ] DELETE `getFullText()` function (lines 36-52)
- [ ] DELETE `getContextWithHighlight()` function (lines 54-89)
- [ ] ADD `highlightSnippet(snippet, start, end)`:
```typescript
function highlightSnippet(snippet: string, start: number, end: number): React.ReactNode {
  if (start === 0 && end === 0) return snippet
  return (
    <span>
      {snippet.substring(0, start)}
      <span className="bg-[var(--color-accent)] text-white px-0.5 rounded font-medium">
        {snippet.substring(start, end)}
      </span>
      {snippet.substring(end)}
    </span>
  )
}
```
- [ ] Use `item.snippet` and `item.highlightStart/End` from API

---

### P2: Frontend - Update TypeScript Types

**File**: `frontend/src/lib/types.ts`

Add highlight fields to search result types or create new types.

---

### P3: Update Storage Interface

**File**: `internal/service/storage.go`

Update interface signatures for new return types.

---

## Critical Files

| File | Purpose |
|------|---------|
| `internal/service/snippet.go` | NEW - Core extraction logic (single source of truth) |
| `internal/service/storage_sqlite.go` | Update all 5 search methods |
| `internal/model/models.go` | Add BaseSearchResult + search result types |
| `internal/service/storage.go` | Interface updates |
| `frontend/src/components/UnifiedSearchModal.tsx` | Remove frontend snippet logic |
| `frontend/src/lib/types.ts` | Add TypeScript types |

---

## Verification

```bash
# Backend
CGO_ENABLED=1 go test -tags fts5 ./internal/service/ -v
CGO_ENABLED=1 go build -tags fts5 ./...

# Frontend
cd frontend && npm run build

# E2E
just build-embedded
# Open http://localhost:8002, Cmd+Shift+K, search, verify highlights
```

---

## Success Criteria

1. All 5 search types return `snippet`, `highlightStart`, `highlightEnd`
2. Frontend uses backend snippets (no local extraction)
3. `getFullText()` and `getContextWithHighlight()` DELETED from frontend
4. Highlights work for all search types
5. All tests pass
