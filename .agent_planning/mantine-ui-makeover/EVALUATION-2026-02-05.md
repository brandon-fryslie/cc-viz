# Evaluation: Mantine UI Makeover

**Date:** 2026-02-05
**Topic:** Complete frontend migration from custom Tailwind/CVA components to Mantine UI

## Current State Assessment

### Architecture Overview
- **Framework:** React 19 + Vite 7.2
- **Routing:** TanStack Router v1.143.4
- **Data Fetching:** TanStack Query v5
- **Current Styling:** Tailwind CSS v4.1 + CVA (class-variance-authority)
- **Icons:** lucide-react (Mantine compatible)
- **Charts:** Recharts v3.6 (will be retained)

### Component Inventory

**Base UI Components (15):** Button, Card, Badge, Input, Tabs, SearchInput, DetailDrawer, DataList, Timeline, CopyButton, CopyableId, CodeViewer, Link, StatusBadge, ErrorBoundary

**Feature Components (16):** AnomalyAlerts, CompareModeBanner, ConfirmDeleteModal, ConversationList, ConversationSearch, ConversationThread, DataManagementBar, ExtensionBrowser, ExtensionCard, ExtensionDetailDrawer, ExtensionFilters, RefreshButton, RequestCompareModal, SessionDetailPanel, SessionEventTimeline, SessionListPanel

**Layout Components (4):** AppLayout, Sidebar, ResizablePanel, GlobalDatePicker

**Chart Components (12):** ChartWrapper, StatCard, TrendIndicator, DailyBurnChart, HourlyUsageChart, WeeklyUsageChart, ModelBreakdownChart, ModelComparisonBar, PerformanceChart, ProjectBreakdownChart, DateNavigation

**Tool Display Components (10):** BashTool, EditTool, GlobTool, GrepTool, ReadTool, TaskTool, TodoWriteTool, WriteTool, ToolUseContainer, ToolInputGeneric

**Pages (22):** Home, Dashboard, Requests, Conversations, ExtensionsHub, ExtensionWorkshop, PluginView, SessionData, TodosSearch, PlansSearch, TokenEconomics, MissionControl, SessionTimeline, CockpitView, Projects, Routing, Configuration, Performance, ClaudeConfig, Settings, ToolsDemo, Usage

### Design Token System
Current tokens in `index.css`:
- Colors: 16 semantic colors (backgrounds, text, borders, accents, semantic)
- Spacing: 16-point scale
- Typography: 8 sizes, 4 weights
- Shadows: 4 elevation levels
- Border radius: 5 variants
- **Dark mode only** (no light mode)

## Verdict: CONTINUE

No blockers. The codebase is well-structured for migration:
1. Clean component hierarchy with clear separation
2. Consistent CVA patterns easily map to Mantine components
3. Design tokens translate directly to Mantine theme
4. TanStack Router/Query are independent of UI layer

## Migration Strategy

### Approach: Component-by-Component Migration with Wrapper Pattern

**Phase 1 - Foundation:** Install Mantine, configure theme, create provider
**Phase 2 - Core Components:** Replace base UI primitives with Mantine equivalents
**Phase 3 - Feature Components:** Update feature components to use Mantine
**Phase 4 - Pages:** Update all pages with Mantine layouts/components
**Phase 5 - Polish:** Remove Tailwind, cleanup, optimize

### Mantine Component Mapping

| Current | Mantine Equivalent |
|---------|-------------------|
| Button | `@mantine/core` Button |
| Card | `@mantine/core` Card, Paper |
| Badge | `@mantine/core` Badge |
| Input | `@mantine/core` TextInput |
| Tabs | `@mantine/core` Tabs |
| SearchInput | `@mantine/core` TextInput + ActionIcon |
| DetailDrawer | `@mantine/core` Drawer |
| DataList | `@mantine/core` Table + TanStack Virtual |
| Timeline | `@mantine/core` Timeline |
| Modal | `@mantine/core` Modal |
| Sidebar | `@mantine/core` AppShell.Navbar |

### Theme Configuration
Mantine theme will inherit current design tokens:
- Dark color scheme (primaryShade: 7)
- Blue primary color (#3b82f6)
- Custom spacing scale
- Custom font sizes
- Custom radius scale

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Large diff, hard to review | Sprint-based incremental migration |
| Breaking changes | Maintain working app at each sprint |
| Mantine learning curve | Well-documented, similar patterns |
| Custom components (Timeline, DataList) | Use Mantine primitives + hooks |

## Estimated Scope

- **~70 component files** need modification
- **~22 page files** need modification
- **1 new file** (MantineProvider setup)
- **1 modified file** (package.json)
- **1 optional removal** (can remove Tailwind after migration)
