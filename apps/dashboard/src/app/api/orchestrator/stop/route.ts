/**
 * POST /api/orchestrator/stop
 *
 * Stops the orchestrator by:
 * 1. Closing the pane via conduit pane-close
 * 2. Confirming shutdown
 *
 * Accepts pane_id in the request body to verify the correct pane.
 */

import { NextRequest, NextResponse } from "next/server";
import { paneClose } from "@/lib/conduit";
import {
  getOrchestratorState,
  setOrchestratorState,
  isOrchestratorRunning,
  saveStateToFile,
} from "@/lib/orchestrator/state";

interface StopRequestBody {
  pane_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StopRequestBody;
    const { pane_id } = body;

    if (!pane_id) {
      return NextResponse.json(
        { error: "pane_id is required" },
        { status: 400 }
      );
    }

    // Check if orchestrator is running
    if (!isOrchestratorRunning()) {
      return NextResponse.json(
        { error: "Orchestrator is not running" },
        { status: 404 }
      );
    }

    const state = getOrchestratorState();

    // Verify pane_id matches
    if (state?.paneId !== pane_id) {
      return NextResponse.json(
        {
          error: "pane_id mismatch",
          expected: state?.paneId,
          provided: pane_id,
        },
        { status: 400 }
      );
    }

    // Update state to "stopping"
    setOrchestratorState({
      ...state,
      status: "stopping",
    });

    // Close the pane
    await paneClose(pane_id);

    // Clear state
    setOrchestratorState(null);

    // Persist state to file
    await saveStateToFile();

    return NextResponse.json({
      success: true,
      message: "Orchestrator stopped successfully",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Clear state on error (pane might already be closed)
    setOrchestratorState(null);
    await saveStateToFile();

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
