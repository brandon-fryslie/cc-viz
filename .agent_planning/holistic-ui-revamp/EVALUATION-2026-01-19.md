# CC-VIZ Frontend UI Revamp Evaluation
**Date**: 2026-01-19
**Scope**: Complete frontend architecture review and revamp planning

## EXECUTIVE SUMMARY

CC-VIZ is a data cockpit with 18 pages, scattered across the information architecture. While the foundation is solid (React 19, TanStack Router, Recharts, Tailwind CSS with dark theme), the UI suffers from:

1. **Fragmented Information Architecture**: Pages exist but aren't cohesively organized around user workflows
2. **Inconsistent Component Patterns**: Mix of PageHeader/AppLayout patterns; duplicate UI concepts
3. **Missing Visual Hierarchy**: Limited distinction between primary/secondary/tertiary content
4. **Poor Cross-Page Navigation**: Incomplete linkage between related data (requests, conversations, extensions, session data)
5. **Premature Page Proliferation**: Many single-purpose pages that should be unified views or modal dialogs
6. **Limited Data Integration**: Search results, charts, and details are siloed rather than interconnected

---

## SECTION 1: CURRENT UI STRUCTURE

### 1.1 Router Architecture
**File**: `frontend/src/router.tsx`

**Routes Defined** (13 primary routes):
- `/` - Home (hub/dashboard)
- `/requests` - API request logs
- `/requests/$id` - Request detail
- `/conversations` - Conversation browser
- `/conversations/$id` - Conversation detail
- `/extensions` - Extensions Hub
- `/extensions/$id` - Plugin view
- `/plugins` - Plugins/Marketplaces
- `/session-data` - Todos & plans
- `/todos-search` - Todo search (NEW)
- `/plans-search` - Plan search (NEW)
- `/settings` - Settings
- `/claude-config` - Claude configuration

**Root Layout**: Sidebar + global date picker header + unified search modal (Cmd+Shift+K)

**Issues**:
- Routes `/todos-search` and `/plans-search` duplicate functionality that should be in `/session-data` with tabs/filters
- `/extensions/$id` and `/plugins` conflict on purpose and route handling
- No breadcrumb navigation between related pages
- No way to filter/search across pages within the same view

### 1.2 Pages Inventory (18 Pages)

| Page | Purpose | Status | Issues |
|------|---------|--------|--------|
| **Home.tsx** | Hub with category cards | ✓ | Generic overview, no stats |
| **Requests.tsx** | Request CRUD, compare | ✓ | Dual-pane but tight vertical space |
| **Conversations.tsx** | Conversation browser | ✓ | Mixed file vs DB format toggle, confusing |
| **SessionData.tsx** | Todos & Plans | ✓ | Overcrowded, bad UX for large datasets |
| **TodosSearch.tsx** | TODO search | ✓ | Should merge with SessionData |
| **PlansSearch.tsx** | Plan search | ✓ | Should merge with SessionData |
| **ExtensionsHub.tsx** | Extension browser | ✓ | Basic filtering, no detail view |
| **PluginView.tsx** | Plugin details | ✓ | Overlaps with extensions |
| **Settings.tsx** | Theme, preferences | ✓ | Basic, no validation |
| **ClaudeConfig.tsx** | Config viewer | ✓ | Read-only, not integrated |
| **Dashboard.tsx** | Stats & charts | ✓ | Only hourly/provider data |
| **Usage.tsx** | Token/model stats | ✓ | Weekly breakdown, not per-project |
| **Performance.tsx** | Latency/p95/p99 | ✓ | Limited to provider level |
| **Routing.tsx** | Routing config | ✓ | Experimental, incomplete |
| **Projects.tsx** | Project browser | ✓ | Unused in current nav |
| **Configuration.tsx** | Config browser | ✓ | Unused in current nav |
| **ToolsDemo.tsx** | Component showcase | ✗ | Debug page, should not be in prod |

**Summary**: 18 pages, many overlapping/redundant purposes. Navigation structure doesn't map to user mental models.

### 1.3 Sidebar Navigation Structure
**File**: `frontend/src/components/layout/Sidebar.tsx`

**Sections** (4):
1. **Overview**: Home, Requests
2. **Conversations**: Conversations, Session Data
3. **Extensions**: Extensions Hub, Plugins
4. **Configuration**: Claude Config, Settings

**Issues**:
- Todos/Plans are under "Conversations" but are standalone data types
- No visual indicators for data counts (e.g., "184 extensions", "1,378 todos")
- Collapsed mode only shows icons - bad for discoverability
- No bookmarks or favorites
- No recent items section

### 1.4 Component Architecture

