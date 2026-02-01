/**
 * Dashboard Status API
 * Story 5.2 — Crash Recovery
 *
 * GET /api/status
 * Returns dashboard status including recovery state.
 */

import { NextResponse } from "next/server";
import { getEventManager } from "@/lib/websocket";

export async function GET() {
  const eventManager = getEventManager();
  const recoveryResult = eventManager.getRecoveryResult();

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    recovery: {
      complete: eventManager.isRecoveryComplete(),
      memoryOnlyMode: eventManager.isMemoryOnlyMode(),
      result: recoveryResult
        ? {
            status: recoveryResult.status,
            eventsLoaded: recoveryResult.eventsLoaded,
            duplicatesSkipped: recoveryResult.duplicatesSkipped,
            timestamp: recoveryResult.timestamp,
          }
        : null,
    },
    persistence: {
      enabled: eventManager.isPersistenceEnabled(),
    },
    buffer: {
      size: eventManager.getBufferSize(),
      capacity: eventManager.getBufferCapacity(),
    },
    clients: eventManager.getClientCount(),
  });
}
