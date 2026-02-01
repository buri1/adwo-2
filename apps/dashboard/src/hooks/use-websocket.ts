/**
 * ADWO 2.0 WebSocket Hook
 * Story 1.5 — Dashboard Event Stream UI
 * Story 4.1 — OTEL Receiver for Cost Metrics
 *
 * Client-side WebSocket connection management with auto-reconnect.
 * Handles connection lifecycle, sync requests, and event dispatching.
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useConnectionStore } from "@/stores/connection-store";
import { useEventStore } from "@/stores/event-store";
import { useCostStore } from "@/stores/cost-store";
import type {
  WebSocketMessage,
  ConnectedPayload,
  SyncPayload,
  EventPayload,
  SyncRequestPayload,
  HeartbeatPayload,
  ErrorPayload,
  CostUpdatePayload,
} from "@adwo/shared";

const RECONNECT_INTERVAL = 2000; // 2 seconds
const WS_URL =
  typeof window !== "undefined"
    ? `ws://${window.location.host}/api/ws`
    : "ws://localhost:3000/api/ws";

interface UseWebSocketOptions {
  url?: string;
  reconnectInterval?: number;
  autoConnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = WS_URL,
    reconnectInterval = RECONNECT_INTERVAL,
    autoConnect = true,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountingRef = useRef(false);

  // Connection store actions
  const {
    status,
    clientId,
    setConnected,
    setConnecting,
    setDisconnected,
    incrementReconnectAttempts,
  } = useConnectionStore();

  // Event store actions
  const { addEvent, addEvents, lastEventId, lastEventTimestamp } =
    useEventStore();

  // Cost store actions
  const { addCostMetric } = useCostStore();

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (isUnmountingRef.current) return;

    clearReconnectTimeout();
    incrementReconnectAttempts();

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isUnmountingRef.current) {
        connect();
      }
    }, reconnectInterval);
  }, [reconnectInterval, clearReconnectTimeout, incrementReconnectAttempts]);

  const sendSyncRequest = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;

    const payload: SyncRequestPayload = {
      since: lastEventTimestamp ?? new Date(0).toISOString(),
      lastEventId: lastEventId ?? undefined,
    };

    const message: WebSocketMessage<SyncRequestPayload> = {
      type: "sync_request",
      payload,
      timestamp: new Date().toISOString(),
    };

    wsRef.current.send(JSON.stringify(message));
  }, [lastEventId, lastEventTimestamp]);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;

        switch (message.type) {
          case "connected": {
            const payload = message.payload as ConnectedPayload;
            setConnected(payload.clientId);
            // Request sync if we have previous events (reconnect scenario)
            if (lastEventId) {
              sendSyncRequest();
            }
            break;
          }

          case "sync": {
            const payload = message.payload as SyncPayload;
            if (payload.events.length > 0) {
              addEvents(payload.events);
            }
            break;
          }

          case "event": {
            const payload = message.payload as EventPayload;
            addEvent(payload.event);
            break;
          }

          case "heartbeat": {
            // Heartbeat received, connection is healthy
            const _payload = message.payload as HeartbeatPayload;
            break;
          }

          case "error": {
            const payload = message.payload as ErrorPayload;
            console.error("[WebSocket] Server error:", payload.message);
            break;
          }

          case "cost_update": {
            const payload = message.payload as CostUpdatePayload;
            addCostMetric(payload.metric, payload.totals, payload.paneId);
            break;
          }

          default:
            console.warn("[WebSocket] Unknown message type:", message.type);
        }
      } catch (error) {
        console.error("[WebSocket] Failed to parse message:", error);
      }
    },
    [setConnected, addEvent, addEvents, addCostMetric, lastEventId, sendSyncRequest]
  );

  const connect = useCallback(() => {
    // Prevent multiple connections
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    setConnecting();
    clearReconnectTimeout();

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        // Connection established, wait for "connected" message
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
      };

      ws.onclose = (event) => {
        wsRef.current = null;

        if (!isUnmountingRef.current) {
          setDisconnected(
            event.wasClean ? undefined : "Connection lost unexpectedly"
          );
          scheduleReconnect();
        }
      };
    } catch (error) {
      console.error("[WebSocket] Failed to create connection:", error);
      setDisconnected("Failed to create connection");
      scheduleReconnect();
    }
  }, [
    url,
    setConnecting,
    setDisconnected,
    clearReconnectTimeout,
    handleMessage,
    scheduleReconnect,
  ]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();

    if (wsRef.current) {
      wsRef.current.close(1000, "Client disconnect");
      wsRef.current = null;
    }

    setDisconnected();
  }, [clearReconnectTimeout, setDisconnected]);

  // Auto-connect on mount
  useEffect(() => {
    isUnmountingRef.current = false;

    if (autoConnect) {
      connect();
    }

    return () => {
      isUnmountingRef.current = true;
      clearReconnectTimeout();

      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmount");
        wsRef.current = null;
      }
    };
  }, [autoConnect, connect, clearReconnectTimeout]);

  return {
    status,
    clientId,
    connect,
    disconnect,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
    isDisconnected: status === "disconnected",
  };
}
