# Sprint: pages-polish - Update All Pages & Final Polish

Generated: 2026-02-05
Confidence: HIGH: 6, MEDIUM: 0, LOW: 0
Status: READY FOR IMPLEMENTATION

## Sprint Goal

Update all 22 pages to use Mantine layout components, remove Tailwind dependencies, and achieve a polished, sleek final appearance.

## Scope

**Deliverables:**
- All pages updated with Mantine Stack, Grid, Container, etc.
- Inline Tailwind classes replaced with Mantine styling
- Tailwind removed from dependencies
- Final visual polish pass
- UnifiedSearchModal updated

## Work Items

### P0: Core Pages [HIGH]

**Acceptance Criteria:**
- [ ] Home.tsx: Grid layout, Card components, styled hero section
- [ ] Dashboard.tsx: Grid for stats, proper spacing
- [ ] Requests.tsx: Split panel layout, DataList styling
- [ ] Conversations.tsx: Three-panel layout clean

**Technical Notes:**
- Use Mantine Container for max-width
- Use Mantine Stack for vertical layouts
- Use Mantine Grid for multi-column layouts
- Use Mantine SimpleGrid for equal columns

**Files:**
- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Requests.tsx`
- `frontend/src/pages/Conversations.tsx`

---

### P1: Showcase Pages [HIGH]

**Acceptance Criteria:**
- [ ] MissionControl.tsx: Subagent graph display polished
- [ ] CockpitView.tsx: Real-time dashboard styled
- [ ] TokenEconomics.tsx: Charts and stats polished
- [ ] SessionTimeline.tsx: Timeline display clean
- [ ] ExtensionWorkshop.tsx: Workshop layout polished

**Files:**
- `frontend/src/pages/MissionControl.tsx`
- `frontend/src/pages/CockpitView.tsx`
- `frontend/src/pages/TokenEconomics.tsx`
- `frontend/src/pages/SessionTimeline.tsx`
- `frontend/src/pages/ExtensionWorkshop.tsx`

---

### P2: Extension & Plugin Pages [HIGH]

**Acceptance Criteria:**
- [ ] ExtensionsHub.tsx: Grid layout for extensions
- [ ] PluginView.tsx: Plugin cards and details

**Files:**
- `frontend/src/pages/ExtensionsHub.tsx`
- `frontend/src/pages/PluginView.tsx`

---

### P3: Data & Session Pages [HIGH]

**Acceptance Criteria:**
- [ ] SessionData.tsx: Tab navigation, data panels
- [ ] TodosSearch.tsx: Search and list layout
- [ ] PlansSearch.tsx: Search and list layout

**Files:**
- `frontend/src/pages/SessionData.tsx`
- `frontend/src/pages/TodosSearch.tsx`
- `frontend/src/pages/PlansSearch.tsx`

---

### P4: Configuration Pages [HIGH]

**Acceptance Criteria:**
- [ ] ClaudeConfig.tsx: Config display polished
- [ ] Configuration.tsx: Settings layout
- [ ] Settings.tsx: Form layout with Mantine inputs
- [ ] Routing.tsx: Routing config display
- [ ] Performance.tsx: Metrics display
- [ ] Projects.tsx: Project list/grid
- [ ] Usage.tsx: Usage stats display
- [ ] ToolsDemo.tsx: Demo showcase

**Files:**
- `frontend/src/pages/ClaudeConfig.tsx`
- `frontend/src/pages/Configuration.tsx`
- `frontend/src/pages/Settings.tsx`
- `frontend/src/pages/Routing.tsx`
- `frontend/src/pages/Performance.tsx`
- `frontend/src/pages/Projects.tsx`
- `frontend/src/pages/Usage.tsx`
- `frontend/src/pages/ToolsDemo.tsx`

---

### P5: UnifiedSearchModal [HIGH]

**Acceptance Criteria:**
- [ ] Uses Mantine Modal
- [ ] Spotlight-like search interface
- [ ] Keyboard navigation
- [ ] Results display polished

**Files:**
- `frontend/src/components/UnifiedSearchModal.tsx`

---

### P6: Remove Tailwind & Cleanup [HIGH]

**Acceptance Criteria:**
- [ ] All Tailwind classes removed from components
- [ ] `tailwindcss` removed from package.json
- [ ] `@tailwindcss/vite` removed
- [ ] postcss.config updated (Mantine only)
- [ ] index.css simplified (keep custom animations if needed)
- [ ] `class-variance-authority` removed if unused
- [ ] `tailwind-merge` removed
- [ ] `cn()` utility updated or removed

**Files:**
- `frontend/package.json`
- `frontend/postcss.config.cjs`
- `frontend/src/index.css`
- `frontend/src/lib/utils.ts`

---

### P7: Final Visual Polish [HIGH]

**Acceptance Criteria:**
- [ ] Consistent spacing throughout app
- [ ] All hover states feel responsive
- [ ] Focus states accessible
- [ ] Scrollbars styled (Mantine ScrollArea where appropriate)
- [ ] Loading states consistent (Mantine Loader, Skeleton)
- [ ] Empty states polished
- [ ] Error states use Mantine Alert

**Technical Notes:**
- Review each page for visual consistency
- Check dark mode throughout
- Verify all interactive states

## Dependencies

- Sprint: foundation
- Sprint: core-components
- Sprint: layout-shell
- Sprint: feature-components

## Risks

| Risk | Mitigation |
|------|------------|
| Removing Tailwind breaks styling | Do incrementally, verify each page |
| 22 pages is many files | Systematic approach, similar patterns |
