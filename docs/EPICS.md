---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories"]
githubRepo: "https://github.com/buri1/adwo-2"
inputDocuments:
  - "docs/ADWO-SYNTHESIS-PLAN.md"
  - "docs/HANDOFF-SM.md"
  - "Chat Session 2026-02-01 (Question Detection, Config, Queue Logic)"
---

# ADWO 2.0 - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for ADWO 2.0, decomposing the requirements from the Synthesis Plan, Handoff Document, and collaborative session decisions into implementable stories.

## Requirements Inventory

### Functional Requirements

**Event Bridge Core:**
- FR1: Event Bridge liest Terminal-Output via Conduit `terminal-read` im 100-200ms Loop
- FR2: Event Bridge beobachtet `orchestrator-state.json` via File Watch
- FR3: Event Bridge führt Delta-Detection durch (nur neue Zeilen senden, keine Duplikate)
- FR4: Event Bridge betreibt WebSocket-Server für Real-Time Events an Dashboard
- FR5: Event Bridge bietet REST API: `POST /api/questions/answer`, `POST /api/orchestrator/start`, `POST /api/orchestrator/message`
- FR6: Event Bridge ist OTEL Receiver auf Port 4317 für Cost/Token Metriken

**Question Handling:**
- FR7: System erkennt AskUserQuestion Pattern im Terminal (`☐` Header + `Enter to select` Footer)
- FR8: Dashboard zeigt Questions in Chat-Style (alle gleichzeitig, in Eingangs-Reihenfolge)
- FR9: User kann Questions unabhängig von Reihenfolge beantworten
- FR10: Antworten werden via `terminal-write` ins korrekte Pane geschrieben (per pane_id)

**Dashboard:**
- FR11: Dashboard zeigt Real-Time Event Stream aller aktiven Panes
- FR12: Dashboard hat "Start Orchestrator" Button → spawnt via Conduit
- FR13: Dashboard hat "Stop Orchestrator" Button → `pane-close` via Conduit
- FR14: Dashboard zeigt Cost/Token Display (aus OTEL Metriken)

**Persistenz:**
- FR15: Events werden in SQLite persistiert (WAL-Mode)
- FR16: System unterstützt Crash Recovery (RingBuffer + SQLite Replay)

**Konfiguration:**
- FR17: System ist via `adwo.config.yaml` konfigurierbar (minimal, erweiterbar)

### NonFunctional Requirements

- NFR1: Real-Time Events erscheinen < 500ms nach Entstehung im Dashboard
- NFR2: Orchestrator läuft 4+ Stunden ohne manuellen Eingriff
- NFR3: Zero externe Dependencies für Persistenz (SQLite, kein Redis/Postgres)
- NFR4: Single `npm start` startet Dashboard + Event Bridge zusammen

### Additional Requirements

**Struktur & Wiederverwendung:**
- Multi-Repo: CLI Orchestrator bleibt separates Template-Repo (Git Submodule)
- ~1.751 LOC aus ADWO 1.0 direkt wiederverwendbar (WebSocket, Stores, Question Modal)
- `project_id` überall vorbereiten für Multi-Project in v1.1

**Technische Patterns:**
- WebSocket für Events (schnell), REST für Antworten (zuverlässig, idempotent)
- Next.js API Routes rufen Event Bridge Library direkt auf (gleicher Process)
- Question Detection: Terminal-Parsing mit Regex (`☐` Header + `Enter to select` Footer)

**Wiederverwendbare Komponenten aus ADWO 1.0:**
- WebSocket Broadcaster (261 LOC)
- Event Manager (76 LOC)
- Ring Buffer (26 LOC)
- Question Manager (280 LOC)
- WebSocket Hook (344 LOC)
- useCountdown (88 LOC)
- Question Store (72 LOC)
- Event Store (146 LOC)
- Connection Store (60 LOC)
- Question Modal (298 LOC, UI anpassen)

