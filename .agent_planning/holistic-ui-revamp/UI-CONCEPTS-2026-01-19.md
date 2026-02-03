# CC-VIZ UI Concepts & Design Direction
**Date**: 2026-01-19
**Purpose**: Brainstorm UI approaches before implementation

---

## Design Philosophy

### Core Principle: "Session is the Unit of Work"

Users work in **sessions** - they start Claude, do some work, accomplish something, and stop. The UI should reflect this mental model:

- **Session** = A continuous period of work (has a UUID)
- **Conversation** = Messages exchanged during a session
- **Todos** = Tasks created/completed during a session
- **Plans** = Plans created during a session
- **File Changes** = Files modified during a session

**Current problem**: UI treats these as separate data types on separate pages.
**Solution**: Unified "Session Timeline" view that shows everything together.

---

## Concept 1: "Mission Control" Dashboard

**Inspiration**: SpaceX mission control, stock trading terminals

```
┌────────────────────────────────────────────────────────────────────────┐
│  CC-VIZ Mission Control                           [⌘K Search] [⚙️]    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────┐ │
│  │ SESSIONS TODAY      │  │ TOKENS (7 DAY)      │  │ HEALTH         │ │
│  │                     │  │                     │  │                │ │
│  │   12 sessions       │  │  ▁▂▄▆▇█▇▅          │  │ 🟢 Anthropic   │ │
│  │   ↑ 3 from yesterday│  │  247K tokens        │  │ 🟢 OpenRouter  │ │
│  │                     │  │  ↑ 12% vs last week │  │ 🟡 Gemini      │ │
│  └─────────────────────┘  └─────────────────────┘  └────────────────┘ │
│                                                                        │
│  ACTIVE SESSION ─────────────────────────────────────────────────────  │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ 42e59982... (cc-viz) - Started 2h ago                              ││
│  │ ├─ 💬 47 messages   ├─ ✅ 3 todos done   ├─ 📝 1 plan created     ││
│  │ └─ Currently: Implementing data integrity fixes...                 ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                        │
│  RECENT SESSIONS ────────────────────────────────────────────────────  │
│  ┌──────────────────────────────────────────────────────────────┬────┐│
│  │ Session                          │ Project     │ Duration │Todos││
│  ├──────────────────────────────────┼─────────────┼──────────┼─────┤│
│  │ 9a44b22e... relationship-linker  │ cc-viz      │ 4h 23m   │ 8   ││
│  │ a9176827... unified-search       │ cc-viz      │ 2h 15m   │ 3   ││
│  │ ba6e828c... canvas-integration   │ brain-canvas│ 1h 45m   │ 5   ││
│  └──────────────────────────────────┴─────────────┴──────────┴─────┘│
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Key Elements**:
- Stat cards with trend indicators (↑↓)
- Provider health status (real-time)
- Active session highlight (if currently working)
- Recent sessions table (clickable → session detail)
- Sparkline charts for quick trends

---

## Concept 2: "Session Timeline" View

**Inspiration**: Git commit history, Slack threads, IDE activity view

```
┌────────────────────────────────────────────────────────────────────────┐
│  Session: 42e59982-0409-46a5-afe8-25314317be7b                        │
│  Project: cc-viz │ Duration: 2h 34m │ Started: 2026-01-19 15:23       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  TIMELINE                                          [Filter: All ▼]    │
│  ────────────────────────────────────────────────────────────────────  │
│                                                                        │
│  15:23  🚀 Session started                                             │
│         └─ Project: /Users/bmf/code/cc-viz                            │
│                                                                        │
│  15:24  💬 Conversation started                                        │
│         └─ "Help me fix the data integrity issues..."                 │
│                                                                        │
│  15:26  📝 Plan created: data-integrity-fixes                         │
│         └─ 3 sprints planned (orphan-cleanup, incremental-maps, ...)  │
│                                                                        │
│  15:28  ✅ Todo added: Sprint 1: orphan-cleanup                        │
│         └─ Status: pending → in_progress                              │
│                                                                        │
│  15:32  📄 File modified: internal/service/storage_sqlite.go          │
│         └─ +45 lines, -12 lines (FK constraints added)                │
│                                                                        │
│  15:35  ✅ Todo completed: Sprint 1: orphan-cleanup                    │
│         └─ Status: in_progress → completed                            │
│                                                                        │
│  15:36  💬 Message: "Sprint 1 complete. Moving to Sprint 2..."        │
│         └─ [View full conversation →]                                 │
│                                                                        │
│  ...                                                                   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Key Elements**:
- Vertical timeline with timestamps
- Event icons (🚀 session, 💬 message, ✅ todo, 📝 plan, 📄 file)
- Collapsed previews that expand on click
- Filter dropdown (All, Messages, Todos, Plans, Files)
- Links to detailed views

