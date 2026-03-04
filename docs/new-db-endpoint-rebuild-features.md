# Feature Rebuild Inventory: New DB Endpoints

// [LAW:one-source-of-truth] This inventory is derived from the runtime route table in `cmd/viz-server/main.go` and frontend API callers in `frontend/src`.
// [LAW:verifiable-goals] Each rebuild item includes deterministic acceptance criteria.

## Scope

This document lists UI/features that must be rebuilt or rewired to align with the current DB-backed API surface.

Authoritative backend surface:
- `cmd/viz-server/main.go:90`
- `cmd/viz-server/main.go:141`

## Endpoint Contract Mismatches (Must Rebuild)

The frontend still calls endpoints that are not registered in the runtime router.

### Missing request surfaces
- `frontend/src/lib/api.ts:87` -> `/api/v2/requests/summary`
- `frontend/src/lib/api.ts:378` -> `/api/v2/requests/search`
- `frontend/src/lib/api.ts:95` -> `/api/v2/requests/{id}`
- `frontend/src/lib/api.ts:105` -> `/api/requests/latest-date`
- `frontend/src/lib/api.ts:120` -> `DELETE /api/requests`
- `frontend/src/pages/Requests.tsx:362` -> `/api/requests/{id}`
- `frontend/src/pages/Requests.tsx:373` -> `/api/requests/{id}`

### Missing legacy analytics/routing surfaces
- `frontend/src/lib/api.ts:168` -> `/api/v2/stats/providers`
- `frontend/src/lib/api.ts:176` -> `/api/v2/stats/subagents`
- `frontend/src/lib/api.ts:184` -> `/api/v2/stats/tools`
- `frontend/src/lib/api.ts:192` -> `/api/v2/stats/performance`
- `frontend/src/lib/api.ts:244` -> `/api/v2/routing/config`
- `frontend/src/lib/api.ts:256` -> `/api/v2/routing/providers`
- `frontend/src/lib/api.ts:270` -> `/api/v2/routing/stats`

## Features To Rebuild Against Current DB Endpoints

| Priority | Feature | Current issue | Rebuild target endpoints | Deterministic acceptance |
|---|---|---|---|---|
| P0 | Requests page (`/requests`) | Hard dependency on removed `/api/requests*` and `/api/v2/requests*` endpoints | Rebuild as DB search/session explorer using `/api/v2/search`, `/api/v2/conversations`, `/api/v2/conversations/{id}/messages`, `/api/v2/claude/sessions/{id}` | Loading `/requests` produces zero 404s; list/details render; compare flow uses only `/api/v2/*` |
| P0 | Settings data-management panel | "Clear all requests" + request count depend on removed request endpoints | Replace with DB-safe actions: reindex/status actions via `/api/v2/conversations/reindex`, `/api/v2/claude/todos/reindex`, `/api/v2/claude/extensions/reindex` | Settings page loads with no failed API calls; each action returns 2xx and updates UI state |
| P0 | Cockpit session list/detail (`/cockpit`) | Session model inferred from conversation IDs; requests tab uses legacy request summary (`frontend/src/components/features/SessionDetailPanel.tsx:41`) | Use `/api/v2/claude/sessions`, `/api/v2/claude/sessions/{id}`, `/api/v2/claude/sessions/{id}/conversations`, `/api/v2/claude/sessions/{id}/files`, `/api/v2/claude/sessions/{id}/plans` | Selecting a session loads counts/data from session endpoints only; no ID-splitting heuristics remain |
| P0 | Session timeline (`/session-timeline`) | Todos/plans are intentionally empty placeholders (`frontend/src/components/features/SessionEventTimeline.tsx:54`, `frontend/src/components/features/SessionEventTimeline.tsx:63`) | Populate timeline from `/api/v2/claude/sessions/{id}` + related endpoints (`/plans`, `/files`, todo detail by session) | Timeline shows non-zero todo/plan events for sessions that have them; no placeholder empty arrays |
| P1 | Mission Control session table | Treats conversations as sessions, not canonical session records | Drive table/cards from `/api/v2/claude/sessions` and `/api/v2/claude/sessions/stats` | Session totals and per-row IDs match `/api/v2/claude/sessions` response exactly |
| P1 | Conversation/session relationship UX | No UI uses relationship endpoints | Add related-session panels via `/api/v2/claude/conversations/{id}/sessions`, `/api/v2/claude/plans/{id}/sessions`, `/api/v2/claude/files?path=` | Conversation/plan/file detail views show linked sessions with working navigation |
| P1 | Global search “Requests” scope | Search UI advertises requests scope while runtime defaults exclude it | Remove/disable requests scope or implement an explicit v2 request-search contract | Search tabs match actual returned data types; no empty/404 request tab behavior |
| P2 | Subagent graph feature UI | Backend endpoints exist, no frontend consumer | Build views on `/api/v2/claude/subagent-graph/hierarchy`, `/stats`, `/hierarchy/{session_id}/agent/{agent_id}` | Subagent graph pages render hierarchy + stats without console/network errors |
| P2 | Legacy analytics pages (if reintroduced) | Dashboard/Performance/Routing pages call missing endpoints | Either delete these pages or rebuild on new DB analytics endpoints (new `/api/v2/analytics/*` contract) | Routed pages make only registered calls; no `/api/v2/stats/providers|subagents|tools|performance` requests |

## Session-Centric Components Using Heuristics (Must Migrate)

- `frontend/src/components/features/SessionListSidebar.tsx:58`
  - Derives session UUID by splitting conversation IDs.
  - Must switch to canonical session records from `/api/v2/claude/sessions`.
- `frontend/src/components/features/SessionListPanel.tsx:30`
  - Uses conversations as session source.
  - Must use session endpoints directly.
- `frontend/src/components/features/SessionDetailPanel.tsx:47`
  - Filters legacy request IDs to infer session requests.
  - Must use session-detail relationships from `/api/v2/claude/sessions/{id}`.

// [LAW:single-enforcer] Session identity must be enforced by backend session endpoints, not re-derived in multiple UI components.
// [LAW:dataflow-not-control-flow] Session workflows should always execute `load session -> load relations -> render`, with empty collections representing missing data instead of branchy fallback paths.

