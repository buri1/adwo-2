/**
 * Stream JSON Bridge
 *
 * Alternative Event Bridge that reads structured JSONL files from
 * Claude Code's --output-format stream-json instead of polling terminals.
 *
 * Benefits over terminal reading:
 * - Structured data (no ANSI parsing needed)
 * - Cost information included (total_cost_usd)
 * - Model and tool information available
 * - More reliable event detection
 *
 * @example
 * ```ts
 * const bridge = new StreamJsonBridge({
 *   watchDir: '/tmp',
 *   projectId: 'my-project',
 * });
 *
 * bridge.onEvent((event) => {
 *   console.log(`[${event.category}] ${event.content}`);
 * });
 *
 * await bridge.start();
 * ```
 */

import { JsonlFileReader, type StreamEventHandler, type FileErrorHandler } from "./jsonl-file-reader";
import type { NormalizedStreamEvent, SessionMetadata } from "@adwo/shared";

export interface StreamJsonBridgeConfig {
  /** Directory to watch for JSONL files (default: /tmp) */
  watchDir?: string;
  /** File pattern to match (default: events-*.jsonl) */
  filePattern?: string;
  /** Project ID for event metadata */
  projectId?: string;
}

export type StreamEventCallback = (event: NormalizedStreamEvent) => void;
export type SessionCallback = (session: SessionMetadata) => void;
export type ErrorCallback = (paneId: string, error: Error) => void;

const DEFAULT_CONFIG: Required<StreamJsonBridgeConfig> = {
  watchDir: "/tmp",
  filePattern: "events-*.jsonl",
  projectId: "default",
};

export class StreamJsonBridge {
  private config: Required<StreamJsonBridgeConfig>;
  private reader: JsonlFileReader;
  private sessions: Map<string, SessionMetadata> = new Map();
  private eventHandlers: StreamEventCallback[] = [];
  private sessionHandlers: SessionCallback[] = [];
  private errorHandlers: ErrorCallback[] = [];
  private running = false;

  constructor(config: StreamJsonBridgeConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.reader = new JsonlFileReader({
      watchDir: this.config.watchDir,
      filePattern: this.config.filePattern,
    });

    this.setupHandlers();
  }

  /**
   * Wire up internal event handlers
   */
  private setupHandlers(): void {
    // Handle stream events
    this.reader.onEvent((event) => {
      // Update session metadata if this is a result event
      if (event.category === "result" && event.cost) {
        this.updateSessionMetrics(event);
      }

      // Notify all event handlers
      for (const handler of this.eventHandlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`[StreamJsonBridge] Event handler error:`, error);
        }
      }
    });

    // Handle file additions (new sessions)
    this.reader.onFileAdded((filePath, paneId) => {
      console.log(`[StreamJsonBridge] New session detected: ${paneId}`);

      // Create initial session metadata
      const session: SessionMetadata = {
        session_id: "",
        pane_id: paneId,
        model: "unknown",
        tools: [],
        cwd: "",
        started_at: new Date().toISOString(),
        total_cost: 0,
        total_tokens: { input: 0, output: 0 },
      };

      this.sessions.set(paneId, session);

      // Notify session handlers
      for (const handler of this.sessionHandlers) {
        try {
          handler(session);
        } catch (error) {
          console.error(`[StreamJsonBridge] Session handler error:`, error);
        }
      }
    });

    // Handle errors
    this.reader.onError((filePath, error) => {
      const paneId = filePath.match(/events-([^.]+)\.jsonl$/)?.[1] || filePath;

      for (const handler of this.errorHandlers) {
        try {
          handler(paneId, error);
        } catch (err) {
          console.error(`[StreamJsonBridge] Error handler error:`, err);
        }
      }
    });
  }

  /**
   * Update session metrics from result events
   */
  private updateSessionMetrics(event: NormalizedStreamEvent): void {
    const session = this.sessions.get(event.pane_id);
    if (session && event.cost) {
      session.total_cost += event.cost.total_usd;
      session.total_tokens.input += event.cost.input_tokens;
      session.total_tokens.output += event.cost.output_tokens;

      // Notify session handlers of update
      for (const handler of this.sessionHandlers) {
        try {
          handler(session);
        } catch (error) {
          console.error(`[StreamJsonBridge] Session update handler error:`, error);
        }
      }
    }
  }

  /**
   * Register event handler
   */
  onEvent(handler: StreamEventCallback): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Register session handler (called on new sessions and updates)
   */
  onSession(handler: SessionCallback): void {
    this.sessionHandlers.push(handler);
  }

  /**
   * Register error handler
   */
  onError(handler: ErrorCallback): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Start the bridge
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn("[StreamJsonBridge] Already running");
      return;
    }

    console.log("[StreamJsonBridge] Starting...");
    console.log(`[StreamJsonBridge] Watch dir: ${this.config.watchDir}`);
    console.log(`[StreamJsonBridge] File pattern: ${this.config.filePattern}`);

    await this.reader.start();

    this.running = true;
    console.log("[StreamJsonBridge] Started successfully");
  }

  /**
   * Stop the bridge
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    console.log("[StreamJsonBridge] Stopping...");
    await this.reader.stop();
    this.sessions.clear();
    this.running = false;
    console.log("[StreamJsonBridge] Stopped");
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get all active sessions
   */
  getSessions(): SessionMetadata[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session by pane ID
   */
  getSession(paneId: string): SessionMetadata | undefined {
    return this.sessions.get(paneId);
  }

  /**
   * Get tracked file paths
   */
  getTrackedFiles(): Array<{ path: string; paneId: string; sessionId: string | null }> {
    return this.reader.getTrackedFiles();
  }

  /**
   * Manually add a file to track
   */
  async addFile(filePath: string): Promise<void> {
    await this.reader.addFile(filePath);
  }

  /**
   * Update project ID
   */
  setProjectId(projectId: string): void {
    this.config.projectId = projectId;
  }

  /**
   * Get current project ID
   */
  getProjectId(): string {
    return this.config.projectId;
  }
}

// Singleton instance
let streamJsonBridgeInstance: StreamJsonBridge | null = null;

/**
 * Get or create the StreamJsonBridge singleton
 */
export function getStreamJsonBridge(config?: StreamJsonBridgeConfig): StreamJsonBridge {
  if (!streamJsonBridgeInstance) {
    streamJsonBridgeInstance = new StreamJsonBridge(config);
  }
  return streamJsonBridgeInstance;
}

/**
 * Reset the StreamJsonBridge singleton (for testing)
 */
export async function resetStreamJsonBridge(): Promise<void> {
  if (streamJsonBridgeInstance) {
    await streamJsonBridgeInstance.stop();
    streamJsonBridgeInstance = null;
  }
}
