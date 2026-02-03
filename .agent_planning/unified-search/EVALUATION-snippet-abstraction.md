# Unified Search Snippet Abstraction - Evaluation

**Date**: 2026-01-19  
**Evaluator**: Code Architecture Analysis  
**Status**: Comprehensive Assessment Complete

---

## Executive Summary

The codebase has **inconsistent snippet extraction** across search result types. Some search methods return full content while others return limited snippets. The frontend reconstructs snippets on the client side. This analysis identifies where abstraction would prevent duplication and improve consistency.

---

## 1. Current Search Implementations

### Backend Search Methods (Go)

#### 1.1 SearchRequests (requests_fts) ✅ HAS SNIPPET
**Location**: `internal/service/storage_sqlite.go:1972-2089`

- **What's returned**: `RequestSearchResult` with `Snippet` field
- **Snippet extraction**: `SUBSTR(f.response_text, 1, 120) as snippet` (line 2031)
- **Length limit**: 120 characters
- **Content source**: `response_text` from FTS5 virtual table
- **Fallback (LIKE)**: Uses `SUBSTR(r.endpoint, 1, 120)` instead (line 2319)
- **Status**: Snippet is extracted at database level

#### 1.2 SearchConversations (conversations_fts) ❌ NO SNIPPET
**Location**: `internal/service/storage_sqlite.go:1861-1969`

- **What's returned**: `ConversationMatch` with `Preview` field (defined but never populated)
- **Snippet extraction**: None - `Preview` field is never assigned a value
- **Content source**: Could be `content_text` from conversations_fts table
- **SQL Query**: Doesn't SELECT any preview/snippet column
- **Problem**: Model has `Preview` field but it's always empty string
- **Frontend workaround**: Falls back to `item.projectName` when Preview is empty

#### 1.3 SearchExtensions (extensions_fts) ❌ NO SNIPPET
**Location**: `internal/service/storage_sqlite.go:2784-2881`

- **What's returned**: Full `Extension` objects
- **Fields returned**: All fields including `Description`, `Name`, `MetadataJSON`
- **Snippet extraction**: None - returns full description (could be large)
- **Content sources**: `Description`, `MetadataJSON`
- **Frontend receives**: Full object with complete description text
- **Problem**: No length limiting or preview extraction

#### 1.4 SearchTodos (todos_fts) ❌ NO SNIPPET
**Location**: `internal/service/storage_sqlite.go:3856-3953`

- **What's returned**: Full `Todo` objects
- **Snippet extraction**: None
- **Content source**: Returns full `Content` field (unbounded)
- **Frontend receives**: Complete todo content for every todo
- **Problem**: Todos can be long (entire task description), no preview limit

#### 1.5 SearchPlans (plans_fts) ✅ HAS PREVIEW
**Location**: `internal/service/storage_sqlite.go:4091-4193`

- **What's returned**: Full `Plan` objects
- **Fields**: `Content` (full), `Preview` (pre-extracted at index time)
- **Preview source**: Pre-computed at indexing time in the `Plan` model
- **Length handling**: Preview is extracted during indexing
- **Status**: Plan model includes preview field populated during indexing

---

## 2. What Needs Snippets

### Current State Summary Table

| Type | Returns | Snippet? | Length Limit | Source |
|------|---------|----------|--------------|--------|
| **Requests** | `RequestSearchResult` | ✅ Yes | 120 chars | `response_text` |
| **Conversations** | `ConversationMatch` | ❌ No (field unused) | None | Should be `content_text` |
| **Extensions** | `Extension` (full) | ❌ No | None | Full `description` |
| **Todos** | `Todo` (full) | ❌ No | None | Full `content` |
| **Plans** | `Plan` (full) | ✅ Yes (pre-computed) | Pre-indexed | Pre-indexed `preview` |

### Frontend Gap Analysis

In `UnifiedSearchModal.tsx` (lines 36-89), the frontend has **ad-hoc snippet extraction**:

```typescript
// Lines 37-52: getFullText() - extracts text based on type
// Lines 55-89: getContextWithHighlight() - extracts ~200 chars with context
function getContextWithHighlight(text: string, searchQuery: string): React.ReactNode {
  // ... manual highlighting of search term
  // ... manual extraction of 100 chars before and after match
  // ... fallback to first 150 chars if not found
}
```

**Problem**: Frontend duplicates snippet extraction logic that should be in backend.

---

## 3. Existing Patterns in Codebase

