/**
 * POST /api/orchestrator/message
 *
 * Sends a message to the orchestrator by writing to its terminal pane.
 */

import { NextRequest, NextResponse } from "next/server";
import { terminalWrite, terminalSendEnter } from "@/lib/conduit";
import {
  getOrchestratorState,
  isOrchestratorRunning,
} from "@/lib/orchestrator/state";

interface MessageRequestBody {
  text: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MessageRequestBody;
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text is required and must be a string" },
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
    if (!state) {
      return NextResponse.json(
        { error: "Orchestrator state not found" },
        { status: 500 }
      );
    }

    // Write message to terminal
    await terminalWrite(state.paneId, text);
    await terminalSendEnter(state.paneId);

    return NextResponse.json({
      success: true,
      pane_id: state.paneId,
      message: "Message sent successfully",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
