# CC-VIZ Roadmap: The Claude Code Data Cockpit

**Last updated**: 2026-01-18
**Vision**: Transform CC-VIZ into a unified data cockpit where every piece of ~/.claude data is visible, connected, and navigable.

---

## Phase 1: Graph Foundation ✅ [COMPLETE]

**Goal**: Build the underlying infrastructure for interconnected data visualization. Establish database schema, indexing patterns, and relationship linking.

**Status**: 4/4 completed | All indexers verified functional (2026-01-18)

### Topics

#### ✅ session-data-indexer [COMPLETED - VERIFIED 2026-01-18]
- **Epic**: Session Data visualization page
- **Status**: PRODUCTION READY
- **Post-Refactor Verification**: CONTINUE ✓
- **What's Done**:
  - Database-backed ingestion from ~/.claude/todos/ and ~/.claude/plans/
  - Color-coded status indicators
  - Session ID / Agent ID display with verification
- **Current Stats**:
  - 1,378 todos indexed
  - 1,485 sessions tracked
  - 16 plans stored
- **Reference**: `.agent_planning/session-data-indexer/EVALUATION-2026-01-18.md`

#### ✅ conversation-indexer [COMPLETED - VERIFIED 2026-01-18]
- **Epic**: CONVERSATION-INDEXER-1
- **Status**: PRODUCTION READY
- **Post-Refactor Verification**: CONTINUE ✓
- **Description**: Parse JSONL conversations, extract messages, tool calls, timestamps
- **What's Done**:
  - ✅ P0: FTS5 blocker fixed (conditional build tags, all tests passing)
  - ✅ P1: Integration tests with real data
  - ✅ P2: Performance validation complete
  - Parse ~/.claude/projects/{path}/{session}.jsonl
  - Extract and index tool calls (Read, Write, Bash, etc.)
  - Build timestamp correlations
  - Store in SQLite with FTS5 for search
- **Current Stats** (2026-01-18):
  - Conversations: 4,334
  - Messages: 333,913
  - FTS entries: 283,647
  - Search latency: ~3ms
- **Reference**: `.agent_planning/conversation-indexer/EVALUATION-2026-01-18.md`

#### ✅ subagent-graph [COMPLETED - VERIFIED 2026-01-18]
- **Epic**: SUBAGENT-GRAPH-1
- **Status**: PRODUCTION READY
- **Post-Refactor Verification**: CONTINUE ✓
- **Description**: Index subagent hierarchies with parent-child relationships
- **What's Done**:
  - Parse ~/.claude/projects/{path}/subagents/agent-*.jsonl
  - Build parent spawn references (flat hierarchy implemented)
  - Correlate with session UUIDs
  - Graph visualization structure via API
  - File watching with 500ms debounce
- **Current Stats**:
  - 769 subagent records
  - 168 distinct sessions
  - 732 distinct agents
- **API Endpoints**: hierarchy, stats, agent details
- **Reference**: `.agent_planning/subagent-graph/EVALUATION-2026-01-18.md`

#### 💡 relationship-linker [PROPOSED]
- **Epic**: RELATIONSHIP-LINKER-1
- **Status**: Proposed
- **Description**: Build cross-entity relationship graph
- **Dependencies**: conversation-indexer, subagent-graph
- **Includes**:
  - Session → Conversations, Todos, Subagents, File Changes
  - File Change → Sessions that modified it
  - Plan → Sessions that created/referenced it
  - Bidirectional navigation support

---

## Phase 2: Search & Discovery 🔄 [READY - NEXT]

**Goal**: Enable users to find anything across all data sources with unified search.

**Status**: 0/3 completed | UNBLOCKED - Ready to start once P2 performance validation completes

### Topics

#### 💡 unified-search [PROPOSED]
- **Epic**: UNIFIED-SEARCH-1
- **Status**: Proposed
- **Dependencies**: conversation-indexer, relationship-linker
- **Description**: FTS5 search across all content types
- **Includes**:
  - Index conversations, plans, todos, history, file changes
  - Multi-type result grouping
  - Result ranking by relevance and recency
  - Context snippets with highlights

