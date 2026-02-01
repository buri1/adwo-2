/**
 * POST /api/orchestrator/start
 *
 * Starts the orchestrator by:
 * 1. Creating a new terminal pane via conduit pane-split
 * 2. Starting Claude in the pane via terminal-write
 * 3. Invoking the /orchestrator skill
 * 4. Returning the pane_id
 *
 * Returns 409 Conflict if orchestrator is already running.
 */

import { NextResponse } from "next/server";
import { paneSplit, terminalWrite, terminalSendEnter } from "@/lib/conduit";
import {
  getOrchestratorState,
  setOrchestratorState,
  isOrchestratorRunning,
  saveStateToFile,
} from "@/lib/orchestrator/state";

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

    // Start Claude in the pane
    await terminalWrite(pane_id, "claude");
    await terminalSendEnter(pane_id);

    // Wait a bit for Claude to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Invoke the /orchestrator skill
    await terminalWrite(pane_id, "/orchestrator");
    await terminalSendEnter(pane_id);

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
      message: "Orchestrator started successfully",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Clear state on error
    setOrchestratorState(null);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
