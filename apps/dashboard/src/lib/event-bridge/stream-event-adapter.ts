/**
 * Stream Event Adapter
 *
 * Connects StreamJsonBridge to the WebSocket EventManager.
 * Transforms NormalizedStreamEvent to the format expected by the broadcaster
 * and handles session lifecycle events.
 *
 * @example
 * ```ts
 * const adapter = new StreamEventAdapter({
 *   watchDir: '/tmp',
 *   projectId: 'my-project',
 * });
 *
 * // Events are automatically forwarded to WebSocket clients
 * await adapter.start();
 * ```
 */

import { StreamJsonBridge, type StreamJsonBridgeConfig } from "./stream-json-bridge";
import { getEventManager } from "../websocket/event-manager";
import { getStreamEventStore } from "../persistence";
import type { NormalizedStreamEvent, SessionMetadata } from "@adwo/shared";

export interface StreamEventAdapterConfig extends StreamJsonBridgeConfig {
  /** Whether to emit debug logs */
  debug?: boolean;
  /** Whether to persist events to SQLite (default: true) */
  enablePersistence?: boolean;
}

/**
 * WebSocket message types for stream events
 */
export interface StreamEventMessage {
  type: "stream_event";
  payload: {
    event: NormalizedStreamEvent;
  };
  timestamp: string;
}

export interface SessionUpdateMessage {
  type: "session_update";
  payload: {
    session: SessionMetadata;
  };
  timestamp: string;
}

export interface SessionStartMessage {
  type: "session_start";
  payload: {
    paneId: string;
    session: SessionMetadata;
  };
  timestamp: string;
}

export type StreamEventCallback = (event: NormalizedStreamEvent) => void;
export type SessionUpdateCallback = (session: SessionMetadata) => void;

export class StreamEventAdapter {
  private bridge: StreamJsonBridge;
  private debug: boolean;
  private persistenceEnabled: boolean;
  private eventCallbacks: StreamEventCallback[] = [];
  private sessionCallbacks: SessionUpdateCallback[] = [];
  private running = false;

  constructor(config: StreamEventAdapterConfig = {}) {
    this.debug = config.debug ?? false;
    this.persistenceEnabled = config.enablePersistence ?? true;

    this.bridge = new StreamJsonBridge({
      watchDir: config.watchDir,
      filePattern: config.filePattern,
      projectId: config.projectId,
    });

    // Initialize persistence if enabled
    if (this.persistenceEnabled) {
      try {
        const store = getStreamEventStore();
        if (!store.isInitialized()) {
          store.initialize();
        }
        console.log("[StreamEventAdapter] Persistence enabled");
      } catch (error) {
        console.error("[StreamEventAdapter] Failed to initialize persistence:", error);
        this.persistenceEnabled = false;
      }
    }

    this.setupHandlers();
  }

  /**
   * Wire up bridge event handlers to forward to WebSocket
   */
  private setupHandlers(): void {
    // Forward stream events to EventManager and callbacks
    this.bridge.onEvent((event) => {
      if (this.debug) {
        console.log(`[StreamEventAdapter] Event: ${event.category} - ${event.content.slice(0, 50)}...`);
      }

      // Persist to SQLite (non-blocking)
      if (this.persistenceEnabled) {
        try {
          const store = getStreamEventStore();
          store.insertEventAsync(event);
        } catch (error) {
          console.error("[StreamEventAdapter] Persistence error:", error);
        }
      }

      // Broadcast to WebSocket clients
      const eventManager = getEventManager();
      eventManager.broadcastRaw<{ event: NormalizedStreamEvent }>({
        type: "stream_event",
        payload: { event },
        timestamp: new Date().toISOString(),
      });

      // Notify local callbacks
      for (const callback of this.eventCallbacks) {
        try {
          callback(event);
        } catch (error) {
          console.error("[StreamEventAdapter] Event callback error:", error);
        }
      }
    });

    // Forward session events
    this.bridge.onSession((session) => {
      if (this.debug) {
        console.log(`[StreamEventAdapter] Session update: ${session.pane_id} - $${session.total_cost.toFixed(4)}`);
      }

      // Persist session to SQLite
      if (this.persistenceEnabled) {
        try {
          const store = getStreamEventStore();
          store.upsertSession(session);
        } catch (error) {
          console.error("[StreamEventAdapter] Session persistence error:", error);
        }
      }

      // Broadcast session update to WebSocket clients
      const eventManager = getEventManager();
      eventManager.broadcastRaw<{ session: SessionMetadata }>({
        type: "session_update",
        payload: { session },
        timestamp: new Date().toISOString(),
      });

      // Notify local callbacks
      for (const callback of this.sessionCallbacks) {
        try {
          callback(session);
        } catch (error) {
          console.error("[StreamEventAdapter] Session callback error:", error);
        }
      }
    });

    // Forward errors
    this.bridge.onError((paneId, error) => {
      console.error(`[StreamEventAdapter] Error for pane ${paneId}:`, error.message);

      // Broadcast error event
      const eventManager = getEventManager();
      eventManager.broadcastRaw<{ paneId: string; message: string }>({
        type: "stream_error",
        payload: { paneId, message: error.message },
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Register event callback (in addition to WebSocket broadcast)
   */
  onEvent(callback: StreamEventCallback): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Register session update callback
   */
  onSession(callback: SessionUpdateCallback): void {
    this.sessionCallbacks.push(callback);
  }

  /**
   * Start the adapter
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn("[StreamEventAdapter] Already running");
      return;
    }

    console.log("[StreamEventAdapter] Starting...");
    await this.bridge.start();
    this.running = true;
    console.log("[StreamEventAdapter] Started successfully");
  }

  /**
   * Stop the adapter
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    console.log("[StreamEventAdapter] Stopping...");
    await this.bridge.stop();
    this.running = false;
    console.log("[StreamEventAdapter] Stopped");
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get active sessions
   */
  getSessions(): SessionMetadata[] {
    return this.bridge.getSessions();
  }

  /**
   * Get session by pane ID
   */
  getSession(paneId: string): SessionMetadata | undefined {
    return this.bridge.getSession(paneId);
  }

  /**
   * Get underlying bridge instance
   */
  getBridge(): StreamJsonBridge {
    return this.bridge;
  }
}

// Singleton instance
let streamEventAdapterInstance: StreamEventAdapter | null = null;

/**
 * Get or create the StreamEventAdapter singleton
 */
export function getStreamEventAdapter(config?: StreamEventAdapterConfig): StreamEventAdapter {
  if (!streamEventAdapterInstance) {
    streamEventAdapterInstance = new StreamEventAdapter(config);
  }
  return streamEventAdapterInstance;
}

/**
 * Reset the StreamEventAdapter singleton (for testing)
 */
export async function resetStreamEventAdapter(): Promise<void> {
  if (streamEventAdapterInstance) {
    await streamEventAdapterInstance.stop();
    streamEventAdapterInstance = null;
  }
}