---

## Concept 3: "Cockpit" Split View

**Inspiration**: IDE panels, Bloomberg terminal

```
┌─────────────┬──────────────────────────────────────────────────────────┐
│             │                                                          │
│  SESSIONS   │  SESSION DETAIL                                          │
│             │  ───────────────────────────────────────────────────────  │
│  [Search]   │                                                          │
│             │  42e59982... (cc-viz)                                     │
│  Today      │  ┌────────────────────────────────────────────────────┐  │
│  ├─ 42e...  │  │ STATS          │ LINKS                             │  │
│  └─ 9a4...  │  │ 47 messages    │ 3 conversations                   │  │
│             │  │ 8 todos (5 ✓)  │ 2 plans                           │  │
│  Yesterday  │  │ 156K tokens    │ 23 file changes                   │  │
│  ├─ a91...  │  └────────────────────────────────────────────────────┘  │
│  ├─ ba6...  │                                                          │
│  └─ c7d...  │  CONVERSATION THREAD                                     │
│             │  ───────────────────────────────────────────────────────  │
│  This Week  │  [User]: Help me fix the data integrity issues...        │
│  ├─ ...     │                                                          │
│             │  [Assistant]: I'll analyze the issues. Let me check...   │
│             │                                                          │
│             │  [Tool: Read] internal/service/storage_sqlite.go         │
│             │                                                          │
│             │  [Assistant]: Found 3 issues:                            │
│             │  1. plan_session_map orphans: 126                        │
│             │  2. session_conversation_map orphans: 31                 │
│             │  ...                                                     │
│             │                                                          │
│             │  ─────────────────────────────────────────────────────── │
│             │  TODOS                          PLANS                    │
│             │  ┌─────────────────────┐       ┌─────────────────────┐  │
│             │  │ ✅ Sprint 1         │       │ 📝 data-integrity   │  │
│             │  │ ✅ Sprint 2         │       │    3 sprints        │  │
│             │  │ ✅ Sprint 3         │       └─────────────────────┘  │
│             │  └─────────────────────┘                                 │
│             │                                                          │
└─────────────┴──────────────────────────────────────────────────────────┘
```

**Key Elements**:
- Left sidebar: Session list grouped by date
- Main area: Session detail with stats header
- Conversation thread (primary content)
- Footer panels: Todos and Plans inline

---

## Concept 4: "Token Economics" Dashboard

**Inspiration**: Financial dashboards, cost management tools

