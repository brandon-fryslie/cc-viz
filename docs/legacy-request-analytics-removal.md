# Legacy Request Analytics Removal (Completed)

Legacy runtime surfaces have been removed.

## Completed Outcomes

1. Runtime API surface is now `health + /api/v3/*` only.  
   `// [LAW:one-source-of-truth] one active API generation`
2. Legacy frontend namespace `/legacy` has been removed from runtime entrypoints.
3. Runtime storage contract is `RuntimeStorageService` only (no legacy request analytics contract in active runtime code paths).
4. Startup schema cleanup drops request-era tables/indexes if they still exist:
   - `requests`
   - `requests_fts`
   - request-era indexes

## Operational Note

The server now treats any removed legacy route as not-found. This is intentional and part of the v3-only cutover.
