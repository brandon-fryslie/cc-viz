# CC-Viz Roadmap

**Last updated**: 2026-02-05
**Vision**: Analytics and visualization for Claude Code usage, focused exclusively on Claude's local data files.

---

## Strategic Context

**Previous scope**: Dual data sources (HAR proxy + conversation indexer)
**Current scope**: Focus exclusively on Claude's local data files (`~/.claude/`, project `.claude/` directories)

See [HANDOFF.md](/HANDOFF.md) for full context on this strategic refocus.

---

## ✅ Foundation (Complete)

Backend indexers verified functional (2026-01-18):

| Component | Status | Stats |
|-----------|--------|-------|
| Conversation Indexer | ✅ Production Ready | 4,334 convos, 333K messages, FTS5 working |
| Subagent Graph | ✅ Production Ready | 769 records, 168 sessions, 732 agents |
| Extension Indexer | ✅ Production Ready | 184 extensions (33 agents, 72 commands, 66 skills, 7 hooks, 6 MCP) |
| Session Data Indexer | ✅ Production Ready | 1,378 todos, 1,485 sessions, 16 plans |

---

## 🔴 Phase 1: Stabilize (Current Priority)

**Goal**: Remove HAR proxy dependencies and fix known data quality issues.

### 1.1 Remove HAR Proxy Dependencies

The HAR proxy data is unreliable (requires proxy running for every session). Remove entirely.

| Task | Files Affected |
|------|----------------|
| Delete queue watcher | `internal/service/queue_watcher.go` |
| Remove requests table operations | `internal/service/storage_sqlite.go` |
| Remove request endpoints | `internal/handler/data_handler.go` |
| Remove request models | `internal/model/models.go` |
| Remove queue config | `config.yaml.example` |

### 1.2 Fix Data Quality Issues

| Issue | Problem | Investigation |
|-------|---------|---------------|
| **Sparse token data** | Only 33% of messages (87K/265K) have token counts | Are tokens only on assistant messages? JSONL format differences? |
| **Inflated cache tokens** | 7.5B cache_read vs 17M input tokens | Check raw JSONL, possible parsing bug or unit mismatch |
| **Flat subagent hierarchy** | All 1,008 entries have `parent_agent_id = NULL` | Check JSONL format, may need to infer from message threading |
| **Empty sessions table** | 0 records but session_file_changes has 123K refs | Missing indexer? Should derive from conversations? |

### 1.3 Cleanup

- [ ] Remove `.bak` files in `internal/`
- [ ] Extend Zod validation to all API endpoints
- [ ] Implement real stats endpoint (remove hardcoded trends)
- [ ] Create dedicated stats endpoint with server-side aggregation

---

## 🟡 Phase 2: Audit

**Goal**: Comprehensive review of what data exists, what we capture correctly, and what's missing.

### Data Inventory
- Document all Claude local files and their formats
- Map JSONL message structure completely
- Identify all extension types and their schemas

### Verification
- Verify conversation indexing accuracy
- Validate token counts against raw data
- Confirm message threading is correct

### Gap Analysis

**Not Currently Captured**:
1. Extension changes over time (install/remove/modify events)
2. Memory file changes (CLAUDE.md modifications)
3. OpenTelemetry metrics (Claude Code emits OTEL data)
4. Model routing decisions (requested vs used)
5. Error/retry patterns
6. Cost data (token costs by model)

**Data Sources to Investigate**:
- `/tmp/claude-*` directories
- `~/.claude/settings.json`
- `~/.claude/statsig/`
- Project `.claude/` directories

---

## 🟢 Phase 3: Analytics & Visualization

**Goal**: Design systems to capture missing data and build analytics/visualizations.

### High Priority

#### Token Economics Dashboard ⭐
- Daily/weekly/monthly token burn trends
- Per-project and per-model cost breakdown
- Input vs output ratio tracking
- Anomaly detection ("tokens 2x normal this week")
- Per-tool cost analysis
- Session efficiency metrics

### Core Features

#### Relationship Linker
- Session → Conversations, Todos, Subagents, File Changes
- Bidirectional navigation support
- Cross-entity relationship graph

#### Unified Search
- FTS5 search across all content types
- Multi-type result grouping
- Advanced query syntax (`type:conversation project:cc-viz modified:>2026-01-01`)

#### Activity Dashboard
- Live status (active sessions, recent conversations, unfinished todos)
- Activity patterns (most active hours, trends, per-project breakdown)
- Tool usage breakdown

### Future Features

- **Time Machine**: Session replay with correlated file history
- **Subagent Observatory**: Visualize agent hierarchies and flow
- **Space Manager**: Understand and clean up ~/.claude
- **Extension Workshop UI**: Browse and manage extensions
- **Cross-Session Todo Board**: Kanban aggregation of all todos

---

## Dependency Graph

```
Foundation ✅ (Indexers Complete)
    ↓
Phase 1: Stabilize 🔴 ← CURRENT
    ├── Remove HAR proxy
    └── Fix data quality issues
    ↓
Phase 2: Audit 🟡
    ├── Data inventory
    ├── Verification
    └── Gap analysis
    ↓
Phase 3: Analytics 🟢
    ├── Token Economics ⭐
    ├── Relationship Linker
    ├── Unified Search
    └── Activity Dashboard
```

---

## Success Metrics

- [ ] HAR proxy code fully removed
- [ ] Token data coverage > 90%
- [ ] Subagent hierarchy correctly populated
- [ ] Sessions table populated correctly
- [ ] All API endpoints have Zod validation
- [ ] Stats calculated server-side, not hardcoded

---

## Reference Materials

- **Handoff**: [HANDOFF.md](/HANDOFF.md)
- **Data Model**: [docs/DATA-MODEL.md](/docs/DATA-MODEL.md)
- **Previous Vision**: [FEATURE_PROPOSAL_cc-viz-ultimate-vision.md](.agent_planning/FEATURE_PROPOSAL_cc-viz-ultimate-vision.md)
