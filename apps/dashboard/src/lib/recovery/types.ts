/**
 * Recovery Types
 * Story 5.2 — Crash Recovery
 *
 * Type definitions for the recovery manager.
 */

/**
 * RecoveryManager configuration
 */
export interface RecoveryConfig {
  /** Maximum events to load from SQLite on recovery */
  maxEventsToLoad: number;
  /** Log recovery progress */
  verbose: boolean;
}

/**
 * Recovery result status
 */
export type RecoveryStatus = "success" | "partial" | "memory_only" | "failed";

/**
 * Result of a recovery operation
 */
export interface RecoveryResult {
  /** Overall recovery status */
  status: RecoveryStatus;
  /** Number of events loaded from SQLite */
  eventsLoaded: number;
  /** Number of panes detected from state file */
  panesDetected: number;
  /** Number of duplicate events skipped */
  duplicatesSkipped: number;
  /** Whether running in memory-only mode */
  memoryOnlyMode: boolean;
  /** Error message if recovery failed or partial */
  error?: string;
  /** Timestamp of recovery completion */
  timestamp: string;
}

/**
 * Recovery warning for WebSocket broadcast
 */
export interface RecoveryWarning {
  type: "recovery_warning";
  payload: {
    mode: "memory_only" | "partial_recovery";
    message: string;
    details?: string;
  };
  timestamp: string;
}