#### 💡 advanced-query-syntax [PROPOSED]
- **Epic**: ADVANCED-QUERY-SYNTAX-1
- **Status**: Proposed
- **Dependencies**: unified-search
- **Description**: Power user query syntax
- **Examples**:
  - `type:conversation project:cc-viz modified:>2026-01-01`
  - `tool:Bash status:active`
  - `modified:>2026-01-01 project:*`

#### 💡 search-ui [PROPOSED]
- **Epic**: SEARCH-UI-1
- **Status**: Proposed
- **Dependencies**: unified-search, advanced-query-syntax
- **Description**: Unified search interface
- **Includes**:
  - Top-level search bar (all pages)
  - Result categorization and grouping
  - Inline previews and navigation
  - Saved searches

---

## Phase 3: Intelligence & Visualization 📋 [QUEUED]

**Goal**: Transform raw data into understanding and visual exploration.

**Status**: 0/5 completed

**Note**: Token Economics Dashboard is high-priority (product-market fit) - include in Phase 3 planning

### Topics

#### 💡 activity-dashboard [PROPOSED]
- **Epic**: ACTIVITY-DASHBOARD-1
- **Status**: Proposed
- **Dependencies**: conversation-indexer, session-data-indexer
- **Description**: Turn stats into understanding
- **Includes**:
  - Live status (active sessions, recent conversations, unfinished todos)
  - Activity patterns (most active hours, trends, per-project breakdown)
  - Tool usage breakdown
  - Token usage by model over time

#### 💡 time-machine [PROPOSED]
- **Epic**: TIME-MACHINE-1
- **Status**: Proposed
- **Dependencies**: conversation-indexer, relationship-linker
- **Description**: Session replay with correlated file history
- **Includes**:
  - Timeline scrubber for any conversation
  - File diffs at each timestamp
  - Tool calls synchronized with file changes
  - File version restore capability

#### 💡 subagent-observatory [PROPOSED]
- **Epic**: SUBAGENT-OBSERVATORY-1
- **Status**: Proposed
- **Dependencies**: subagent-graph, conversation-indexer
- **Description**: Visualize agent hierarchies and flow
- **Includes**:
  - Tree visualization of spawn hierarchies
  - Click-through to agent conversations
  - Per-agent metrics (tokens, duration, files modified)
  - Aggregate views (most common agents, average chain depth)

#### 💡 space-manager [PROPOSED]
- **Epic**: SPACE-MANAGER-1
- **Status**: Proposed
- **Description**: Understand and clean up ~/.claude
- **Includes**:
  - Storage breakdown by directory
  - Age and staleness indicators
  - Safe-to-delete identification
  - Bulk actions: archive, compress, clean, export
  - Smart suggestions for cleanup

#### 💡 token-economics [PROPOSED] ⭐ HIGH PRIORITY
- **Epic**: TOKEN-ECONOMICS-1
- **Status**: Proposed
- **Priority**: HIGH (product-market fit for power users)
- **Description**: Understand token consumption patterns and detect anomalies
- **Includes**:
  - Daily/weekly/monthly token burn trends
  - Per-project token cost breakdown
  - Per-model token cost breakdown
  - Input vs output ratio tracking and drift detection
  - Anomaly alerts ("tokens 2x normal this week")
  - Per-tool cost analysis (tokens per call by tool type)
  - Session efficiency metrics
  - "Did I break something?" diagnostics
- **Why**: Every LLM power user needs to track token spend and catch unexpected cost spikes

---

## Phase 4: Extension Management 🔄 [IN PROGRESS]

**Goal**: Consolidate extension management and show usage analytics.

**Status**: 1/2 completed | extension-indexer verified functional (2026-01-18)

### Topics

#### ✅ extension-indexer [COMPLETED - VERIFIED 2026-01-18]
- **Epic**: EXTENSION-WORKSHOP-1 (Backend)
- **Status**: PRODUCTION READY
- **Post-Refactor Verification**: CONTINUE ✓
- **Description**: Index Claude Code extensions from ~/.claude
- **What's Done**:
  - Index agents, commands, skills, hooks, MCP servers
  - Parse YAML frontmatter from markdown files
  - Track enabled/disabled state
  - Support plugin sources (multiple marketplaces)
  - Persist toggle state to ~/.claude/settings.json
