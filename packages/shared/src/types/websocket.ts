/**
 * ADWO 2.0 WebSocket Message Protocol Types
 * Story 1.4 — WebSocket Server
 * Story 4.1 — OTEL Receiver for Cost Metrics
 */

import type { NormalizedTerminalEvent, AgentState, WorkflowState } from "./events.js";
import type { CostMetric, CostTotals } from "./cost.js";

/**
 * WebSocket message types for server-client communication
 */
export type WebSocketMessageType =
  | "connected"
  | "sync"
  | "sync_request"
  | "event"
  | "heartbeat"
  | "error"
  | "cost_update";

/**
 * Base WebSocket message structure
 */
export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  payload: T;
  timestamp: string;
}

/**
 * Connected payload — sent when client first connects
 */
export interface ConnectedPayload {
  clientId: string;
  serverTime: string;
}

/**
 * Sync payload — sent on initial connection or after sync_request
 */
export interface SyncPayload {
  clientId: string;
  events: NormalizedTerminalEvent[];
  agents?: AgentState[];
  workflow?: WorkflowState;
  timestamp: string;
}

/**
 * Single event payload — sent for live updates
 */
export interface EventPayload {
  event: NormalizedTerminalEvent;
}

/**
 * Sync request payload — sent from client to request missed events
 */
export interface SyncRequestPayload {
  since: string;
  lastEventId?: string;
}

/**
 * Heartbeat payload
 */
export interface HeartbeatPayload {
  serverTime: string;
}

/**
 * Error payload
 */
export interface ErrorPayload {
  code: string;
  message: string;
}

/**
 * Cost update payload — sent when new cost metrics are received
 * Story 4.1 — OTEL Receiver for Cost Metrics
 */
export interface CostUpdatePayload {
  /** The new cost metric */
  metric: CostMetric;
  /** Updated totals for the pane */
  totals: CostTotals;
  /** Pane ID for association */
  paneId: string;
}

/**
 * Connected client tracking
 */
export interface ConnectedClient {
  id: string;
  connectedAt: Date;
  lastEventTimestamp?: Date;
  lastEventId?: string;
}
