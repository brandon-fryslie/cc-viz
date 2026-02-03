# Definition of Done: design-system Sprint

**Epic**: cc-viz-3j1
**Sprint**: Design System & Component Library

---

## Acceptance Criteria Summary

### 1. Design Tokens (cc-viz-3j1.1)

| Criterion | Test Method |
|-----------|-------------|
| Light mode colors defined | Check `index.css` has `html.light` or media query overrides |
| Spacing scale complete | Verify variables: `--space-1` through `--space-16` |
| Typography scale complete | Verify variables: `--text-xs` through `--text-3xl` |
| Shadow system defined | Verify variables: `--shadow-sm`, `--shadow-md`, `--shadow-lg` |
| Border radius tokens | Verify variables: `--radius-sm`, `--radius-md`, `--radius-lg` |
| Transition tokens | Verify variables: `--duration-fast`, `--duration-base`, `--duration-slow` |

### 2. Base Components (cc-viz-3j1.2)

| Criterion | Test Method |
|-----------|-------------|
| Button renders all variants | Visual check: primary, secondary, ghost, danger |
| Button renders all sizes | Visual check: sm, md, lg |
| Button disabled state works | Click disabled button, verify no action |
| Input accepts text | Type in input, verify value |
| Input shows error state | Pass error prop, verify red border |
| Card renders with slots | Check header, content, footer render |
| Badge shows all colors | Visual check: default, success, warning, error |
| Components use tokens | Inspect CSS, verify no hardcoded colors |
| CVA variants work | Change variant prop, verify class changes |

### 3. Data Visualization (cc-viz-3j1.3)

| Criterion | Test Method |
|-----------|-------------|
| StatCard uses design tokens | Inspect CSS, verify token usage |
| StatCard trend indicator works | Pass positive/negative trend, verify arrow |
| ChartWrapper shows loading | Pass isLoading, verify skeleton |
| ChartWrapper shows error | Pass error, verify message |
| Charts respect theme | Switch theme, verify colors update |

### 4. Layout Components (cc-viz-3j1.4)

| Criterion | Test Method |
|-----------|-------------|
| DataList virtualizes | Render 10K items, check DOM has ~20 elements |
| DataList sorts on column click | Click column header, verify order changes |
| DataList filters | Type in filter, verify rows reduce |
| DataList keyboard nav | Press arrow keys, verify selection moves |
| DetailDrawer slides in | Open drawer, verify animation |
| DetailDrawer closes on escape | Press Escape, verify drawer closes |
| DetailDrawer has backdrop | Open drawer, verify backdrop visible |
| Timeline shows events | Pass events, verify rendered |
| Timeline filterable | Toggle event type, verify filtering |
| Timeline expands details | Click event, verify details shown |

### 5. Theme System (cc-viz-3j1.5)

| Criterion | Test Method |
|-----------|-------------|
| ThemeProvider wraps app | Check router.tsx |
| useTheme hook works | Call hook, verify theme value |
| Dark mode displays | Set theme='dark', verify dark colors |
| Light mode displays | Set theme='light', verify light colors |
| System mode respects OS | Set theme='system', match OS preference |
| Theme persists in localStorage | Switch theme, refresh, verify same |
| ThemeToggle in Settings | Navigate to Settings, verify toggle |
| No flash on load | Refresh page, verify no white flash |

### 6. Utility Patterns (cc-viz-3j1.6)

| Criterion | Test Method |
|-----------|-------------|
| SearchInput debounces | Type quickly, verify single callback |
| SearchInput has clear button | Enter text, click X, verify cleared |
| CopyableId truncates | Pass long ID, verify middle truncation |
| CopyableId copies on click | Click, paste elsewhere, verify copied |
| StatusBadge variants | Render pending/in_progress/completed |
| Tabs show active state | Click tab, verify indicator moves |
| Tabs support badges | Pass count, verify badge shows |
| Tabs keyboard nav | Press arrow keys, verify tab changes |

---

## Quality Gates

### Code Quality
- [ ] No TypeScript errors (`pnpm typecheck`)
- [ ] No ESLint warnings (`pnpm lint`)
- [ ] All components have TypeScript props interface
- [ ] All public props have JSDoc comments
- [ ] No hardcoded colors (except in token definitions)

### Performance
- [ ] DataList renders 1000+ items at 60fps
- [ ] Theme switch completes in <200ms
- [ ] No layout shifts on page load
- [ ] Bundle size increase <50KB

### Accessibility
- [ ] All interactive elements have focus states
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Keyboard navigation works for all components
- [ ] Screen reader announces state changes

### Browser Compatibility
- [ ] Works in Chrome (latest)
- [ ] Works in Firefox (latest)
- [ ] Works in Safari (latest)
- [ ] No console errors in any browser

---

## Beads Task Closure Checklist

Close each task when its criteria are met:

```bash
# After Design Tokens complete
bd close cc-viz-3j1.1 --reason "Design tokens implemented: colors, spacing, typography, shadows, radius, transitions"

# After Base Components complete
bd close cc-viz-3j1.2 --reason "Button, Input, Card, Badge components with CVA variants"

# After Data Viz complete
bd close cc-viz-3j1.3 --reason "StatCard refactored, ChartWrapper created, TrendIndicator extracted"

# After Layout Components complete
bd close cc-viz-3j1.4 --reason "DataList, DetailDrawer, Timeline implemented with full features"

# After Theme System complete
bd close cc-viz-3j1.5 --reason "ThemeProvider, dark/light/system modes, localStorage persistence"

# After Utility Patterns complete
bd close cc-viz-3j1.6 --reason "SearchInput, CopyableId, StatusBadge, Tabs implemented"

# After all tasks complete
bd close cc-viz-3j1 --reason "Design System epic complete - all components ready for feature sprints"
```

---

## Sprint Complete When

1. All 6 child tasks (cc-viz-3j1.1 - cc-viz-3j1.6) closed in beads
2. All quality gates pass
3. Theme switching works end-to-end
4. Components documented with usage examples
5. Feature sprints can begin using these components
