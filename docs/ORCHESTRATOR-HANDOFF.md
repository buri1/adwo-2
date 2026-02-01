# ADWO 2.0 - Orchestrator Implementation Handoff

> **Für:** Orchestrator Agent
> **Projekt:** ADWO 2.0 (Agentic Development Workflow Orchestrator)
> **Repo:** https://github.com/buri1/adwo-2
> **Datum:** 2026-02-01
> **Status:** Ready for Implementation

---

## Quick Start für Orchestrator

```bash
# Repo klonen
git clone --recurse-submodules https://github.com/buri1/adwo-2
cd adwo-2

# Issues sind bereits angelegt
gh issue list
```

---

## Projekt-Überblick

ADWO 2.0 verbindet den CLI Orchestrator mit einem React Dashboard für Real-Time Observability.

```
CLI Orchestrator (existiert) + Dashboard (neu) = ADWO 2.0
                              ↑
                      Event Bridge (neu)
```

**Kern-Features:**
- Real-Time Event Streaming von Agent-Terminals
- Question Handling via Dashboard
- Cost/Token Tracking via OTEL
- Crash Recovery via SQLite

---

## Implementation Phases

### Phase 1: Foundation (Sequential)
**Agents:** 1-2
**Stories:** 1.1 → 1.2 → 1.3 → 1.4 → 1.5

Story 1.1 MUSS zuerst abgeschlossen werden. Danach:
- Stories 1.2 + 1.4 können PARALLEL laufen
- Story 1.3 nach 1.2
- Story 1.5 nach 1.4

```
1.1 ─┬─► 1.2 ─► 1.3
     └─► 1.4 ─► 1.5
```

### Phase 2: Features (Parallel - 4 Agents)
**Voraussetzung:** Epic 1 abgeschlossen

```
Agent 1: Epic 2 (Control)     → Stories 2.1 → 2.2/2.3
Agent 2: Epic 3 (Questions)   → Stories 3.1/3.2 → 3.3
Agent 3: Epic 4 (Cost)        → Stories 4.1/4.2
Agent 4: Epic 5 (Persistence) → Stories 5.1 → 5.2
```

### Phase 3: Integration (Sequential)
**Agents:** 1-2
- E2E Testing
- Bug Fixes
- Final Polish

---

## Story Execution Order

