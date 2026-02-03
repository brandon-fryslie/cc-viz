# Sprint: token-economics - Token Economics Dashboard

**Generated**: 2026-01-20
**Epic**: cc-viz-89o
**Confidence**: HIGH
**Status**: READY FOR IMPLEMENTATION (after Design System 80%)
**Priority**: P2 (Medium)
**Depends On**: cc-viz-3j1 (Design System)

---

## Sprint Goal

Build the Token Economics Dashboard - a financial-style dashboard showing token burn trends, cost breakdowns by project/model, and anomaly alerts. Helps users understand where their API budget is going.

---

## Scope

**Deliverables:**
1. Dashboard layout with date range picker header
2. Daily token burn trend chart (area chart)
3. Cost breakdown by model and project (pie/donut charts)
4. Anomaly detection and alerts
5. Cost data table (sessions with highest tokens)
6. Forecasting and predictions (optional/P3)

**Out of Scope:**
- Actual cost calculation (tokens only, no pricing)
- Budget limits/alerts (future feature)
- Real-time tracking (future feature)

---

## Work Items

### P0: Dashboard Layout (cc-viz-89o.1)

**Files to Create:**
- `frontend/src/pages/TokenEconomics.tsx`

**Uses**: `GlobalDatePicker` (existing), Design System components

**Acceptance Criteria:**
- [ ] Full-width header with title "Token Economics" and date range picker
- [ ] Key metrics summary bar: Total Tokens, Avg/Day, Peak Day, Burn Rate
- [ ] Large trend chart section (60% height)
- [ ] Bottom section: Breakdown charts (left) + Alerts (right)
- [ ] Data table below breakdowns
- [ ] Responsive: stacks on mobile

**Technical Notes:**
- Use existing GlobalDatePicker with DateRangeContext
- CSS Grid for layout sections

---

### P1: Daily Token Burn Chart (cc-viz-89o.2)

**Uses**: `HourlyUsageChart` (adapted), `ChartWrapper` from Design System

**Files to Create:**
- `frontend/src/components/charts/DailyBurnChart.tsx`

**Acceptance Criteria:**
- [ ] Recharts AreaChart showing token usage over selected date range
- [ ] Tooltip shows: Date, Total Tokens, Breakdown by Model
- [ ] Highlight anomalies (days >2x average) with different color
- [ ] Toggle: Stacked view (by model) vs Single line
- [ ] Toggle: Stacked view (by project) vs Single line
- [ ] Smooth animation on data change

**Technical Notes:**
- Adapt HourlyUsageChart pattern for daily aggregation
- Use existing MODEL_COLORS
- Anomaly threshold: mean + 2 * stddev

---

### P2: Cost Breakdown Charts (cc-viz-89o.3)

**Uses**: `ModelBreakdownChart` (existing), `ChartWrapper`

**Files to Create:**
- `frontend/src/components/charts/ProjectBreakdownChart.tsx`

**Acceptance Criteria:**
- [ ] Pie chart 1: Tokens by Model (donut with center text)
- [ ] Pie chart 2: Tokens by Project (donut with center text)
- [ ] Legend shows: Model/Project name, percentage, token count
- [ ] Click segment → drill down to session list (optional)
- [ ] "Other" category for items <5%

**Technical Notes:**
- Reuse ModelBreakdownChart pattern
- Aggregate by project using session data

---

### P3: Anomaly Detection (cc-viz-89o.4)

**Files to Create:**
- `frontend/src/components/features/AnomalyAlerts.tsx`

**Acceptance Criteria:**
- [ ] Alert card for each anomaly detected
- [ ] Anomaly types: Spike (>2x avg), High Session (>50K tokens), Model Switch
- [ ] Each alert shows: Date, Type, Description, Link to Session
- [ ] Sorted by severity (spikes first)
- [ ] Max 5 alerts shown (expandable)
- [ ] "No anomalies" state if none detected

**Technical Notes:**
- Calculate anomalies client-side from stats data
- Spike: daily tokens > mean + 2 * stddev
- High Session: any session > 50K tokens
- Model Switch: >50% change in model distribution vs previous period

---

### P4: Cost Data Table (cc-viz-89o.5)

**Uses**: `DataList` from Design System

**Acceptance Criteria:**
- [ ] Columns: Session UUID, Project, Model, Tokens, Date
- [ ] Sortable by: Tokens (default desc), Date, Project
- [ ] Searchable by session UUID, project name
- [ ] Click row → navigate to Cockpit view for session
- [ ] Shows top 20 by default, pagination for more
- [ ] Format tokens with formatTokens() (e.g., "156K")

**Technical Notes:**
- Use aggregate data from conversations/sessions
- Group by session_uuid, sum tokens

---

### P5: Forecasting (cc-viz-89o.6) - Optional P3

**Acceptance Criteria:**
- [ ] "Projected Monthly Burn" card based on current trend
- [ ] Simple linear projection: avg(last 7 days) * 30
- [ ] Show confidence range (±20%)
- [ ] Warning badge if projected > previous month
- [ ] "Based on last N days" note

**Technical Notes:**
- Simple calculation, no ML
- Show as additional StatCard
- Can defer if time-constrained

---

## Dependencies

- **Blocks on**: Design System (cc-viz-3j1) - needs StatCard, DataList, ChartWrapper
- **API Ready**: useWeeklyStats, useModelStats, useConversations

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Anomaly detection accuracy | Medium | Low | Start simple, iterate |
| Large date range performance | Medium | Medium | Aggregate on backend if needed |
| Project attribution complexity | Low | Medium | Use session → project mapping |

---

## Exit Criteria

Sprint is complete when:
- [ ] All 6 beads tasks (cc-viz-89o.1 through cc-viz-89o.6) are closed
- [ ] Dashboard shows real token data for selected date range
- [ ] Daily burn chart renders with model breakdown
- [ ] Pie charts show model and project distribution
- [ ] Anomaly alerts appear when thresholds exceeded
- [ ] Data table shows top token consumers
- [ ] Forecasting card shows projected monthly burn (P3, optional)
- [ ] All charts respect theme (dark/light)
