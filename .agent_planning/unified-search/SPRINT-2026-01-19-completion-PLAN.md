# Sprint: Unified Search Completion

**Generated**: 2026-01-19
**Confidence**: HIGH
**Status**: READY FOR IMPLEMENTATION

---

## Sprint Goal

Complete the unified search feature by implementing:
1. Backend-provided snippets with highlight offsets for all search types
2. Session UUID display in search results with copy functionality (middle truncation format)
3. Detail page navigation with scroll-and-flash highlighting
4. Navigation URL fixes

---

## Design Decisions (Per User)

1. **Session ID Display**: Middle truncation with copy - `0123...cdef` format, click to copy full UUID
2. **Detail Page Highlighting**: Scroll to first match, flash highlight yellow then fade

---

## Scope

**Deliverables**:
1. Backend snippet extraction service
2. Updated search endpoints with snippets + session_uuid + highlight offsets
3. Frontend modal using backend data (removing ad-hoc extraction)
4. Detail page highlighting on navigation
5. Session ID display with copy button

---

## Work Items

### P0: Backend - Create Snippet Service

**File**: `internal/service/snippet.go` (NEW)

**Acceptance Criteria**:
- [ ] Create `SnippetResult` struct with `Snippet`, `HighlightStart`, `HighlightEnd` fields
- [ ] Create `ExtractSnippet(fullText, searchQuery string, contextChars int) SnippetResult`
- [ ] Case-insensitive search term matching
- [ ] Extract ~100 chars before and ~100 after first match
- [ ] Add ellipsis when truncated
- [ ] Handle edge cases: term not found (return first N chars), empty text, empty query
- [ ] For multi-term queries, use first term for highlight position
- [ ] Unit tests covering all edge cases

**Technical Notes**:
```go
type SnippetResult struct {
    Snippet        string `json:"snippet"`
    HighlightStart int    `json:"highlightStart"`  // 0-based byte offset in snippet
    HighlightEnd   int    `json:"highlightEnd"`    // 0-based byte offset in snippet
}

func ExtractSnippet(fullText, searchQuery string, contextChars int) SnippetResult
```

---

### P1: Backend - Update SearchConversations

**File**: `internal/service/storage_sqlite.go` (function at ~line 1861)

**Acceptance Criteria**:
- [ ] Populate `Preview` field in `ConversationMatch` (currently always empty)
- [ ] Add `HighlightStart`, `HighlightEnd` fields to `ConversationMatch` model
- [ ] Use `ExtractSnippet()` on `content_text` from FTS5 table
- [ ] Return `session_uuid` if available (from conversation metadata)
- [ ] Pass search query to snippet extractor for highlight positioning

**Technical Notes**:
- SQL query needs to SELECT content from conversations_fts
- Update model in `internal/model/models.go`

---

### P2: Backend - Update SearchExtensions

**File**: `internal/service/storage_sqlite.go` (function at ~line 2784)

**Acceptance Criteria**:
- [ ] Create `ExtensionSearchResult` type (lightweight, not full Extension object)
- [ ] Include: ID, Type, Name, Snippet, HighlightStart, HighlightEnd, MatchCount
- [ ] Extract snippet from `description` field
- [ ] Use `ExtractSnippet()` for context and highlight offsets
- [ ] Update storage interface

**New Type**:
```go
type ExtensionSearchResult struct {
    ID             string `json:"id"`
    Type           string `json:"type"`
    Name           string `json:"name"`
    Source         string `json:"source"`
    Snippet        string `json:"snippet"`
    HighlightStart int    `json:"highlightStart"`
    HighlightEnd   int    `json:"highlightEnd"`
    MatchCount     int    `json:"matchCount"`
}
```

---

### P3: Backend - Update SearchTodos

**File**: `internal/service/storage_sqlite.go` (function at ~line 3856)

**Acceptance Criteria**:
- [ ] Create `TodoSearchResult` type (lightweight)
- [ ] Include: ID, SessionUUID, Snippet, Status, HighlightStart, HighlightEnd, MatchCount
- [ ] Extract snippet from `content` field
- [ ] **Include session_uuid** in results
- [ ] Use `ExtractSnippet()` for context and highlight offsets
- [ ] Update storage interface

**New Type**:
```go
type TodoSearchResult struct {
    ID             int    `json:"id"`
    SessionUUID    string `json:"session_uuid"`
    Snippet        string `json:"snippet"`
    Status         string `json:"status"`
    HighlightStart int    `json:"highlightStart"`
    HighlightEnd   int    `json:"highlightEnd"`
    MatchCount     int    `json:"matchCount"`
}
```

