# Sprint: design-system - Design System & Component Library

**Generated**: 2026-01-20
**Epic**: cc-viz-3j1
**Confidence**: HIGH
**Status**: READY FOR IMPLEMENTATION
**Priority**: P1 (High) - BLOCKING all other sprints

---

## Sprint Goal

Build the foundational design system including design tokens, base UI components, layout components, theme system, and utility patterns that enable all 5 showcase UI views to share a consistent visual language.

---

## Scope

**Deliverables:**
1. Design tokens (colors, typography, spacing) in CSS variables
2. Base component library (Button, Input, Card) with variants
3. Data visualization components (enhanced StatCard, ChartWrapper)
4. Layout components (DataList, DetailDrawer, Timeline)
5. Theme system (dark/light switching with persistence)
6. Shared utility patterns (CopyableId, SearchInput, StatusBadge, Tabs)

**Out of Scope:**
- Feature-specific components (those go in feature epics)
- Backend changes (none needed)
- Testing infrastructure (optional, defer if blocking)

---

## Work Items

### P0: Design Tokens (cc-viz-3j1.1)

**Files to Modify:**
- `frontend/src/index.css` - Add to @theme block

**Acceptance Criteria:**
- [ ] Light mode color palette defined (mirroring dark mode)
- [ ] Spacing scale: 2px, 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px
- [ ] Typography scale: 12px, 13px, 14px, 16px, 18px, 24px, 32px with weights
- [ ] Shadow/elevation: elevation-1, elevation-2, elevation-3
- [ ] Border radius: radius-sm (4px), radius-md (8px), radius-lg (12px), radius-full
- [ ] Transition timings: transition-fast (150ms), transition-base (200ms), transition-slow (300ms)

**Technical Notes:**
- Use `@theme` block in Tailwind v4 format
- Define both `--color-*` (dark) and light mode overrides via `@media (prefers-color-scheme: light)`
- Add class-based override: `html.light` for manual toggle

---

### P1: Base Components (cc-viz-3j1.2)

**Files to Create:**
- `frontend/src/components/ui/Button.tsx`
- `frontend/src/components/ui/Input.tsx`
- `frontend/src/components/ui/Card.tsx`
- `frontend/src/components/ui/Badge.tsx`

**Acceptance Criteria:**
- [ ] Button: variants (primary, secondary, ghost, danger), sizes (sm, md, lg), disabled state
- [ ] Input: text, search, number types; placeholder, error state, disabled state
- [ ] Card: header, content, footer slots; hover state; clickable variant
- [ ] Badge: color variants (default, success, warning, error, info), sizes (sm, md)
- [ ] All components use design tokens (not hardcoded colors)
- [ ] All components use CVA (class-variance-authority) for variants
- [ ] TypeScript props fully typed with JSDoc comments

**Technical Notes:**
- Use CVA pattern from existing codebase (cva function imported)
- Follow Tailwind v4 + @theme variable naming
- Components should be pure/controlled with forwarded refs
- Use `cn()` utility for class merging

---

### P2: Data Visualization Components (cc-viz-3j1.3)

**Files to Modify:**
- `frontend/src/components/charts/StatCard.tsx` - Refactor to use tokens

**Files to Create:**
- `frontend/src/components/charts/ChartWrapper.tsx`
- `frontend/src/components/charts/TrendIndicator.tsx`

**Acceptance Criteria:**
- [ ] StatCard refactored: uses design tokens, improved trend display
- [ ] ChartWrapper: consistent padding, loading state, error state, theme-aware colors
- [ ] TrendIndicator: extracted from StatCard, reusable (up, down, neutral)
- [ ] All chart components respect theme (dark/light)

**Technical Notes:**
- Recharts colors should reference CSS variables where possible
- Use `getComputedStyle` or CSS custom properties for dynamic theming

---

### P3: Layout Components (cc-viz-3j1.4)

**Files to Create:**
- `frontend/src/components/ui/DataList.tsx`
- `frontend/src/components/ui/DetailDrawer.tsx`
- `frontend/src/components/ui/Timeline.tsx`

