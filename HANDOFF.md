# CC-Viz Handoff Document

*Created: 2026-02-05*

## Project Overview

CC-Viz provides visualization and analytics for Claude Code usage. This handoff documents a strategic refocus of the project and the work needed to stabilize it.

## Strategic Refocus

**Previous scope**: Dual data sources (HAR proxy + conversation indexer)
**New scope**: Focus exclusively on Claude's local data files

### Primary Dataset: Claude Historical Data
Everything Claude Code writes to the local filesystem:
- `~/.claude/` - Main Claude directory
- `~/.claude.json` - Global configuration
- `~/.claude/projects/` - Conversation JSONL files
- `/tmp/claude-*` - Temporary session data
- Project-level `.claude/` directories

### Secondary Dataset: User Configuration
Track how configuration evolves over time:
- **Memory files**: Global and project-level CLAUDE.md files
- **Extensions**: Plugins, agents, skills, commands, hooks, MCPs
- **Marketplaces**: Installed plugin sources
- **Project config**: Per-project settings and extensions

### Future Goal
Correlate configuration changes with outcomes - understand how extensions, memory content, and settings impact conversation quality and productivity.

---

## Roadmap

### Phase 1: Stabilize
Remove HAR proxy dependencies and fix known data issues.

### Phase 2: Audit
Comprehensive review of what data exists, what we're capturing correctly, and what's missing.

### Phase 3: Design & Build
Design systems to capture missing data and build analytics/visualizations.

---

## Phase 1: Stabilization Work

### 1.1 Remove HAR Proxy Dependencies

The HAR proxy (cc-proxy) data is unreliable - it requires the proxy to be running and properly configured for every Claude Code session. We will remove this dependency entirely.

**Tasks**:
- [ ] Remove `requests` table and related code
- [ ] Remove queue watcher (`queue_watcher.go`) that processes HAR files
- [ ] Remove `/api/requests/*` endpoints
- [ ] Update CLAUDE.md to reflect new project scope
- [ ] Remove proxy-related configuration options

**Files affected**:
- `internal/service/queue_watcher.go` - Delete
- `internal/service/storage_sqlite.go` - Remove requests table operations
- `internal/handler/data_handler.go` - Remove request endpoints
- `internal/model/models.go` - Remove request-related models
- `config.yaml.example` - Remove queue directory config

### 1.2 Fix Known Data Issues

#### Issue 1: Token data is sparse
**Problem**: Only 33% of messages (87,803 of 265,905) have token counts. The rest show 0.
**Investigation needed**:
- Are tokens only present on assistant messages?
- Is the JSONL format different for older conversations?
- Are we parsing the token fields correctly?

#### Issue 2: Cache read tokens seem inflated
**Problem**: 7.5 billion cache_read_tokens vs 17M input tokens - ratio doesn't make sense.
**Investigation needed**:
- Check raw JSONL files to see actual values
- May be a parsing bug or unit mismatch
- Could be cumulative vs per-message values

#### Issue 3: Subagent hierarchy is flat
**Problem**: All 1,008 subagent_graph entries have `parent_agent_id = NULL`. No hierarchy is being captured.
**Investigation needed**:
- Check JSONL format for agent/parent relationships
- May need to infer hierarchy from message threading
- Check if `parent_uuid` in messages provides this

#### Issue 4: Sessions table is empty
**Problem**: `sessions` table has 0 records, but `session_file_changes` has 123k records referencing sessions.
**Investigation needed**:
- Is something supposed to populate this table?
- Should sessions be derived from conversations?
- Check if there's an orphaned indexer

### 1.3 Additional Known Issues

#### Issue 5: Duplicate/stale backup files
**Problem**: Multiple `.bak` files in `internal/` directories (models.go.bak, models.go.bak2, etc.)
**Fix**: Clean up backup files, ensure they're gitignored

#### Issue 6: Frontend/backend type mismatches
**Problem**: We just fixed `messageCount` vs `requestCount`. There may be other mismatches.
**Fix**: Zod validation added for conversations endpoint. Extend to other endpoints.

