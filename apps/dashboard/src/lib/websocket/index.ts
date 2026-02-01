/**
 * WebSocket Module
 * Story 1.4 — WebSocket Server
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
