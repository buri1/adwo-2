/**
 * ADWO 2.0 WebSocket Message Protocol Types
 * Story 1.4 — WebSocket Server
 */

import type { NormalizedTerminalEvent, AgentState, WorkflowState } from "./events.js";

/**
 * WebSocket message types for server-client communication
 */
export type WebSocketMessageType =
  | "connected"
  | "sync"
  | "sync_request"
  | "event"
  | "heartbeat"
  | "error";

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
 * Connected client tracking
 */
export interface ConnectedClient {
  id: string;
  connectedAt: Date;
  lastEventTimestamp?: Date;
  lastEventId?: string;
}
