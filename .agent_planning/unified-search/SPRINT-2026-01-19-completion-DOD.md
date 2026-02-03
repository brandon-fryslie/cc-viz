# Sprint: Unified Search Completion - Definition of Done

**Sprint**: SPRINT-2026-01-19-completion
**Date**: 2026-01-19

---

## Acceptance Criteria Summary

### P0: Backend Snippet Service
- [ ] File `internal/service/snippet.go` exists
- [ ] `SnippetResult` struct defined with Snippet, HighlightStart, HighlightEnd
- [ ] `ExtractSnippet()` function implemented
- [ ] Case-insensitive term matching works
- [ ] Context extraction (~200 chars around match) works
- [ ] Ellipsis added at truncation boundaries
- [ ] Edge cases handled: empty text, term not found, empty query
- [ ] Unit tests pass: `go test ./internal/service/ -run TestSnippet`

### P1: SearchConversations Update
- [ ] `ConversationMatch` has `Preview`, `HighlightStart`, `HighlightEnd` fields
- [ ] `Preview` field is populated (not empty string)
- [ ] Highlight offsets are correct
- [ ] Model updated in `models.go`

### P2: SearchExtensions Update
- [ ] `ExtensionSearchResult` type created
- [ ] Returns snippet instead of full Extension object
- [ ] Highlight offsets included
- [ ] Interface updated in `storage.go`

### P3: SearchTodos Update
- [ ] `TodoSearchResult` type created
- [ ] `session_uuid` included in result
- [ ] Snippet extracted from content
- [ ] Highlight offsets included
- [ ] Interface updated

### P4: SearchPlans Update
- [ ] Plan search result includes `session_uuid`
- [ ] Highlight offsets added
- [ ] Snippet provided (either existing preview or extracted)

### P5: SearchRequests Update
- [ ] `HighlightStart`, `HighlightEnd` added to `RequestSearchResult`
- [ ] Uses `ExtractSnippet()` instead of raw SUBSTR

### P6: Frontend Modal Update
- [ ] `getFullText()` function DELETED
- [ ] `getContextWithHighlight()` function DELETED
- [ ] `highlightSnippet()` function added using backend offsets
- [ ] Results display session_uuid with copy functionality
- [ ] Navigation URLs include `?q=` param

### P7: Frontend Types Update
- [ ] `RequestSearchResult` has highlight fields
- [ ] `ExtensionSearchResult` type exists
- [ ] `TodoSearchResult` type exists with `session_uuid`
- [ ] `PlanSearchResult` type exists with `session_uuid`

### P8: Detail Page Highlighting
- [ ] Conversations page reads URL `q` param
- [ ] Conversations page highlights matching content
- [ ] Requests page reads URL `q` param
- [ ] Requests page highlights matching content
- [ ] Scroll to first match on load

### P9: Navigation Fixes
- [ ] Clicking request result navigates with highlight param
- [ ] Clicking conversation result navigates with highlight param
- [ ] Clicking todo result navigates to correct session
- [ ] Clicking plan result navigates to correct session

---

## Build Verification

```bash
# Backend builds
CGO_ENABLED=1 go build -tags fts5 ./...

# Frontend builds
cd frontend && npm run build

# Embedded build works
just build-embedded

# Tests pass
CGO_ENABLED=1 go test -tags fts5 ./internal/service/ -v
```

---

## Manual Test Checklist

### Search Functionality
- [ ] Cmd+Shift+K opens search modal
- [ ] Typing triggers search after 2+ chars
- [ ] All result types appear (requests, conversations, extensions, todos, plans)

### Snippet Display
- [ ] Request results show snippet with highlighting
- [ ] Conversation results show snippet with highlighting
- [ ] Extension results show snippet with highlighting
- [ ] Todo results show snippet with highlighting
- [ ] Plan results show snippet with highlighting

### Session ID Display
- [ ] Todo results show truncated session UUID
- [ ] Plan results show truncated session UUID
- [ ] Clicking session ID copies full UUID to clipboard
- [ ] Visual feedback shown after copy

### Navigation & Highlighting
- [ ] Clicking request result opens detail page
- [ ] Request detail page highlights matching content
- [ ] Clicking conversation result opens detail page
- [ ] Conversation detail page highlights matching content
- [ ] Clicking todo navigates to session-data with todo visible
- [ ] Clicking plan navigates to session-data with plan visible

---

## Definition of Done

This sprint is **COMPLETE** when:

1. All acceptance criteria checkboxes above are checked
2. All build verification commands succeed
3. All manual test checklist items pass
4. No console errors in browser during testing
5. No new TypeScript type errors
6. Code committed with descriptive message
