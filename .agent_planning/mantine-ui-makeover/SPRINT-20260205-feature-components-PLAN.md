# Sprint: feature-components - Update Feature Components

Generated: 2026-02-05
Confidence: HIGH: 12, MEDIUM: 2, LOW: 0
Status: PARTIALLY READY

## Sprint Goal

Update all feature components to use Mantine components and styling, creating a cohesive visual design.

## Scope

**Deliverables:**
- Conversation components migrated
- Extension components migrated
- Session components migrated
- Data management components migrated
- Chart wrapper components styled with Mantine

## Work Items

### P0: Conversation Components [HIGH]

**Acceptance Criteria:**
- [ ] ConversationList uses Mantine List or custom with Mantine styling
- [ ] ConversationSearch uses Mantine TextInput
- [ ] ConversationThread uses Mantine Stack, Paper for messages
- [ ] Message styling consistent with theme

**Files:**
- `frontend/src/components/features/ConversationList.tsx`
- `frontend/src/components/features/ConversationSearch.tsx`
- `frontend/src/components/features/ConversationThread.tsx`

---

### P1: Extension Components [HIGH]

**Acceptance Criteria:**
- [ ] ExtensionBrowser uses Mantine Grid, filters
- [ ] ExtensionCard uses Mantine Card with proper styling
- [ ] ExtensionDetailDrawer uses Mantine Drawer (from core-components)
- [ ] ExtensionFilters uses Mantine Select, Checkbox, etc.

**Files:**
- `frontend/src/components/features/ExtensionBrowser.tsx`
- `frontend/src/components/features/ExtensionCard.tsx`
- `frontend/src/components/features/ExtensionDetailDrawer.tsx`
- `frontend/src/components/features/ExtensionFilters.tsx`

---

### P2: Session Components [HIGH]

**Acceptance Criteria:**
- [ ] SessionListPanel uses Mantine Stack, ScrollArea
- [ ] SessionListSidebar uses Mantine NavLink or List
- [ ] SessionDetailPanel uses Mantine Paper, Stack, Grid
- [ ] SessionEventTimeline uses custom Timeline (Mantine Timeline if fits)

**Files:**
- `frontend/src/components/features/SessionListPanel.tsx`
- `frontend/src/components/features/SessionListSidebar.tsx`
- `frontend/src/components/features/SessionDetailPanel.tsx`
- `frontend/src/components/features/SessionEventTimeline.tsx`

---

### P3: Data Management Components [HIGH]

**Acceptance Criteria:**
- [ ] DataManagementBar uses Mantine Group, ActionIcon
- [ ] RefreshButton uses Mantine ActionIcon with Loader
- [ ] CompareModeBanner uses Mantine Alert or Paper
- [ ] AnomalyAlerts uses Mantine Alert

**Files:**
- `frontend/src/components/features/DataManagementBar.tsx`
- `frontend/src/components/features/RefreshButton.tsx`
- `frontend/src/components/features/CompareModeBanner.tsx`
- `frontend/src/components/features/AnomalyAlerts.tsx`

---

### P4: Chart Components Wrapper Updates [HIGH]

**Acceptance Criteria:**
- [ ] ChartWrapper uses Mantine Paper, Title, Text
- [ ] StatCard uses Mantine Card with proper styling
- [ ] TrendIndicator uses Mantine Badge or Text with color
- [ ] DateNavigation uses Mantine ActionIcon, Text
- [ ] Keep Recharts internals unchanged

**Files:**
- `frontend/src/components/charts/ChartWrapper.tsx`
- `frontend/src/components/charts/StatCard.tsx`
- `frontend/src/components/charts/TrendIndicator.tsx`
- `frontend/src/components/charts/DateNavigation.tsx`

---

### P5: DataList Component [MEDIUM]

**Acceptance Criteria:**
- [ ] Uses Mantine Table styling
- [ ] TanStack Virtual integration preserved
- [ ] Sortable headers with Mantine styling
- [ ] Selected row highlighting
- [ ] Keyboard navigation preserved

**Technical Notes:**
- Mantine Table is not virtualized by default
- Keep TanStack Virtual, use Mantine styling
- May need hybrid approach

#### Unknowns to Resolve
- Best way to combine TanStack Virtual with Mantine Table styling

#### Exit Criteria
- Virtualization works with 1000+ rows
- Mantine-consistent styling applied

**Files:**
- `frontend/src/components/ui/DataList.tsx`

---

### P6: Timeline Component [MEDIUM]

**Acceptance Criteria:**
- [ ] Consider Mantine Timeline component
- [ ] If Mantine Timeline fits: use it
- [ ] If not: use Mantine primitives (Paper, Group, Text)
- [ ] Expandable details work
- [ ] Event type icons styled

#### Unknowns to Resolve
- Whether Mantine Timeline meets our requirements
- Custom vs Mantine Timeline decision

#### Exit Criteria
- Timeline displays events correctly
- Mantine-consistent styling

**Files:**
- `frontend/src/components/ui/Timeline.tsx`

---

### P7: Utility Components [HIGH]

**Acceptance Criteria:**
- [ ] CopyButton uses Mantine ActionIcon, Tooltip
- [ ] CopyableId uses Mantine Code, CopyButton
- [ ] CodeViewer uses Mantine Code or Prism
- [ ] Link uses standard anchor with Mantine styling
- [ ] ErrorBoundary unchanged (logic only)

**Files:**
- `frontend/src/components/ui/CopyButton.tsx`
- `frontend/src/components/ui/CopyableId.tsx`
- `frontend/src/components/ui/CodeViewer.tsx`
- `frontend/src/components/ui/Link.tsx`
- `frontend/src/components/ui/ErrorBoundary.tsx`

---

### P8: Message Content Components [HIGH]

**Acceptance Criteria:**
- [ ] MessageContent uses Mantine Text, Paper
- [ ] TextContent uses Mantine Text
- [ ] ImageContent uses Mantine Image
- [ ] SystemReminder uses Mantine Alert
- [ ] FunctionDefinitions uses Mantine Code, List

**Files:**
- `frontend/src/components/ui/MessageContent.tsx`
- `frontend/src/components/ui/TextContent.tsx`
- `frontend/src/components/ui/ImageContent.tsx`
- `frontend/src/components/ui/SystemReminder.tsx`
- `frontend/src/components/ui/FunctionDefinitions.tsx`

---

### P9: Tool Display Components [HIGH]

**Acceptance Criteria:**
- [ ] ToolUseContainer uses Mantine Paper, Collapse
- [ ] ToolInputGeneric uses Mantine Code
- [ ] ToolResultContent uses Mantine Paper, Text
- [ ] All specific tools (Bash, Edit, etc.) use Mantine Code, Text
- [ ] FileListContent uses Mantine List

**Files:**
- `frontend/src/components/ui/tools/ToolUseContainer.tsx`
- `frontend/src/components/ui/tools/ToolInputGeneric.tsx`
- `frontend/src/components/ui/tools/ToolResultContent.tsx`
- `frontend/src/components/ui/tools/tools/*.tsx` (8 files)

## Dependencies

- Sprint: foundation
- Sprint: core-components
- Sprint: layout-shell

## Risks

| Risk | Mitigation |
|------|------------|
| DataList virtualization complexity | Keep TanStack Virtual, apply Mantine styling |
| Many files to update | Systematic file-by-file approach |
