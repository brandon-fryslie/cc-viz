# Sprint: plan-linkage

**Generated**: 2026-01-19
**Confidence**: HIGH
**Status**: READY FOR IMPLEMENTATION

---

## Sprint Goal

Link plans to sessions via content parsing and complete all bidirectional navigation APIs.

---

## Scope

**Deliverables**:
1. Plan-session mapping table and population
2. Add session_uuid column to claude_plans
3. Complete bidirectional APIs for all entity types

---

## Work Items

### P0: Plan-Session Map Table

**Files to Modify**:
- `internal/service/storage_sqlite.go`

**Implementation**:
```sql
CREATE TABLE IF NOT EXISTS plan_session_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  relationship TEXT,
  confidence TEXT,
  discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, session_id),
  FOREIGN KEY (plan_id) REFERENCES claude_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_psm_plan ON plan_session_map(plan_id);
CREATE INDEX IF NOT EXISTS idx_psm_session ON plan_session_map(session_id);
```

**Columns**:
- relationship: 'created', 'referenced', 'updated'
- confidence: 'high' (UUID found), 'medium' (temporal match)

**Acceptance Criteria**:
- [ ] Table created with proper foreign keys
- [ ] Both directions indexed for fast queries
- [ ] Relationship types documented

---

### P1: Schema Migration - claude_plans

**Files to Modify**:
- `internal/service/storage_sqlite.go`

**Implementation**:
```sql
-- Check if column exists before adding
ALTER TABLE claude_plans ADD COLUMN session_uuid TEXT;
CREATE INDEX IF NOT EXISTS idx_plans_session ON claude_plans(session_uuid);
```

**Acceptance Criteria**:
- [ ] session_uuid column added to claude_plans
- [ ] Index created on session_uuid
- [ ] Existing plans not affected (column allows NULL)

---

### P2: Plan Content Parser

**Files to Modify**:
- `internal/service/relationship_linker.go`

**Implementation**:
```go
func (rl *RelationshipLinker) ExtractSessionUUIDsFromPlan(content string) []string
// Look for patterns:
// - UUID format: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
// - Context: "session:", "Session:", "session_uuid:", "sessionId:"
// - References in markdown links, code blocks, etc.

func (rl *RelationshipLinker) LinkPlansToSessions() error
// 1. Read all plans from claude_plans
// 2. For each plan, read file content from disk
// 3. Extract UUIDs from content
// 4. Match UUIDs against sessions table
// 5. Insert into plan_session_map with 'high' confidence
// 6. If no UUID found, try temporal matching ('medium' confidence)
```

**UUID Pattern**: `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`

**Temporal Matching Fallback**:
- Get plan file mtime
- Find sessions active within 1 hour of mtime
- If single session, link with 'medium' confidence
- If multiple sessions, skip (too ambiguous)

**Acceptance Criteria**:
- [ ] UUID extraction finds valid UUIDs in plan content
- [ ] Only UUIDs that exist in sessions table are linked
- [ ] Temporal fallback works when no UUID found
- [ ] Confidence level correctly set

---

### P3: Model Updates

**Files to Modify**:
- `internal/model/models.go`

**Structs to Add/Update**:
```go
type PlanSessionMap struct {
    ID           int       `json:"id"`
    PlanID       int       `json:"plan_id"`
    SessionID    string    `json:"session_id"`
    Relationship string    `json:"relationship"`
    Confidence   string    `json:"confidence"`
    DiscoveredAt time.Time `json:"discovered_at"`
}

// Update existing Plan struct
type Plan struct {
    // ... existing fields ...
    SessionUUID *string `json:"session_uuid,omitempty"`  // NEW
}
```

**Acceptance Criteria**:
- [ ] PlanSessionMap struct defined
- [ ] Plan struct updated with SessionUUID field

---

### P4: Storage Interface Methods

**Files to Modify**:
- `internal/service/storage.go`
- `internal/service/storage_sqlite.go`

**Methods to Add**:
```go
// Plan → Sessions
GetPlanSessions(planID int) ([]*model.Session, error)

// Session → Plans
GetSessionPlans(sessionID string) ([]*model.Plan, error)

// Link operations
LinkPlanToSession(planID int, sessionID string, relationship string, confidence string) error
```

**Acceptance Criteria**:
- [ ] All methods implemented
- [ ] GetPlanSessions returns sessions with relationship metadata
- [ ] GetSessionPlans returns plans linked to session
- [ ] LinkPlanToSession handles duplicates gracefully

---

### P5: Complete Session Detail API

**Files to Modify**:
- `internal/handler/data_handler.go`

**Extend Session Detail Response**:
```json
GET /api/v2/claude/sessions/{id}
{
  "id": "...",
  "project_path": "...",
  "started_at": "...",
  "ended_at": "...",
  "conversations": [...],
  "files": [...],
  "plans": [...],          // NEW
  "todos": [...],          // NEW
  "subagents": [...]       // NEW
}
```

**Implementation**:
- Add GetSessionPlans call
- Add existing GetTodosBySession query
- Add existing GetSubagentsBySession query

**Acceptance Criteria**:
- [ ] Session detail includes plans array
- [ ] Session detail includes todos array
- [ ] Session detail includes subagents array
- [ ] All arrays properly populated

---

### P6: Plan-Session APIs

**Files to Modify**:
- `internal/handler/data_handler.go`
- `cmd/viz-server/main.go`

**Endpoints**:
```
GET /api/v2/claude/plans/{id}/sessions     - Sessions that created/referenced plan
GET /api/v2/claude/sessions/{id}/plans     - Plans linked to session
```

**Response Format**:
```json
GET /api/v2/claude/plans/{id}/sessions
{
  "plan_id": 1,
  "sessions": [
    {
      "id": "abc...",
      "relationship": "created",
      "confidence": "high",
      "started_at": "..."
    }
  ]
}
```

**Acceptance Criteria**:
- [ ] Both endpoints implemented
- [ ] Relationship and confidence included in response
- [ ] Returns empty array (not error) when no links exist

---

## Dependencies

- Sprint 1 (sessions-foundation): Sessions table
- Sprint 2 (relationship-maps): RelationshipLinker service exists

---

## Risks

| Risk | Mitigation |
|------|------------|
| Plans stored outside DB (on disk) | Read file content during linking |
| UUID patterns match non-session strings | Validate against sessions table before inserting |
| Temporal matching too ambiguous | Only use when single session matches; skip otherwise |

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] `just test` passes
- [ ] `just check` passes
- [ ] Plan-session links populated from existing data
- [ ] Full session detail includes ALL related entities
- [ ] Bidirectional navigation verified manually
