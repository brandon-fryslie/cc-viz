# V3-Only Architecture

## Runtime Surface

1. Backend API:
   - `GET /health`
   - `GET|POST /api/v3/*`
2. Frontend app:
   - Root v3 Mantine UI only
   - No `/legacy` UI namespace

`// [LAW:one-source-of-truth] one runtime UI and one runtime API generation`

## Storage Boundary

1. Runtime handlers consume `RuntimeStorageService` only.
2. Request-era analytics methods are not part of runtime contracts.

`// [LAW:single-enforcer] runtime handler constructor enforces the storage boundary`

## Schema Boundary

On storage bootstrap, legacy request-era schema objects are dropped idempotently:

1. `requests` table
2. `requests_fts` virtual table
3. request-era indexes

This ensures runtime operation does not depend on deprecated request-log structures.

## Frontend IA

Top-level routes:

1. `/`
2. `/mission-control`
3. `/sessions`
4. `/token-economics`
5. `/extensions-config`
6. `/search`
7. resource detail routes under `/sessions/:id`, `/conversations/:id`, `/plans/:id`, `/extensions-config/:type/:id`
