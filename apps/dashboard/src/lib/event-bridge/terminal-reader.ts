/**
 * Terminal Reader
 *
 * Manages polling of Conduit terminal panes via the `conduit terminal-read` CLI.
 * Supports reading from multiple panes in parallel with error handling and backoff.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type {
  TrackedPane,
  TerminalOutputEvent,
  OutputHandler,
  ErrorHandler,
} from "./types";

const execAsync = promisify(exec);

export interface TerminalReaderConfig {
  pollIntervalMs: number;
  maxErrorCount: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
}

const DEFAULT_CONFIG: TerminalReaderConfig = {
  pollIntervalMs: 150,
  maxErrorCount: 5,
  baseBackoffMs: 1000,
  maxBackoffMs: 30000,
};

export class TerminalReader {
  private config: TerminalReaderConfig;
  private panes: Map<string, TrackedPane> = new Map();
  private lastContent: Map<string, string> = new Map();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private outputHandler: OutputHandler | null = null;
  private errorHandler: ErrorHandler | null = null;
  private running = false;

  constructor(config: Partial<TerminalReaderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set handler for terminal output events
   */
  onOutput(handler: OutputHandler): void {
    this.outputHandler = handler;
  }

  /**
   * Set handler for errors
   */
  onError(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  /**
   * Start polling all registered panes
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.pollTimer = setInterval(() => {
      void this.pollAllPanes();
    }, this.config.pollIntervalMs);

    console.log(
      `[EventBridge] Terminal reader started (interval: ${this.config.pollIntervalMs}ms)`
    );
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.running = false;
    console.log("[EventBridge] Terminal reader stopped");
  }

  /**
   * Register a pane for reading
   */
  addPane(paneId: string, title?: string): void {
    if (this.panes.has(paneId)) return;

    this.panes.set(paneId, {
      id: paneId,
      title,
      lastReadAt: 0,
      errorCount: 0,
      backoffUntil: 0,
    });

    console.log(`[EventBridge] Added pane: ${paneId}${title ? ` (${title})` : ""}`);
  }

  /**
   * Unregister a pane and clean up
   */
  removePane(paneId: string): void {
    this.panes.delete(paneId);
    this.lastContent.delete(paneId);
    console.log(`[EventBridge] Removed pane: ${paneId}`);
  }

  /**
   * Get list of currently tracked pane IDs
   */
  getTrackedPanes(): string[] {
    return Array.from(this.panes.keys());
  }

  /**
   * Clear all panes
   */
  clearPanes(): void {
    this.panes.clear();
    this.lastContent.clear();
  }

  /**
   * Poll all registered panes in parallel
   */
  private async pollAllPanes(): Promise<void> {
    const now = Date.now();
    const readPromises: Promise<void>[] = [];

    for (const [paneId, pane] of Array.from(this.panes.entries())) {
      // Skip if in backoff period
      if (now < pane.backoffUntil) continue;

      readPromises.push(this.readPane(paneId, pane));
    }

    // Read all panes in parallel
    await Promise.allSettled(readPromises);
  }

  /**
   * Read a single pane via conduit terminal-read
   */
  private async readPane(paneId: string, pane: TrackedPane): Promise<void> {
    try {
      const { stdout } = await execAsync(`conduit terminal-read -p ${paneId}`, {
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      });

      // Update tracking state
      pane.lastReadAt = Date.now();
      pane.errorCount = 0;
      pane.backoffUntil = 0;

      // Check for new content
      const previousContent = this.lastContent.get(paneId) || "";
      if (stdout !== previousContent) {
        this.lastContent.set(paneId, stdout);

        // Emit event only if there's actual new content
        if (stdout.length > 0 && this.outputHandler) {
          const event: TerminalOutputEvent = {
            paneId,
            content: stdout,
            timestamp: Date.now(),
          };
          this.outputHandler(event);
        }
      }
    } catch (error) {
      this.handlePaneError(paneId, pane, error as Error);
    }
  }

  /**
   * Handle pane read error with exponential backoff
   */
  private handlePaneError(
    paneId: string,
    pane: TrackedPane,
    error: Error
  ): void {
    pane.errorCount++;

    // Calculate exponential backoff
    const backoffMs = Math.min(
      this.config.baseBackoffMs * Math.pow(2, pane.errorCount - 1),
      this.config.maxBackoffMs
    );
    pane.backoffUntil = Date.now() + backoffMs;

    console.warn(
      `[EventBridge] Error reading pane ${paneId} (attempt ${pane.errorCount}): ${error.message}`
    );
    console.warn(`[EventBridge] Backing off for ${backoffMs}ms`);

    // Emit error event
    if (this.errorHandler) {
      this.errorHandler(paneId, error);
    }

    // If max errors exceeded, log but continue trying (with backoff)
    if (pane.errorCount >= this.config.maxErrorCount) {
      console.error(
        `[EventBridge] Pane ${paneId} has failed ${pane.errorCount} times. ` +
          `Will continue retrying with ${this.config.maxBackoffMs}ms backoff.`
      );
    }
  }
}
