# Sprint: layout-shell - App Layout with Mantine AppShell

Generated: 2026-02-05
Confidence: HIGH: 4, MEDIUM: 1, LOW: 0
Status: PARTIALLY READY

## Sprint Goal

Replace custom layout components with Mantine AppShell for consistent, polished navigation and page structure.

## Scope

**Deliverables:**
- Sidebar using Mantine AppShell.Navbar with NavLink
- AppLayout using Mantine AppShell
- ResizablePanel using Mantine or custom implementation
- GlobalDatePicker using Mantine DatePickerInput

## Work Items

### P0: Sidebar with Mantine AppShell.Navbar [HIGH]

**Acceptance Criteria:**
- [ ] Sidebar uses AppShell.Navbar
- [ ] Collapsible behavior preserved (240px → 48px)
- [ ] Section headers styled appropriately
- [ ] NavLink items with icons
- [ ] Active item highlighting with accent color
- [ ] Badge counts on items
- [ ] Footer "Viz running" indicator

**Technical Notes:**
- Use Mantine NavLink for navigation items
- AppShell.Navbar handles collapsed state
- Preserve existing nav structure

**Files:**
- `frontend/src/components/layout/Sidebar.tsx`

---

### P1: AppLayout with AppShell [HIGH]

**Acceptance Criteria:**
- [ ] Uses Mantine AppShell as root layout
- [ ] Navbar slot for Sidebar
- [ ] Main content area
- [ ] Title/description header area
- [ ] Responsive behavior

**Files:**
- `frontend/src/components/layout/AppLayout.tsx`

---

### P2: GlobalDatePicker with Mantine DatePickerInput [HIGH]

**Acceptance Criteria:**
- [ ] Uses @mantine/dates DatePickerInput
- [ ] Date range selection works
- [ ] Integrates with DateRangeContext
- [ ] Dark theme styled
- [ ] Preset ranges (Today, Yesterday, Last 7 days, etc.)

**Files:**
- `frontend/src/components/layout/GlobalDatePicker.tsx`

---

### P3: ResizablePanel [MEDIUM]

**Acceptance Criteria:**
- [ ] Draggable divider for resizing
- [ ] Min/max constraints
- [ ] Smooth resize behavior
- [ ] Cursor feedback on hover

**Technical Notes:**
- Mantine doesn't have a resizable panel component
- Options: keep custom implementation with Mantine styling, or use @mantine/hooks useResize
- May need to research best approach

#### Unknowns to Resolve
- Best approach for resize functionality with Mantine
- Whether to use a third-party library or custom hooks

#### Exit Criteria
- Decision made on implementation approach
- Working resize with consistent styling

**Files:**
- `frontend/src/components/layout/ResizablePanel.tsx`

---

### P4: Update Route Layout [HIGH]

**Acceptance Criteria:**
- [ ] Root layout uses AppShell
- [ ] All routes render within AppShell.Main
- [ ] Navigation state managed correctly

**Files:**
- `frontend/src/routes/__root.tsx` (or equivalent root route)

## Dependencies

- Sprint: foundation
- Sprint: core-components (for Button, etc. used in layout)

## Risks

| Risk | Mitigation |
|------|------------|
| ResizablePanel complexity | Keep custom if needed, style with Mantine |
| AppShell learning curve | Well documented, similar patterns |
