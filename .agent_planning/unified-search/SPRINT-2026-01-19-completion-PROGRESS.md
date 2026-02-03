# Sprint Progress: Unified Search Completion

**Date**: 2026-01-19
**Status**: IN PROGRESS

## Completed (P0-P1)

### P0: Backend Snippet Service ✓
- [x] Created `internal/service/snippet.go` with ExtractSnippet()
- [x] Case-insensitive term matching
- [x] Context extraction (~200 chars around match)
- [x] Ellipsis at truncation boundaries
- [x] Unicode-safe (rune-based) handling
- [x] Comprehensive unit tests (15 test cases, all passing)
- [x] Committed: 8aba63cf

### Models Update ✓
- [x] Added HighlightStart, HighlightEnd to ConversationMatch
- [x] Added HighlightStart, HighlightEnd to RequestSearchResult
- [x] Created ExtensionSearchResult type
- [x] Created TodoSearchResult type with session_uuid
- [x] Created PlanSearchResult type with session_uuid
- [x] Committed: 3b5ccfcf

### Interface Update ✓
- [x] Updated StorageService interface signatures
- [x] SearchExtensions returns ExtensionSearchResult
- [x] SearchTodos returns TodoSearchResult
- [x] SearchPlans returns PlanSearchResult
- [x] Committed: c74dd7d8

### P1: SearchConversations Update ✓
- [x] Updated SQL query to fetch content_text
- [x] Uses ExtractSnippet() for preview generation
- [x] Populates Preview, HighlightStart, HighlightEnd
- [x] Modified: internal/service/storage_sqlite.go

## In Progress

### P2: SearchExtensions Update
- [ ] Create lightweight ExtensionSearchResult
- [ ] Extract snippet from description field
- [ ] Use ExtractSnippet() for highlights
- [ ] Implementation location: storage_sqlite.go line ~2917

### P3: SearchTodos Update
- [ ] Create TodoSearchResult type
- [ ] Include session_uuid in results
- [ ] Extract snippet from content
- [ ] Use ExtractSnippet() for highlights
- [ ] Implementation location: storage_sqlite.go line ~3989

### P4: SearchPlans Update
- [ ] Create PlanSearchResult type
- [ ] Include session_uuid in results
- [ ] Use preview or ExtractSnippet()
- [ ] Add highlight offsets
- [ ] Implementation location: storage_sqlite.go line ~4224

### P5: SearchRequests Update
- [ ] Add HighlightStart, HighlightEnd to results
- [ ] Use ExtractSnippet() instead of raw SUBSTR
- [ ] Implementation location: storage_sqlite.go line ~2105

### P6: Frontend Modal Update
- [ ] Delete getFullText() and getContextWithHighlight()
- [ ] Add highlightSnippet() using backend offsets
- [ ] Display session_uuid with copy button
- [ ] Add navigation URLs with ?q= param

### P7: Frontend Types Update
- [ ] Already completed in backend (model types exist)
- [ ] Need to update frontend/src/lib/types.ts

### P8: Detail Page Highlighting
- [ ] Conversations page: read q param, highlight, scroll
- [ ] Requests page: read q param, highlight, scroll

### P9: Navigation Fixes
- [ ] Update getResultUrl() in UnifiedSearchModal
- [ ] Pass search query for highlighting
- [ ] Fix todo/plan navigation to session-data page

## Blockers

Current compilation errors:
- SearchExtensions implementation returns wrong type ([]*Extension vs []*ExtensionSearchResult)
- SearchTodos implementation returns wrong type
- SearchPlans implementation returns wrong type

These must be updated before the code compiles.

## Next Steps

1. Implement P2: Update SearchExtensions implementation
2. Implement P3: Update SearchTodos implementation
3. Implement P4: Update SearchPlans implementation
4. Implement P5: Update SearchRequests implementation
5. Test backend builds successfully
6. Implement P6-P9: Frontend updates
7. Manual testing per DOD checklist
8. Final commit and evaluation

## Files Modified So Far

**Backend**:
- internal/service/snippet.go (NEW)
- internal/service/snippet_test.go (NEW)
- internal/model/models.go
- internal/service/storage.go
- internal/service/storage_sqlite.go (partial - SearchConversations only)

**Frontend**: Not started yet

## Time/Token Usage

- Created snippet service with tests: ~20k tokens
- Updated models and interface: ~10k tokens
- Updated SearchConversations: ~5k tokens
- Total: ~35k/200k tokens used
- Remaining: ~165k tokens for P2-P9
