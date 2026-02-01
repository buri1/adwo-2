/**
 * Event Manager
 * Story 1.4 — WebSocket Server
 * Story 5.1 — SQLite Persistence for Events
 *
 * Coordinates the RingBuffer, WebSocket Broadcaster, and EventStore.
 * Receives events from EventBridge and manages distribution and persistence.
 */

import type { Server } from "http";
import type { NormalizedTerminalEvent } from "@adwo/shared";
import { RingBuffer } from "./ring-buffer";
import { WebSocketBroadcaster } from "./broadcaster";
import { getEventStore, resetEventStore, type EventStore, type EventStoreConfig, type EventQueryOptions, type EventQueryResult } from "../persistence";

// Default buffer size: 1000 events (AC5)
const DEFAULT_BUFFER_SIZE = 1000;

export interface EventManagerConfig {
  maxBufferSize?: number;
  persistence?: Partial<EventStoreConfig>;
  enablePersistence?: boolean;
}

export class EventManager {
  private buffer: RingBuffer<NormalizedTerminalEvent>;
  private broadcaster: WebSocketBroadcaster | null = null;
  private eventStore: EventStore | null = null;
  private persistenceEnabled: boolean;

  constructor(config: EventManagerConfig = {}) {
    const { maxBufferSize = DEFAULT_BUFFER_SIZE, persistence, enablePersistence = true } = config;

    this.buffer = new RingBuffer<NormalizedTerminalEvent>(maxBufferSize);
    this.persistenceEnabled = enablePersistence;

    console.log(
      `[EventManager] Initialized with buffer capacity: ${maxBufferSize}`
    );

    // Initialize SQLite persistence (Story 5.1)
    if (enablePersistence) {
      try {
        this.eventStore = getEventStore(persistence);
        this.eventStore.initialize();
        console.log("[EventManager] SQLite persistence enabled");
      } catch (error) {
        console.error("[EventManager] Failed to initialize persistence:", error);
        this.eventStore = null;
      }
    }
  }

  /**
   * Initialize the WebSocket broadcaster with the HTTP server.
   * Must be called after the server is created.
   */
  public initialize(server: Server) {
    if (this.broadcaster) {
      console.warn("[EventManager] Broadcaster already initialized");
      return;
    }
    this.broadcaster = new WebSocketBroadcaster(server, this.buffer);
    console.log("[EventManager] WebSocket broadcaster initialized");
  }

  /**
   * Emit an event: Push to buffer, persist to SQLite, and broadcast to clients.
   * AC5: Events are stored even without clients (max 1000 in-memory)
   * AC3: Events are broadcast to all clients (<100ms)
   * Story 5.1 AC2: Events are persisted async to SQLite (non-blocking)
   */
  public emit(event: NormalizedTerminalEvent) {
    // Always push to buffer (AC5)
    this.buffer.push(event);

    // Persist to SQLite async (Story 5.1 AC2 - non-blocking)
    if (this.eventStore) {
      this.eventStore.insertAsync(event);
    }

    // Broadcast if broadcaster is initialized
    if (this.broadcaster) {
      this.broadcaster.broadcast(event);
    }
  }

  /**
   * Broadcast a raw message to all connected clients.
   */
  public broadcastRaw<T>(message: {
    type: string;
    payload: T;
    timestamp: string;
  }) {
    if (this.broadcaster) {
      this.broadcaster.broadcastRaw(message);
    }
  }

  /**
   * Get the broadcaster instance.
   */
  public getBroadcaster(): WebSocketBroadcaster | null {
    return this.broadcaster;
  }

  /**
   * Get all events currently in the buffer.
   */
  public getAll(): NormalizedTerminalEvent[] {
    return this.buffer.getAll();
  }

  /**
   * Get events since a specific timestamp.
   */
  public getRecent(since: Date): NormalizedTerminalEvent[] {
    return this.buffer.getRecent(since);
  }

  /**
   * Get events since a specific event ID.
   */
  public getSince(lastEventId: string): NormalizedTerminalEvent[] {
    return this.buffer.getSince(lastEventId);
  }

  /**
   * Get current buffer size.
   */
  public getBufferSize(): number {
    return this.buffer.size();
  }

  /**
   * Get buffer capacity.
   */
  public getBufferCapacity(): number {
    return this.buffer.capacity();
  }

  /**
   * Get connected client count.
   */
  public getClientCount(): number {
    return this.broadcaster?.getClientCount() ?? 0;
  }

  /**
   * Check if broadcaster is initialized.
   */
  public isInitialized(): boolean {
    return this.broadcaster !== null;
  }

  /**
   * Check if persistence is enabled and initialized.
   */
  public isPersistenceEnabled(): boolean {
    return this.eventStore !== null && this.eventStore.isInitialized();
  }

  /**
   * Get event history from SQLite (Story 5.1 AC4).
   * For dashboard initial load after restart.
   */
  public getHistory(limit = 100): NormalizedTerminalEvent[] {
    if (!this.eventStore) {
      console.warn("[EventManager] Persistence not enabled, returning buffer");
      return this.buffer.getAll();
    }

    try {
      return this.eventStore.getRecent(limit);
    } catch (error) {
      console.error("[EventManager] Failed to get history from SQLite:", error);
      return this.buffer.getAll();
    }
  }

  /**
   * Query events from SQLite with filtering options.
   */
  public queryHistory(options: EventQueryOptions = {}): EventQueryResult | null {
    if (!this.eventStore) {
      return null;
    }

    try {
      return this.eventStore.query(options);
    } catch (error) {
      console.error("[EventManager] Failed to query history:", error);
      return null;
    }
  }

  /**
   * Get the EventStore instance (for direct access if needed).
   */
  public getEventStore(): EventStore | null {
    return this.eventStore;
  }

  /**
   * Cleanup resources.
   */
  public close() {
    if (this.broadcaster) {
      this.broadcaster.close();
      this.broadcaster = null;
    }
    // EventStore is managed as singleton, don't close here
  }
}

// Singleton instance
let eventManagerInstance: EventManager | null = null;

/**
 * Get or create the EventManager singleton.
 */
export function getEventManager(config?: EventManagerConfig): EventManager {
  if (!eventManagerInstance) {
    eventManagerInstance = new EventManager(config);
  }
  return eventManagerInstance;
}

/**
 * Reset the EventManager singleton (for testing).
 */
export function resetEventManager(): void {
  if (eventManagerInstance) {
    eventManagerInstance.close();
    eventManagerInstance = null;
  }
  // Also reset the EventStore singleton
  resetEventStore();
}
