/**
 * Event Manager
 * Story 1.4 — WebSocket Server
 *
 * Coordinates the RingBuffer and WebSocket Broadcaster.
 * Receives events from EventBridge and manages distribution.
 */

import type { Server } from "http";
import type { NormalizedTerminalEvent } from "@adwo/shared";
import { RingBuffer } from "./ring-buffer";
import { WebSocketBroadcaster } from "./broadcaster";

// Default buffer size: 1000 events (AC5)
const DEFAULT_BUFFER_SIZE = 1000;

export class EventManager {
  private buffer: RingBuffer<NormalizedTerminalEvent>;
  private broadcaster: WebSocketBroadcaster | null = null;

  constructor(maxBufferSize = DEFAULT_BUFFER_SIZE) {
    this.buffer = new RingBuffer<NormalizedTerminalEvent>(maxBufferSize);
    console.log(
      `[EventManager] Initialized with buffer capacity: ${maxBufferSize}`
    );
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
   * Emit an event: Push to buffer and broadcast to clients.
   * AC5: Events are stored even without clients (max 1000)
   * AC3: Events are broadcast to all clients (<100ms)
   */
  public emit(event: NormalizedTerminalEvent) {
    // Always push to buffer (AC5)
    this.buffer.push(event);

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
   * Cleanup resources.
   */
  public close() {
    if (this.broadcaster) {
      this.broadcaster.close();
      this.broadcaster = null;
    }
  }
}

// Singleton instance
let eventManagerInstance: EventManager | null = null;

/**
 * Get or create the EventManager singleton.
 */
export function getEventManager(maxBufferSize?: number): EventManager {
  if (!eventManagerInstance) {
    eventManagerInstance = new EventManager(maxBufferSize);
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
}
