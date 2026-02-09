# Sprint: core-components - Replace Base UI Primitives

Generated: 2026-02-05
Confidence: HIGH: 8, MEDIUM: 0, LOW: 0
Status: READY FOR IMPLEMENTATION

## Sprint Goal

Replace all base UI components (`/components/ui/`) with Mantine equivalents while maintaining API compatibility where possible.

## Scope

**Deliverables:**
- Button component using Mantine Button
- Card components using Mantine Card/Paper
- Badge component using Mantine Badge
- Input component using Mantine TextInput
- Tabs component using Mantine Tabs
- SearchInput using Mantine TextInput + ActionIcon
- DetailDrawer using Mantine Drawer
- Modal components using Mantine Modal

## Work Items

### P0: Button Component [HIGH]

**Acceptance Criteria:**
- [ ] Button uses `@mantine/core` Button
- [ ] Variants mapped: primary→filled, secondary→outline, ghost→subtle, danger→filled+red
- [ ] Sizes mapped: sm, md, lg
- [ ] Loading state works with Mantine's loading prop
- [ ] All existing Button usages still work

**Files:**
- `frontend/src/components/ui/Button.tsx`

---

### P1: Card Components [HIGH]

**Acceptance Criteria:**
- [ ] Card uses Mantine Card or Paper
- [ ] CardHeader, CardTitle, CardDescription, CardContent, CardFooter preserved
- [ ] Variants (default, hover, clickable) mapped to Mantine props
- [ ] Padding variants work
- [ ] All existing Card usages render correctly

**Files:**
- `frontend/src/components/ui/Card.tsx`

---

### P2: Badge Component [HIGH]

**Acceptance Criteria:**
- [ ] Badge uses Mantine Badge
- [ ] Variants mapped: default, success, warning, error, info → Mantine colors
- [ ] Size variants work
- [ ] StatusBadge still works (uses Badge internally)

**Files:**
- `frontend/src/components/ui/Badge.tsx`
- `frontend/src/components/ui/StatusBadge.tsx`

---

### P3: Input Component [HIGH]

**Acceptance Criteria:**
- [ ] Input uses Mantine TextInput
- [ ] Label prop works
- [ ] Error state/message works
- [ ] Size variants (sm, md, lg) work
- [ ] Placeholder styling matches theme

**Files:**
- `frontend/src/components/ui/Input.tsx`

---

### P4: SearchInput Component [HIGH]

**Acceptance Criteria:**
- [ ] Uses Mantine TextInput with leftSection (search icon)
- [ ] Clear button via rightSection ActionIcon
- [ ] Debounced search behavior preserved
- [ ] Loading indicator works

**Files:**
- `frontend/src/components/ui/SearchInput.tsx`

---

### P5: Tabs Component [HIGH]

**Acceptance Criteria:**
- [ ] Uses Mantine Tabs
- [ ] Tab items with icons work
- [ ] Badge counts in tabs work
- [ ] Keyboard navigation preserved (Mantine handles this)
- [ ] Active indicator animation (Mantine built-in)

**Files:**
- `frontend/src/components/ui/Tabs.tsx`

---

### P6: DetailDrawer Component [HIGH]

**Acceptance Criteria:**
- [ ] Uses Mantine Drawer
- [ ] Opens from right side
- [ ] Close on escape works
- [ ] Backdrop click closes
- [ ] Custom width support

**Files:**
- `frontend/src/components/ui/DetailDrawer.tsx`

---

### P7: Modal Components (ConfirmDeleteModal, RequestCompareModal) [HIGH]

**Acceptance Criteria:**
- [ ] Use Mantine Modal
- [ ] ConfirmDeleteModal: confirmation input, delete action preserved
- [ ] RequestCompareModal: comparison display preserved
- [ ] Escape key closes
- [ ] Backdrop click behavior

**Files:**
- `frontend/src/components/features/ConfirmDeleteModal.tsx`
- `frontend/src/components/features/RequestCompareModal.tsx`

## Dependencies

- Sprint: foundation (Mantine installed and configured)

## Risks

| Risk | Mitigation |
|------|------------|
| API differences break consumers | Keep wrapper API, adapt internally |
| Styling inconsistencies | Use theme tokens consistently |
