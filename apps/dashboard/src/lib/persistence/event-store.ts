/**
 * Event Store
 * Story 5.1 — SQLite Persistence for Events
 *
 * SQLite-based persistent storage for terminal events.
 * Uses better-sqlite3 for synchronous API with WAL mode for concurrent reads.
 */

import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { homedir } from "os";
import { join, dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import type { NormalizedTerminalEvent } from "@adwo/shared";
import type {
  EventStoreConfig,
  EventQueryOptions,
  EventQueryResult,
  PruneResult,
  EventRow,
} from "./types";
import { rowToEvent, eventToRow } from "./types";

// Default configuration
const DEFAULT_CONFIG: EventStoreConfig = {
  dbPath: join(homedir(), ".adwo", "events.db"),
  maxEvents: 10000,
  maxAgeDays: 30,
  enableWal: true,
};

/**
 * EventStore - SQLite-based event persistence
 *
 * Features:
 * - WAL mode for concurrent reads
 * - Async-style insert (non-blocking via setImmediate)
 * - Automatic pruning of old events
 * - Query by project, pane, type, timestamp, or event ID
 */
export class EventStore {
  private db: DatabaseType | null = null;
  private config: EventStoreConfig;
  private insertStmt: ReturnType<DatabaseType["prepare"]> | null = null;
  private pruneScheduled = false;

  constructor(config: Partial<EventStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the database connection and schema.
   * Must be called before any other methods.
   */
  public initialize(): void {
    if (this.db) {
      console.warn("[EventStore] Already initialized");
      return;
    }

    // Ensure directory exists
    const dbDir = dirname(this.config.dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
      console.log(`[EventStore] Created directory: ${dbDir}`);
    }

    // Open database
    this.db = new Database(this.config.dbPath);
    console.log(`[EventStore] Opened database: ${this.config.dbPath}`);

    // Enable WAL mode for concurrent reads (AC1)
    if (this.config.enableWal) {
      this.db.pragma("journal_mode = WAL");
      console.log("[EventStore] WAL mode enabled");
    }

    // Optimize for performance
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("cache_size = 10000");
    this.db.pragma("temp_store = MEMORY");

    // Create schema (AC3)
    this.createSchema();

    // Prepare statements for performance
    this.prepareStatements();

    console.log("[EventStore] Initialization complete");
  }

  /**
   * Create the events table schema.
   */
  private createSchema(): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        pane_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        question_metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Index for efficient queries
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_project_pane ON events(project_id, pane_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
    `);

    console.log("[EventStore] Schema created/verified");
  }

  /**
   * Prepare commonly used SQL statements.
   */
  private prepareStatements(): void {
    if (!this.db) throw new Error("Database not initialized");

    this.insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO events
        (id, project_id, pane_id, type, content, timestamp, synced, question_metadata, created_at)
      VALUES
        (@id, @project_id, @pane_id, @type, @content, @timestamp, @synced, @question_metadata, datetime('now'))
    `);
  }

  /**
   * Insert an event asynchronously (non-blocking).
   * Uses setImmediate to avoid blocking the event loop (AC2).
   */
  public insertAsync(event: NormalizedTerminalEvent): void {
    setImmediate(() => {
      try {
        this.insert(event);
      } catch (error) {
        console.error("[EventStore] Async insert failed:", error);
      }
    });
  }

  /**
   * Insert an event synchronously.
   */
  public insert(event: NormalizedTerminalEvent): void {
    if (!this.db || !this.insertStmt) {
      throw new Error("Database not initialized");
    }

    const row = eventToRow(event);
    this.insertStmt.run(row);

    // Schedule pruning if needed (non-blocking)
    this.schedulePrune();
  }

  /**
   * Insert multiple events in a transaction.
   */
  public insertBatch(events: NormalizedTerminalEvent[]): void {
    if (!this.db || !this.insertStmt) {
      throw new Error("Database not initialized");
    }

    const insertMany = this.db.transaction(
      (evts: NormalizedTerminalEvent[]) => {
        for (const event of evts) {
          const row = eventToRow(event);
          this.insertStmt!.run(row);
        }
      }
    );

    insertMany(events);
    this.schedulePrune();
  }

  /**
   * Query events with filtering options (AC4).
   */
  public query(options: EventQueryOptions = {}): EventQueryResult {
    if (!this.db) throw new Error("Database not initialized");

    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.projectId) {
      conditions.push("project_id = @projectId");
      params.projectId = options.projectId;
    }

    if (options.paneId) {
      conditions.push("pane_id = @paneId");
      params.paneId = options.paneId;
    }

    if (options.type) {
      conditions.push("type = @type");
      params.type = options.type;
    }

    if (options.since) {
      conditions.push("timestamp > @since");
      params.since = options.since;
    }

    if (options.afterId) {
      // Get the timestamp of the reference event first
      const refEvent = this.db
        .prepare("SELECT timestamp FROM events WHERE id = ?")
        .get(options.afterId) as { timestamp: string } | undefined;

      if (refEvent) {
        conditions.push("(timestamp > @afterTimestamp OR (timestamp = @afterTimestamp AND id > @afterId))");
        params.afterTimestamp = refEvent.timestamp;
        params.afterId = options.afterId;
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const order = options.order === "desc" ? "DESC" : "ASC";
    const limit = options.limit ?? 1000;

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM events ${whereClause}`;
    const countResult = this.db.prepare(countSql).get(params) as {
      count: number;
    };

    // Get events with limit + 1 to check hasMore
    const selectSql = `
      SELECT * FROM events
      ${whereClause}
      ORDER BY timestamp ${order}, id ${order}
      LIMIT ${limit + 1}
    `;

    const rows = this.db.prepare(selectSql).all(params) as EventRow[];
    const hasMore = rows.length > limit;
    const events = rows.slice(0, limit).map(rowToEvent);

    return {
      events,
      total: countResult.count,
      hasMore,
    };
  }

  /**
   * Get the most recent events (for dashboard initial load).
   */
  public getRecent(limit = 100): NormalizedTerminalEvent[] {
    return this.query({ limit, order: "desc" }).events.reverse();
  }

  /**
   * Get events since a specific event ID.
   */
  public getSince(lastEventId: string, limit = 1000): NormalizedTerminalEvent[] {
    return this.query({ afterId: lastEventId, limit }).events;
  }

  /**
   * Mark event as synced.
   */
  public markSynced(eventId: string): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.prepare("UPDATE events SET synced = 1 WHERE id = ?").run(eventId);
  }

  /**
   * Mark multiple events as synced.
   */
  public markSyncedBatch(eventIds: string[]): void {
    if (!this.db) throw new Error("Database not initialized");

    const updateMany = this.db.transaction((ids: string[]) => {
      const stmt = this.db!.prepare("UPDATE events SET synced = 1 WHERE id = ?");
      for (const id of ids) {
        stmt.run(id);
      }
    });

    updateMany(eventIds);
  }

  /**
   * Schedule a non-blocking prune operation (AC5).
   */
  private schedulePrune(): void {
    if (this.pruneScheduled) return;

    this.pruneScheduled = true;
    setImmediate(() => {
      this.pruneScheduled = false;
      try {
        this.prune();
      } catch (error) {
        console.error("[EventStore] Prune failed:", error);
      }
    });
  }

  /**
   * Prune old events based on age and count limits (AC5).
   */
  public prune(): PruneResult {
    if (!this.db) throw new Error("Database not initialized");

    const result: PruneResult = {
      deletedByAge: 0,
      deletedByCount: 0,
      totalDeleted: 0,
      remainingCount: 0,
    };

    // Delete events older than maxAgeDays
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxAgeDays);
    const cutoffTimestamp = cutoffDate.toISOString();

    const ageDeleteResult = this.db
      .prepare("DELETE FROM events WHERE timestamp < ?")
      .run(cutoffTimestamp);
    result.deletedByAge = ageDeleteResult.changes;

    // Delete oldest events if over maxEvents limit
    const countResult = this.db
      .prepare("SELECT COUNT(*) as count FROM events")
      .get() as { count: number };

    if (countResult.count > this.config.maxEvents) {
      const excessCount = countResult.count - this.config.maxEvents;

      // Delete oldest events
      const countDeleteResult = this.db
        .prepare(
          `
          DELETE FROM events WHERE id IN (
            SELECT id FROM events ORDER BY timestamp ASC, id ASC LIMIT ?
          )
        `
        )
        .run(excessCount);
      result.deletedByCount = countDeleteResult.changes;
    }

    result.totalDeleted = result.deletedByAge + result.deletedByCount;

    // Get remaining count
    const remainingResult = this.db
      .prepare("SELECT COUNT(*) as count FROM events")
      .get() as { count: number };
    result.remainingCount = remainingResult.count;

    if (result.totalDeleted > 0) {
      console.log(
        `[EventStore] Pruned ${result.totalDeleted} events (age: ${result.deletedByAge}, count: ${result.deletedByCount}), remaining: ${result.remainingCount}`
      );
    }

    return result;
  }

  /**
   * Get database statistics.
   */
  public getStats(): {
    eventCount: number;
    oldestEvent: string | null;
    newestEvent: string | null;
    dbSizeBytes: number;
  } {
    if (!this.db) throw new Error("Database not initialized");

    const countResult = this.db
      .prepare("SELECT COUNT(*) as count FROM events")
      .get() as { count: number };

    const oldestResult = this.db
      .prepare("SELECT timestamp FROM events ORDER BY timestamp ASC LIMIT 1")
      .get() as { timestamp: string } | undefined;

    const newestResult = this.db
      .prepare("SELECT timestamp FROM events ORDER BY timestamp DESC LIMIT 1")
      .get() as { timestamp: string } | undefined;

    // Get database file size
    let dbSizeBytes = 0;
    try {
      const { statSync } = require("fs");
      const stats = statSync(this.config.dbPath);
      dbSizeBytes = stats.size;
    } catch {
      // File might not exist yet
    }

    return {
      eventCount: countResult.count,
      oldestEvent: oldestResult?.timestamp ?? null,
      newestEvent: newestResult?.timestamp ?? null,
      dbSizeBytes,
    };
  }

  /**
   * Close the database connection.
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.insertStmt = null;
      console.log("[EventStore] Database closed");
    }
  }

  /**
   * Check if the store is initialized.
   */
  public isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * Get the database path.
   */
  public getDbPath(): string {
    return this.config.dbPath;
  }
}

// Singleton instance
let eventStoreInstance: EventStore | null = null;

/**
 * Get or create the EventStore singleton.
 */
export function getEventStore(
  config?: Partial<EventStoreConfig>
): EventStore {
  if (!eventStoreInstance) {
    eventStoreInstance = new EventStore(config);
  }
  return eventStoreInstance;
}

/**
 * Reset the EventStore singleton (for testing).
 */
export function resetEventStore(): void {
  if (eventStoreInstance) {
    eventStoreInstance.close();
    eventStoreInstance = null;
  }
}
