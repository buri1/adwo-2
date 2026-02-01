/**
 * ADWO 2.0 WebSocket Hook Tests
 * Story 1.5 — Dashboard Event Stream UI
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWebSocket } from "../../src/hooks/use-websocket";
import { useConnectionStore } from "../../src/stores/connection-store";
import { useEventStore } from "../../src/stores/event-store";

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send = vi.fn();
  close = vi.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close", { code, reason, wasClean: true }));
    }
  });

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }

  simulateClose(wasClean = true, code = 1000) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close", { wasClean, code }));
    }
  }
}

// Add static constants
Object.assign(MockWebSocket, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
});

// Helper to get WebSocket instance with type safety
function getWsInstance(index: number): MockWebSocket {
  const ws = MockWebSocket.instances[index];
  if (!ws) throw new Error(`No WebSocket instance at index ${index}`);
  return ws;
}

describe("useWebSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    (global as any).WebSocket = MockWebSocket;

    // Reset stores
    useConnectionStore.getState().reset();
    useEventStore.getState().clearEvents();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("connection lifecycle", () => {
    it("should auto-connect on mount", async () => {
      renderHook(() => useWebSocket());

      // Allow useEffect to run
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(MockWebSocket.instances).toHaveLength(1);
      expect(getWsInstance(0).url).toContain("/api/ws");
    });

    it("should not auto-connect when disabled", async () => {
      renderHook(() => useWebSocket({ autoConnect: false }));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(MockWebSocket.instances).toHaveLength(0);
    });

    it("should set connecting status on connect", async () => {
      renderHook(() => useWebSocket());

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(useConnectionStore.getState().status).toBe("connecting");
    });

    it("should set connected status after receiving connected message", async () => {
      renderHook(() => useWebSocket());

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const ws = getWsInstance(0);

      act(() => {
        ws.simulateOpen();
        ws.simulateMessage({
          type: "connected",
          payload: { clientId: "client-123", serverTime: new Date().toISOString() },
          timestamp: new Date().toISOString(),
        });
      });

      expect(useConnectionStore.getState().status).toBe("connected");
      expect(useConnectionStore.getState().clientId).toBe("client-123");
    });

    it("should disconnect on unmount", async () => {
      const { unmount } = renderHook(() => useWebSocket());

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const ws = getWsInstance(0);

      act(() => {
        ws.simulateOpen();
      });

      unmount();

      expect(ws.close).toHaveBeenCalledWith(1000, "Component unmount");
    });
  });

  describe("reconnection", () => {
    it("should schedule reconnect on disconnect", async () => {
      renderHook(() => useWebSocket({ reconnectInterval: 2000 }));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const ws = getWsInstance(0);

      act(() => {
        ws.simulateOpen();
        ws.simulateClose(false); // unclean close
      });

      expect(useConnectionStore.getState().status).toBe("disconnected");
      expect(useConnectionStore.getState().reconnectAttempts).toBe(1);

      // Advance timer to trigger reconnect
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(MockWebSocket.instances).toHaveLength(2);
    });

    it("should increment reconnect attempts", async () => {
      renderHook(() => useWebSocket({ reconnectInterval: 2000 }));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const ws1 = getWsInstance(0);

      act(() => {
        ws1.simulateClose(false);
      });

      expect(useConnectionStore.getState().reconnectAttempts).toBe(1);

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      const ws2 = getWsInstance(1);

      act(() => {
        ws2.simulateClose(false);
      });

      expect(useConnectionStore.getState().reconnectAttempts).toBe(2);
    });
  });

  describe("message handling", () => {
    it("should handle event messages", async () => {
      renderHook(() => useWebSocket());

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const ws = getWsInstance(0);

      act(() => {
        ws.simulateOpen();
        ws.simulateMessage({
          type: "connected",
          payload: { clientId: "client-123", serverTime: new Date().toISOString() },
          timestamp: new Date().toISOString(),
        });
      });

      act(() => {
        ws.simulateMessage({
          type: "event",
          payload: {
            event: {
              id: "evt_001",
              pane_id: "%0",
              type: "output",
              content: "Hello World",
              timestamp: new Date().toISOString(),
              project_id: "test",
            },
          },
          timestamp: new Date().toISOString(),
        });
      });

      const events = useEventStore.getState().events;
      expect(events).toHaveLength(1);
      expect(events[0]!.id).toBe("evt_001");
      expect(events[0]!.content).toBe("Hello World");
    });

    it("should handle sync messages", async () => {
      renderHook(() => useWebSocket());

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const ws = getWsInstance(0);

      act(() => {
        ws.simulateOpen();
        ws.simulateMessage({
          type: "connected",
          payload: { clientId: "client-123", serverTime: new Date().toISOString() },
          timestamp: new Date().toISOString(),
        });
      });

      act(() => {
        ws.simulateMessage({
          type: "sync",
          payload: {
            clientId: "client-123",
            events: [
              {
                id: "evt_001",
                pane_id: "%0",
                type: "output",
                content: "Event 1",
                timestamp: "2024-01-01T10:00:00Z",
                project_id: "test",
              },
              {
                id: "evt_002",
                pane_id: "%0",
                type: "output",
                content: "Event 2",
                timestamp: "2024-01-01T10:00:01Z",
                project_id: "test",
              },
            ],
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
      });

      const events = useEventStore.getState().events;
      expect(events).toHaveLength(2);
    });

    it("should handle error messages gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      renderHook(() => useWebSocket());

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const ws = getWsInstance(0);

      act(() => {
        ws.simulateOpen();
        ws.simulateMessage({
          type: "error",
          payload: { code: "SYNC_FAILED", message: "Sync failed" },
          timestamp: new Date().toISOString(),
        });
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[WebSocket] Server error:",
        "Sync failed"
      );

      consoleSpy.mockRestore();
    });

    it("should handle invalid JSON gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      renderHook(() => useWebSocket());

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const ws = getWsInstance(0);

      act(() => {
        ws.simulateOpen();
        // Send invalid JSON
        if (ws.onmessage) {
          ws.onmessage(new MessageEvent("message", { data: "invalid json" }));
        }
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("sync request", () => {
    it("should send sync request on reconnect with existing events", async () => {
      // Add existing event to store
      useEventStore.getState().addEvent({
        id: "evt_existing",
        pane_id: "%0",
        type: "output",
        content: "Existing",
        timestamp: "2024-01-01T10:00:00Z",
        project_id: "test",
      });

      renderHook(() => useWebSocket());

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const ws = getWsInstance(0);

      act(() => {
        ws.simulateOpen();
        ws.simulateMessage({
          type: "connected",
          payload: { clientId: "client-123", serverTime: new Date().toISOString() },
          timestamp: new Date().toISOString(),
        });
      });

      // Should have sent sync_request
      expect(ws.send).toHaveBeenCalled();
      const firstCall = ws.send.mock.calls[0];
      expect(firstCall).toBeDefined();
      const sentMessage = JSON.parse(firstCall![0] as string);
      expect(sentMessage.type).toBe("sync_request");
      expect(sentMessage.payload.lastEventId).toBe("evt_existing");
    });
  });

  describe("return values", () => {
    it("should return connection status", async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(result.current.status).toBe("connecting");
      expect(result.current.isConnecting).toBe(true);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isDisconnected).toBe(false);
    });

    it("should expose connect and disconnect functions", async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: false }));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(typeof result.current.connect).toBe("function");
      expect(typeof result.current.disconnect).toBe("function");
    });

    it("should allow manual connect", async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: false }));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(MockWebSocket.instances).toHaveLength(0);

      act(() => {
        result.current.connect();
      });

      expect(MockWebSocket.instances).toHaveLength(1);
    });

    it("should allow manual disconnect", async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const ws = getWsInstance(0);

      act(() => {
        ws.simulateOpen();
      });

      act(() => {
        result.current.disconnect();
      });

      expect(ws.close).toHaveBeenCalled();
      expect(useConnectionStore.getState().status).toBe("disconnected");
    });
  });
});