### Epic 1: Foundation & Live Event Stream
| Order | Story | Issue | Parallel? |
|-------|-------|-------|-----------|
| 1 | 1.1: Project Scaffold & Config | [#1](https://github.com/buri1/adwo-2/issues/1) | FIRST |
| 2a | 1.2: Conduit Integration | [#2](https://github.com/buri1/adwo-2/issues/2) | After 1.1 |
| 2b | 1.4: WebSocket Server | [#4](https://github.com/buri1/adwo-2/issues/4) | After 1.1, PARALLEL with 1.2 |
| 3 | 1.3: Delta Detection | [#3](https://github.com/buri1/adwo-2/issues/3) | After 1.2 |
| 4 | 1.5: Event Stream UI | [#5](https://github.com/buri1/adwo-2/issues/5) | After 1.4 |

### Epic 2: Orchestrator Control
| Order | Story | Issue | Parallel? |
|-------|-------|-------|-----------|
| 1 | 2.1: REST API | [#6](https://github.com/buri1/adwo-2/issues/6) | After Epic 1 |
| 2a | 2.2: Start Button | [#7](https://github.com/buri1/adwo-2/issues/7) | After 2.1 |
| 2b | 2.3: Stop Button | [#8](https://github.com/buri1/adwo-2/issues/8) | After 2.1, PARALLEL with 2.2 |

### Epic 3: Question Handling
| Order | Story | Issue | Parallel? |
|-------|-------|-------|-----------|
| 1a | 3.1: Question Detection | [#9](https://github.com/buri1/adwo-2/issues/9) | After Epic 1 |
| 1b | 3.2: Question Display | [#10](https://github.com/buri1/adwo-2/issues/10) | After Epic 1, PARALLEL with 3.1 |
| 2 | 3.3: Answer Flow | [#11](https://github.com/buri1/adwo-2/issues/11) | After 3.1 + 3.2 |

### Epic 4: Cost Tracking
| Order | Story | Issue | Parallel? |
|-------|-------|-------|-----------|
| 1a | 4.1: OTEL Receiver | [#12](https://github.com/buri1/adwo-2/issues/12) | After Epic 1 |
| 1b | 4.2: Cost Display | [#13](https://github.com/buri1/adwo-2/issues/13) | After Epic 1, PARALLEL with 4.1 |

### Epic 5: Persistence & Reliability
| Order | Story | Issue | Parallel? |
|-------|-------|-------|-----------|
| 1 | 5.1: SQLite Persistence | [#14](https://github.com/buri1/adwo-2/issues/14) | After Epic 1 |
| 2 | 5.2: Crash Recovery | [#15](https://github.com/buri1/adwo-2/issues/15) | After 5.1 |

---

## Orchestrator Commands

### Agent Spawning Pattern
```bash
# Terminal für Agent öffnen
conduit pane-split right -t terminal
pane_id=$(conduit pane-list | jq -r '.[-1].id')

# Claude starten
conduit terminal-write -p $pane_id -e "cd /Users/buraksmac/Desktop/code2/adwo-2 && claude --dangerously-skip-permissions"
conduit terminal-wait -p $pane_id -t 15

# Dev Agent aktivieren
conduit terminal-write -p $pane_id -e "/bmad-agent-bmm-dev"
conduit terminal-wait -p $pane_id -t 10

# Story zuweisen
conduit terminal-write -p $pane_id -e "Implementiere Story 1.1: Project Scaffold & Config. Details: https://github.com/buri1/adwo-2/issues/1"
```

### Story Assignment Template
```
Implementiere Story {N.M}: {Title}

GitHub Issue: https://github.com/buri1/adwo-2/issues/{issue_number}

Arbeitsverzeichnis: /Users/buraksmac/Desktop/code2/adwo-2

Lies das Issue für vollständige Acceptance Criteria.
Committe nach jeder abgeschlossenen AC.
Melde dich wenn du fertig bist oder blockiert wirst.
```

---

## Wiederverwendbare Komponenten

Diese Dateien aus ADWO 1.0 können kopiert werden:

| Komponente | Quelle | Ziel | LOC |
|------------|--------|------|-----|
| WebSocket Broadcaster | `/Users/buraksmac/Desktop/code/adwo/overspark/apps/orchestrator/src/websocket/broadcaster.ts` | `apps/dashboard/src/lib/event-bridge/` | 261 |
| Event Manager | `/Users/buraksmac/Desktop/code/adwo/overspark/apps/orchestrator/src/websocket/eventManager.ts` | `apps/dashboard/src/lib/event-bridge/` | 76 |
| Ring Buffer | `/Users/buraksmac/Desktop/code/adwo/overspark/apps/orchestrator/src/websocket/ringBuffer.ts` | `apps/dashboard/src/lib/event-bridge/` | 26 |
| Question Manager | `/Users/buraksmac/Desktop/code/adwo/overspark/apps/orchestrator/src/services/o-agent/QuestionManager.ts` | `apps/dashboard/src/lib/questions/` | 280 |
| WebSocket Hook | `/Users/buraksmac/Desktop/code/adwo/overspark/apps/dashboard/src/hooks/use-websocket.ts` | `apps/dashboard/src/hooks/` | 344 |
| useCountdown | `/Users/buraksmac/Desktop/code/adwo/overspark/apps/dashboard/src/hooks/useCountdown.ts` | `apps/dashboard/src/hooks/` | 88 |
| Question Store | `/Users/buraksmac/Desktop/code/adwo/overspark/apps/dashboard/src/stores/question-store.ts` | `apps/dashboard/src/stores/` | 72 |
| Event Store | `/Users/buraksmac/Desktop/code/adwo/overspark/apps/dashboard/src/stores/event-store.ts` | `apps/dashboard/src/stores/` | 146 |
| Connection Store | `/Users/buraksmac/Desktop/code/adwo/overspark/apps/dashboard/src/stores/connection-store.ts` | `apps/dashboard/src/stores/` | 60 |
| Question Modal | `/Users/buraksmac/Desktop/code/adwo/overspark/apps/dashboard/src/components/question/question-modal.tsx` | `apps/dashboard/src/components/question/` | 298 |

**Total: ~1,651 LOC wiederverwendbar**

---

## Technische Entscheidungen (Binding)

| Entscheidung | Wert |
|--------------|------|
| Framework | Next.js 14+ (App Router) |
| Styling | Tailwind + shadcn/ui |
| State | Zustand |
| Types | TypeScript strict |
| Package Manager | pnpm |
| Persistenz | SQLite (better-sqlite3) |
| WebSocket | ws library |
| Config | YAML (adwo.config.yaml) |

---

## Question Detection Pattern

Das AskUserQuestion Format im Terminal:

```
─────────────────────────────────────────────────
 ☐ Header

Question text here?

❯ 1. Option A
     Description of option A
  2. Option B
     Description of option B
  3. Option C
     Description of option C
  4. Type something.
─────────────────────────────────────────────────
  5. Chat about this

Enter to select · ↑/↓ to navigate · Esc to cancel
```

**Detection Markers:**
- Start: `☐` character
- End: `Enter to select`

---

## Success Criteria

| Kriterium | Messung |
|-----------|---------|
| Real-Time Events | < 500ms Latenz |
| Orchestrator Stability | 4+ Stunden ohne Crash |
| Question Handling | User kann via Dashboard antworten |
| Cost Tracking | Korrekte Token/USD Anzeige |
| Crash Recovery | Keine Datenverlust bei Restart |

---

## Orchestrator State Schema

```json
{
  "phase": "implementation",
  "current_epic": 1,
  "current_story": "1.1",
  "active_agents": [
    {
      "pane_id": "abc-123",
      "type": "dev",
      "story": "1.1",
      "status": "working"
    }
  ],
  "completed_stories": [],
  "blocked_stories": []
}
```

---

## Checkpoints

Nach jeder Story:
1. ✅ Alle Acceptance Criteria erfüllt?
2. ✅ Tests geschrieben/passing?
3. ✅ Code committed + pushed?
4. ✅ GitHub Issue geschlossen?

Nach jedem Epic:
1. ✅ Alle Stories abgeschlossen?
2. ✅ Integration funktioniert?
3. ✅ Keine Regressionen?

---

## Bei Problemen

1. **Agent blockiert:** Story skippen, nächste Story starten, später zurückkehren
2. **Dependency fehlt:** Prüfen ob vorherige Story wirklich fertig ist
3. **Unklare Anforderung:** GitHub Issue lesen, bei Bedarf User fragen
4. **Merge Conflicts:** Orchestrator koordiniert Resolution

---

## Start Command

```
Du bist der Orchestrator für ADWO 2.0.

Lies: /Users/buraksmac/Desktop/code2/adwo-2/docs/ORCHESTRATOR-HANDOFF.md
Lies: /Users/buraksmac/Desktop/code2/adwo-2/docs/EPICS.md

Starte mit Epic 1, Story 1.1.
Spawne Dev Agents via Conduit wie im Handoff beschrieben.
Nutze bis zu 4 parallele Agents wo möglich.
Tracke Progress im orchestrator-state.json.

Beginne jetzt.
```

---

**Ende des Handoff-Prompts**
