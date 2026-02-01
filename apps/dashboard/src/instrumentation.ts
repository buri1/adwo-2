import { join } from "path";

/**
 * Next.js instrumentation hook
 *
 * Called once when the Next.js server starts. Used to initialize
 * server-side services like the Event Bridge.
 */
export async function register() {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    console.log("[ADWO] Dashboard starting...");

    // Dynamically import EventBridge to avoid client-side bundling
    const { getEventBridge } = await import("@/lib/event-bridge");

    // Resolve state file path
    // Default: orchestrator/_bmad/orchestrator-state.json from project root
    const stateFilePath =
      process.env["ORCHESTRATOR_STATE_FILE"] ??
      join(process.cwd(), "..", "..", "orchestrator", "_bmad", "orchestrator-state.json");

    try {
      const eventBridge = getEventBridge({ stateFilePath });

      // Log output events (will be replaced by WebSocket broadcast in Story 1.3)
      eventBridge.onOutput((event) => {
        console.log(
          `[EventBridge] Output from pane ${event.paneId}: ${event.content.slice(0, 100)}...`
        );
      });

      eventBridge.onError((paneId, error) => {
        console.error(`[EventBridge] Error from pane ${paneId}: ${error.message}`);
      });

      eventBridge.onPaneChange((added, removed) => {
        if (added.length > 0) {
          console.log(`[EventBridge] Panes added: ${added.join(", ")}`);
        }
        if (removed.length > 0) {
          console.log(`[EventBridge] Panes removed: ${removed.join(", ")}`);
        }
      });

      await eventBridge.start();
      console.log("[ADWO] Dashboard ready with Event Bridge");
    } catch (error) {
      console.error(
        `[ADWO] Failed to start Event Bridge: ${(error as Error).message}`
      );
      // Continue without Event Bridge - dashboard can still function
      console.log("[ADWO] Dashboard ready (without Event Bridge)");
    }
  }
}
