/**
 * Event Bridge
 *
 * Core module that coordinates reading terminal output from Conduit panes.
 * Watches orchestrator-state.json for pane registrations and polls terminals
 * for new output via the Conduit CLI.
 *
 * @example
 * ```ts
 * const eventBridge = new EventBridge({
 *   stateFilePath: '/path/to/orchestrator-state.json',
 * });
 *
 * eventBridge.onOutput((event) => {
 *   console.log(`[${event.paneId}] ${event.content}`);
 * });
 *
 * await eventBridge.start();
 * ```
 */

import { StateWatcher } from "./state-watcher";
import { TerminalReader } from "./terminal-reader";
import { DeltaDetector } from "./delta-detector";
import type { NormalizedTerminalEvent } from "@adwo/shared";
import type {
  EventBridgeConfig,
  TerminalOutputEvent,
  OutputHandler,
  ErrorHandler,
  PaneChangeHandler,
  NormalizedEventHandler,
} from "./types";

export type {
  EventBridgeConfig,
  TerminalOutputEvent,
  NormalizedEventHandler,
} from "./types";
export type {
  NormalizedTerminalEvent,
  QuestionMetadata,
  QuestionOption,
  NormalizedStreamEvent,
  SessionMetadata,
  StreamJsonEvent,
} from "@adwo/shared";
export { DeltaDetector, stripAnsi, detectEventType } from "./delta-detector";
export {
  QuestionDetector,
  isQuestionPattern,
  parseQuestion,
  getQuestionDetector,
  resetQuestionDetector,
} from "./question-detector";

// Stream JSON support (new approach)
export {
  JsonlFileReader,
  type JsonlFileReaderConfig,
  type StreamEventHandler,
} from "./jsonl-file-reader";
export {
  StreamJsonBridge,
  getStreamJsonBridge,
  resetStreamJsonBridge,
  type StreamJsonBridgeConfig,
  type StreamEventCallback,
  type SessionCallback,
} from "./stream-json-bridge";

export interface EventBridgeFullConfig extends EventBridgeConfig {
  projectId: string;
}

const DEFAULT_CONFIG: EventBridgeFullConfig = {
  stateFilePath: "",
  pollIntervalMs: 150,
  maxErrorCount: 5,
  baseBackoffMs: 1000,
  maxBackoffMs: 30000,
  projectId: "default",
};

export class EventBridge {
  private config: EventBridgeFullConfig;
  private stateWatcher: StateWatcher;
  private terminalReader: TerminalReader;
  private deltaDetector: DeltaDetector;
  private outputHandlers: OutputHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private paneChangeHandlers: PaneChangeHandler[] = [];
  private normalizedEventHandlers: NormalizedEventHandler[] = [];
  private running = false;

  constructor(
    config: Partial<EventBridgeFullConfig> & { stateFilePath: string }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.stateWatcher = new StateWatcher({
      stateFilePath: this.config.stateFilePath,
    });

    this.terminalReader = new TerminalReader({
      pollIntervalMs: this.config.pollIntervalMs,
      maxErrorCount: this.config.maxErrorCount,
      baseBackoffMs: this.config.baseBackoffMs,
      maxBackoffMs: this.config.maxBackoffMs,
    });

    this.deltaDetector = new DeltaDetector({
      projectId: this.config.projectId,
    });

    this.setupHandlers();
  }

  /**
   * Wire up internal event handlers
   */
  private setupHandlers(): void {
    // Forward terminal output events and process through delta detector
    this.terminalReader.onOutput((event) => {
      // First, call raw output handlers
      for (const handler of this.outputHandlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(
            `[EventBridge] Output handler error: ${(error as Error).message}`
          );
        }
      }

      // Then, process through delta detector and emit normalized events
      const normalizedEvents = this.deltaDetector.process(event);
      for (const normalizedEvent of normalizedEvents) {
        for (const handler of this.normalizedEventHandlers) {
          try {
            handler(normalizedEvent);
          } catch (error) {
            console.error(
              `[EventBridge] Normalized event handler error: ${(error as Error).message}`
            );
          }
        }
      }
    });

