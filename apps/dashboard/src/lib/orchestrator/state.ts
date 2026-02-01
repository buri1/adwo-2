/**
 * Orchestrator State Manager
 *
 * Manages the active orchestrator pane state in memory with optional
 * persistence to orchestrator-state.json.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface OrchestratorPaneState {
  paneId: string;
  startedAt: string;
  status: "starting" | "running" | "stopping";
}

// In-memory state for the active orchestrator pane
let activeOrchestrator: OrchestratorPaneState | null = null;

/**
 * Get the current orchestrator state
 */
export function getOrchestratorState(): OrchestratorPaneState | null {
  return activeOrchestrator;
}

/**
 * Set the orchestrator state
 */
export function setOrchestratorState(
  state: OrchestratorPaneState | null
): void {
  activeOrchestrator = state;
}

/**
 * Check if orchestrator is currently running
 */
export function isOrchestratorRunning(): boolean {
  return (
    activeOrchestrator !== null && activeOrchestrator.status !== "stopping"
  );
}

/**
 * Path to the orchestrator state file in .bmad directory
 */
function getStateFilePath(): string {
  return join(process.cwd(), ".bmad", "orchestrator-state.json");
}

/**
 * Load orchestrator state from file (for recovery after restart)
 */
export async function loadStateFromFile(): Promise<void> {
  try {
    const content = await readFile(getStateFilePath(), "utf-8");
    const state = JSON.parse(content);

    // Check if there's an active orchestrator pane in the file
    if (state.current_agent?.pane_id && state.current_agent?.type === "orchestrator") {
      activeOrchestrator = {
        paneId: state.current_agent.pane_id,
        startedAt: state.current_agent.spawned_at || new Date().toISOString(),
        status: "running",
      };
    }
  } catch {
    // State file doesn't exist or is invalid - start fresh
    activeOrchestrator = null;
  }
}

/**
 * Persist orchestrator state to file
 */
export async function saveStateToFile(): Promise<void> {
  try {
    const content = await readFile(getStateFilePath(), "utf-8");
    const state = JSON.parse(content);

    if (activeOrchestrator) {
      state.current_agent = {
        pane_id: activeOrchestrator.paneId,
        type: "orchestrator",
        spawned_at: activeOrchestrator.startedAt,
      };
    } else {
      state.current_agent = null;
    }

    state.last_updated = new Date().toISOString();

    await writeFile(getStateFilePath(), JSON.stringify(state, null, 2));
  } catch {
    // If file doesn't exist, create minimal state
    const state = {
      current_agent: activeOrchestrator
        ? {
            pane_id: activeOrchestrator.paneId,
            type: "orchestrator",
            spawned_at: activeOrchestrator.startedAt,
          }
        : null,
      last_updated: new Date().toISOString(),
    };

    await writeFile(getStateFilePath(), JSON.stringify(state, null, 2));
  }
}
