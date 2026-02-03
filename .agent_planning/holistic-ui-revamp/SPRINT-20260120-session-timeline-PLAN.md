# Sprint: session-timeline - Session Timeline View

**Generated**: 2026-01-20
**Epic**: cc-viz-bjd
**Confidence**: HIGH
**Status**: READY FOR IMPLEMENTATION (after Design System 80%)
**Priority**: P1 (High)
**Depends On**: cc-viz-3j1 (Design System)

---

## Sprint Goal

Build the Session Timeline View - the primary data view showing interleaved events (conversations, requests, todos, plans) on a chronological timeline. This is the central "see everything that happened" view.

---

## Scope

**Deliverables:**
1. Session list sidebar (collapsible, searchable, sortable)
2. Central timeline with interleaved events display
3. Event detail cards (expandable in timeline)
4. Filtering and grouping controls
5. Quick actions on timeline items
6. Search highlighting and navigation

**Out of Scope:**
- Full conversation thread (that's Cockpit Split View)
- Token analytics (that's Token Economics)
- Extension management (that's Extension Workshop)

---

## Work Items

### P0: Session List Sidebar (cc-viz-bjd.1)

**Files to Create:**
- `frontend/src/pages/SessionTimeline.tsx`
- `frontend/src/components/features/SessionListSidebar.tsx`

**Acceptance Criteria:**
- [ ] Left sidebar (240px default, collapsible to 48px)
- [ ] List all sessions grouped by date (Today, Yesterday, This Week, Older)
- [ ] Each item shows: truncated UUID, project name, message count badge
- [ ] Search bar filters sessions by UUID or project
- [ ] Sort options: Date (newest/oldest), Activity, Token count
- [ ] Visual indicator for currently selected session
- [ ] Keyboard navigation (arrow keys, enter to select)

**Technical Notes:**
- Use `useConversations` hook, group by session_uuid
- Adapt pattern from ConversationList.tsx
- Store selected session in URL param for shareable links

---

### P1: Central Timeline (cc-viz-bjd.2)

**Uses**: `Timeline` from Design System

**Files to Create:**
- `frontend/src/components/features/SessionEventTimeline.tsx`

**Acceptance Criteria:**
- [ ] Vertical timeline with timestamps on left margin
- [ ] Event types rendered:
  - 🚀 Session started (from first conversation timestamp)
  - 💬 Conversation message (collapsed, shows preview)
  - ✅ Todo (status changes: pending → in_progress → completed)
  - 📝 Plan (created, shows title)
  - 📄 File changes (if available from session API)
- [ ] Events sorted chronologically
- [ ] Each event type has distinct icon and color
- [ ] Zoomable: hour view, day view, week view

**Technical Notes:**
- Aggregate data from: conversations, todos, plans
- Use timestamp as key for ordering
- Virtualize if >100 events in session

---

### P2: Event Detail Cards (cc-viz-bjd.3)

**Acceptance Criteria:**
- [ ] Click event → expands inline to show details
- [ ] Conversation event: shows message preview (first 200 chars)
- [ ] Todo event: shows content, status badge
- [ ] Plan event: shows plan title, sprint count
- [ ] "View full" link → navigates to detail view
- [ ] Close button or click-outside to collapse

**Technical Notes:**
- Use CSS transition for expand/collapse animation
- Keep one event expanded at a time (accordion pattern)

---

### P3: Filtering & Grouping (cc-viz-bjd.4)

**Uses**: `Badge`, `Button` from Design System

**Acceptance Criteria:**
- [ ] Toggle buttons: Conversations, Todos, Plans, Files (each can be on/off)
- [ ] Active filters highlighted with Badge
- [ ] Group by: None (chronological), Type, Hour
- [ ] Time range picker: Last 24h, This Week, This Month, Custom
- [ ] Filter state persisted in URL params

**Technical Notes:**
- Use array state for active filters
- URLSearchParams for persistence: `?filters=conversations,todos&range=week`

---

### P4: Quick Actions (cc-viz-bjd.5)

**Acceptance Criteria:**
- [ ] Hover shows action buttons: View Detail, Copy ID, Open in Context
- [ ] "Copy ID" copies event ID to clipboard (with toast confirmation)
- [ ] "Open in Context" opens full conversation/todo/plan view
- [ ] Bulk select (checkbox on each event) for future batch actions
- [ ] Keyboard shortcut: `c` to copy selected event ID

**Technical Notes:**
- Use `useCopyToClipboard` hook
- Toast notification for feedback

---

### P5: Search & Navigation (cc-viz-bjd.6)

**Uses**: `SearchInput` from Design System

**Acceptance Criteria:**
- [ ] Search bar above timeline
- [ ] Search within current session (local filter)
- [ ] Matching events highlighted (background color)
- [ ] "N of M matches" counter
- [ ] Prev/Next buttons to jump between matches
- [ ] Enter key jumps to first match

**Technical Notes:**
- Use existing search highlighting CSS (`.search-highlight`)
- Store match indices for navigation
- Scroll to match using `scrollIntoView()`

---

## Dependencies

- **Blocks on**: Design System (cc-viz-3j1) - needs Timeline, SearchInput, Badge
- **API Ready**: useConversations, useTodos, usePlans, useConversationMessages

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Timeline performance with many events | Medium | High | Virtualize, lazy load |
| Complex timestamp merging | Medium | Medium | Use unified sort function |
| Zoom level complexity | Low | Medium | Start with day view only |

---

## Exit Criteria

Sprint is complete when:
- [ ] All 6 beads tasks (cc-viz-bjd.1 through cc-viz-bjd.6) are closed
- [ ] Session list shows all sessions grouped by date
- [ ] Timeline shows interleaved events chronologically
- [ ] Events expandable with detail cards
- [ ] Filters work (toggle event types)
- [ ] Search highlights matches in timeline
- [ ] Navigation between matches works
- [ ] Performance acceptable with 500+ events per session