**Layout Components** (`components/layout/`):
- `AppLayout.tsx` - Legacy wrapper (kept for compatibility, should be deprecated)
- `Sidebar.tsx` - Navigation sidebar
- `GlobalDatePicker.tsx` - Date range picker
- `ResizablePanel.tsx` - Dual-pane split view
- `PageHeader.tsx` - Page title + description + actions

**UI Components** (`components/ui/`):
- `Link.tsx` - Navigation link
- `CopyButton.tsx` - Copy to clipboard
- `CodeViewer.tsx` - Code rendering
- `MessageContent.tsx` - Chat message display
- `SystemReminder.tsx` - System context display
- `TextContent.tsx` - Rich text display
- `ImageContent.tsx` - Image rendering
- `ToolUseContent.tsx` - Tool execution display
- `FunctionDefinitions.tsx` - Tool schema display

**Tool Display Components** (`components/ui/tools/tools/`):
- `BashTool.tsx`, `ReadTool.tsx`, `WriteTool.tsx`, etc.
- Over-specialized for tool rendering

**Feature Components** (`components/features/`):
- `ConversationSearch.tsx` - Conversation FTS search
- `ConversationList.tsx` - Conversation browser
- `ConversationThread.tsx` - Message display
- `RequestCompareModal.tsx` - Compare 2 requests
- `CompareModeBanner.tsx` - Compare mode indicator
- `ConfirmDeleteModal.tsx` - Delete confirmation
- `DataManagementBar.tsx` - Bulk actions
- `RefreshButton.tsx` - Manual refresh

**Chart Components** (`components/charts/`):
- `HourlyUsageChart.tsx` - Line chart (hourly tokens)
- `WeeklyUsageChart.tsx` - Line chart (daily tokens)
- `ModelBreakdownChart.tsx` - Pie/bar chart
- `PerformanceChart.tsx` - Latency percentiles
- `ModelComparisonBar.tsx` - Model comparison
- `StatCard.tsx` - Metric card
- `DateNavigation.tsx` - Date range picker

**Issues**:
- Component sprawl: 40+ components for relatively simple UI
- No shared modal/dialog system
- No consistent form component library
- Search components scattered (ConversationSearch, global UnifiedSearchModal)
- Charts hardcoded with Recharts; difficult to swap

### 1.5 Theme & Styling

**Theme** (`frontend/src/index.css`):
```css
--color-bg-primary: #0a0a0b     (near black)
--color-bg-secondary: #111113
--color-bg-tertiary: #18181b
--color-bg-hover: #1f1f23
--color-bg-active: #27272a

--color-text-primary: #fafafa   (near white)
--color-text-secondary: #a1a1aa (gray-400)
--color-text-muted: #71717a     (gray-500)

--color-accent: #3b82f6         (blue-500)
--color-success: #22c55e        (green-500)
--color-warning: #eab308        (yellow-500)
--color-error: #ef4444          (red-500)
```

**Issues**:
- Single dark theme (no light mode support)
- Accent color is blue; limited color palette for data differentiation
- Theme variables use semantic names but no design system documentation
- No established spacing/sizing scale
- Recharts charts have hardcoded colors (not theme-aware)

### 1.6 Data Flow Architecture

**API Layer** (`frontend/src/lib/api.ts`):
- 40+ query hooks (useRequestsSummary, useConversations, useTodos, etc.)
- V2 API endpoint prefix
- Mixed response formats (arrays vs wrapped objects)
- Search queries separate from main queries
- Some endpoints use X-Total-Count headers for pagination

**Type System** (`frontend/src/lib/types.ts`):
- 60+ TypeScript types
- Matches Go backend models
- No validation layer (types are for structure, not safety)
- Search result types separate from main types

**State Management**:
- TanStack React Query for server state
- Local useState for UI state (search, filters, selected items)
- No global UI state (modals, notifications, etc.)
- DateRangeContext for date picker coordination

**Issues**:
- API layer not organized by domain (requests, conversations, etc.)
- No error handling strategy
- No retry logic
- No caching strategy documented
- Mixed pagination patterns (some use limit/offset, some use headers)

---

## SECTION 2: AVAILABLE DATA & APIS

### 2.1 Data Types & Sources

**Requests** (from HAR files):
- Model, provider, routing info
- Tool usage, token counts
- Response time, status codes
- Streaming detection
- ~333K indexed messages

**Conversations** (from ~/.claude/projects/):
- Session IDs, timestamps
- File paths, message counts
- Subagent hierarchies
- Tool calls per message
- 4,334 conversations, 333,913 messages

**Session Data** (Todos & Plans):
- Todo status (pending, in_progress, completed)
- Session UUID tracking
- Plan files with markdown content
- 1,378 todos, 16 plans indexed