**Acceptance Criteria:**
- [ ] DataList: virtualized with @tanstack/react-virtual, sortable columns, filterable, search
- [ ] DataList: keyboard navigation (arrow keys, enter to select)
- [ ] DetailDrawer: slide from right, 400px width, backdrop overlay, close on escape
- [ ] DetailDrawer: animation (transform + opacity transition)
- [ ] Timeline: vertical event display with timestamps
- [ ] Timeline: event icons (customizable), expandable details
- [ ] Timeline: filter by event type

**Technical Notes:**
- DataList should use `useVirtualizer` from @tanstack/react-virtual
- DetailDrawer use CSS `transform: translateX()` for slide animation
- Timeline is custom HTML/CSS (not Recharts)

---

### P4: Theme System (cc-viz-3j1.5)

**Files to Create:**
- `frontend/src/lib/ThemeContext.tsx`
- `frontend/src/components/ui/ThemeToggle.tsx`

**Files to Modify:**
- `frontend/src/router.tsx` - Wrap with ThemeProvider
- `frontend/src/index.css` - Add theme class selectors

**Acceptance Criteria:**
- [ ] ThemeProvider context with useTheme hook
- [ ] Theme options: 'dark', 'light', 'system'
- [ ] localStorage persistence (key: 'cc-viz-theme')
- [ ] System preference detection via matchMedia
- [ ] ThemeToggle component (icon button with dropdown)
- [ ] Smooth transition when switching (no flash)
- [ ] Add to Settings page

**Technical Notes:**
- Apply theme via `html` class: `html.dark`, `html.light`
- Use `prefers-color-scheme` media query for 'system' mode
- Transition: `transition: background-color 0.2s, color 0.2s`

---

### P5: Utility Patterns (cc-viz-3j1.6)

**Files to Create:**
- `frontend/src/components/ui/SearchInput.tsx`
- `frontend/src/components/ui/CopyableId.tsx`
- `frontend/src/components/ui/StatusBadge.tsx`
- `frontend/src/components/ui/Tabs.tsx`

**Acceptance Criteria:**
- [ ] SearchInput: debounced (300ms), clear button, loading indicator, icon prefix
- [ ] CopyableId: middle truncation (show first 8 + last 4 chars), click-to-copy, tooltip
- [ ] StatusBadge: variants for todo status (pending, in_progress, completed)
- [ ] Tabs: horizontal, active indicator, badge counts, keyboard navigation
- [ ] All use design tokens and are theme-aware

**Technical Notes:**
- SearchInput use custom `useDebouncedValue` hook
- CopyableId use existing `useCopyToClipboard` hook
- Tabs: use controlled component pattern with `value`/`onChange`

---

## Dependencies

- None (this is the foundation sprint)
- Blocks: All 5 feature sprints

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Over-engineering components | Medium | High | Keep simple, build what's needed |
| Theme flash on page load | Low | Medium | Use blocking script in HTML head |
| DataList performance issues | Low | Medium | Profile with 10K+ items |

---

## Implementation Order

1. **Day 1-2**: Design tokens (P0) - Must be first
2. **Day 3-4**: Base components (P1) - Button, Input, Card, Badge
3. **Day 5**: Theme system (P4) - Provider + toggle
4. **Day 6-7**: Layout components (P3) - DataList, DetailDrawer, Timeline
5. **Day 8**: Data viz components (P2) - StatCard refactor, ChartWrapper
6. **Day 9**: Utility patterns (P5) - SearchInput, CopyableId, Tabs
7. **Day 10**: Integration testing + polish

---

## Exit Criteria

Sprint is complete when:
- [ ] All 6 beads tasks (cc-viz-3j1.1 through cc-viz-3j1.6) are closed
- [ ] Theme switching works (dark/light/system)
- [ ] All components use design tokens (no hardcoded colors)
- [ ] DataList handles 1000+ items without jank
- [ ] DetailDrawer animates smoothly
- [ ] Components are documented (JSDoc + usage examples in comments)
