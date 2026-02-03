# Evaluation: Data Integrity Fixes
Generated: 2026-01-19
Topic: data-integrity-fixes
Verdict: CONTINUE

## Context

This evaluation follows a comprehensive data integrity audit that discovered 15 distinct issues across 6 categories after fixing an initial sessions table completeness problem.

## What Exists

### Current State
- Sessions table: 1,055 entries (fixed from 290)
- session_conversation_map: 1,647 entries
- session_file_changes: 366,864 entries
- plan_session_map: 109 entries (19 valid, 90+ orphans)
- conversation_messages: 361,124 entries
- conversations: 4,380 entries
- claude_todos: 1,440 entries
- claude_plans: 18 entries
- subagent_graph: indexed

### Working Features
- Sessions migration now unions all sources (conversation_messages, claude_todos, subagent_graph)
- Plan-session linking works via session_file_changes
- File change extraction from tool_use blocks works
- Basic relationship navigation APIs exist

## What's Missing / Broken

### Critical Issues (P0)

1. **session_conversation_map incomplete** - 2,561 missing pairs
   - Only populated at table creation, never updated on subsequent runs
   - 527 sessions have messages but no mapping

2. **plan_session_map orphans** - 126 orphan entries
   - Plan re-indexing creates new auto-increment IDs
   - Old FK references become orphans
   - SQLite FKs not enforced (off by default)

3. **conversation_messages orphans** - 2,229 messages
   - Reference conversation IDs that don't exist in conversations table
   - Mostly agent-* pattern (subagent conversations)

4. **sessions aggregate counts wrong** - 496+ sessions
   - conversation_count: 100% are 0
   - agent_count: 100% are 0
   - todo_count: 100% are 0
   - message_count: 132 mismatches

### High Priority Issues (P1)

5. **conversations.message_count mismatch** - 1,050 conversations
   - Stored count from JSONL file != actual deduplicated DB count

6. **session_conversation_map → conversations orphans** - 31 entries
   - Agent conversations not in conversations table

7. **Startup timing issue**
   - Relationship linker runs before async indexers complete
   - Potential race condition

### Medium Priority Issues (P2)

8. **Empty todo sessions** - 1,280 entries with 0 todos
9. **Conversations with no messages** - 338 entries
10. **FTS sync issues** - 299,636 FTS entries vs 361,124 messages

## Dependencies and Risks

### Dependencies
- All fixes depend on understanding the indexer data flow
- FK enforcement requires connection string change
- Some fixes require startup order changes

### Risks
- FK enforcement could fail if orphans exist (need cleanup first)
- Incremental mapping updates could slow down indexing
- Aggregate count updates add DB writes

## Recommended Sprint Structure

Based on the audit, I recommend 3 sprints in dependency order:

1. **Sprint 1: orphan-cleanup** (HIGH confidence)
   - Clean up existing orphaned data
   - Enable FK constraints
   - Prerequisite for other fixes

2. **Sprint 2: incremental-maps** (HIGH confidence)
   - Make session_conversation_map incremental
   - Fix sessions aggregate counts
   - Fix conversations.message_count

3. **Sprint 3: timing-fixes** (MEDIUM confidence)
   - Fix startup timing/ordering
   - Needs research on best approach
