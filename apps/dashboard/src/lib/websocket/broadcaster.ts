/**
 * WebSocket Broadcaster
 * Story 1.4 — WebSocket Server
 *
 * Manages WebSocket connections, client tracking, and event broadcasting.
 * Adapted from ADWO 1.0 for Next.js integration.
 */

import { WebSocketServer, WebSocket } from "ws";
import * as crypto from "crypto";
import type { Server } from "http";
import type {
  NormalizedTerminalEvent,
  WebSocketMessage,
  ConnectedPayload,
  SyncPayload,
  SyncRequestPayload,
  EventPayload,
  HeartbeatPayload,
  ErrorPayload,
  ConnectedClient,
} from "@adwo/shared";
import { RingBuffer } from "./ring-buffer";

// Heartbeat interval: 30 seconds
const HEARTBEAT_INTERVAL_MS = 30_000;

export class WebSocketBroadcaster {
  private wss: WebSocketServer;
  private buffer: RingBuffer<NormalizedTerminalEvent>;
  private clients: Map<string, ConnectedClient & { ws: WebSocket }> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(server: Server, buffer: RingBuffer<NormalizedTerminalEvent>) {
    this.buffer = buffer;

    // Create WebSocket server attached to HTTP server
    this.wss = new WebSocketServer({
      server,
      path: "/api/ws",
    });

    this.wss.on("connection", (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    // Start heartbeat timer
    this.startHeartbeat();

    console.log("[WebSocket] Server initialized on /api/ws");
  }

  /**
   * Handle new client connection
   * AC2: Client receives 'connected' event upon connection
   */
  private handleConnection(ws: WebSocket) {
    const clientId = crypto.randomUUID();

    // Track client
    this.clients.set(clientId, {
      id: clientId,
      ws,
      connectedAt: new Date(),
    });

    console.log(
      `[WebSocket] Client connected: ${clientId} (${this.clients.size} total)`
    );

    // AC2: Send 'connected' event
    this.sendConnectedEvent(clientId, ws);

    ws.on("close", () => {
      this.clients.delete(clientId);
      console.log(
        `[WebSocket] Client disconnected: ${clientId} (${this.clients.size} total)`
      );
    });

    ws.on("error", (err) => {
      console.error(`[WebSocket] Client error [${clientId}]:`, err);
    });

    ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      this.handleMessage(clientId, data);
    });
  }

  /**
   * Send 'connected' event to newly connected client
   * AC2: Client receives 'connected' event upon connection
   */
  private sendConnectedEvent(clientId: string, ws: WebSocket) {
    const connectedMessage: WebSocketMessage<ConnectedPayload> = {
      type: "connected",
      payload: {
        clientId,
        serverTime: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    this.send(ws, connectedMessage);
  }

  /**
   * Handle incoming messages from clients
   * AC4: Reconnecting clients can request missed events
   */
  private handleMessage(
    clientId: string,
    data: Buffer | ArrayBuffer | Buffer[]
  ) {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;

      switch (message.type) {
        case "sync_request":
          this.handleSyncRequest(
            clientId,
            message.payload as SyncRequestPayload
          );
          break;
        default:
          console.log(
            `[WebSocket] Unknown message type from ${clientId}: ${message.type}`
          );
      }
    } catch (error) {
      console.error(
        `[WebSocket] Invalid message from ${clientId}:`,
        error
      );
      this.sendError(clientId, "INVALID_MESSAGE", "Failed to parse message");
    }
  }

  /**
   * Handle sync request from client (for reconnection recovery)
   * AC4: Reconnecting clients receive missed events from RingBuffer
   */
  private handleSyncRequest(clientId: string, payload: SyncRequestPayload) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      let missedEvents: NormalizedTerminalEvent[];

      if (payload.lastEventId) {
        // Prefer event ID based sync for more accurate recovery
        missedEvents = this.buffer.getSince(payload.lastEventId);
      } else {
        // Fallback to timestamp based sync
        const sinceDate = new Date(payload.since);
        missedEvents = this.buffer.getRecent(sinceDate);
      }

      console.log(
        `[WebSocket] Sync request from ${clientId}: ${missedEvents.length} events`
      );

      const syncMessage: WebSocketMessage<SyncPayload> = {
        type: "sync",
        payload: {
          clientId,
          events: missedEvents,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      this.send(client.ws, syncMessage);

      // Update client's last event tracking
      if (missedEvents.length > 0) {
        const lastEvent = missedEvents[missedEvents.length - 1]!;
        client.lastEventTimestamp = new Date(lastEvent.timestamp);
        client.lastEventId = lastEvent.id;
      }
    } catch (error) {
      console.error(
        `[WebSocket] Failed to process sync request from ${clientId}:`,
        error
      );
      this.sendError(clientId, "SYNC_FAILED", "Failed to retrieve events");
    }
  }

  /**
   * Send error message to specific client
   */
  private sendError(clientId: string, code: string, message: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const errorMessage: WebSocketMessage<ErrorPayload> = {
      type: "error",
      payload: { code, message },
      timestamp: new Date().toISOString(),
    };

    this.send(client.ws, errorMessage);
  }

  /**
   * Broadcast event to all connected clients
   * AC3: New terminal events are broadcast to all clients (<100ms latency)
   */
  public broadcast(event: NormalizedTerminalEvent) {
    const eventMessage: WebSocketMessage<EventPayload> = {
      type: "event",
      payload: { event },
      timestamp: new Date().toISOString(),
    };

    let broadcastCount = 0;
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        this.send(client, eventMessage);
        broadcastCount++;
      }
    });

    if (broadcastCount > 0) {
      console.log(
        `[WebSocket] Broadcast event ${event.id} to ${broadcastCount} clients`
      );
    }
  }

  /**
   * Broadcast a raw message to all connected clients
   */
  public broadcastRaw<T>(message: {
    type: string;
    payload: T;
    timestamp: string;
  }) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        this.send(client, message);
      }
    });
  }

  /**
   * Start heartbeat timer for connection health
   */
  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const heartbeatMessage: WebSocketMessage<HeartbeatPayload> = {
        type: "heartbeat",
        payload: { serverTime: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      };

      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          this.send(client, heartbeatMessage);
        }
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Get count of connected clients
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all connected client IDs
   */
  public getConnectedClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get the WebSocket server instance
   */
  public getWebSocketServer(): WebSocketServer {
    return this.wss;
  }

  private send(ws: WebSocket, data: unknown) {
    try {
      ws.send(JSON.stringify(data));
    } catch (error) {
      console.error("[WebSocket] Failed to send message:", error);
    }
  }

  /**
   * Cleanup on shutdown
   */
  public close() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    this.wss.close();
    console.log("[WebSocket] Server closed");
  }
}
