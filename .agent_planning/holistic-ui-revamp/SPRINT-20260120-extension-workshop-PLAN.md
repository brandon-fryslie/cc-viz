# Sprint: extension-workshop - Extension Workshop

**Generated**: 2026-01-20
**Epic**: cc-viz-9dx
**Confidence**: HIGH
**Status**: READY FOR IMPLEMENTATION (after Design System 80%)
**Priority**: P2 (Medium)
**Depends On**: cc-viz-3j1 (Design System)

---

## Sprint Goal

Build the Extension Workshop - a unified extension browser with type filtering, enable/disable toggles, and detail drawer. Inspired by VS Code extensions and app stores.

---

## Scope

**Deliverables:**
1. Extension browser with grid/list view toggle
2. Type and status filtering (agents, commands, skills, hooks, MCP)
3. Extension card with enable/disable toggle
4. Detail drawer for full extension info
5. Settings/configuration panel for extensions
6. Search and pagination for large lists

**Out of Scope:**
- Extension installation (read-only for now)
- Marketplace integration (future feature)
- Extension development tools (future feature)

---

## Work Items

### P0: Extension Browser (cc-viz-9dx.1)

**Files to Create:**
- `frontend/src/pages/ExtensionWorkshop.tsx`
- `frontend/src/components/features/ExtensionBrowser.tsx`

**Uses**: `SearchInput`, `Card` from Design System

**Acceptance Criteria:**
- [ ] Grid view (default): 3 columns on desktop, 2 on tablet, 1 on mobile
- [ ] List view toggle: single column with more details
- [ ] View toggle button (grid/list icons)
- [ ] Global search bar at top
- [ ] Extension count shown: "184 extensions"
- [ ] Loading skeleton while fetching

**Technical Notes:**
- Use useExtensions() hook
- Store view preference in localStorage
- CSS Grid with auto-fit for responsive

---

### P1: Type & Status Filtering (cc-viz-9dx.2)

**Uses**: `Badge`, `Button` from Design System

**Files to Create:**
- `frontend/src/components/features/ExtensionFilters.tsx`

**Acceptance Criteria:**
- [ ] Type tabs: All | Agents | Commands | Skills | Hooks | MCP
- [ ] Each tab shows count badge
- [ ] Status filter dropdown: All, Enabled, Disabled
- [ ] Source filter: All, User, Plugin (by plugin name)
- [ ] Active filters shown as dismissible badges
- [ ] "Clear all" button when filters active
- [ ] Filters persist in URL params

**Technical Notes:**
- URL: `?type=agents&status=enabled&source=do@loom99`
- Multi-select for types (can show agents + skills)

---

### P2: Extension Card (cc-viz-9dx.3)

**Uses**: `Card`, `Badge`, `Button` from Design System

**Files to Create:**
- `frontend/src/components/features/ExtensionCard.tsx`

**Acceptance Criteria:**
- [ ] Icon (emoji or default icon based on type)
- [ ] Name (bold, clickable)
- [ ] Type badge: Agent, Command, Skill, Hook, MCP
- [ ] Source badge: User, Plugin name
- [ ] Description (2 lines max, truncated)
- [ ] Enable/disable toggle (right side)
- [ ] Hover state with subtle elevation
- [ ] Click card → opens detail drawer

**Technical Notes:**
- Toggle updates localStorage (no backend persistence yet)
- Use CVA for card variants (enabled/disabled styling)

---

### P3: Detail Drawer (cc-viz-9dx.4)

**Uses**: `DetailDrawer` from Design System

**Files to Create:**
- `frontend/src/components/features/ExtensionDetailDrawer.tsx`

**Acceptance Criteria:**
- [ ] Slides in from right (400px width)
- [ ] Header: Name, Type badge, Enable/disable toggle
- [ ] Full description (scrollable)
- [ ] Metadata: Source, Version (if available), Author
- [ ] "Edit" button → opens file in default editor (if user extension)
- [ ] "View Source" button → shows source path
- [ ] Related extensions section (same plugin/type)
- [ ] Close on Escape or click outside

**Technical Notes:**
- Use existing extension data structure
- "Edit" uses `code://` or `vscode://` URL scheme

---

### P4: Settings Panel (cc-viz-9dx.5)

**Files to Create:**
- `frontend/src/components/features/ExtensionSettings.tsx`

**Acceptance Criteria:**
- [ ] Tab or section in drawer for settings (if extension has config)
- [ ] Form fields generated from extension config schema
- [ ] Save/Cancel/Reset buttons
- [ ] Validation with error messages
- [ ] Success toast on save

**Technical Notes:**
- Most extensions don't have config yet - show "No settings available"
- If config exists, render dynamic form
- Store in localStorage for now (no backend)

---

### P5: Search & Pagination (cc-viz-9dx.6)

**Uses**: `SearchInput`, `DataList` from Design System

**Acceptance Criteria:**
- [ ] Search filters by: name, description, type, source
- [ ] Debounced search (300ms)
- [ ] Results count: "Showing 45 of 184 extensions"
- [ ] Virtualized list for performance (if >50 extensions)
- [ ] Infinite scroll or "Load more" button
- [ ] Empty state: "No extensions match your search"

**Technical Notes:**
- Client-side filtering (all extensions loaded)
- Use @tanstack/react-virtual if list view

---

## Dependencies

- **Blocks on**: Design System (cc-viz-3j1) - needs Card, Badge, DetailDrawer, SearchInput
- **API Ready**: useExtensions(), usePlugins(), useMarketplaces()

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Extension toggle without backend | Low | Low | localStorage persistence |
| Dynamic settings form complexity | Medium | Medium | Start with "no settings" state |
| Large extension list performance | Low | Low | Already have virtualization |

---

## Exit Criteria

Sprint is complete when:
- [ ] All 6 beads tasks (cc-viz-9dx.1 through cc-viz-9dx.6) are closed
- [ ] Extension browser shows all 184+ extensions
- [ ] Grid/list view toggle works
- [ ] Type tabs filter correctly with counts
- [ ] Enable/disable toggle persists (localStorage)
- [ ] Detail drawer shows full extension info
- [ ] Search filters extensions by name/description
- [ ] Performance acceptable with all extensions loaded
- [ ] UI works in both themes (dark/light)
