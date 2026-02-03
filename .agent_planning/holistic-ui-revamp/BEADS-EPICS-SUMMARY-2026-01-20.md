# CC-Viz UI Revamp: Beads Epics & Work Breakdown

**Created**: 2026-01-20
**Status**: Ready for Implementation
**Total Epics**: 6 (1 foundation + 5 feature epics)
**Total Work Items**: 36 tasks

---

## Executive Summary

This document provides a comprehensive work breakdown for the holistic UI revamp of CC-Viz. The project introduces 5 distinct UI concepts—all built on a shared design system—that modernize how users interact with their session data, tokens, and extensions.

**Key Structure**:
- ✅ All epics created in beads task tracker
- ✅ All child tasks created with detailed descriptions
- ✅ Design System epic marked as blocking dependency for all others
- ✅ Work items prioritized (P0=Critical, P1=High, P2=Medium, P3=Low)
- ✅ Ready for sprint planning and implementation

---

## Epic Overview

### 1. Design System & Component Library (`cc-viz-3j1`)
**Priority**: P1 (High) | **Status**: Open | **Children**: 6 tasks

**Purpose**: Foundational design tokens, UI components, and patterns shared across all 5 UI concepts.

**Blocking**: All other 5 epics depend on this epic's completion.

**Work Items**:
1. **Design tokens: colors, typography, spacing** (P1)
   - Semantic color tokens (background, text, accent, success, error, warning)
   - Typography scale (font sizes, weights, line heights)
   - Spacing scale (padding, margins, gaps)

2. **Base component library: Button, Input, Card** (P1)
   - Reusable base components with theme support
   - Variants (primary, secondary, ghost), sizes, disabled states

3. **Data visualization components: StatCard, Chart wrapper** (P1)
   - StatCard for metrics display
   - Generalized chart wrapper for Recharts integration
   - Trend indicators

4. **Layout components: DataList, DetailDrawer, Timeline** (P1)
   - DataList with virtualization for large datasets
   - DetailDrawer for side panels
   - Timeline component for event display

5. **Theme system: dark/light switching, CSS variables** (P1)
   - Theme provider implementation
   - CSS variables for all tokens
   - localStorage persistence
   - Smooth transitions

6. **Shared utility patterns: CopyableId, SearchInput, StatusBadge** (P1)
   - CopyableId with middle truncation and click-to-copy
   - SearchInput with debounce
   - StatusBadge variants

---

### 2. Mission Control Dashboard (`cc-viz-tqy`)
**Priority**: P1 (High) | **Status**: Open | **Children**: 6 tasks | **Depends**: Design System

**Purpose**: Home/stats screen showing overview of all sessions, recent activity, key metrics, and quick navigation.

**Concept**: "Mission Control" for Claude Code—see what's happening across your entire workspace at a glance.

**Work Items**:
1. **Layout & grid structure for dashboard** (P1)
   - Responsive grid layout
   - Header with title, stat cards area, bottom tables/charts

2. **Stat cards with trend indicators** (P1)
   - Total sessions, active conversations, tokens/day, avg tokens per session
   - Trend arrows (up/down/neutral)

3. **Recent sessions table with search & sort** (P1)
   - Virtualized table: name, created date, message count, token count, last activity
   - Sortable columns, searchable

4. **Activity feed / event timeline** (P1)
   - Chronological feed of recent events across all sessions
   - Session created, conversation started, request made, todo completed, plan updated

5. **Analytics charts: token trends, model distribution** (P1)
   - Daily token burn chart (last 30 days)
   - Pie chart: tokens by model
   - Bar chart: sessions by project

6. **Quick action buttons & shortcuts** (P2)
   - Quick navigation: search (Cmd+K), view all sessions, view analytics
   - Optional: keyboard shortcuts help

---

### 3. Session Timeline View (`cc-viz-bjd`)
**Priority**: P1 (High) | **Status**: Open | **Children**: 6 tasks | **Depends**: Design System

**Purpose**: Primary data view showing interleaved events (conversations, requests, todos, plans) on a timeline.

**Concept**: See everything that happened in a session as an organized, chronological stream.

**Work Items**:
1. **Session list sidebar: collapsible, searchable, sortable** (P1)
   - Left sidebar with all sessions
   - Collapsible/expandable, searchable by name/content, sortable by date/name/activity
   - Visual indicators for session state

2. **Central timeline: interleaved events display** (P1)
   - Core timeline showing conversations, requests, todos, plans chronologically
   - Each event type has distinct visual treatment
   - Zoomable timeline (hour/day/week view)

3. **Event detail cards in timeline** (P1)
   - Timeline events are clickable
   - Details: conversation snippet, request summary, todo content, plan overview
   - Links to original content

4. **Filtering & grouping controls** (P1)
   - Toggle visibility: conversations, requests, todos, plans
   - Group by: type, date, project
   - Time range picker (last 24h, week, month, custom)

5. **Quick actions on timeline items** (P2)
   - Hover actions: view detail, copy ID, open in context, jump to session
   - Bulk actions for selecting multiple items

