# Legacy Request Analytics Removal (Runtime Contract)

## What Changed

The runtime storage contract no longer requires legacy request ingestion/analytics behavior.

- Runtime interface: `internal/service/storage.go` -> `RuntimeStorageService`
- Legacy interface: `internal/service/storage.go` -> `LegacyRequestStorageService`
- `StorageService` now aliases runtime only.

## Removed From Runtime Contract

These methods are now legacy-only and are not required for runtime storage implementations:

- `SaveRequest`
- `GetRequests`
- `ClearRequests`
- `UpdateRequestWithGrading`
- `UpdateRequestWithResponse`
- `EnsureDirectoryExists`
- `GetRequestByShortID`
- `GetConfig`
- `GetAllRequests`
- `GetRequestsSummary`
- `GetRequestsSummaryPaginated`
- `GetLatestRequestDate`
- `SearchRequests`
- `GetProviderStats`
- `GetSubagentStats`
- `GetToolStats`
- `GetPerformanceStats`

## Runtime Behavior Changes

- Unified search defaults now exclude request-search domain unless explicitly requested. // [LAW:one-source-of-truth] default search domains are centralized in `internal/storagehybrid/searchsql/store.go`
- Startup route banner no longer advertises removed `/api/requests` surface.

## Deferred Compatibility

- Frontend still issues `/api/v2/requests/summary` on some non-priority paths, producing 404.
- This does not block search/session recovery and is intentionally deferred for follow-up cleanup.

## Reintroduction Criteria

Reintroduce legacy request analytics only if all conditions are true:

1. A concrete product requirement depends on request analytics, not just legacy parity.
2. Request analytics has a dedicated boundary/interface separate from runtime search/session contract. // [LAW:single-enforcer]
3. API + frontend contract is explicitly versioned and tested independently from search/session acceptance.
