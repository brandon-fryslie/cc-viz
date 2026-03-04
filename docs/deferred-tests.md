# Deferred Tests

This file is the single inventory of intentionally skipped tests.

| Date (UTC) | File | Test | Reason | Re-enable Criteria |
|---|---|---|---|---|
| 2026-03-04 | `/Users/bmf/code/cc-viz/internal/service/storage_sqlite_test.go` | `TestGetStats_WithProviderData` | Legacy request-analytics daily stats behavior is outside search/session recovery scope | Request analytics API/contract is explicitly reintroduced and owned by a dedicated compatibility track |