```
┌────────────────────────────────────────────────────────────────────────┐
│  Token Economics                                    [Date: Last 30d ▼] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                     DAILY TOKEN BURN                             │  │
│  │  250K ─┤                              ▄                          │  │
│  │        │                           ▄▄ █                          │  │
│  │  200K ─┤                        ▄▄▄██ █                          │  │
│  │        │                     ▄▄▄████ █▄                          │  │
│  │  150K ─┤               ▄  ▄▄▄██████ ██▄                          │  │
│  │        │            ▄▄▄█▄▄█████████ ███                          │  │
│  │  100K ─┤         ▄▄▄████████████████████▄                        │  │
│  │        │      ▄▄████████████████████████▄                        │  │
│  │   50K ─┤   ▄▄▄██████████████████████████▄                        │  │
│  │        │▄▄▄█████████████████████████████▄                        │  │
│  │     0 ─┼──────────────────────────────────────────────           │  │
│  │        Jan 1    Jan 7    Jan 14   Jan 19                         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────┐ │
│  │ BY PROJECT          │  │ BY MODEL            │  │ ANOMALIES      │ │
│  │                     │  │                     │  │                │ │
│  │ cc-viz      45%     │  │ opus-4    60%       │  │ ⚠️ Jan 15:     │ │
│  │ chaperone   30%     │  │ sonnet    35%       │  │ 2.3x normal    │ │
│  │ brain-canvas 15%    │  │ haiku      5%       │  │ (unified-search│ │
│  │ other       10%     │  │                     │  │  sprint)       │ │
│  └─────────────────────┘  └─────────────────────┘  └────────────────┘ │
│                                                                        │
│  TOP TOKEN CONSUMERS (This Week)                                       │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ Session                  │ Project  │ Model  │ Tokens │ Cost    │   │
│  ├──────────────────────────┼──────────┼────────┼────────┼─────────│   │
│  │ 42e59982... (data-integ) │ cc-viz   │ opus   │ 156K   │ ~$2.34  │   │
│  │ 9a44b22e... (rel-linker) │ cc-viz   │ opus   │ 142K   │ ~$2.13  │   │
│  │ a9176827... (unified-s)  │ cc-viz   │ opus   │ 98K    │ ~$1.47  │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Key Elements**:
- Large trend chart (main focus)
- Breakdown pies (project, model)
- Anomaly alerts (highlight unusual usage)
- Session cost table (where did tokens go?)

---

## Concept 5: "Extension Workshop"

**Inspiration**: VS Code extensions, App stores

```
┌────────────────────────────────────────────────────────────────────────┐
│  Extension Workshop                    [Search extensions...] [+ New] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [All] [Agents: 33] [Commands: 72] [Skills: 66] [Hooks: 7] [MCP: 6]   │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                                                                    ││
│  │  🤖 code-bloodhound                                    [Enabled ●] ││
│  │  Agent • User                                                      ││
│  │  Use when you need to investigate a codebase for hidden technical  ││
│  │  debt, incomplete implementations, abandoned migrations...          ││
│  │                                                        [Edit] [···]││
│  │                                                                    ││
│  ├────────────────────────────────────────────────────────────────────┤│
│  │  ⌨️ system-prompt-editor                               [Enabled ●] ││
│  │  Command • User                                                    ││
│  │  Edit your global CLAUDE.md system prompt                          ││
│  │                                                        [Edit] [···]││
│  │                                                                    ││
│  ├────────────────────────────────────────────────────────────────────┤│
│  │  🎯 do:plan-skill                                      [Enabled ●] ││
│  │  Skill • Plugin: do@loom99                                         ││
│  │  Create comprehensive, confidence-rated implementation plans...     ││
│  │                                                        [View] [···]││
│  │                                                                    ││
│  ├────────────────────────────────────────────────────────────────────┤│
│  │  🔧 repomix                                           [Disabled ○] ││
│  │  MCP Server • Plugin: repomix-mcp                                  ││
│  │  Pack codebases for AI analysis                                    ││
│  │                                                       [Enable] [···]││
│  │                                                                    ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Key Elements**:
- Type tabs with counts
- Search across all extensions
- List with inline toggle (enabled/disabled)
- Source badge (User, Plugin name)
- Quick actions (Edit, View, Enable/Disable)
- "..." menu for advanced options

---

## Design System Foundations

### Color Palette (Dark Theme)

| Purpose | Color | Hex |
|---------|-------|-----|
| Background Primary | Near black | #0a0a0b |
| Background Secondary | Dark gray | #111113 |
| Background Tertiary | Gray | #18181b |
| Text Primary | White | #fafafa |
| Text Secondary | Light gray | #a1a1aa |
| Text Muted | Gray | #71717a |
| Accent (Interactive) | Blue | #3b82f6 |
| Success | Green | #22c55e |
| Warning | Yellow | #eab308 |
| Error | Red | #ef4444 |
| **NEW: Chart 1** | Purple | #8b5cf6 |
| **NEW: Chart 2** | Cyan | #06b6d4 |
| **NEW: Chart 3** | Pink | #ec4899 |

### Typography Scale

| Level | Size | Weight | Use |
|-------|------|--------|-----|
| Display | 32px | Bold | Page titles |
| Heading | 24px | Semibold | Section headers |
| Title | 18px | Medium | Card titles |
| Body | 14px | Regular | Content |
| Small | 12px | Regular | Metadata, timestamps |
| Mono | 13px | Regular | UUIDs, code |

### Spacing Scale

| Token | Size | Use |
|-------|------|-----|
| xs | 4px | Inline spacing |
| sm | 8px | Tight padding |
| md | 16px | Standard padding |
| lg | 24px | Section spacing |
| xl | 32px | Page margins |
| 2xl | 48px | Large gaps |

### Component Patterns

**Cards**: Rounded corners (8px), subtle border, hover lift
**Lists**: No borders, hover highlight, clear row separation
**Buttons**: Pill shape for primary, square for icon-only
**Inputs**: Dark background, light border on focus
**Modals**: Backdrop blur, centered, max-width 640px
**Drawers**: Slide from right, 400px width

---

## Recommended Approach

### Phase 1: Foundation
1. Establish design tokens (colors, spacing, typography)
2. Create base component library (Button, Input, Card, List)
3. Implement new navigation structure

### Phase 2: Core Views
1. Build Session Timeline view (primary innovation)
2. Consolidate Dashboard (merge stats pages)
3. Unify Extension Workshop

### Phase 3: Polish
1. Add cross-references and linking
2. Implement Token Economics dashboard
3. Performance optimization (virtualization)

---

**Status**: Concepts ready for review
**Next Step**: User feedback on direction, then sprint planning
