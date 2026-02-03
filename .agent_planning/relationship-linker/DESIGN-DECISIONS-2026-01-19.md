# Design Decisions: relationship-linker

**Recorded**: 2026-01-19
**Status**: APPROVED by user

---

## Decision 1: Session Representation

**Chosen**: Explicit sessions table

Create authoritative `sessions` table with:
- id (UUID primary key)
- project_path
- started_at, ended_at timestamps
- Aggregate counts (conversations, messages, agents, todos)

**Rationale**: Single source of truth for sessions. Enables session-level metadata and efficient relationship queries.

**Migration Required**: Populate ~1,000 existing sessions from conversation_messages.session_id.

---

## Decision 2: File Change Tracking

**Chosen**: Parse tool outputs

Extract file paths from Write/Edit/Bash tool calls in existing conversation_messages.

**Implementation**:
1. Parse tool_use content from conversation_messages
2. Extract file paths from Write, Edit tool calls
3. Extract file paths from Bash commands (best effort)
4. Store in session_file_changes table

**Rationale**: Uses existing data, no new collection mechanisms needed.

---

## Decision 3: Plan-Session Linkage

**Chosen**: Content parsing + schema field

1. Parse existing plans for session UUID patterns
2. Add session_uuid field to claude_plans table for future plans
3. Populate plan_session_map junction table

**Rationale**: Most complete approach. Handles both existing and future plans.

---

## Schema Summary

```sql
-- New tables required
CREATE TABLE sessions (...);
CREATE TABLE session_conversation_map (...);
CREATE TABLE session_file_changes (...);
CREATE TABLE plan_session_map (...);

-- Migration: claude_plans
ALTER TABLE claude_plans ADD COLUMN session_uuid TEXT;
```

See EVALUATION-2026-01-19.md Section 4 for full schema.
