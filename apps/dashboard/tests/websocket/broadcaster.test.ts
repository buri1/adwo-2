/**
 * WebSocket Broadcaster Integration Tests
 * Story 1.4 — WebSocket Server
 *
 * Tests the WebSocket server behavior including connection handling,
 * event broadcasting, and reconnection recovery.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createServer, Server } from "http";
import { WebSocket } from "ws";
import { WebSocketBroadcaster } from "../../src/lib/websocket/broadcaster";
import { RingBuffer } from "../../src/lib/websocket/ring-buffer";
import type {
  NormalizedTerminalEvent,
  WebSocketMessage,
  ConnectedPayload,
  SyncPayload,
  EventPayload,
} from "@adwo/shared";

function createEvent(
  id: string,
  timestamp = new Date()
): NormalizedTerminalEvent {
  return {
    id,
    pane_id: "test-pane",
    type: "output",
    content: `Test content for event ${id}`,
    timestamp: timestamp.toISOString(),
    project_id: "test-project",
  };
}

/**
 * Collects messages from a WebSocket into an array.
 * Returns a function to get collected messages and a promise that resolves
 * when the first message is received.
 */
function createMessageCollector(ws: WebSocket): {
  messages: WebSocketMessage[];
  waitForMessage: (timeout?: number) => Promise<WebSocketMessage>;
} {
  const messages: WebSocketMessage[] = [];
  const waiters: Array<{
    resolve: (msg: WebSocketMessage) => void;
    reject: (err: Error) => void;
  }> = [];

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    messages.push(msg);

    // Resolve any waiting promises
    const waiter = waiters.shift();
    if (waiter) {
      waiter.resolve(msg);
    }
  });

  return {
    messages,
    waitForMessage: (timeout = 1000) => {
      // If we already have a message, return it immediately
      if (messages.length > 0) {
        return Promise.resolve(messages.shift()!);
      }

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const idx = waiters.findIndex((w) => w.resolve === resolve);
          if (idx >= 0) waiters.splice(idx, 1);
          reject(new Error("Timeout waiting for message"));
        }, timeout);

        waiters.push({
          resolve: (msg) => {
            clearTimeout(timer);
            resolve(msg);
          },
          reject: (err) => {
            clearTimeout(timer);
            reject(err);
          },
        });
      });
    },
  };
}