---

### P4: Backend - Update SearchPlans

**File**: `internal/service/storage_sqlite.go` (function at ~line 4091)

**Acceptance Criteria**:
- [ ] Create `PlanSearchResult` type (lightweight) OR add fields to Plan
- [ ] Include: ID, FileName, DisplayName, Snippet, SessionUUID, HighlightStart, HighlightEnd
- [ ] **Include session_uuid** in results
- [ ] Use existing `preview` field OR use `ExtractSnippet()` for context
- [ ] Add highlight offsets
- [ ] Update storage interface

---

### P5: Backend - Update SearchRequests

**File**: `internal/service/storage_sqlite.go` (function at ~line 1972)

**Acceptance Criteria**:
- [ ] Add `HighlightStart`, `HighlightEnd` to `RequestSearchResult`
- [ ] Use `ExtractSnippet()` instead of raw SUBSTR for snippet
- [ ] Update model in `internal/model/models.go`

---

### P6: Frontend - Update Unified Search Modal

**File**: `frontend/src/components/UnifiedSearchModal.tsx`

**Acceptance Criteria**:
- [ ] DELETE `getFullText()` function (lines 36-52)
- [ ] DELETE `getContextWithHighlight()` function (lines 54-89)
- [ ] ADD `highlightSnippet(snippet, start, end)` function using backend offsets
- [ ] Use `item.snippet` from API responses
- [ ] Display session_uuid with copy button for items that have it
- [ ] Pass search query in navigation URL: `?q=${searchQuery}&highlight=true`
- [ ] Update all type handling to use new result types

**New Function**:
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

**Session ID Display** (Middle Truncation):
```typescript
function truncateMiddle(uuid: string): string {
  if (uuid.length <= 12) return uuid
  return `${uuid.substring(0, 4)}...${uuid.substring(uuid.length - 4)}`
}

{item.session_uuid && (
  <button
    onClick={(e) => {
      e.stopPropagation()
      navigator.clipboard.writeText(item.session_uuid)
      // Show toast or visual feedback
    }}
    className="text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
    title={`Click to copy: ${item.session_uuid}`}
  >
    {truncateMiddle(item.session_uuid)}
  </button>
)}
```

---

### P7: Frontend - Update TypeScript Types

**File**: `frontend/src/lib/types.ts`

**Acceptance Criteria**:
- [ ] Add `highlightStart`, `highlightEnd` to `RequestSearchResult`
- [ ] Add `highlightStart`, `highlightEnd`, `session_uuid` (optional) to `ConversationMatch` equivalent
- [ ] Create `ExtensionSearchResult` type
- [ ] Create `TodoSearchResult` type with `session_uuid`
- [ ] Create `PlanSearchResult` type with `session_uuid`
- [ ] Update `UnifiedSearchResult` to use new types

---

### P8: Frontend - Detail Page Highlighting

**Files**:
- `frontend/src/pages/Requests.tsx`
- `frontend/src/pages/Conversations.tsx`

**Acceptance Criteria**:
- [ ] Read `q` and `highlight` URL params from navigation
- [ ] If `highlight=true`, find matching content and scroll to it
- [ ] Apply temporary highlight effect (flash yellow then fade)
- [ ] Handle case where content isn't found (maybe loaded async)

**Implementation Notes**:
```typescript
// In detail page useEffect
const searchParams = new URLSearchParams(window.location.search)
const highlightQuery = searchParams.get('q')
const shouldHighlight = searchParams.get('highlight') === 'true'

if (shouldHighlight && highlightQuery && detailContent) {
  // Find and highlight matching content
  // Scroll into view
}
```

---

### P9: Frontend - Fix Navigation URLs

**File**: `frontend/src/components/UnifiedSearchModal.tsx`

