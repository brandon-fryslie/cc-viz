# CC-Viz Data Model

*Last updated: 2026-02-05*

This document describes the data currently available in CC-Viz, where it comes from, and what it represents.

## Data Sources

CC-Viz collects data from two sources:

1. **Conversation Indexer** - Scans `~/.claude/projects/` JSONL files written by Claude Code
2. **HAR Proxy** (cc-proxy) - Captures HTTP traffic between Claude Code and the API

Currently, only the Conversation Indexer is active. The HAR proxy data (`requests` table) is empty.

---

## Tables

### conversations
**Source**: Indexed from `~/.claude/projects/*/*.jsonl` files
**Records**: 1,478
**Represents**: A single Claude Code conversation (one JSONL file)

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Session UUID from the JSONL filename |
| project_path | TEXT | Sanitized path like `-Users-bmf-code-myproject` |
| project_name | TEXT | Same as project_path (display name) |
| start_time | DATETIME | Timestamp of first message |
| end_time | DATETIME | Timestamp of last message |
| message_count | INTEGER | Total messages in conversation |
| file_path | TEXT | Absolute path to the JSONL file |
| file_mtime | DATETIME | File modification time (for incremental indexing) |

**Time range**: 2026-01-04 to 2026-02-05 (32 days)

---

### conversation_messages
**Source**: Parsed from JSONL conversation files
**Records**: 265,905
**Represents**: Individual messages within conversations (user prompts, assistant responses, tool calls, tool results)

| Column | Type | Description |
|--------|------|-------------|
| uuid | TEXT | Unique message identifier |
| conversation_id | TEXT | FK to conversations.id |
| parent_uuid | TEXT | Parent message (for threading) |
| type | TEXT | Message type (see below) |
| role | TEXT | `user`, `assistant`, or null |
| timestamp | DATETIME | When the message occurred |
| session_id | TEXT | Claude Code session UUID |
| agent_id | TEXT | Agent identifier (for subagents) |
| is_sidechain | BOOLEAN | Whether this is a subagent sidechain |
| model | TEXT | Model used (if assistant message) |
| input_tokens | INTEGER | Input tokens for this message |
| output_tokens | INTEGER | Output tokens for this message |
| cache_read_tokens | INTEGER | Tokens read from cache |
| cache_creation_tokens | INTEGER | Tokens written to cache |
| content_json | TEXT | Raw message content |
| tool_use_json | TEXT | Tool invocations |
| tool_result_json | TEXT | Tool results |

**Message types**: `user`, `assistant`, `tool_use`, `tool_result`, `summary`

**Models observed**:
| Model | Messages | Input Tokens | Output Tokens |
|-------|----------|--------------|---------------|
| claude-opus-4-5-20251101 | 36,361 | 2,818,429 | 1,021,860 |
| claude-sonnet-4-5-20250929 | 35,183 | 2,594,934 | 2,617,554 |
| MiniMax-M2.1 | 12,098 | 9,651,726 | 1,241,192 |
| claude-haiku-4-5-20251001 | 11,495 | 2,322,560 | 253,800 |

**Token totals**:
- Input: 17,596,446
- Output: 5,139,113
- Cache read: 7,531,579,121 (!)

---

### subagent_graph
**Source**: Extracted from conversation messages with agent_id fields
**Records**: 1,008
**Represents**: Agent hierarchy within conversations (Task tool spawns)

| Column | Type | Description |
|--------|------|-------------|
| session_id | TEXT | Parent conversation session |
| agent_id | TEXT | This agent's identifier |
| parent_agent_id | TEXT | Parent agent (null for root) |
| message_count | INTEGER | Messages in this agent's context |
| spawn_time | DATETIME | When agent was spawned |
| end_time | DATETIME | When agent completed |
| status | TEXT | Agent status |
| is_sidechain | BOOLEAN | Whether running as sidechain |

**Current data**: All 1,008 entries are root agents (parent_agent_id is null)

---

### claude_todos
**Source**: Extracted from conversation session data
**Records**: 1,716
**Represents**: Todo items created during Claude Code sessions

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment ID |
| content | TEXT | Todo text content |
| status | TEXT | `pending`, `in_progress`, `completed` |
| session_uuid | TEXT | Session that created this todo |

**Status breakdown**:
- completed: 804 (47%)
- pending: 678 (40%)
- in_progress: 234 (14%)

---

### claude_plans
**Source**: Extracted from `plan.md` files in session directories
**Records**: 33
**Represents**: Implementation plans created in plan mode

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment ID |
| title | TEXT | Plan title |
| goal | TEXT | Plan goal/objective |
| content | TEXT | Full plan content |
| file_path | TEXT | Path to plan.md file |
| session_uuid | TEXT | Associated session |

---

### session_file_changes
**Source**: Extracted from tool_use messages (Edit, Write, Bash)
**Records**: 123,003
**Represents**: Files modified during Claude Code sessions

| Column | Type | Description |
|--------|------|-------------|
| session_id | TEXT | Session that made the change |
| file_path | TEXT | Path to modified file |
| change_type | TEXT | Type of change |
| tool_name | TEXT | Tool used |
| timestamp | DATETIME | When change occurred |

**By tool**:
- Bash: 44,805
- Edit: 42,999
- Write: 35,199

---

### extensions
**Source**: Scanned from `~/.claude/` directories and installed plugins
**Records**: 168
**Represents**: Installed Claude Code extensions (commands, skills, agents, etc.)

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Extension identifier |
| type | TEXT | `command`, `skill`, `agent`, `hook`, `mcp` |
| name | TEXT | Extension name |
| source | TEXT | `user` or plugin identifier |
| enabled | BOOLEAN | Whether enabled |

**By type**:
- command: 70
- skill: 61
- agent: 32
- hook: 4
- mcp: 1

---

### requests
**Source**: HAR files from cc-proxy
**Records**: 0 (not currently collecting)
**Represents**: Raw HTTP requests to Claude API

This table would contain detailed request/response data including:
- Full request/response bodies
- Response timing (TTFB, total time)
- Provider routing decisions
- Error details

---

## Relationships

```
conversations (1) ──────< (many) conversation_messages
     │
     └──< subagent_graph (agent hierarchy)
     │
     └──< session_file_changes (files modified)
     │
     └──< claude_todos (todos created)
     │
     └──< claude_plans (plans created)
```

---

## Data Quality Notes

1. **Token data is sparse**: Only ~33% of messages have token counts (87,803 of 265,905)
2. **Cache read tokens seem inflated**: 7.5 billion cache_read_tokens needs investigation
3. **No subagent hierarchy**: All subagent_graph entries show as root (parent_agent_id is null)
4. **HAR data not flowing**: requests table is empty - cc-proxy may not be running
5. **Session table empty**: sessions table has 0 records despite session_file_changes having data

---

## Volume by Time

**Last 7 days (conversations)**:
| Date | Conversations | Messages |
|------|---------------|----------|
| 2026-02-05 | 25 | 4,412 |
| 2026-02-04 | 68 | 12,974 |
| 2026-02-03 | 100 | 25,903 |
| 2026-02-02 | 182 | 48,265 |
| 2026-02-01 | 184 | 38,282 |
| 2026-01-31 | 143 | 32,387 |
| 2026-01-30 | 155 | 24,814 |

**Top projects by messages**:
| Project | Conversations | Messages |
|---------|---------------|----------|
| oscilla-animator-v2 | 167 | 93,104 |
| cc-dump | 54 | 19,336 |
| humanify (hybrid branch) | 8 | 12,092 |
| git-krakin-crackin | 14 | 11,536 |
| humanify (main) | 65 | 8,751 |
