# Hybrid GORM Recovery Plan (Implemented)

## Scope

- Fresh DB rebuild with backup first. // [LAW:verifiable-goals] deterministic rollback path
- Hybrid storage runtime:
  - Canonical schema guardrails + reads via GORM-backed store (`internal/storagehybrid/canonical`).
  - Search/FTS ownership via SQL store (`internal/storagehybrid/searchsql`).
  - Startup composition via hybrid orchestrator (`internal/storagehybrid/hybrid`).
- Runtime storage contract decoupled from legacy request analytics requirements. // [LAW:single-enforcer] runtime boundary enforces runtime-only contract
- Search + session-open flows validated via API checks and Chrome DevTools MCP.

## Backup / Restore

- Backup file: `/Users/bmf/code/cc-viz/backups/requests-20260304-010952.db`
- SHA256: `75c348b24356126c7900131d37e8a72d9dd001f7fa8534f08553722191ef7614`
- Size: `1.7G`

### Restore command

```bash
cp /Users/bmf/code/cc-viz/backups/requests-20260304-010952.db /Users/bmf/code/cc-viz/requests.db
```

## Implementation Changes

1. Runtime contract split
- `internal/service/storage.go`
- `StorageService` now includes only `RuntimeStorageService`.
- Legacy request analytics methods remain isolated in `LegacyRequestStorageService`.
- `SearchRequests` moved to legacy interface.

2. Hybrid storage modules
- `internal/storagehybrid/canonical/models.go`
- `internal/storagehybrid/canonical/store.go`
- `internal/storagehybrid/searchsql/store.go`
- `internal/storagehybrid/hybrid/store.go`

3. Runtime wiring updates
- `internal/service/storage_sqlite.go`
  - initializes hybrid store at startup
  - applies canonical/session/conversation reads through canonical store
  - enforces unified search default types through search SQL store
- `cmd/viz-server/main.go`
  - constructor now returns concrete `*SQLiteStorageService`
  - removed stale `/api/requests` startup log line
- `internal/handler/data_handler.go`
  - removed stale request-endpoint banner comment

4. Fresh rebuild executed

```bash
rm -f requests.db requests.db-wal requests.db-shm
/tmp/viz-server
```

- Post-ingest counts:
  - conversations: `2396`
  - conversation_messages: `219801`
  - sessions: `1426`
  - conversations_fts rows: `102532`
  - todos: `1807`
  - plans: `333`

## Verification

### Automated

```bash
CGO_ENABLED=1 go test -tags fts5 ./...
```

Passes with one deferred non-search test documented in `docs/deferred-tests.md`.

### API checks

- `/api/v2/search?q=agent&limit=5` returns conversation results and no request section by default.
- `/api/v2/claude/sessions?limit=10` returns non-zero `message_count` sessions.
- `/api/v2/claude/sessions/{id}` loads immediately with conversation metadata.

### Chrome DevTools MCP checks

- Conversations page loads and lists conversations with message counts.
- Conversation open flow loads full message panel (no stuck loading state).
- Session Data page loads and session row selection renders Session Detail panel.
- Console errors during tested flow: none.
- Non-priority 404s observed from deprecated request-summary fetches (`/api/v2/requests/summary`), documented as deferred legacy surface.

## Deferred Work

- Legacy request analytics/runtime request-summary endpoints remain out of scope for search-first recovery.
- Request-summary UI/API cleanup tracked by documentation in `docs/legacy-request-analytics-removal.md`.