**Extensions** (from ~/.claude/):
- Agents, commands, skills, hooks, MCP servers
- Plugin sources and marketplaces
- Enabled/disabled state
- 184 total extensions

**Subagent Graph**:
- Agent hierarchies and relationships
- Parent-child spawn chains
- 769 subagent records, 168 sessions, 732 agents

**Statistics**:
- Hourly token usage
- Model/provider breakdowns
- Tool usage frequency
- Performance percentiles (p50, p95, p99)

### 2.2 API Endpoints Available

**Request Endpoints**:
- `GET /api/v2/requests/summary` - List requests with pagination
- `GET /api/v2/requests/{id}` - Request detail
- `GET /api/v2/requests/search` - FTS5 search

**Conversation Endpoints**:
- `GET /api/v2/conversations` - List conversations
- `GET /api/v2/conversations/{id}` - Conversation detail
- `GET /api/v2/conversations/{id}/messages` - Paginated messages
- `GET /api/v2/conversations/search` - FTS5 search

**Session Data Endpoints**:
- `GET /api/v2/claude/todos` - Todos list
- `GET /api/v2/claude/todos/{sessionUuid}` - Todo detail
- `GET /api/v2/claude/todos/search` - Todo search
- `GET /api/v2/claude/plans` - Plans list
- `GET /api/v2/claude/plans/{id}` - Plan detail
- `GET /api/v2/claude/plans/search` - Plan search
- `POST /api/v2/claude/todos/reindex` - Reindex session data

**Extension Endpoints**:
- `GET /api/v2/claude/extensions` - List extensions (with filters)
- `GET /api/v2/plugins` - Installed plugins
- `GET /api/v2/marketplaces` - Available marketplaces
- `POST /api/v2/claude/extensions/reindex` - Reindex extensions

**Statistics Endpoints**:
- `GET /api/v2/stats` - Weekly stats
- `GET /api/v2/stats/hourly` - Hourly stats
- `GET /api/v2/stats/models` - Model breakdown
- `GET /api/v2/stats/providers` - Provider breakdown
- `GET /api/v2/stats/subagents` - Subagent stats
- `GET /api/v2/stats/tools` - Tool usage
- `GET /api/v2/stats/performance` - Latency percentiles

**Relationship Endpoints** (NEW from relationship-linker):
- `GET /api/v2/claude/sessions` - Session list with stats
- `GET /api/v2/claude/sessions/{id}` - Session detail
- `GET /api/v2/claude/sessions/{id}/conversations` - Conversations in session
- `GET /api/v2/claude/sessions/{id}/file-changes` - Files modified in session
- `GET /api/v2/claude/sessions/{id}/plans` - Plans linked to session

---

## SECTION 3: CURRENT PAIN POINTS & INCONSISTENCIES

### 3.1 Navigation & Discoverability

**Problem**: Users must know which page to visit; there's no guided discovery.
- "I want to see my recent work" → No dedicated view
- "Find all uses of tool X" → Search doesn't filter by tool
- "Compare performance across models" → Must manually visit Performance page
- "Find todos for project Y" → No project context in todos interface

**Evidence**:
- Sidebar fixed 2-levels deep (section → page)
- No breadcrumbs
- No "recently viewed" items
- No cross-reference links (e.g., "5 requests from this conversation")

### 3.2 Visual Inconsistencies

**Problem**: Similar concepts rendered differently across pages.

| Concept | Requests | Conversations | Session Data | Extensions |
|---------|----------|---------------|--------------|-----------|
| **List Item** | Checkbox + color dot | Button | Row | Card |
| **Selection** | Checkbox | Click row | Click row | N/A (table) |
| **Search** | Local + FTS | Local + FTS | Local (limit 50) | URL param + dropdown |
| **Filtering** | Date range + model | Sort options | Tab-based | Dropdowns |
| **Detail View** | Dual-pane | Tab toggle | Modal-like | New page |

### 3.3 Information Architecture Problems

**Problem**: Data is partitioned by source type, not by user workflows.

**Current**: Source-centric
- Requests page
- Conversations page
- Extensions page
- Session Data page (Todos + Plans)

**Expected**: Workflow-centric
- Search & Discover (unified search)
- Session Timeline (conversation + todos + plans + file changes)
- Metrics Dashboard (token economics, performance trends)
- Extension Workshop (manage, enable/disable, create)

### 3.4 Data Integration Gaps

**Problem**: Pages are isolated; no linkage between related data.

**Missing Links**:
- Request → Conversation (which conversation triggered this request?)
- Conversation → Session Data (todos/plans created during this session?)
- File Change → Conversation (which conversation modified this file?)
- Subagent → Conversation (show messages from this agent)
- Tool → Requests (show all requests that used this tool)

