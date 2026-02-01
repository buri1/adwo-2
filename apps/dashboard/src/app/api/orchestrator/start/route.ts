/**
 * POST /api/orchestrator/start
 *
 * Starts the orchestrator by:
 * 1. Creating a new terminal pane via conduit pane-split
 * 2. Starting Claude with --output-format stream-json piped to a JSONL file
 * 3. Invoking the /orchestrator skill
 * 4. Returning the pane_id
 *
 * The stream-json output is written to /tmp/events-{pane_id}.jsonl
 * and watched by StreamEventAdapter for real-time event processing.
 *
 * Returns 409 Conflict if orchestrator is already running.
 */

import { NextResponse } from "next/server";
import { paneSplit, terminalWrite } from "@/lib/conduit";
import {
  getOrchestratorState,
  setOrchestratorState,
  isOrchestratorRunning,
  saveStateToFile,
} from "@/lib/orchestrator/state";

// Directory for stream-json event files (must match StreamEventAdapter config)
const STREAM_EVENTS_DIR = process.env["STREAM_EVENTS_DIR"] ?? "/tmp";

export async function POST() {
  try {
    // Check if orchestrator is already running
    if (isOrchestratorRunning()) {
      const state = getOrchestratorState();
      return NextResponse.json(
        {
          error: "Orchestrator is already running",
          pane_id: state?.paneId,
        },
        { status: 409 }
      );
    }

    // Create new terminal pane
    const { pane_id } = await paneSplit();

    // Update state to "starting"
    setOrchestratorState({
      paneId: pane_id,
      startedAt: new Date().toISOString(),
      status: "starting",
    });

    // Build the Claude command with stream-json output
    // The output is piped to a JSONL file that StreamEventAdapter watches
    const eventsFile = `${STREAM_EVENTS_DIR}/events-${pane_id}.jsonl`;
    const claudeCmd = `claude --output-format stream-json 2>&1 | tee ${eventsFile}`;

    // Start Claude with stream-json output (with Enter to execute)
    await terminalWrite(pane_id, claudeCmd, true);

    // Wait a bit for Claude to initialize
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Invoke the /orchestrator skill (with Enter to execute)
    await terminalWrite(pane_id, "/orchestrator", true);

    // Update state to "running"
    setOrchestratorState({
      paneId: pane_id,
      startedAt: getOrchestratorState()!.startedAt,
      status: "running",
    });

    // Persist state to file
    await saveStateToFile();

    return NextResponse.json({
      success: true,
      pane_id,
      events_file: eventsFile,
      message: "Orchestrator started successfully with stream-json output",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Clear state on error
    setOrchestratorState(null);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