### FR Coverage Map

| FR | Epic | Beschreibung |
|----|------|--------------|
| FR1 | Epic 1 | Terminal-read Loop (100-200ms) |
| FR2 | Epic 1 | File Watch auf orchestrator-state.json |
| FR3 | Epic 1 | Delta Detection (keine Duplikate) |
| FR4 | Epic 1 | WebSocket Server für Events |
| FR5 | Epic 2+3 | REST API (start/message → E2, answer → E3) |
| FR6 | Epic 4 | OTEL Receiver (Port 4317) |
| FR7 | Epic 3 | Question Pattern Detection |
| FR8 | Epic 3 | Chat-Style Question Display |
| FR9 | Epic 3 | Unabhängige Beantwortung |
| FR10 | Epic 3 | terminal-write Antwort ins Pane |
| FR11 | Epic 1 | Event Stream Display |
| FR12 | Epic 2 | Start Orchestrator Button |
| FR13 | Epic 2 | Stop Orchestrator Button |
| FR14 | Epic 4 | Cost/Token Display |
| FR15 | Epic 5 | SQLite Persistenz (WAL-Mode) |
| FR16 | Epic 5 | Crash Recovery |
| FR17 | Epic 1 | Config (adwo.config.yaml) |

## Parallelization Strategy

```
Phase 1: Epic 1 (Foundation) - Sequential, 1-2 Agents
         ↓
Phase 2: Epic 2 + Epic 3 + Epic 4 + Epic 5 - Parallel, 4 Agents
         ↓
Phase 3: Integration Testing - 1-2 Agents
```

Epics 2-5 haben KEINE Abhängigkeiten untereinander. Sie bauen alle nur auf Epic 1 auf.

## Epic List

### Epic 1: Foundation & Live Event Stream
**User kann Real-Time Terminal-Output im Dashboard sehen.**

Nach diesem Epic: Du öffnest das Dashboard und siehst live was in den Agent-Terminals passiert.

**FRs covered:** FR1, FR2, FR3, FR4, FR11, FR17

**Wiederverwendbar:** WebSocket Broadcaster (261 LOC), Event Manager (76 LOC), Ring Buffer (26 LOC), WebSocket Hook (344 LOC), Event Store (146 LOC), Connection Store (60 LOC)

---

### Epic 2: Orchestrator Control
**User kann Orchestrator vom Dashboard aus starten und stoppen.**

Nach diesem Epic: Ein Button-Klick startet den Orchestrator, ein anderer stoppt ihn.

**FRs covered:** FR5 (partial: start/message), FR12, FR13

**Parallelisierbar:** API + UI können von 2 Agents parallel entwickelt werden.

---

### Epic 3: Question Handling
**User kann Agent-Fragen im Dashboard sehen und beantworten.**

Nach diesem Epic: Wenn ein Agent eine Frage stellt, erscheint sie im Chat und du kannst antworten.

**FRs covered:** FR5 (partial: answer), FR7, FR8, FR9, FR10

**Wiederverwendbar:** Question Manager (280 LOC), Question Store (72 LOC), Question Modal (298 LOC), useCountdown (88 LOC)

**Parallelisierbar:** Detection (Backend) + Modal (Frontend) können von 2 Agents parallel entwickelt werden.

---

### Epic 4: Cost Tracking
**User kann Kosten und Token-Verbrauch in Echtzeit sehen.**

Nach diesem Epic: Du siehst was die Session kostet und wie viele Tokens verbraucht werden.

**FRs covered:** FR6, FR14

**Parallelisierbar:** OTEL Receiver + Cost Display können von 2 Agents parallel entwickelt werden.

---

### Epic 5: Persistenz & Reliability
**System verliert keine Daten bei Crash und kann sich erholen.**

Nach diesem Epic: Du kannst das Dashboard schließen, neu starten, und siehst die Event-History.

**FRs covered:** FR15, FR16