### 3.5 Scale & Performance Issues

**Problem**: Large datasets (333K messages, 4,334 conversations) not optimized.

**Issues**:
- ConversationThread renders all messages (no virtualization)
- SessionData todo list not paginated efficiently
- Search results unlimited (may return thousands)
- No lazy loading for images or code blocks

---

## SECTION 4: UI REVAMP RECOMMENDATIONS

### 4.1 Information Architecture Redesign

**Proposed Navigation Structure**:

```
┌─────────────────────────────────────────────────────────────┐
│  CC-VIZ                                    [Search: ⌘K]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 OVERVIEW                                                │
│     Dashboard (unified stats + recent activity)             │
│                                                             │
│  🔍 EXPLORE                                                 │
│     Sessions (timeline view - conversations, todos, files)  │
│     Conversations (list + detail)                           │
│     Requests (list + detail)                                │
│                                                             │
│  📈 INSIGHTS                                                │
│     Token Economics (spend trends, anomalies)               │
│     Performance (latency, provider health)                  │
│     Tool Analytics (usage patterns)                         │
│                                                             │
│  🔧 MANAGE                                                  │
│     Extensions (unified browser)                            │
│     Settings                                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Page Consolidation

| Current Pages | Consolidated Into |
|---------------|-------------------|
| Home, Dashboard, Usage, Performance | **Dashboard** (tabs: Overview, Tokens, Performance, Tools) |
| Conversations, SessionData, TodosSearch, PlansSearch | **Sessions** (timeline view with todos/plans inline) |
| Extensions, Plugins, PluginView | **Extensions** (unified browser with detail drawer) |
| ClaudeConfig, Settings, Configuration | **Settings** (tabs: Preferences, Claude Config, Advanced) |
| Projects, Routing, ToolsDemo | **Remove** (unused or dev-only) |

**Result**: 18 pages → 6 pages

### 4.3 New Core Views

#### View 1: Dashboard (Home)
- **Stats Row**: Total sessions, conversations, todos, extensions
- **Activity Feed**: Last 10 events (conversation started, todo completed, plan created)
- **Quick Charts**: Token usage (7-day), model breakdown (pie)
- **Shortcuts**: Recent sessions, pinned items

#### View 2: Sessions (Primary Data View)
- **List**: Sessions with conversation count, todo count, date range
- **Timeline Detail**: Interleaved view of conversation messages, todo changes, file edits
- **Linked Data**: Associated plans, subagents, file changes
- **Key insight**: Session is the organizing unit, not conversation

#### View 3: Token Economics (Insights)
- **Burn Trend**: Daily/weekly/monthly token usage
- **Per-Project Breakdown**: Which projects cost most
- **Per-Model Breakdown**: Which models cost most
- **Anomaly Detection**: "Usage 2x normal this week"
- **Tool Costs**: Tokens per tool type

#### View 4: Extensions (Manage)
- **Unified Browser**: All types (agents, commands, skills, hooks, MCP)
- **Filters**: Type, source, enabled/disabled
- **Detail Drawer**: Description, toggle, edit link
- **Stats**: Usage counts if available

### 4.4 Component System

**Core Components Needed**:
1. `DataList` - Virtualized list with consistent item rendering
2. `DetailDrawer` - Slide-out panel for details (not full page)
3. `SearchInput` - Consistent search with filters dropdown
4. `StatCard` - Metric display with trend indicator
5. `Timeline` - Interleaved event display
6. `CopyableId` - UUID with middle-truncation and copy

### 4.5 Data Integration Patterns

**Every UUID should be a link**:
- Session UUID → Session detail
- Conversation ID → Conversation detail
- Request ID → Request detail
- Extension ID → Extension drawer

**Cross-references in detail views**:
- Session detail shows: conversations, todos, plans, file changes
- Conversation detail shows: parent session, associated todos
- Request detail shows: parent conversation (if linked)

---

## SECTION 5: SPRINT RECOMMENDATIONS

Based on this evaluation, recommend 3 sprints:

### Sprint 1: Consolidation (HIGH confidence)
- Merge duplicate pages
- Remove unused pages
- Establish consistent navigation

### Sprint 2: Session Timeline (HIGH confidence)
- Create Sessions page as primary data view
- Implement timeline component
- Link conversations, todos, plans to sessions

### Sprint 3: Dashboard Unification (HIGH confidence)
- Merge Dashboard, Usage, Performance into single view
- Add token economics charts
- Add activity feed

---

**Status**: Ready for sprint planning
**Next Step**: Create sprint plans with acceptance criteria