#### Issue 7: Hardcoded stats in dashboard
**Problem**: `conversationsTrend` (15.3%) and `tokensTrend` (8.7%) are hardcoded placeholders.
**Fix**: Implement proper stats endpoint that calculates real trends.

#### Issue 8: Conversation limit caps stats
**Problem**: `/api/v2/conversations` was hardcoded to return max 100, breaking "Conversations (7d)" stat.
**Partial fix**: Added limit parameter, increased default to 1000.
**Proper fix**: Create dedicated stats endpoint with server-side aggregation.

---

## Phase 2: Audit (After Stabilization)

### What Data Exists
- Document all Claude local files and their formats
- Map JSONL message structure completely
- Identify all extension types and their schemas

### What We're Capturing Correctly
- Verify conversation indexing accuracy
- Validate token counts against raw data
- Confirm message threading is correct

### What We're Missing

#### Not Currently Captured:
1. **Extension changes over time** - We snapshot current extensions but don't track when they were installed/removed/modified
2. **Memory file changes** - CLAUDE.md modifications not tracked
3. **OpenTelemetry metrics** - Claude Code emits OTEL data we're not capturing
4. **Model routing decisions** - Which model was requested vs used
5. **Error/retry patterns** - Failed requests and recovery
6. **Cost data** - Token costs by model

#### Data Sources to Investigate:
- `/tmp/claude-*` directories - What's in there?
- `~/.claude/settings.json` - User preferences
- `~/.claude/statsig/` - Feature flags and experiments
- Project `.claude/` directories - Local overrides

---

## Phase 3: Design & Build (Future)

### Potential Analytics
- Token usage trends and predictions
- Model usage patterns
- Extension effectiveness (do certain plugins correlate with better outcomes?)
- Project activity heatmaps
- Conversation complexity analysis
- Tool usage patterns

### Technical Requirements
- Time-series tracking for configuration changes
- Efficient aggregation queries for stats
- Real-time indexing for active conversations
- Data retention policies

---

## Current Session Context

### What We Did Today
1. Fixed `just dev` command (port conflicts)
2. Fixed "Sessions Today" stat to use rolling 24h instead of calendar day
3. Fixed "0 messages" bug - backend was returning `requestCount` instead of `messageCount`
4. Added Zod validation to catch future type mismatches
5. Discovered conversation limit was capping stats at 100
6. Documented full data model in `docs/DATA-MODEL.md`

### Files Modified Today
- `frontend/src/pages/MissionControl.tsx` - Rolling 24h stats
- `frontend/src/lib/api.ts` - Added Zod validation, limit parameter
- `frontend/src/lib/schemas.ts` - New file for API schemas
- `internal/model/models.go` - Fixed JSON tags
- `internal/handler/data_handler.go` - Fixed field names, added limit param
- `internal/service/storage.go` - Added interface method
- `docs/DATA-MODEL.md` - New comprehensive data documentation

### Running the Project
```bash
just dev          # Runs Go backend + Vite frontend
just build        # Build Go binary only
just test         # Run tests
```

Dashboard: http://localhost:5173
API: http://localhost:8002

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `internal/service/indexer.go` | Conversation indexer - scans ~/.claude/projects |
| `internal/service/extension_indexer.go` | Extension discovery |
| `internal/service/subagent_indexer.go` | Agent hierarchy tracking |
| `internal/service/storage_sqlite.go` | All database operations |
| `internal/handler/data_handler.go` | API endpoints |
| `frontend/src/pages/MissionControl.tsx` | Main dashboard |
| `docs/DATA-MODEL.md` | Data model documentation |

---

## Questions for Next Session

1. Should we track extension history in a separate table or use event sourcing?
2. What's the right granularity for stats - hourly, daily, weekly?
3. Should we index `/tmp/claude-*` or is that too ephemeral?
4. How do we handle conversation files that get deleted?
5. What OTEL metrics does Claude Code emit and how do we capture them?