6. **Search highlighting & navigation** (P1)
   - Search results highlight in timeline
   - Scroll to first match
   - Prev/next navigation for search results across session

---

### 4. Cockpit Split View (`cc-viz-0xr`)
**Priority**: P2 (Medium) | **Status**: Open | **Children**: 6 tasks | **Depends**: Design System

**Purpose**: IDE-style layout with session list on left, detail panel on right.

**Concept**: "Cockpit"—side-by-side session browser and detail view with inline todo/plan management.

**Work Items**:
1. **Left panel: session list with quick stats** (P1)
   - Virtualized session list
   - Name, last activity date, message/token count previews
   - Selection highlighting, favorite/star functionality
   - Search bar

2. **Right panel: detail view structure** (P1)
   - Header (name, dates, stats)
   - Tabs (conversations, requests, todos, plans)
   - Content area

3. **Header stats bar: inline metrics** (P1)
   - Compact stats display: total tokens, conversations, requests, todos, plans
   - Trend indicators, time range toggle

4. **Tab navigation: conversations, requests, todos, plans** (P1)
   - Tab bar to switch between content types
   - Each tab shows relevant items with preview/summary
   - Badge showing item count per tab

5. **Content virtualization & performance optimization** (P1)
   - Lazy-load tab content, virtualize large lists
   - Optimize re-renders
   - Monitor performance, profile with DevTools

6. **Inline todo/plan management: check, delete, edit** (P2)
   - Quick inline actions on todos/plans: check off, delete, edit inline
   - Keyboard shortcuts for power users

---

### 5. Token Economics Dashboard (`cc-viz-89o`)
**Priority**: P2 (Medium) | **Status**: Open | **Children**: 6 tasks | **Depends**: Design System

**Purpose**: Financial-style dashboard showing token burn trends, cost breakdowns by project/model.

**Concept**: "Token Economics"—understand where your API budget is going and spot anomalies.

**Work Items**:
1. **Dashboard layout: header with date range picker** (P1)
   - Date range selector (last week, month, 3 months, custom)
   - Key metrics summary bar (total tokens, avg per day, burn rate)

2. **Daily token burn trend chart** (P1)
   - Area chart showing token usage over time
   - Tooltip with daily breakdown
   - Highlight anomalies (days with unusual usage)
   - Toggle stacked view (by model/project)

3. **Cost breakdown by model & project** (P1)
   - Pie/donut charts: tokens by model (GPT-4, Claude 3, etc.)
   - Pie by project/session
   - Drill-down capability to see individual sessions

4. **Anomaly detection & alerts** (P2)
   - Identify and flag unusual usage patterns
   - Sudden spikes, high-cost sessions, model switches
   - Clickable alerts linking to source sessions

5. **Cost data table: sessions with highest tokens** (P1)
   - Sortable table: session name, model used, tokens, cost, date
   - Search and filter
   - Click to view session detail

6. **Forecasting & predictions** (P3)
   - Optional: predict monthly burn based on trend
   - Estimated costs, budget tracking warnings if available

---

### 6. Extension Workshop (`cc-viz-9dx`)
**Priority**: P2 (Medium) | **Status**: Open | **Children**: 6 tasks | **Depends**: Design System

**Purpose**: Unified extension browser with type filtering, enable/disable toggles, detail drawer.

**Concept**: "Extension Workshop"—discover, manage, and configure extensions in one place.

**Work Items**:
1. **Extension browser: grid/list view with search** (P1)
   - Main view showing all extensions as grid (cards) or list
   - Global search bar, quick filters (type, status)
   - Responsive grid layout

2. **Type & status filtering: extensions, plugins, commands** (P1)
   - Filter by: extension type, status (enabled/disabled/not-installed)
   - Category filtering (productivity, utility, etc.)
   - Multi-select filters

3. **Extension card: name, description, enable/disable toggle** (P1)
   - Each extension shows: icon, name, description snippet, version, author
   - Enable/disable toggle
   - Hover for quick actions

4. **Detail drawer: full extension info & management** (P1)
   - Slide-in drawer with full description, settings, enable/disable
   - Uninstall, configuration options, related extensions

5. **Settings/configuration panel for extensions** (P2)
   - Per-extension settings UI
   - Form builder for configuration options
   - Save/cancel/reset buttons, validation and error handling

6. **Search & pagination: handle large extension lists** (P1)
   - Search across name/description/tags
   - Virtualized list for performance
   - Pagination or infinite scroll
   - Show result count

---

## Dependency Graph

```
Design System & Component Library (cc-viz-3j1)
    ↓ blocks ↓
    ├── Mission Control Dashboard (cc-viz-tqy)
    ├── Session Timeline View (cc-viz-bjd)
    ├── Cockpit Split View (cc-viz-0xr)
    ├── Token Economics Dashboard (cc-viz-89o)
    └── Extension Workshop (cc-viz-9dx)
```

**Implication**: Design System must be completed to 90%+ before other epics can have functional MVPs. However, styling and component refinement can happen in parallel.

