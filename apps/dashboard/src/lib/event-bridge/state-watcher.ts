/**
 * State Watcher
 *
 * Watches orchestrator-state.json for changes and extracts registered pane IDs.
 * Uses chokidar for efficient file system watching.
 */

import { watch, type FSWatcher } from "chokidar";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { OrchestratorState, PaneChangeHandler } from "./types";

export interface StateWatcherConfig {
  stateFilePath: string;
  debounceMs?: number;
}

export class StateWatcher {
  private config: StateWatcherConfig;
  private watcher: FSWatcher | null = null;
  private currentPanes: Set<string> = new Set();
  private changeHandler: PaneChangeHandler | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(config: StateWatcherConfig) {
    this.config = {
      debounceMs: 100,
      ...config,
    };
  }

  /**
   * Set handler for pane changes
   */
  onChange(handler: PaneChangeHandler): void {
    this.changeHandler = handler;
  }

  /**
   * Start watching the state file
   */
  async start(): Promise<void> {
    if (this.running) return;

    // Check if file exists
    if (!existsSync(this.config.stateFilePath)) {
      console.log(
        `[EventBridge] State file not found: ${this.config.stateFilePath}`
      );
      console.log("[EventBridge] Will watch for file creation...");
    }

    // Initialize watcher
    this.watcher = watch(this.config.stateFilePath, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 50,
        pollInterval: 10,
      },
    });

    this.watcher.on("add", () => {
      console.log(`[EventBridge] State file created: ${this.config.stateFilePath}`);
      void this.handleFileChange();
    });

    this.watcher.on("change", () => {
      this.debouncedHandleChange();
    });

    this.watcher.on("unlink", () => {
      console.log(`[EventBridge] State file removed: ${this.config.stateFilePath}`);
      this.handleFileRemoved();
    });

    this.watcher.on("error", (error: unknown) => {
      console.error(`[EventBridge] Watcher error: ${error instanceof Error ? error.message : String(error)}`);
    });

    this.running = true;
    console.log(`[EventBridge] Watching state file: ${this.config.stateFilePath}`);

    // Do initial read
    await this.handleFileChange();
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    this.running = false;
    console.log("[EventBridge] State watcher stopped");
  }

  /**
   * Get currently registered pane IDs
   */
  getCurrentPanes(): string[] {
    return Array.from(this.currentPanes);
  }

  /**
   * Debounced file change handler
   */
  private debouncedHandleChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      void this.handleFileChange();
    }, this.config.debounceMs);
  }

  /**
   * Handle state file change
   */
  private async handleFileChange(): Promise<void> {
    try {
      const content = await readFile(this.config.stateFilePath, "utf-8");
      const state = JSON.parse(content) as OrchestratorState;
      const newPanes = this.extractPaneIds(state);

      this.processChanges(newPanes);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // File doesn't exist yet, clear panes
        this.processChanges(new Set());
      } else {
        console.error(
          `[EventBridge] Error reading state file: ${(error as Error).message}`
        );
      }
    }
  }

  /**
   * Handle file removal
   */
  private handleFileRemoved(): void {
    this.processChanges(new Set());
  }

  /**
   * Extract pane IDs from state
   */
  private extractPaneIds(state: OrchestratorState): Set<string> {
    const panes = new Set<string>();

    // Current agent pane
    if (state.current_session?.current_agent?.pane_id) {
      panes.add(state.current_session.current_agent.pane_id);
    }

    // Additional panes array (for future multi-pane support)
    if (state.panes && Array.isArray(state.panes)) {
      for (const paneId of state.panes) {
        if (typeof paneId === "string" && paneId.length > 0) {
          panes.add(paneId);
        }
      }
    }

    return panes;
  }

  /**
   * Process changes and emit events
   */
  private processChanges(newPanes: Set<string>): void {
    const added: string[] = [];
    const removed: string[] = [];

    // Find added panes
    for (const paneId of Array.from(newPanes)) {
      if (!this.currentPanes.has(paneId)) {
        added.push(paneId);
      }
    }

    // Find removed panes
    for (const paneId of Array.from(this.currentPanes)) {
      if (!newPanes.has(paneId)) {
        removed.push(paneId);
      }
    }

    // Update current state
    this.currentPanes = newPanes;

    // Emit change event if there were changes
    if ((added.length > 0 || removed.length > 0) && this.changeHandler) {
      console.log(
        `[EventBridge] Pane changes - added: [${added.join(", ")}], removed: [${removed.join(", ")}]`
      );
      this.changeHandler(added, removed);
    }
  }
}