- **Current Stats**:
  - 184 extensions indexed
  - 33 agents, 72 commands, 66 skills, 7 hooks, 6 MCP
  - 19 distinct sources (user + plugins)
  - 30 installed plugins tracked
  - 7 known marketplaces
- **API Endpoints**: extensions (list, detail, stats, toggle, reindex), plugins, marketplaces
- **Reference**: `.agent_planning/extension-workshop/EVALUATION-2026-01-18.md`

#### 💡 extension-workshop-ui [PROPOSED]
- **Epic**: EXTENSION-WORKSHOP-1 (Frontend)
- **Status**: Proposed
- **Dependencies**: extension-indexer (DONE)
- **Description**: Browse and manage agents, commands, skills, plugins in UI
- **Includes**:
  - Unified browser for all extension types
  - Filtering and search
  - Enable/disable toggles (connected to backend)
  - Quick actions: edit, delete, create new

#### 💡 cross-session-todo-board [PROPOSED]
- **Epic**: CROSS-SESSION-TODO-BOARD-1
- **Status**: Proposed
- **Dependencies**: session-data-indexer
- **Description**: Kanban aggregation of all todos
- **Includes**:
  - Aggregated todo view across all sessions
  - Kanban columns: Pending, In Progress, Completed
  - Click-through to source session
  - Filters: session, project, age, keywords
  - Live updates during active sessions

---

## Dependency Graph

```
Session Data Indexer ✅ (1,378 todos, 16 plans)
    ↓
Conversation Indexer ✅ (4,334 convos, 333K msgs) → Subagent Graph ✅ (769 records)
    ↓                                                      ↓
Relationship Linker 💡 ←──────────────────────────────────┘
    ↓
├── Unified Search 💡
│   ├── Advanced Query Syntax 💡
│   └── Search UI 💡
├── Activity Dashboard 💡
├── Time Machine 💡
├── Subagent Observatory 💡
├── Space Manager 💡
├── Extension Workshop (Backend ✅, UI 💡) - 184 extensions indexed
└── Cross-Session Todo Board 💡
```

---

## Success Metrics

- ✓ Any UUID in the UI is clickable and navigates to context
- ✓ Search finds content regardless of source type
- ✓ Users can answer "what did I work on last week" in <30 seconds
- ✓ Storage cleanup recovers space without data loss risk
- ✓ Subagent hierarchies are visible and navigable
- ✓ File history correlates with conversation events

---

## Reference Materials

- **Full Vision**: [FEATURE_PROPOSAL_cc-viz-ultimate-vision.md](.agent_planning/FEATURE_PROPOSAL_cc-viz-ultimate-vision.md)
- **Handoff**: [HANDOFF-cc-viz-ultimate-vision-20260112.md](.agent_planning/HANDOFF-cc-viz-ultimate-vision-20260112.md)
- **Session Data Plan**: [PLAN-sprint2-20260112.md](.agent_planning/cc-viz-roadmap/PLAN-sprint2-20260112.md)
- **Storage Strategy**: [ADR-001-storage-strategy.md](ADR-001-storage-strategy.md)

---

## Next Steps

**Post-Refactor Verification Complete (2026-01-18)**:
All backend indexers verified functional:
- ✅ session-data-indexer - 1,378 todos, 1,485 sessions, 16 plans
- ✅ conversation-indexer - 4,334 convos, 333K messages, FTS5 working
- ✅ subagent-graph - 769 records, 168 sessions, 732 agents
- ✅ extension-indexer - 184 extensions across 5 types

**Up Next**:
1. Plan and implement **relationship-linker** (Phase 1 final piece)
2. Plan and implement **Phase 2: Unified Search**
3. Begin **Phase 3: User Features** (Token Economics high priority)

**Tracking**:
- All work tracked in beads for persistence across sessions
- Evaluations in `.agent_planning/<topic>/EVALUATION-*.md`
- Status updated in this ROADMAP after each phase completion
