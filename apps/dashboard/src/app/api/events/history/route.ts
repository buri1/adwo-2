/**
 * GET /api/events/history
 * Story 5.1 — SQLite Persistence for Events (AC4)
 *
 * Returns recent events from SQLite for dashboard initial load.
 * Supports filtering by project, pane, type, and pagination.
 */

import { NextRequest, NextResponse } from "next/server";
import { getEventManager } from "@/lib/websocket/event-manager";
import type { TerminalEventType } from "@adwo/shared";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10)),
      1000 // Max 1000 events per request
    );
    const projectId = searchParams.get("project_id") ?? undefined;
    const paneId = searchParams.get("pane_id") ?? undefined;
    const type = searchParams.get("type") as TerminalEventType | undefined;
    const since = searchParams.get("since") ?? undefined;
    const afterId = searchParams.get("after_id") ?? undefined;
    const order = (searchParams.get("order") ?? "asc") as "asc" | "desc";

    const eventManager = getEventManager();

    // Check if persistence is enabled
    if (!eventManager.isPersistenceEnabled()) {
      // Fall back to in-memory buffer
      console.warn("[API] Persistence not enabled, returning buffer events");
      const events = eventManager.getAll();

      return NextResponse.json({
        events,
        total: events.length,
        hasMore: false,
        source: "buffer",
      });
    }

    // Query events from SQLite
    const result = eventManager.queryHistory({
      projectId,
      paneId,
      type: type && ["output", "question", "error", "status"].includes(type) ? type : undefined,
      since,
      afterId,
      limit,
      order,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to query event history" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      events: result.events,
      total: result.total,
      hasMore: result.hasMore,
      source: "sqlite",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[API] Error fetching event history:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
