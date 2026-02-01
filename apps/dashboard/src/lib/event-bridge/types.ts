/**
 * Event Bridge Types
 *
 * Type definitions for the Event Bridge module that reads terminal output
 * from Conduit panes and manages pane lifecycle.
 */

/**
 * Represents a terminal pane from Conduit
 */
export interface ConduitPane {
  id: string;
  type: "terminal" | "editor" | "browser" | "canvas";
  sessionId: string;
  cwd: string;
  title: string;
}

/**
 * Tracked pane with reading state
 */
export interface TrackedPane {
  id: string;
  title?: string;
  lastReadAt: number;
  errorCount: number;
  backoffUntil: number;
}

/**
 * Raw terminal output event from a pane read
 */
export interface TerminalOutputEvent {
  paneId: string;
  content: string;
  timestamp: number;
}

/**
 * Orchestrator state structure (subset relevant to Event Bridge)
 */
export interface OrchestratorState {
  version: string;
  current_session: {
    phase: "idle" | "implementation" | "testing" | string;
    current_agent: {
      pane_id: string | null;
      started_at: string | null;
    };
  };
  panes?: string[];
}

/**
 * Event Bridge configuration
 */
export interface EventBridgeConfig {
  stateFilePath: string;
  pollIntervalMs: number;
  maxErrorCount: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
}

/**
 * Event handler callback types
 */
export type OutputHandler = (event: TerminalOutputEvent) => void;
export type ErrorHandler = (paneId: string, error: Error) => void;
export type PaneChangeHandler = (added: string[], removed: string[]) => void;

/**
 * Handler for normalized terminal events (after delta detection)
 */
export type NormalizedEventHandler = (
  event: import("@adwo/shared").NormalizedTerminalEvent
) => void;
