/**
 * Recovery Manager
 * Story 5.2 — Crash Recovery
 *
 * Manages graceful recovery from crashes by:
 * 1. Loading events from SQLite and repopulating RingBuffer
 * 2. Detecting active panes from orchestrator-state.json
 * 3. Preventing duplicates via event ID tracking
 * 4. Falling back to memory-only mode if SQLite unavailable
 */

import type { NormalizedTerminalEvent } from "@adwo/shared";
import type { EventStore } from "../persistence/event-store";
import type { RingBuffer } from "../websocket/ring-buffer";
import type { RecoveryConfig, RecoveryResult, RecoveryWarning } from "./types";

// Default configuration
const DEFAULT_CONFIG: RecoveryConfig = {
  maxEventsToLoad: 1000,
  verbose: true,
};

export class RecoveryManager {
  private config: RecoveryConfig;
  private seenEventIds: Set<string> = new Set();
  private memoryOnlyMode = false;
  private recoveryComplete = false;
  private lastRecoveryResult: RecoveryResult | null = null;
  private pendingWarning: RecoveryWarning | null = null;

  constructor(config: Partial<RecoveryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Perform recovery: Load events from SQLite into RingBuffer.
   *
   * Recovery sequence:
   * 1. Try to initialize EventStore (SQLite)
   * 2. Load recent events from SQLite
   * 3. Populate RingBuffer with loaded events (tracking IDs for dedup)
   * 4. If SQLite fails, set memory-only mode
   *
   * @param eventStore - The EventStore instance (may be null if unavailable)
   * @param buffer - The RingBuffer to populate
   * @returns RecoveryResult with status and statistics
   */
  public async recover(
    eventStore: EventStore | null,
    buffer: RingBuffer<NormalizedTerminalEvent>
  ): Promise<RecoveryResult> {
    if (this.config.verbose) {
      console.log("[RecoveryManager] Starting recovery...");
    }

    const result: RecoveryResult = {
      status: "success",
      eventsLoaded: 0,
      panesDetected: 0,
      duplicatesSkipped: 0,
      memoryOnlyMode: false,
      timestamp: new Date().toISOString(),
    };

    // Check if EventStore is available
    if (!eventStore) {
      return this.handleMemoryOnlyMode(result, "EventStore not provided");
    }

    // Try to access SQLite
    try {
      if (!eventStore.isInitialized()) {
        return this.handleMemoryOnlyMode(result, "EventStore not initialized");
      }

      // Load recent events from SQLite
      const events = eventStore.getRecent(this.config.maxEventsToLoad);

      if (this.config.verbose) {
        console.log(`[RecoveryManager] Found ${events.length} events in SQLite`);
      }

      // Populate RingBuffer with events, tracking IDs to prevent duplicates
      for (const event of events) {
        if (this.seenEventIds.has(event.id)) {
          result.duplicatesSkipped++;
          continue;
        }

        // Add to seen IDs
        this.seenEventIds.add(event.id);

        // Push to buffer
        buffer.push(event);
        result.eventsLoaded++;
      }

      // Limit seen IDs set size to prevent memory growth
      this.pruneSeenEventIds();

      if (this.config.verbose) {
        console.log(
          `[RecoveryManager] Loaded ${result.eventsLoaded} events into buffer, skipped ${result.duplicatesSkipped} duplicates`
        );
      }

      result.status = "success";
      this.recoveryComplete = true;
      this.lastRecoveryResult = result;

      console.log("[RecoveryManager] Recovery complete");
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[RecoveryManager] SQLite access failed:", errorMessage);
      return this.handleMemoryOnlyMode(result, errorMessage);
    }
  }

  /**
   * Handle transition to memory-only mode when SQLite is unavailable.
   */
  private handleMemoryOnlyMode(result: RecoveryResult, reason: string): RecoveryResult {
    this.memoryOnlyMode = true;
    result.memoryOnlyMode = true;
    result.status = "memory_only";
    result.error = reason;

    // Prepare warning for WebSocket broadcast
    this.pendingWarning = {
      type: "recovery_warning",
      payload: {
        mode: "memory_only",
        message: "Running in memory-only mode. Events will not be persisted.",
        details: reason,
      },
      timestamp: new Date().toISOString(),
    };

    console.warn(`[RecoveryManager] Memory-only mode: ${reason}`);

    this.recoveryComplete = true;
    this.lastRecoveryResult = result;
    return result;
  }

  /**
   * Check if an event has already been processed (for duplicate prevention).
   * Call this before emitting new events to avoid duplicates.
   */
  public isEventSeen(eventId: string): boolean {
    return this.seenEventIds.has(eventId);
  }

  /**
   * Mark an event as seen (for duplicate tracking).
   * Called automatically when events are emitted through EventManager.
   */
  public markEventSeen(eventId: string): void {
    this.seenEventIds.add(eventId);
    // Periodically prune to prevent memory growth
    if (this.seenEventIds.size > 2000) {
      this.pruneSeenEventIds();
    }
  }

  /**
   * Prune old event IDs to prevent unbounded memory growth.
   * Keeps the most recent 1000 IDs.
   */
  private pruneSeenEventIds(): void {
    if (this.seenEventIds.size <= 1000) return;

    // Convert to array, keep only last 1000 (assumes chronological insertion)
    const ids = Array.from(this.seenEventIds);
    const toKeep = ids.slice(-1000);
    this.seenEventIds = new Set(toKeep);

    if (this.config.verbose) {
      console.log(`[RecoveryManager] Pruned seen IDs: ${ids.length} -> ${toKeep.length}`);
    }
  }

  /**
   * Check if running in memory-only mode.
   */
  public isMemoryOnlyMode(): boolean {
    return this.memoryOnlyMode;
  }

  /**
   * Check if recovery is complete.
   */
  public isRecoveryComplete(): boolean {
    return this.recoveryComplete;
  }

  /**
   * Get the last recovery result.
   */
  public getLastRecoveryResult(): RecoveryResult | null {
    return this.lastRecoveryResult;
  }

  /**
   * Get pending warning for WebSocket broadcast.
   * Returns null if no warning pending.
   * After calling this, the warning is cleared.
   */
  public consumePendingWarning(): RecoveryWarning | null {
    const warning = this.pendingWarning;
    this.pendingWarning = null;
    return warning;
  }

  /**
   * Get number of seen event IDs (for testing/debugging).
   */
  public getSeenEventCount(): number {
    return this.seenEventIds.size;
  }

  /**
   * Clear all state (for testing).
   */
  public reset(): void {
    this.seenEventIds.clear();
    this.memoryOnlyMode = false;
    this.recoveryComplete = false;
    this.lastRecoveryResult = null;
    this.pendingWarning = null;
  }
}

// Singleton instance
let recoveryManagerInstance: RecoveryManager | null = null;

/**
 * Get or create the RecoveryManager singleton.
 */
export function getRecoveryManager(config?: Partial<RecoveryConfig>): RecoveryManager {
  if (!recoveryManagerInstance) {
    recoveryManagerInstance = new RecoveryManager(config);
  }
  return recoveryManagerInstance;
}

/**
 * Reset the RecoveryManager singleton (for testing).
 */
export function resetRecoveryManager(): void {
  if (recoveryManagerInstance) {
    recoveryManagerInstance.reset();
    recoveryManagerInstance = null;
  }
}
