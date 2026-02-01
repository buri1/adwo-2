/**
 * Persistence Types
 * Story 5.1 — SQLite Persistence for Events
 *
 * Type definitions for the SQLite event store.
 */

import type { NormalizedTerminalEvent, TerminalEventType } from "@adwo/shared";

/**
 * Database event row structure
 */
export interface EventRow {
  id: string;
  project_id: string;
  pane_id: string;
  type: TerminalEventType;
  content: string;
  timestamp: string;
  synced: number; // SQLite stores boolean as 0/1
  question_metadata: string | null; // JSON string or null
  created_at: string; // For pruning purposes
}

/**
 * EventStore configuration
 */
export interface EventStoreConfig {
  /** Path to the SQLite database file */
  dbPath: string;
  /** Maximum number of events to retain (default: 10000) */
  maxEvents: number;
  /** Maximum age of events in days (default: 30) */
  maxAgeDays: number;
  /** Enable WAL mode (default: true) */
  enableWal: boolean;
}

/**
 * Query options for fetching events
 */
export interface EventQueryOptions {
  /** Filter by project ID */
  projectId?: string;
  /** Filter by pane ID */
  paneId?: string;
  /** Filter by event type */
  type?: TerminalEventType;
  /** Get events since this timestamp (ISO 8601) */
  since?: string;
  /** Get events after this event ID */
  afterId?: string;
  /** Maximum number of events to return */
  limit?: number;
  /** Order by timestamp (default: asc) */
  order?: "asc" | "desc";
}

/**
 * Result of event query
 */
export interface EventQueryResult {
  events: NormalizedTerminalEvent[];
  total: number;
  hasMore: boolean;
}

/**
 * Pruning result statistics
 */
export interface PruneResult {
  deletedByAge: number;
  deletedByCount: number;
  totalDeleted: number;
  remainingCount: number;
}

/**
 * Convert database row to NormalizedTerminalEvent
 */
export function rowToEvent(row: EventRow): NormalizedTerminalEvent {
  const event: NormalizedTerminalEvent = {
    id: row.id,
    project_id: row.project_id,
    pane_id: row.pane_id,
    type: row.type,
    content: row.content,
    timestamp: row.timestamp,
  };

  if (row.question_metadata) {
    try {
      event.question_metadata = JSON.parse(row.question_metadata);
    } catch {
      // Invalid JSON, ignore metadata
    }
  }

  return event;
}

/**
 * Convert NormalizedTerminalEvent to database row values
 */
export function eventToRow(
  event: NormalizedTerminalEvent
): Omit<EventRow, "created_at" | "synced"> & { synced: number } {
  return {
    id: event.id,
    project_id: event.project_id,
    pane_id: event.pane_id,
    type: event.type,
    content: event.content,
    timestamp: event.timestamp,
    synced: 0, // Initially not synced
    question_metadata: event.question_metadata
      ? JSON.stringify(event.question_metadata)
      : null,
  };
}
