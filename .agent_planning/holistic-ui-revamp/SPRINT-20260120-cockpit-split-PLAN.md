# Sprint: cockpit-split - Cockpit Split View

**Generated**: 2026-01-20
**Epic**: cc-viz-0xr
**Confidence**: HIGH
**Status**: READY FOR IMPLEMENTATION (after Design System 80%)
**Priority**: P2 (Medium)
**Depends On**: cc-viz-3j1 (Design System)

---

## Sprint Goal

Build the Cockpit Split View - an IDE-style layout with session list on left, detail panel on right. Features inline stats header and todo/plan display for power users who want to browse sessions efficiently.

---

## Scope

**Deliverables:**
1. Left panel: session list with quick stats
2. Right panel: detail view structure with header
3. Header stats bar with inline metrics
4. Tab navigation (conversations, requests, todos, plans)
5. Content virtualization for performance
6. Inline todo/plan management (check, delete, edit)

**Out of Scope:**
- Timeline view (that's Session Timeline)
- Token analytics (that's Token Economics)
- Full conversation editor (read-only)

---

## Work Items

### P0: Left Panel - Session List (cc-viz-0xr.1)

**Files to Create:**
- `frontend/src/pages/CockpitView.tsx`
- `frontend/src/components/features/SessionListPanel.tsx`

**Uses**: `DataList` from Design System

**Acceptance Criteria:**
- [ ] Virtualized session list (handles 1000+ sessions)
- [ ] Each row shows: UUID (truncated), last activity date, message count, token count
- [ ] Search bar at top filters by UUID, project, content
- [ ] Selection highlighting (current session)
- [ ] Favorite/star functionality (optional - stored in localStorage)
- [ ] Keyboard navigation: arrow keys, enter to select
- [ ] Resizable width (default 280px, min 200px, max 400px)

**Technical Notes:**
- Use ResizablePanel from existing layout components
- Use @tanstack/react-virtual for list
- Store favorites in localStorage (no backend persistence yet)

---

### P1: Right Panel - Detail View (cc-viz-0xr.2)

**Files to Create:**
- `frontend/src/components/features/SessionDetailPanel.tsx`

**Acceptance Criteria:**
- [ ] Header: Session UUID (copyable), project name, date range
- [ ] Stats row: Total tokens, conversations count, requests count, todos count
- [ ] Tab area below header for content switching
- [ ] Content area (fills remaining space)
- [ ] Empty state when no session selected

**Technical Notes:**
- Use CopyableId for UUID display
- Flex layout with overflow-auto for content

---

### P2: Header Stats Bar (cc-viz-0xr.3)

**Uses**: `StatCard` (compact variant) from Design System

**Acceptance Criteria:**
- [ ] Compact horizontal stats: 4 metrics in a row
- [ ] Metrics: Total Tokens | Conversations | Requests | Todos/Plans
- [ ] Each metric is clickable (jumps to that tab)
- [ ] Trend indicator if data available
- [ ] Time range toggle: All Time, Last 7 Days, Last 24h

**Technical Notes:**
- Create compact variant of StatCard (smaller padding, inline layout)
- Store time range in component state (not URL)

---

### P3: Tab Navigation (cc-viz-0xr.4)

**Uses**: `Tabs` from Design System

**Acceptance Criteria:**
- [ ] Tabs: Conversations | Requests | Todos | Plans
- [ ] Each tab shows item count as badge
- [ ] Active tab indicator (underline or background)
- [ ] Tab content loads on demand (lazy)
- [ ] Keyboard navigation: left/right arrows
- [ ] URL param: `?tab=conversations` for deep linking

**Technical Notes:**
- Use controlled Tabs component
- Store tab in URL search params

---

### P4: Content Virtualization (cc-viz-0xr.5)

**Acceptance Criteria:**
- [ ] Conversations tab: virtualized message list (handles 1000+ messages)
- [ ] Requests tab: virtualized request list
- [ ] Todos tab: list with status grouping
- [ ] Plans tab: list with preview
- [ ] Lazy load tab content (don't load until tab selected)
- [ ] Loading state while fetching
- [ ] No jank when scrolling 10K+ items

**Technical Notes:**
- Use @tanstack/react-virtual for each list
- Use React.lazy() or conditional rendering for tab panels
- Profile with React DevTools to verify no re-renders

---

### P5: Inline Todo/Plan Management (cc-viz-0xr.6)

**Acceptance Criteria:**
- [ ] Todo item: checkbox to toggle status (optimistic update)
- [ ] Todo item: delete button (with confirmation)
- [ ] Todo item: inline edit (click to edit, enter to save)
- [ ] Plan item: expand to show sprints
- [ ] Keyboard shortcuts: `x` to toggle done, `d` to delete, `e` to edit

**Technical Notes:**
- Use mutation hooks for updates (if backend supports)
- If backend is read-only, show "Read-only mode" message
- Optimistic updates with rollback on error

---

## Dependencies

- **Blocks on**: Design System (cc-viz-3j1) - needs DataList, Tabs, CopyableId
- **API Ready**: useConversations, useConversationMessages, useRequests, useTodos, usePlans

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance with deep conversation threads | Medium | High | Virtualize + lazy load |
| Panel resize complexity | Low | Low | Use existing ResizablePanel |
| Todo edit conflicts | Low | Medium | Optimistic UI with error handling |

---

## Exit Criteria

Sprint is complete when:
- [ ] All 6 beads tasks (cc-viz-0xr.1 through cc-viz-0xr.6) are closed
- [ ] Session list virtualizes 1000+ sessions smoothly
- [ ] Click session → detail panel updates
- [ ] All 4 tabs work with data loading
- [ ] Content virtualizes (no jank with 10K items)
- [ ] Todo status can be toggled (if backend supports)
- [ ] Panel resizing works
- [ ] Keyboard navigation complete
