/**
 * Persistence Module
 * Story 5.1 — SQLite Persistence for Events
 *
 * Exports for the SQLite-based event persistence layer.
 */

export { EventStore, getEventStore, resetEventStore } from "./event-store";
export type {
  EventStoreConfig,
  EventQueryOptions,
  EventQueryResult,
  PruneResult,
  EventRow,
} from "./types";
export { rowToEvent, eventToRow } from "./types";

// Stream event persistence
export {
  StreamEventStore,
  getStreamEventStore,
  resetStreamEventStore,
  type StreamEventStoreConfig,
  type StreamEventQueryOptions,
  type StreamEventQueryResult,
  type StreamEventRow,
  type StreamEventCategory,
} from "./stream-event-store";