### Pattern 1: FTS5 Virtual Tables
All search types use FTS5 virtual tables:
- `conversations_fts` (lines 23-32 in storage_fts5.go)
- `requests_fts` (lines 50-70)
- `extensions_fts` (lines 80-96)
- `todos_fts` (lines 106-121)
- `plans_fts` (lines 131-148)

FTS5 tables include `UNINDEXED` fields for metadata and searchable text fields.

### Pattern 2: Query Building
All search methods follow identical pattern:
1. Build FTS5 query with OR logic across terms
2. Execute count query
3. Execute results query with pagination
4. Scan results

### Pattern 3: Response Structures
- **Paginated responses**: All include `Total`, `Limit`, `Offset`
- **Match counting**: All include `MatchCount` or similar
- **Type consistency**: Mixed - some return full objects, some return result objects

---

## 4. Frontend Display Needs

### UnifiedSearchModal Usage (lines 36-52)

Currently accesses these fields per type:

```typescript
// Conversations: item.preview || item.projectName
// Requests: item.prompt || item.url
// Extensions: item.description || item.name
// Todos: item.content
// Plans: item.goal || item.display_name || item.preview
```

### Context Extraction (lines 55-89)

Frontend extracts context in `getContextWithHighlight()`:
- Find search term in text
- Extract ~100 chars before and ~100 chars after (total ~200 chars)
- Add ellipsis if truncated
- Highlight matching term

**This logic should be in backend**, not frontend.

### TodosSearchPage and PlansSearchPage Display

Both pages display full content in tables:
- **Todos table**: Shows full `todo.content` in truncated column (max-w-xl)
- **Plans table**: Shows `plan.title` and `plan.goal` (no preview)

Both could benefit from pre-computed snippets.

---

## 5. Duplication Risk Analysis

### Backend Duplication
- **SearchRequests snippet extraction**: Uses `SUBSTR()` to get 120 chars
- **Frontend snippet extraction**: Manually extracts and highlights context
- **Risk**: Logic diverges - backend extracts different snippet than frontend displays

### Model Type Inconsistency
- **Requests**: Returns `RequestSearchResult` (lightweight, has snippet)
- **Conversations**: Returns `ConversationMatch` (lightweight, missing preview)
- **Extensions**: Returns `Extension` (heavyweight, full object)
- **Todos**: Returns `Todo` (heavyweight, full object)
- **Plans**: Returns `Plan` (heavyweight, full object)

**Design violation**: Inconsistent return types. Should all follow same pattern.

### Search Results Wrapping
- **Requests**: Wrapped in `RequestSearchResults` (with pagination)
- **Conversations**: Wrapped in `SearchResults` (with pagination)
- **Extensions/Todos/Plans**: Wrapped in `UnifiedSearchSection` (generic)

**Different structures** for essentially same data (paginated list of results).

---

## 6. Model Type Analysis

### RequestSearchResult
```go
type RequestSearchResult struct {
    RequestID  string `json:"requestId"`
    Timestamp  string `json:"timestamp"`
    Method     string `json:"method"`
    Endpoint   string `json:"endpoint"`
    Model      string `json:"model"`
    Provider   string `json:"provider"`
    MatchCount int    `json:"matchCount"`
    Snippet    string `json:"snippet"`        // ✅ Has snippet
}
```
**Status**: Correct pattern - minimal fields + snippet

### ConversationMatch
```go
type ConversationMatch struct {
    ConversationID string    `json:"conversationId"`
    ProjectName    string    `json:"projectName"`
    ProjectPath    string    `json:"projectPath"`
    Preview        string    `json:"preview"`     // ❌ Field exists but never populated
    MatchCount     int       `json:"matchCount"`
    LastActivity   time.Time `json:"lastActivity"`
}
```
**Status**: Has preview field (unused), but SQL query never SELECTs anything for it

### Extension
```go
type Extension struct {
    Type          string          `json:"type"`
    ID            string          `json:"id"`
    Name          string          `json:"name"`
    Description   string          `json:"description"`  // Full text, unbounded
    Enabled       bool            `json:"enabled"`
    Source        string          `json:"source"`
    PluginID      *string         `json:"plugin_id,omitempty"`
    // ... more fields
}
```
**Status**: Returns full object with full description - no snippet

### Todo
```go
type Todo struct {
    ID          int       `json:"id"`
    SessionUUID string    `json:"session_uuid"`
    AgentUUID   string    `json:"agent_uuid,omitempty"`
    FilePath    string    `json:"file_path"`
    Content     string    `json:"content"`        // Full text, unbounded
    Status      string    `json:"status"`
    ActiveForm  string    `json:"active_form,omitempty"`
    ItemIndex   int       `json:"item_index"`
    ModifiedAt  time.Time `json:"modified_at"`
    IndexedAt   time.Time `json:"indexed_at"`
}
```
**Status**: Returns full object with full content - no snippet