function waitForOpen(ws: WebSocket, timeout = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error("Timeout waiting for connection"));
    }, timeout);

    ws.once("open", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

describe("WebSocketBroadcaster", () => {
  let server: Server;
  let broadcaster: WebSocketBroadcaster;
  let buffer: RingBuffer<NormalizedTerminalEvent>;
  let port: number;
  let clients: WebSocket[] = [];

  beforeEach((ctx) => {
    return new Promise<void>((resolve) => {
      buffer = new RingBuffer<NormalizedTerminalEvent>(100);
      server = createServer();
      server.listen(0, () => {
        const addr = server.address();
        port = typeof addr === "object" && addr ? addr.port : 0;
        broadcaster = new WebSocketBroadcaster(server, buffer);
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Close all client connections
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    }
    clients = [];

    // Close broadcaster and server
    broadcaster.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function createClient(): { ws: WebSocket; collector: ReturnType<typeof createMessageCollector> } {
    const ws = new WebSocket(`ws://localhost:${port}/api/ws`);
    clients.push(ws);
    const collector = createMessageCollector(ws);
    return { ws, collector };
  }

  describe("AC1: Connection to ws://localhost:3000/api/ws", () => {
    it("should accept WebSocket connections on /api/ws path", async () => {
      const { ws } = createClient();

      await waitForOpen(ws);

      expect(ws.readyState).toBe(WebSocket.OPEN);
    });
  });

  describe("AC2: Connected event on connection", () => {
    it("should send 'connected' event with clientId when client connects", async () => {
      const { ws, collector } = createClient();
      await waitForOpen(ws);

      const message = await collector.waitForMessage();

      expect(message.type).toBe("connected");
      expect((message.payload as ConnectedPayload).clientId).toBeDefined();
      expect(
        typeof (message.payload as ConnectedPayload).clientId
      ).toBe("string");
      expect((message.payload as ConnectedPayload).serverTime).toBeDefined();
    });

    it("should assign unique clientIds to different clients", async () => {
      const { ws: ws1, collector: collector1 } = createClient();
      const { ws: ws2, collector: collector2 } = createClient();

      await waitForOpen(ws1);
      await waitForOpen(ws2);

      const msg1 = await collector1.waitForMessage();
      const msg2 = await collector2.waitForMessage();

      expect((msg1.payload as ConnectedPayload).clientId).not.toBe(
        (msg2.payload as ConnectedPayload).clientId
      );
    });
  });

  describe("AC3: Event broadcasting", () => {
    it("should broadcast events to all connected clients", async () => {
      const { ws: ws1, collector: collector1 } = createClient();
      const { ws: ws2, collector: collector2 } = createClient();

      await waitForOpen(ws1);
      await waitForOpen(ws2);

      // Consume connected messages
      await collector1.waitForMessage();
      await collector2.waitForMessage();

      const event = createEvent("broadcast-test");
      broadcaster.broadcast(event);

      const msg1 = await collector1.waitForMessage();
      const msg2 = await collector2.waitForMessage();

      expect(msg1.type).toBe("event");
      expect((msg1.payload as EventPayload).event).toEqual(event);

      expect(msg2.type).toBe("event");
      expect((msg2.payload as EventPayload).event).toEqual(event);
    });

    it("should broadcast with <100ms latency", async () => {
      const { ws, collector } = createClient();
      await waitForOpen(ws);
      await collector.waitForMessage(); // Consume connected message

      const event = createEvent("latency-test");
      const startTime = Date.now();

      broadcaster.broadcast(event);

      const msg = await collector.waitForMessage();
      const latency = Date.now() - startTime;

      expect(msg.type).toBe("event");
      expect(latency).toBeLessThan(100);
    });
  });

  describe("AC4: Reconnection recovery", () => {
    it("should allow clients to request missed events via sync_request", async () => {
      // Pre-populate buffer with events
      const oldEvents = [
        createEvent("old-1", new Date(Date.now() - 5000)),
        createEvent("old-2", new Date(Date.now() - 4000)),
        createEvent("old-3", new Date(Date.now() - 3000)),
      ];
      oldEvents.forEach((e) => buffer.push(e));

      const { ws, collector } = createClient();
      await waitForOpen(ws);
      await collector.waitForMessage(); // Consume connected message

      // Request events since a specific timestamp
      const syncRequest: WebSocketMessage = {
        type: "sync_request",
        payload: { since: new Date(Date.now() - 4500).toISOString() },
        timestamp: new Date().toISOString(),
      };
      ws.send(JSON.stringify(syncRequest));

      const syncResponse = await collector.waitForMessage();

      expect(syncResponse.type).toBe("sync");
      const payload = syncResponse.payload as SyncPayload;
      expect(payload.events.length).toBe(2); // old-2 and old-3
      expect(payload.events.map((e) => e.id)).toEqual(["old-2", "old-3"]);
    });

    it("should support event ID based sync_request", async () => {
      const events = [
        createEvent("evt-1"),
        createEvent("evt-2"),
        createEvent("evt-3"),
        createEvent("evt-4"),
      ];
      events.forEach((e) => buffer.push(e));

      const { ws, collector } = createClient();
      await waitForOpen(ws);
      await collector.waitForMessage(); // Consume connected message

      // Request events since a specific event ID
      const syncRequest: WebSocketMessage = {
        type: "sync_request",
        payload: {
          since: new Date(0).toISOString(),
          lastEventId: "evt-2",
        },
        timestamp: new Date().toISOString(),
      };
      ws.send(JSON.stringify(syncRequest));

      const syncResponse = await collector.waitForMessage();

      expect(syncResponse.type).toBe("sync");
      const payload = syncResponse.payload as SyncPayload;
      expect(payload.events.length).toBe(2); // evt-3 and evt-4
      expect(payload.events.map((e) => e.id)).toEqual(["evt-3", "evt-4"]);
    });
  });

  describe("AC5: RingBuffer stores events without clients", () => {
    it("should store events in buffer even with no connected clients", () => {
      expect(broadcaster.getClientCount()).toBe(0);

      const event = createEvent("no-client-test");
      buffer.push(event);

      expect(buffer.size()).toBe(1);
      expect(buffer.getAll()).toContainEqual(event);
    });
  });

  describe("Client tracking", () => {
    it("should track connected client count", async () => {
      expect(broadcaster.getClientCount()).toBe(0);

      const { ws: ws1 } = createClient();
      await waitForOpen(ws1);

      expect(broadcaster.getClientCount()).toBe(1);

      const { ws: ws2 } = createClient();
      await waitForOpen(ws2);

      expect(broadcaster.getClientCount()).toBe(2);
    });

    it("should update count when clients disconnect", async () => {
      const { ws } = createClient();
      await waitForOpen(ws);

      expect(broadcaster.getClientCount()).toBe(1);

      ws.close();
      // Wait for close event to propagate
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(broadcaster.getClientCount()).toBe(0);
    });

    it("should return connected client IDs", async () => {
      const { ws, collector } = createClient();
      await waitForOpen(ws);
      const msg = await collector.waitForMessage();
      const clientId = (msg.payload as ConnectedPayload).clientId;

      const connectedIds = broadcaster.getConnectedClientIds();

      expect(connectedIds).toContain(clientId);
    });
  });

  describe("Error handling", () => {
    it("should handle invalid JSON messages gracefully", async () => {
      const { ws, collector } = createClient();
      await waitForOpen(ws);
      await collector.waitForMessage(); // Consume connected message

      // Send invalid JSON
      ws.send("not valid json");

      const errorMsg = await collector.waitForMessage();

      expect(errorMsg.type).toBe("error");
      expect(errorMsg.payload).toEqual({
        code: "INVALID_MESSAGE",
        message: "Failed to parse message",
      });
    });
  });
});