**Sequentiell:** SQLite Setup → Crash Recovery (Abhängigkeit)

---

## Epic 1: Foundation & Live Event Stream

**Goal:** User kann Real-Time Terminal-Output im Dashboard sehen.

### Story 1.1: Project Scaffold & Config
**GitHub Issue:** [#1](https://github.com/buri1/adwo-2/issues/1)

**As a** developer,
**I want** a properly configured Next.js project with pnpm workspace and config loader,
**So that** I have a solid foundation for building the Event Bridge and Dashboard.

**Acceptance Criteria:**

**Given** I clone the adwo-2 repository
**When** I run `pnpm install && pnpm dev`
**Then** the Next.js development server starts on port 3000
**And** the console shows "ADWO 2.0 Dashboard ready"

**Given** an `adwo.config.yaml` file exists in the project root
**When** the application starts
**Then** the config is loaded and validated
**And** project name is accessible throughout the application

**Given** no `adwo.config.yaml` exists
**When** the application starts
**Then** sensible defaults are used
**And** a warning is logged suggesting to create the config

**Technical Notes:**
- Use Next.js 14+ with App Router
- TypeScript strict mode
- Shared types in `packages/shared`
- Config loader in `apps/dashboard/src/lib/config/`

**FRs Covered:** FR17

---

### Story 1.2: Event Bridge Core - Conduit Integration
**GitHub Issue:** [#2](https://github.com/buri1/adwo-2/issues/2)

**As a** dashboard user,
**I want** the Event Bridge to read terminal output from all active panes,
**So that** I can see what's happening in the orchestrator and agents.

**Acceptance Criteria:**

**Given** the Event Bridge is running
**When** a pane is registered in `orchestrator-state.json`
**Then** the Event Bridge starts reading from that pane via `conduit terminal-read`
**And** reads are performed every 100-200ms

**Given** multiple panes are registered
**When** the Event Bridge is polling
**Then** all panes are read in parallel
**And** events are tagged with their source pane_id

**Given** a pane is removed from `orchestrator-state.json`
**When** the Event Bridge detects the change
**Then** it stops reading from that pane
**And** cleans up resources

**Given** `conduit terminal-read` fails for a pane
**When** the error occurs
**Then** the Event Bridge logs the error
**And** continues reading from other panes
**And** retries the failed pane after a backoff

**Technical Notes:**
- Use `chokidar` or Node.js `fs.watch` for file watching
- Spawn `conduit` as child process
- Store pane registry in memory with last-read timestamp

**FRs Covered:** FR1, FR2

---

### Story 1.3: Delta Detection & Event Normalization
**GitHub Issue:** [#3](https://github.com/buri1/adwo-2/issues/3)

**As a** dashboard user,
**I want** to see only new terminal output without duplicates,
**So that** the event stream is clean and efficient.

**Acceptance Criteria:**

**Given** the Event Bridge reads terminal output
**When** comparing to the previous read
**Then** only new lines are extracted as events
**And** duplicate content is never sent twice

**Given** new terminal output is detected
**When** processing the content
**Then** ANSI escape codes are stripped
**And** the output is normalized to plain text with preserved structure

**Given** an event is created
**When** it is processed
**Then** it includes: `id`, `pane_id`, `type`, `content`, `timestamp`
**And** `project_id` is included (prepared for multi-project)

**Technical Notes:**
- Track last content hash or line count per pane
- Use `strip-ansi` or similar for ANSI removal
- Event types: `output`, `question`, `error`, `status`

**FRs Covered:** FR3

---

### Story 1.4: WebSocket Server
**GitHub Issue:** [#4](https://github.com/buri1/adwo-2/issues/4)

**As a** dashboard frontend,
**I want** to connect to a WebSocket server and receive real-time events,
**So that** I can display them instantly without polling.

**Acceptance Criteria:**

**Given** the Dashboard is running
**When** the frontend connects to `ws://localhost:3000/api/ws`
**Then** the WebSocket connection is established
**And** the client receives a `connected` event

**Given** a new terminal event is detected
**When** the Event Bridge processes it
**Then** it is broadcast to all connected WebSocket clients
**And** delivery latency is < 100ms

**Given** a client disconnects and reconnects
**When** the reconnection happens
**Then** the client receives missed events from the RingBuffer
**And** event order is preserved

**Given** no clients are connected
**When** events are generated
**Then** events are still stored in the RingBuffer
**And** memory usage is bounded (e.g., last 1000 events)

**Technical Notes:**
- **REUSE FROM ADWO 1.0:** WebSocket Broadcaster (261 LOC), Event Manager (76 LOC), Ring Buffer (26 LOC)
- Integrate with Next.js API route or custom server

**FRs Covered:** FR4

**Parallelization:** Can run parallel with Story 1.2 after Story 1.1

---

### Story 1.5: Dashboard Event Stream UI
**GitHub Issue:** [#5](https://github.com/buri1/adwo-2/issues/5)

**As a** dashboard user,
**I want** to see a real-time stream of events from all active panes,
**So that** I can monitor what the orchestrator and agents are doing.

**Acceptance Criteria:**

**Given** the Dashboard is open in a browser
**When** terminal events arrive via WebSocket
**Then** they appear in the Event Stream panel within 500ms
**And** new events are appended at the bottom

**Given** events from multiple panes are streaming
**When** viewing the Event Stream
**Then** events are visually distinguished by pane (color/icon)
**And** pane names/types are shown

**Given** the WebSocket connection is lost
**When** viewing the Dashboard
**Then** a "Disconnected" indicator is shown
**And** automatic reconnection is attempted every 2 seconds

**Given** the WebSocket reconnects
**When** the connection is re-established
**Then** missed events are fetched from the server
**And** the stream continues seamlessly

**Technical Notes:**
- **REUSE FROM ADWO 1.0:** WebSocket Hook (344 LOC), Event Store (146 LOC), Connection Store (60 LOC)
- Use Tailwind + shadcn/ui for styling

**FRs Covered:** FR11

**NFRs Addressed:** NFR1 (< 500ms latency)

---

## Epic 2: Orchestrator Control

**Goal:** User kann Orchestrator vom Dashboard aus starten und stoppen.

### Story 2.1: REST API for Orchestrator Control
**GitHub Issue:** [#6](https://github.com/buri1/adwo-2/issues/6)

**As a** dashboard user,
**I want** REST API endpoints to start and stop the orchestrator,
**So that** the frontend can control the orchestrator lifecycle.

**Acceptance Criteria:**

**Given** the orchestrator is not running
**When** I call `POST /api/orchestrator/start`
**Then** a new terminal pane is created via `conduit pane-split`
**And** Claude is started with `conduit terminal-write`
**And** the `/orchestrator` skill is invoked
**And** the response includes the new `pane_id`

**Given** the orchestrator is running with a known `pane_id`
**When** I call `POST /api/orchestrator/stop` with the `pane_id`
**Then** the pane is closed via `conduit pane-close`
**And** the response confirms successful shutdown

**Given** the orchestrator is running
**When** I call `POST /api/orchestrator/message` with text content
**Then** the message is written to the orchestrator pane via `conduit terminal-write`
**And** the response confirms delivery

**Given** the orchestrator is already running
**When** I call `POST /api/orchestrator/start`
**Then** the response returns 409 Conflict
**And** includes the existing `pane_id`

**Technical Notes:**
- Next.js API Routes in `apps/dashboard/src/app/api/orchestrator/`
- Use child_process to spawn conduit commands

**FRs Covered:** FR5 (partial: start/message)

**Parallelization:** Can run parallel with Epic 1 Stories after Story 1.1

---

### Story 2.2: Start Orchestrator Button
**GitHub Issue:** [#7](https://github.com/buri1/adwo-2/issues/7)

**As a** dashboard user,
**I want** a "Start Orchestrator" button in the UI,
**So that** I can launch the orchestrator with a single click.

**Acceptance Criteria:**

**Given** the orchestrator is not running
**When** I view the dashboard
**Then** I see a prominent "Start Orchestrator" button
**And** it is styled with a green/primary color

**Given** the orchestrator is not running
**When** I click the "Start Orchestrator" button
**Then** a loading spinner appears
**And** the API call `POST /api/orchestrator/start` is made
**And** on success, the button changes to show "Running" state

**Given** the orchestrator is already running
**When** I view the dashboard
**Then** the start button is disabled or hidden
**And** I see a "Running" indicator instead

**Given** the start request fails
**When** viewing the dashboard
**Then** an error toast/notification is shown
**And** the button returns to its initial state

**Technical Notes:**
- React component in `apps/dashboard/src/components/orchestrator/`
- Use shadcn/ui Button component

**FRs Covered:** FR12

**Parallelization:** Can run parallel with Story 2.3 after Story 2.1

---

### Story 2.3: Stop Orchestrator Button
**GitHub Issue:** [#8](https://github.com/buri1/adwo-2/issues/8)

**As a** dashboard user,
**I want** a "Stop Orchestrator" button in the UI,
**So that** I can gracefully shut down the orchestrator when needed.

**Acceptance Criteria:**

**Given** the orchestrator is running
**When** I view the dashboard
**Then** I see a "Stop Orchestrator" button
**And** it is styled with a red/danger color

**Given** the orchestrator is running
**When** I click the "Stop Orchestrator" button
**Then** a confirmation dialog appears
**And** on confirm, the API call `POST /api/orchestrator/stop` is made
**And** on success, the button changes to show "Stopped" state

**Given** the orchestrator is not running
**When** I view the dashboard
**Then** the stop button is disabled or hidden

**Given** the orchestrator is running but unresponsive
**When** I click "Stop" and it fails
**Then** I see a "Force Stop" option
**And** clicking it forcefully closes the pane

**Technical Notes:**
- React component in `apps/dashboard/src/components/orchestrator/`
- Use shadcn/ui Button and AlertDialog components

**FRs Covered:** FR13

**Parallelization:** Can run parallel with Story 2.2 after Story 2.1

---

## Epic 3: Question Handling

**Goal:** User kann Agent-Fragen im Dashboard sehen und beantworten.

### Story 3.1: Question Detection in Terminal Output
**GitHub Issue:** [#9](https://github.com/buri1/adwo-2/issues/9)

**As a** dashboard user,
**I want** the system to automatically detect when an agent asks a question,
**So that** I can respond via the dashboard instead of switching to the terminal.

**Acceptance Criteria:**

**Given** terminal output is being processed
**When** the output contains the AskUserQuestion pattern:
- `☐` header character
- Question text
- Numbered options
- `Enter to select` footer
**Then** the event is classified as type `question`
**And** question metadata is extracted (header, question text, options)

**Given** a question is detected
**When** creating the question event
**Then** it includes: `id`, `pane_id`, `type: "question"`, `question`, `header`, `options[]`, `timestamp`

**Given** multiple panes have questions pending
**When** questions are detected
**Then** each question is tracked separately
**And** all are available for display

**Given** terminal output does NOT match the question pattern
**When** processing the content
**Then** it is classified as `output` type
**And** no question metadata is extracted

**Technical Notes:**
- Detection regex: `☐\s+(.+?)\n.*?\n(.+?)\n.*?((?:\s*\d+\.\s+.+\n)+).*?Enter to select`
- Adapt Question Manager from ADWO 1.0 (280 LOC)

**FRs Covered:** FR7

---

### Story 3.2: Question Display in Chat UI
**GitHub Issue:** [#10](https://github.com/buri1/adwo-2/issues/10)

**As a** dashboard user,
**I want** to see agent questions in a chat-style interface,
**So that** I can easily understand and respond to them.

**Acceptance Criteria:**

**Given** a question event is received via WebSocket
**When** viewing the dashboard
**Then** the question appears in the chat panel
**And** it shows the question text prominently
**And** options are displayed as clickable buttons

**Given** multiple questions are pending
**When** viewing the chat panel
**Then** all questions are visible in chronological order
**And** each question is clearly separated

**Given** a question is displayed
**When** viewing its details
**Then** I can see which pane/agent asked the question
**And** the pane type is shown (orchestrator, dev_agent, etc.)

**Given** questions and regular output are mixed
**When** viewing the chat panel
**Then** questions are visually distinct (different background, icon)
**And** they stand out from regular log messages

**Technical Notes:**
- **REUSE FROM ADWO 1.0:** Question Store (72 LOC), Question Modal base (298 LOC)
- Use shadcn/ui Card, Button components

**FRs Covered:** FR8

**Parallelization:** Can run parallel with Story 3.1 (frontend + backend)

---

### Story 3.3: Answer Questions via Dashboard
**GitHub Issue:** [#11](https://github.com/buri1/adwo-2/issues/11)

**As a** dashboard user,
**I want** to answer agent questions directly in the dashboard,
**So that** I don't need to switch to the terminal.

**Acceptance Criteria:**

**Given** a question is displayed with options
**When** I click on an option button
**Then** the answer is sent to the backend
**And** the question is marked as "answered"

**Given** a question is displayed
**When** I want to provide a custom answer
**Then** I can type in a text field
**And** submit with Enter or a Send button

**Given** I submit an answer
**When** the backend receives it
**Then** `conduit terminal-write` is called with the answer
**And** the answer is written to the correct pane (by pane_id)

**Given** an answer is submitted successfully
**When** viewing the chat panel
**Then** my answer appears below the question
**And** it's styled as a "user message"

**Given** multiple questions are pending
**When** I answer any of them
**Then** I can answer in any order (not just chronological)
**And** each answer goes to the correct pane

**Technical Notes:**
- REST endpoint: `POST /api/questions/answer` with `{ questionId, paneId, answer }`
- Use `conduit terminal-write -p <pane_id> -e "<answer>"`
- useCountdown hook from ADWO 1.0 (88 LOC) for timeout display

**FRs Covered:** FR5 (partial: answer), FR9, FR10

---

## Epic 4: Cost Tracking

**Goal:** User kann Kosten und Token-Verbrauch in Echtzeit sehen.

### Story 4.1: OTEL Receiver for Cost Metrics
**GitHub Issue:** [#12](https://github.com/buri1/adwo-2/issues/12)

**As a** dashboard backend,
**I want** to receive OpenTelemetry metrics from Claude Code,
**So that** I can track costs and token usage.

**Acceptance Criteria:**

**Given** the Event Bridge is running
**When** Claude Code sends OTEL metrics
**Then** they are received on port 4317 (gRPC) or 4318 (HTTP)
**And** metrics are parsed and stored

**Given** OTEL metrics are received
**When** processing them
**Then** the following are extracted:
- `claude_code.cost.usage` (USD)
- `claude_code.token.usage` (input/output/cache)
- Session information

**Given** multiple Claude sessions are running
**When** metrics are received
**Then** they are associated with the correct pane/session
**And** aggregated totals are maintained

**Given** new cost metrics are received
**When** processing is complete
**Then** a `cost_update` event is broadcast via WebSocket
**And** includes current totals

**Technical Notes:**
- Use `@opentelemetry/exporter-metrics-otlp-http` or similar
- Claude Code env: `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317`

**FRs Covered:** FR6

**Parallelization:** Can run parallel with other epics after Story 1.1

---

### Story 4.2: Cost Display in Dashboard
**GitHub Issue:** [#13](https://github.com/buri1/adwo-2/issues/13)

**As a** dashboard user,
**I want** to see real-time cost and token usage,
**So that** I can monitor my spending during development sessions.

**Acceptance Criteria:**

**Given** cost metrics are being received
**When** viewing the dashboard
**Then** I see a cost indicator showing total USD spent
**And** it updates in real-time

**Given** cost metrics include token data
**When** viewing the cost panel
**Then** I see a breakdown: Input tokens, Output tokens, Cache tokens
**And** totals for the session

**Given** multiple agents are running
**When** viewing the cost panel
**Then** I can see costs per agent/pane
**And** a total across all panes

**Given** costs exceed a threshold (configurable)
**When** the threshold is crossed
**Then** a warning indicator appears
**And** optionally a notification is shown

**Technical Notes:**
- React component in `apps/dashboard/src/components/cost/`
- Subscribe to `cost_update` events via WebSocket
- Format currency appropriately (USD)

**FRs Covered:** FR14

**Parallelization:** Can run parallel with Story 4.1 (frontend + backend)

---

## Epic 5: Persistenz & Reliability

**Goal:** System verliert keine Daten bei Crash und kann sich erholen.

### Story 5.1: SQLite Persistence for Events
**GitHub Issue:** [#14](https://github.com/buri1/adwo-2/issues/14)

**As a** dashboard user,
**I want** events to be persisted to SQLite,
**So that** I can see event history even after restarting the dashboard.

**Acceptance Criteria:**

**Given** the Event Bridge starts
**When** initializing
**Then** SQLite database is created/opened with WAL mode
**And** the events table exists with correct schema

**Given** a new event is created
**When** it is broadcast via WebSocket
**Then** it is also inserted into SQLite
**And** the insert is non-blocking (async)

**Given** an event is persisted
**Then** the following fields are stored:
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  pane_id TEXT,
  type TEXT,
  content TEXT,
  timestamp INTEGER,
  synced INTEGER DEFAULT 0
);
```

**Given** the dashboard loads
**When** the frontend connects
**Then** it can request recent events from SQLite
**And** events are returned in chronological order

**Given** many events have been stored
**When** storage exceeds a limit (e.g., 10,000 events or 30 days)
**Then** old events are pruned
**And** pruning is non-blocking

**Technical Notes:**
- Use `better-sqlite3` for synchronous API or `sqlite3` async
- WAL mode for concurrent reads during writes
- Database file: `~/.adwo/events.db` or configurable

**FRs Covered:** FR15

**NFRs Addressed:** NFR3 (zero external dependencies)

---

### Story 5.2: Crash Recovery
**GitHub Issue:** [#15](https://github.com/buri1/adwo-2/issues/15)

**As a** dashboard user,
**I want** the system to recover gracefully from crashes,
**So that** I don't lose important event data.

**Acceptance Criteria:**

**Given** the Event Bridge was previously running
**When** it restarts after a crash
**Then** events are loaded from SQLite
**And** the RingBuffer is repopulated with recent events
**And** WebSocket clients can reconnect and see history

**Given** the dashboard crashed mid-session
**When** it restarts
**Then** active panes are detected from `orchestrator-state.json`
**And** terminal-read loops resume for all active panes

**Given** recovery is in progress
**When** loading events from SQLite
**Then** duplicates are prevented via event ID checking
**And** the RingBuffer maintains correct order

**Given** SQLite is corrupted or unavailable
**When** the Event Bridge starts
**Then** it logs a warning
**And** continues operating in memory-only mode
**And** notifies the user via WebSocket

**Technical Notes:**
- On startup: Load last N events from SQLite into RingBuffer
- Check `synced` flag to identify unprocessed events
- Recovery sequence: Open SQLite → Load events → Scan state.json → Resume loops → Accept connections

**FRs Covered:** FR16

**NFRs Addressed:** NFR2 (4+ hours without intervention)
