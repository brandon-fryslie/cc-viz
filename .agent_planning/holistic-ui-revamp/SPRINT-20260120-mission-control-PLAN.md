# Sprint: mission-control - Mission Control Dashboard

**Generated**: 2026-01-20
**Epic**: cc-viz-tqy
**Confidence**: HIGH
**Status**: READY FOR IMPLEMENTATION (after Design System 80%)
**Priority**: P1 (High)
**Depends On**: cc-viz-3j1 (Design System)

---

## Sprint Goal

Build the Mission Control Dashboard - the home screen showing overview of all sessions, recent activity, key metrics, and quick navigation. Inspired by SpaceX mission control and stock trading terminals.

---

## Scope

**Deliverables:**
1. Dashboard layout with responsive grid structure
2. Stat cards with trend indicators (sessions, conversations, tokens, avg)
3. Recent sessions table with search and sort
4. Activity feed / event timeline (cross-session)
5. Analytics charts (token trends, model distribution)
6. Quick action buttons and keyboard shortcuts

**Out of Scope:**
- Session detail view (that's Cockpit Split View)
- Deep analytics (that's Token Economics)
- Real-time updates (future enhancement)

---

## Work Items

### P0: Layout & Grid Structure (cc-viz-tqy.1)

**Files to Create:**
- `frontend/src/pages/MissionControl.tsx`

**Files to Modify:**
- `frontend/src/router.tsx` - Add /mission-control route (or replace /)

**Acceptance Criteria:**
- [ ] Responsive grid: 3-column on desktop, 2-column on tablet, 1-column on mobile
- [ ] Header section with title "Mission Control" and date range picker
- [ ] Top row: 4 stat cards
- [ ] Middle row: Activity feed (left 60%) + Health status (right 40%)
- [ ] Bottom row: Recent sessions table (full width)
- [ ] Uses design system spacing tokens

**Technical Notes:**
- Use CSS Grid with `grid-template-areas` for named regions
- Stat cards use flex with gap for responsive wrapping

---

### P1: Stat Cards with Trends (cc-viz-tqy.2)

**Uses**: `StatCard` from Design System

**Acceptance Criteria:**
- [ ] Card 1: "Sessions Today" - count with ↑↓ vs yesterday
- [ ] Card 2: "Conversations" - total count with 7-day trend
- [ ] Card 3: "Tokens (7 Day)" - formatted (e.g., "247K") with trend
- [ ] Card 4: "Avg Tokens/Session" - calculated metric
- [ ] Trend percentage calculated from API stats
- [ ] Uses `useWeeklyStats` and `useConversations` hooks

**Technical Notes:**
- Calculate trends: `(current - previous) / previous * 100`
- Use formatTokens() from WeeklyUsageChart.tsx

---

### P2: Recent Sessions Table (cc-viz-tqy.3)

**Uses**: `DataList` from Design System

**Acceptance Criteria:**
- [ ] Columns: Session UUID (truncated), Project, Duration, Messages, Tokens, Last Activity
- [ ] Sortable by: Date, Duration, Tokens
- [ ] Searchable by session UUID and project name
- [ ] Virtualized for performance (if >50 sessions)
- [ ] Click row → navigate to session detail (Cockpit view)
- [ ] Shows 10-20 most recent by default

**Technical Notes:**
- Use `useConversations` or sessions API
- Group by session_uuid
- Calculate duration from first/last message timestamps

---

### P3: Activity Feed (cc-viz-tqy.4)

**Uses**: `Timeline` from Design System

**Acceptance Criteria:**
- [ ] Chronological feed of last 20 events
- [ ] Event types: session started, conversation started, todo completed, plan created
- [ ] Each event shows: icon, timestamp, description, link
- [ ] Auto-updates every 30s (optional, can be manual refresh)
- [ ] "View all" link to full activity page (if implemented)

**Technical Notes:**
- Aggregate from conversations, todos, plans APIs
- Sort by timestamp descending
- Use relative time ("2 hours ago")

---

### P4: Analytics Charts (cc-viz-tqy.5)

**Uses**: `HourlyUsageChart`, `ModelBreakdownChart`, `ChartWrapper` from Design System

**Acceptance Criteria:**
- [ ] Token trend chart: Last 7 days, daily aggregation
- [ ] Model breakdown pie: Tokens by model (donut chart)
- [ ] Sessions by project bar chart (horizontal)
- [ ] Charts respect theme (dark/light)
- [ ] Tooltips show exact values

**Technical Notes:**
- Reuse existing chart components
- Use `useWeeklyStats` and `useModelStats` hooks
- Pass theme colors via ChartWrapper

---

### P5: Quick Actions & Shortcuts (cc-viz-tqy.6)

**Acceptance Criteria:**
- [ ] Search shortcut (Cmd+K) opens unified search modal
- [ ] Quick links: "All Sessions", "Token Analytics", "Extensions"
- [ ] Keyboard shortcuts help tooltip (? key)
- [ ] Optional: Pinned/favorite sessions section

**Technical Notes:**
- Unified search modal already exists
- Add Link components with Button styling

---

## Dependencies

- **Blocks on**: Design System (cc-viz-3j1) - needs StatCard, DataList, Timeline
- **API Ready**: useWeeklyStats, useConversations, useTodos, usePlans

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Activity feed performance | Low | Medium | Limit to 20 events, paginate |
| Session grouping complexity | Medium | Low | Start simple, enhance later |

---

## Exit Criteria

Sprint is complete when:
- [ ] All 6 beads tasks (cc-viz-tqy.1 through cc-viz-tqy.6) are closed
- [ ] Dashboard loads in <2s
- [ ] Stat cards show real data with trends
- [ ] Sessions table is searchable and sortable
- [ ] Activity feed shows recent events
- [ ] Charts render correctly in both themes
- [ ] Navigation works (click session → Cockpit view)
