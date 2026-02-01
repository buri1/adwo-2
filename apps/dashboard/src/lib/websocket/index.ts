/**
 * WebSocket Module
 * Story 1.4 — WebSocket Server
 * Story 5.2 — Crash Recovery
 *
 * Exports all WebSocket-related components for real-time event streaming.
 */

export { RingBuffer } from "./ring-buffer";
export type { TimestampedEvent } from "./ring-buffer";

export { WebSocketBroadcaster } from "./broadcaster";

export {
  EventManager,
  getEventManager,
  resetEventManager,
} from "./event-manager";
export type { EventManagerConfig } from "./event-manager";

// Re-export recovery types for convenience
export type { RecoveryResult, RecoveryWarning } from "../recovery";
