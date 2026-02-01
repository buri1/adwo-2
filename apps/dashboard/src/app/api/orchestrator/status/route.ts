/**
 * GET /api/orchestrator/status
 *
 * Returns the current orchestrator state.
 * Used by the dashboard to display the orchestrator status and button state.
 */

import { NextResponse } from "next/server";
import {
  getOrchestratorState,
  isOrchestratorRunning,
  loadStateFromFile,
} from "@/lib/orchestrator/state";

export async function GET() {
  try {
    // Attempt to load state from file if not in memory (e.g., after server restart)
    if (!getOrchestratorState()) {
      await loadStateFromFile();
    }

    const state = getOrchestratorState();
    const isRunning = isOrchestratorRunning();

    return NextResponse.json({
      isRunning,
      status: state?.status ?? "stopped",
      paneId: state?.paneId ?? null,
      startedAt: state?.startedAt ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