---

## Beads Commands Reference

### View Epics
```bash
# Show design system epic
bd show cc-viz-3j1

# Show all epics
bd list --type epic
```

### Start Work
```bash
# Mark epic as in_progress
bd update cc-viz-3j1 --status in_progress

# View child tasks
bd show cc-viz-3j1 --children

# Start first task
bd update cc-viz-3j1.1 --status in_progress
bd update cc-viz-3j1.1 --notes "COMPLETED: [list done]. IN PROGRESS: [current]. NEXT: [upcoming]"
```

### Track Progress
```bash
# Show what's ready to work on
bd ready

# Show all blocked items
bd blocked

# List all by epic parent
bd list --parent cc-viz-3j1
```

### Complete Tasks
```bash
# Close a task
bd close cc-viz-3j1.1 --reason "Completed design tokens implementation"

# Close entire epic when children done
bd epic close-eligible
```

### Sync to Git
```bash
# Sync all changes to git
bd sync
```

---

## Implementation Roadmap

### Phase 1: Foundation (Design System)
**Duration**: First sprint(s)
**Goal**: Build all shared components and design system
**Deliverables**:
- Design tokens (colors, typography, spacing) in CSS variables
- 5 base components (Button, Input, Card, etc.)
- 3 layout components (DataList, DetailDrawer, Timeline)
- Theme system with dark/light switching
- 3 shared patterns (CopyableId, SearchInput, StatusBadge)

**Success Criteria**: All components documented, tested, storybook deployed (optional)

### Phase 2: Core Views
**Duration**: Following sprint(s)
**Goal**: Implement 5 UI concepts using foundation components
**Parallel Work**: All 5 epics can proceed in parallel (P1 tasks first)
**Deliverables**: MVP versions of all 5 views with data integration

### Phase 3: Polish & Optimization
**Duration**: Final sprint(s)
**Goal**: Refine UX, optimize performance, add advanced features (P2/P3 tasks)
**Deliverables**: Production-ready UI with smooth animations, proper error handling

---

## Technical Architecture Notes

### Shared Component Strategy
All 5 views use components from the Design System epic:

```
Design System Components:
├── Base: Button, Input, Card, Badge, Tabs
├── Data: StatCard, ChartWrapper, DataList
├── Layout: DetailDrawer, Timeline, Grid
└── Utils: CopyableId, SearchInput, StatusBadge

Used by all 5 views:
├── Mission Control → StatCard, ChartWrapper, DataList
├── Timeline View → Timeline, DataList, SearchInput, DetailDrawer
├── Cockpit Split → DataList, Tabs, StatCard, CopyableId
├── Token Economics → ChartWrapper, StatCard, DataList
└── Extension Workshop → DataList, DetailDrawer, SearchInput, Badge
```

### Performance Considerations
- **Virtualization**: DataList uses react-window for 300K+ records
- **Lazy Loading**: Tab content loads on demand
- **Memoization**: Charts and heavy components memoized
- **Progressive Enhancement**: Core functionality works without JS

### API Integration
- Existing `/api/v2/` endpoints provide all necessary data
- No backend changes needed—all views consume existing APIs
- Future consideration: Add specific aggregation endpoints if views become slow

---

## Quality Checklist (Per Epic)

Before marking an epic as complete:

- [ ] All child tasks marked complete
- [ ] All components use Design System tokens
- [ ] Performance tested (no jank, loads < 2s)
- [ ] Keyboard navigation works
- [ ] Responsive on mobile/tablet/desktop
- [ ] Dark theme applied consistently
- [ ] No console errors/warnings
- [ ] Manual testing done against real data
- [ ] Cross-browser tested (Chrome, Firefox, Safari)
- [ ] Accessibility checked (contrast, ARIA labels)

---

## Next Steps

1. **Review this breakdown** - Ensure alignment with vision
2. **Run sprint planning** - Use `/do:plan "holistic-ui-revamp"` to create implementation sprint
3. **Start Design System** - Begin with P1 tasks in cc-viz-3j1
4. **Build in parallel** - Once Design System is 80% done, start P1 tasks in other epics
5. **Track progress** - Use `bd ready` to see unblocked work, `bd update` to log progress

---

## Beads Sync Status

All epics and tasks have been:
- ✅ Created in beads database
- ✅ Linked with proper parent-child relationships
- ✅ Synced to git (`.beads/issues.jsonl`)
- ✅ Ready for concurrent work across team/agent sessions

**Last Sync**: 2026-01-20 02:56:05-07:00

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Epics | 6 |
| Total Tasks | 36 |
| P0 (Critical) | 0 |
| P1 (High) | 27 |
| P2 (Medium) | 8 |
| P3 (Low) | 1 |
| Blocked (waiting on Design System) | 5 epics |
| Ready to Start | Design System epic (cc-viz-3j1) |

---

**Created by**: Claude Code
**Project**: CC-Viz Holistic UI Revamp
**Status**: Ready for Sprint Planning & Implementation