    // Forward error events
    this.terminalReader.onError((paneId, error) => {
      for (const handler of this.errorHandlers) {
        try {
          handler(paneId, error);
        } catch (err) {
          console.error(
            `[EventBridge] Error handler error: ${(err as Error).message}`
          );
        }
      }
    });

    // Handle pane changes from state watcher
    this.stateWatcher.onChange((added, removed) => {
      // Remove old panes
      for (const paneId of removed) {
        this.terminalReader.removePane(paneId);
        this.deltaDetector.clearPane(paneId);
      }

      // Add new panes
      for (const paneId of added) {
        this.terminalReader.addPane(paneId);
      }

      // Notify listeners
      for (const handler of this.paneChangeHandlers) {
        try {
          handler(added, removed);
        } catch (error) {
          console.error(
            `[EventBridge] Pane change handler error: ${(error as Error).message}`
          );
        }
      }
    });
  }

  /**
   * Register output event handler
   */
  onOutput(handler: OutputHandler): void {
    this.outputHandlers.push(handler);
  }

  /**
   * Register error handler
   */
  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Register pane change handler
   */
  onPaneChange(handler: PaneChangeHandler): void {
    this.paneChangeHandlers.push(handler);
  }

  /**
   * Register normalized event handler (delta-detected, ANSI-stripped events)
   */
  onNormalizedEvent(handler: NormalizedEventHandler): void {
    this.normalizedEventHandlers.push(handler);
  }

  /**
   * Start the Event Bridge
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn("[EventBridge] Already running");
      return;
    }

    console.log("[EventBridge] Starting...");
    console.log(`[EventBridge] State file: ${this.config.stateFilePath}`);
    console.log(`[EventBridge] Poll interval: ${this.config.pollIntervalMs}ms`);

    // Start watching state file first
    await this.stateWatcher.start();

    // Then start terminal reader
    this.terminalReader.start();

    this.running = true;
    console.log("[EventBridge] Started successfully");
  }

  /**
   * Stop the Event Bridge
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    console.log("[EventBridge] Stopping...");

    this.terminalReader.stop();
    await this.stateWatcher.stop();

    this.running = false;
    console.log("[EventBridge] Stopped");
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current tracked pane IDs
   */
  getTrackedPanes(): string[] {
    return this.terminalReader.getTrackedPanes();
  }

  /**
   * Manually add a pane (for testing or direct control)
   */
  addPane(paneId: string, title?: string): void {
    this.terminalReader.addPane(paneId, title);
  }

  /**
   * Manually remove a pane
   */
  removePane(paneId: string): void {
    this.terminalReader.removePane(paneId);
    this.deltaDetector.clearPane(paneId);
  }

  /**
   * Update the project ID for normalized events
   */
  setProjectId(projectId: string): void {
    this.config.projectId = projectId;
    this.deltaDetector.setProjectId(projectId);
  }

  /**
   * Get current project ID
   */
  getProjectId(): string {
    return this.config.projectId;
  }
}

// Singleton instance for use across the application
let eventBridgeInstance: EventBridge | null = null;

/**
 * Get or create the EventBridge singleton
 */
export function getEventBridge(
  config?: Partial<EventBridgeFullConfig> & { stateFilePath: string }
): EventBridge {
  if (!eventBridgeInstance) {
    if (!config?.stateFilePath) {
      throw new Error("EventBridge requires stateFilePath on first initialization");
    }
    eventBridgeInstance = new EventBridge(config);
  }
  return eventBridgeInstance;
}

/**
 * Reset the EventBridge singleton (for testing)
 */
export async function resetEventBridge(): Promise<void> {
  if (eventBridgeInstance) {
    await eventBridgeInstance.stop();
    eventBridgeInstance = null;
  }
}