### Plan
```go
type Plan struct {
    ID          int        `json:"id"`
    FileName    string     `json:"file_name"`
    DisplayName string     `json:"display_name"`
    Content     string     `json:"content"`       // Full text
    Preview     string     `json:"preview"`       // ✅ Pre-computed preview
    FileSize    int64      `json:"file_size"`
    ModifiedAt  time.Time  `json:"modified_at"`
    IndexedAt   time.Time  `json:"indexed_at"`
    SessionUUID *string    `json:"session_uuid,omitempty"`
}
```
**Status**: Has both full content AND preview - preview is pre-indexed

---

## 7. Design Decisions Required

### 7.1 Snippet Length Limits

**Current inconsistency**:
- Requests: 120 chars
- Frontend context window: ~200 chars (100 before + query + 100 after)
- Conversations: 0 chars (not extracted)
- Todos/Extensions: Unbounded

**Recommendation**: Standardize on one approach:
- **Option A (Minimal)**: 120-150 chars (like Requests)
- **Option B (Context)**: 200-250 chars with search term highlighted
- **Option C (Smart)**: Variable based on content type

### 7.2 Context Window Strategy

**Frontend currently does**:
- Find search term position
- Extract ~100 chars before and after
- Add ellipsis at truncation points

**Backend should do**:
- Include matching context (before/after search term)
- OR just truncate at first N characters

**Question**: Should backend extract context or frontend?
- **Backend**: More efficient, consistent across all clients
- **Frontend**: More flexible for different display needs

### 7.3 Snippet Extraction Timing

**Current state**:
- **Requests**: Extracted at query time (in SQL SUBSTR)
- **Plans**: Extracted at index time (pre-computed)
- **Others**: Not extracted

**Three approaches**:
1. **Query-time extraction** (SQL SUBSTR): Fast, computed on demand
2. **Index-time extraction** (stored in model): Slower indexing, faster queries
3. **Hybrid**: Pre-extract for large content (Plans), on-demand for small

### 7.4 Snippet Content Selection

**For each type, which field(s) to snippet?**

| Type | Field(s) to Snippet | Size Range |
|------|-------------------|------------|
| Requests | `response_text` | Typically large (can be MBs) |
| Conversations | `content_text` | Variable (1KB-100KB) |
| Extensions | `description` | Small-Medium (100B-5KB) |
| Todos | `content` | Medium (100B-2KB) |
| Plans | `content` | Large (1KB-50KB) |

### 7.5 Backend vs Frontend Responsibility

**Current state**: Frontend does all snippet extraction/highlighting

**Proposed**: Backend extracts snippets, frontend applies styling

**Abstraction location**: Create `SnippetExtractor` service in `internal/service/` with methods:

```go
type SnippetExtractor interface {
    ExtractSnippet(fullText string, maxLength int) string
    ExtractContextSnippet(fullText, searchTerm string, contextSize int) string
}
```

Then use in all search methods:
- `SearchRequests`: Use existing 120-char extraction
- `SearchConversations`: Extract from content_text
- `SearchExtensions`: Truncate description to 150 chars
- `SearchTodos`: Truncate content to 150 chars
- `SearchPlans`: Use existing pre-computed preview (or use extractor)

---

## 8. Key Issues to Solve

### Issue 1: ConversationMatch.Preview Never Populated
- **Location**: `SearchConversations` query (line 1890-1912) doesn't SELECT preview
- **Impact**: Frontend shows only `projectName` instead of preview
- **Solution**: Add preview extraction to SQL query

### Issue 2: Inconsistent Return Types
- **Requests**: Returns `RequestSearchResult` (result-specific type)
- **Others**: Return full domain objects (Extension, Todo, Plan)
- **Impact**: Frontend needs different code paths for each type
- **Solution**: Create unified result wrapper types for all search methods

### Issue 3: Frontend Duplicates Backend Logic
- **File**: `UnifiedSearchModal.tsx` lines 36-89
- **Duplication**: `getContextWithHighlight()` re-implements search term highlighting
- **Impact**: Logic can diverge, frontend-backend mismatch
- **Solution**: Backend should return pre-highlighted or pre-extracted snippets

### Issue 4: No Max-Length Protection
- **Todo/Extension/Plan**: Return unbounded content in search results
- **Impact**: Large responses, network overhead, poor UX in list views
- **Solution**: Always include snippet + full content flag, or truncate by default

