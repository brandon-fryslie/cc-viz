# Next-Level Roadmap (Post Rebuild)

## Goal
Take the new v3 runtime and Mantine root UI from functional parity to a faster, more deterministic, and more operable platform.

`// [LAW:one-source-of-truth]` All milestones below assume v3 read models + v3 live protocol remain the only canonical runtime contract.
`// [LAW:verifiable-goals]` Every milestone includes machine-verifiable exit criteria.

## Milestone 1: Live Data Convergence (P0)
- Replace broad query invalidation with topic-scoped reducers that apply websocket deltas directly for overview/sessions/activity.
- Keep REST refetch only for gap recovery and reconnect.
- Add monotonic `seq` contract tests per topic.

Exit criteria:
- Under synthetic 1 msg/sec ingest, UI updates without polling loops.
- Websocket reconnect with forced seq gap triggers exactly one REST recovery fetch per affected topic.
- Automated tests: reducer unit tests + integration coverage for reconnect/gap behavior.

## Milestone 2: Search Depth + Precision (P0)
- Add ranking and domain weighting (exact ID match > artifact title > snippet text).
- Add type filters and saved query params for `/search`.
- Add stable snippet extraction for messages/files/config sections.

Exit criteria:
- Deterministic search fixture returns same ordered top-10 results across runs.
- Deep-link routing passes for all artifact kinds (session/conversation/message/todo/plan/file/extension/plugin/config).
- Playwright asserts keyboard palette and full-page `/search` produce identical top result for the same query.

## Milestone 3: Sessions Explorer UX Hardening (P0)
- Add virtualization + pagination for very large session/message sets.
- Add structured artifact renderer (message, todo, plan, file) instead of raw JSON-only inspection.
- Add explicit loading/error/empty states per tab.

Exit criteria:
- Session with 10k+ messages opens without UI jank > 100ms frame drops during scroll.
- No uncaught errors when switching tabs rapidly during live updates.
- Playwright scenario validates deep-link focus routing for message/todo/file artifacts.

## Milestone 4: Token Economics Expansion (P1)
- Add anomaly panel (spike/drop detection) and model/project trend decomposition.
- Add compare windows (current vs previous) with explicit window controls.

Exit criteria:
- Deterministic fixture triggers known anomaly markers at expected buckets.
- Chart/table totals reconcile with summary totals for the same date range.
- Unit tests assert anomaly detection rules and trend deltas.

## Milestone 5: Operability + Guardrails (P1)
- Add structured telemetry around v3 handlers and websocket topics (latency/error counters).
- Add contract tests for every `/api/v3/*` endpoint shape.
- Add CI check that new UI does not import legacy request endpoints.

Exit criteria:
- CI fails on schema drift for v3 DTO snapshots.
- CI fails if `/api/requests*` or `/api/v2/requests*` appears in new UI route tree.
- Dashboard logs include per-topic live send cadence + error counts.

## Milestone 6: Accessibility + Quality Gates (P1)
- Resolve remaining Chrome issue panel warnings in v3 routes.
- Add axe-based accessibility smoke checks for top-level pages.
- Add keyboard-navigation checks for command palette and primary nav.

Exit criteria:
- Axe checks pass on `/`, `/mission-control`, `/sessions`, `/search`, `/extensions-config`.
- Command palette is fully operable by keyboard (open, navigate, execute, close) in Playwright.

## Execution Order
1. Milestone 1
2. Milestone 2
3. Milestone 3
4. Milestone 4
5. Milestone 5
6. Milestone 6

`// [LAW:dataflow-not-control-flow]` This order preserves stable dataflow first, then UX/features, then observability and hardening.