**Acceptance Criteria**:
- [ ] Update `getResultUrl()` to pass search query for highlighting
- [ ] Fix extension URL (currently `/extensions?search=${item.name}` but page doesn't read it)
- [ ] For todos/plans, navigate to session-data page with proper selection OR create detail routes

**Updated URLs**:
```typescript
case 'conversation':
  return `/conversations/${item.id}?q=${encodeURIComponent(searchQuery)}&highlight=true`
case 'request':
  return `/requests/${item.id}?q=${encodeURIComponent(searchQuery)}&highlight=true`
case 'extension':
  return `/extensions?id=${item.id}`  // ExtensionsHub should handle this
case 'todo':
  return `/session-data?session=${item.session_uuid}&todo=${item.id}`  // Navigate to session with todo selected
case 'plan':
  return `/session-data?session=${item.session_uuid}&plan=${item.id}`  // Navigate to session with plan selected
```

---

## Dependencies

**Work Order**:
1. P0 (Snippet service) - Foundation, do first
2. P1-P5 (Backend search updates) - Can be done in parallel after P0
3. P6-P7 (Frontend modal + types) - After P1-P5
4. P8 (Detail page highlighting) - After P6
5. P9 (Navigation fixes) - Can be done with P6

**External Dependencies**:
- None - all changes are internal

---

## Technical Architecture

### Data Flow

```
User types in search modal
  ↓
Frontend: GET /api/v2/search?q=term
  ↓
Backend: Call each search method in parallel
  ↓
Each method:
  - Execute FTS5 query
  - For each result, call ExtractSnippet(content, query, 100)
  - Return result with snippet + highlight offsets + session_uuid
  ↓
Backend: Aggregate and return unified results
  ↓
Frontend: Display results using backend snippets
  ↓
User clicks result
  ↓
Navigate to /conversations/123?q=term&highlight=true
  ↓
Detail page: Read params, find content, scroll, highlight
```

### Snippet Service

```
ExtractSnippet(fullText, searchQuery, contextChars)
  ↓
Parse searchQuery (split on whitespace, take first term)
  ↓
Find term position in fullText (case-insensitive)
  ↓
If found:
  - Calculate start = max(0, pos - contextChars)
  - Calculate end = min(len, pos + len(term) + contextChars)
  - Extract snippet
  - Calculate highlight offsets relative to snippet start
  - Add ellipsis if truncated
If not found:
  - Return first 200 chars
  - HighlightStart = 0, HighlightEnd = 0
  ↓
Return SnippetResult
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation | Level |
|------|--------|-----------|-------|
| Backend changes break existing clients | API incompatibility | Add fields, don't remove existing ones | LOW |
| Snippet extraction slow for large content | Performance | Limit search to first 10KB of content | LOW |
| Detail page highlight flickers | UX | Use CSS animation with smooth fade | LOW |
| Session UUID not always present | Missing display | Only show copy button when present | LOW |
| Multi-byte character handling in offsets | Broken highlight | Use rune-based offsets in Go | MEDIUM |

---

## Success Criteria

Unified search completion is verified when:

1. **Snippets**: All 5 search types return backend-provided snippets with context
2. **Highlighting**: Search term is highlighted in results using backend offsets
3. **Session ID**: Todos and Plans show session UUID with copy-on-click
4. **Navigation**: Clicking result navigates to detail page with content highlighted
5. **Performance**: No regression - search still < 500ms
6. **Tests**: Go unit tests for snippet extraction pass
7. **Build**: `just build-embedded` succeeds
8. **Manual verification**: Cmd+Shift+K → search → results have highlights → click → detail page highlights content

---

## Acceptance Test Scenarios

### Scenario 1: Search with Highlighting
1. Press Cmd+Shift+K
2. Type "error"
3. Verify results show snippets with "error" highlighted
4. Verify highlighting works for all result types (requests, conversations, extensions, todos, plans)

### Scenario 2: Session ID Copy
1. Search for something that returns todos or plans
2. Verify session ID appears (truncated like `01234567...`)
3. Click session ID
4. Verify full UUID copied to clipboard
5. Verify visual feedback (tooltip or toast)

### Scenario 3: Navigate and Highlight
1. Search for "function"
2. Click a conversation result
3. Verify navigation to `/conversations/:id?q=function&highlight=true`
4. Verify page scrolls to matching content
5. Verify content flashes highlighted then fades

### Scenario 4: Todo/Plan Navigation
1. Search for something returning todos
2. Click a todo result
3. Verify navigation to session-data page
4. Verify correct session is expanded
5. Verify todo is highlighted/selected

---

## Files Modified Summary

**Backend (Go)**:
1. `internal/service/snippet.go` - NEW
2. `internal/service/storage_sqlite.go` - Update 5 search methods
3. `internal/service/storage.go` - Interface updates
4. `internal/model/models.go` - Add result types and fields

**Frontend (TypeScript/React)**:
1. `frontend/src/components/UnifiedSearchModal.tsx` - Major refactor
2. `frontend/src/lib/types.ts` - Add types
3. `frontend/src/pages/Conversations.tsx` - Add highlight handling
4. `frontend/src/pages/Requests.tsx` - Add highlight handling
5. `frontend/src/pages/SessionData.tsx` - Handle navigation params