### Issue 5: Multiple Snippet Strategies
- **Requests**: Uses `SUBSTR` (simple truncation)
- **Plans**: Uses pre-computed index-time extraction
- **Frontend**: Uses context-window extraction
- **Impact**: Inconsistent user experience
- **Solution**: Choose one standard approach

---

## 9. Abstraction Design Recommendation

### Proposed Backend Abstraction

Create `internal/service/snippet.go`:

```go
// SnippetConfig defines how to extract snippets
type SnippetConfig struct {
    MaxLength          int  // Maximum length of snippet
    IncludeContext     bool // Include surrounding context
    ContextSize        int  // Chars before/after search term
    PrecomputedMode    bool // Use pre-indexed snippet vs on-demand
}

// SnippetExtractor extracts and normalizes snippets
type SnippetExtractor struct {
    config SnippetConfig
}

// ExtractSnippet returns a truncated snippet
func (e *SnippetExtractor) ExtractSnippet(fullText string) string

// ExtractContextSnippet returns snippet with search term context
func (e *SnippetExtractor) ExtractContextSnippet(fullText, searchTerm string) string

// These would be used by all search methods
```

### Proposed Frontend Simplification

In `UnifiedSearchModal.tsx`, replace complex `getContextWithHighlight()` with:
- Backend returns pre-extracted snippet (just display it)
- Optional: Backend returns highlight markers for styling

### Proposed Model Changes

Create unified search result wrappers:

```go
// Generic search result wrapper (replaces RequestSearchResult, ConversationMatch, etc.)
type SearchResultItem struct {
    ID         string                 `json:"id"`
    Type       string                 `json:"type"`     // "request", "conversation", etc.
    Title      string                 `json:"title"`    // Display name
    Snippet    string                 `json:"snippet"`  // Truncated content
    MatchCount int                    `json:"matchCount"`
    Metadata   map[string]interface{} `json:"metadata"` // Type-specific data
}
```

---

## 10. Findings Summary

### Critical Findings

1. **Snippet extraction is scattered**: Backend (Requests), Frontend (UnifiedSearchModal), Index-time (Plans)
2. **ConversationMatch.Preview field unused**: Has the field but never populated from database
3. **Inconsistent response types**: Some lightweight (RequestSearchResult), some heavyweight (Extension, Todo, Plan)
4. **Frontend duplicates backend logic**: Context highlighting should be in backend
5. **No length protection**: Todos and Extensions return unbounded full content

### Architecture Violations

- **ONE SOURCE OF TRUTH**: Snippet extraction logic exists in frontend and backend
- **SINGLE ENFORCER**: No single place enforces snippet length/extraction rules
- **LOCALITY**: Adding snippet extraction requires changes in multiple search methods

### Duplication Hotspots

- **Search methods**: 5 different implementations (requests, conversations, extensions, todos, plans)
- **Frontend/backend**: Snippet extraction logic duplicated across boundary
- **Result types**: RequestSearchResult vs ConversationMatch vs Extension vs Todo vs Plan

---

## 11. Implementation Strategy (Recommended)

### Phase 1: Backend Abstraction (Low Risk)
1. Create `SnippetExtractor` service in `internal/service/snippet.go`
2. Implement standardized extraction methods
3. Update `SearchRequests` to use extractor (no behavior change)
4. Update `SearchConversations` to populate `Preview` field

### Phase 2: Consistency (Medium Risk)
1. Create `SearchResultItem` wrapper type
2. Update all search methods to return consistent structure OR add snippet fields to existing types
3. Ensure all snippets go through extractor

### Phase 3: Frontend Simplification (Low Risk)
1. Update `UnifiedSearchModal.tsx` to remove `getContextWithHighlight()`
2. Backend returns pre-highlighted snippets or highlighting markers
3. Frontend just displays pre-computed snippets

---

## Conclusion

The codebase **has the infrastructure for unified snippet abstraction** but currently **lacks the unifying layer**. The patterns exist (FTS5 tables, paginated responses, result types) but are applied inconsistently.

A `SnippetExtractor` service living at **`internal/service/snippet.go`** would serve as the single source of truth for all snippet extraction, preventing duplication and ensuring consistency across:
- All search types (requests, conversations, extensions, todos, plans)
- Backend and frontend boundaries
- Query-time vs index-time extraction

The abstraction should enforce:
- Maximum snippet length (120-250 chars depending on type)
- Consistent context extraction around search terms
- Optional highlighting markers for frontend display
- Fallback graceful handling of edge cases

