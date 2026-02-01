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
