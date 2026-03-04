# Search Recovery Test Matrix

## Classification Rules

- `required-for-search`: required to prove search + session-open recovery.
- `irrelevant-to-search`: not required for this cycle; may be deferred with `t.Skip` + TODO + `docs/deferred-tests.md` entry.

## Required For Search

- `internal/service/search_test.go::TestSearchConversations`
- `internal/service/search_test.go::TestSearchConversationsResponseFormat`
- `internal/service/indexer_test.go::TestSearchIndexedConversations`
- `internal/service/indexer_test.go::TestConversationIndexer`
- `internal/service/storage_sqlite_test.go::TestMigration_ExistingDatabase`

Execution:

```bash
CGO_ENABLED=1 go test -tags fts5 ./internal/service
```

Status: passing.

## Irrelevant To Search (Deferred)

- `internal/service/storage_sqlite_test.go::TestGetStats_WithProviderData`
  - reason: validates legacy request-analytics day bucketing, not search/session runtime behavior
  - action: skipped with TODO comment and documented in `docs/deferred-tests.md`

## Browser-Level Acceptance (Chrome DevTools MCP)

- Conversations list loads and shows message counts.
- Opening a conversation loads detail panel content.
- Session Data list loads and selecting a session loads detail panel.
- No console errors during search/session flows.
