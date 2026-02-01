/**
 * Stream Event Store
 * SQLite Persistence for Stream-JSON Events
 *
 * Stores NormalizedStreamEvent from Claude Code's --output-format stream-json.
 * Uses a separate table from terminal events to maintain clean separation.
 */

import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { homedir } from "os";
import { join, dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import type { NormalizedStreamEvent, SessionMetadata } from "@adwo/shared";

/**
 * Stream event categories for filtering
 */
export type StreamEventCategory = "text" | "tool" | "hook" | "result" | "system" | "error";

/**
 * Database row structure for stream events
 */
export interface StreamEventRow {
  id: string;
  session_id: string;
  pane_id: string;
  category: StreamEventCategory;
  original_type: string;
  content: string;
  timestamp: string;
  tool_info: string | null; // JSON: { name, input, status }
  cost_info: string | null; // JSON: { total_usd, input_tokens, output_tokens, duration_ms }
  model: string | null;
  created_at: string;
}

/**
 * Session row for tracking session metadata
 */
export interface SessionRow {
  session_id: string;
  pane_id: string;
  model: string;
  tools: string; // JSON array
  cwd: string;
  started_at: string;
  total_cost: number;
  input_tokens: number;
  output_tokens: number;
  updated_at: string;
}

/**
 * Store configuration
 */
export interface StreamEventStoreConfig {
  dbPath: string;
  maxEvents: number;
  maxAgeDays: number;
  enableWal: boolean;
}

/**
 * Query options
 */
export interface StreamEventQueryOptions {
  sessionId?: string;
  paneId?: string;
  category?: StreamEventCategory;
  since?: string;
  afterId?: string;
  limit?: number;
  order?: "asc" | "desc";
}

/**
 * Query result
 */
export interface StreamEventQueryResult {
  events: NormalizedStreamEvent[];
  total: number;
  hasMore: boolean;
}

const DEFAULT_CONFIG: StreamEventStoreConfig = {
  dbPath: join(homedir(), ".adwo", "events.db"),
  maxEvents: 10000,
  maxAgeDays: 30,
  enableWal: true,
};

/**
 * Convert database row to NormalizedStreamEvent
 */
function rowToStreamEvent(row: StreamEventRow): NormalizedStreamEvent {
  const event: NormalizedStreamEvent = {
    id: row.id,
    session_id: row.session_id,
    pane_id: row.pane_id,
    category: row.category,
    original_type: row.original_type,
    content: row.content,
    timestamp: row.timestamp,
  };

  if (row.tool_info) {
    try {
      event.tool = JSON.parse(row.tool_info);
    } catch {
      // Invalid JSON, ignore
    }
  }

  if (row.cost_info) {
    try {
      event.cost = JSON.parse(row.cost_info);
    } catch {
      // Invalid JSON, ignore
    }
  }

  if (row.model) {
    event.model = row.model;
  }

  return event;
}

/**
 * Convert NormalizedStreamEvent to database row values
 */
function streamEventToRow(event: NormalizedStreamEvent): Omit<StreamEventRow, "created_at"> {
  return {
    id: event.id,
    session_id: event.session_id,
    pane_id: event.pane_id,
    category: event.category,
    original_type: event.original_type,
    content: event.content,
    timestamp: event.timestamp,
    tool_info: event.tool ? JSON.stringify(event.tool) : null,
    cost_info: event.cost ? JSON.stringify(event.cost) : null,
    model: event.model ?? null,
  };
}

/**
 * Convert SessionMetadata to database row values
 */
function sessionToRow(session: SessionMetadata): Omit<SessionRow, "updated_at"> {
  return {
    session_id: session.session_id,
    pane_id: session.pane_id,
    model: session.model,
    tools: JSON.stringify(session.tools),
    cwd: session.cwd,
    started_at: session.started_at,
    total_cost: session.total_cost,
    input_tokens: session.total_tokens.input,
    output_tokens: session.total_tokens.output,
  };
}

/**
 * Convert database row to SessionMetadata
 */
function rowToSession(row: SessionRow): SessionMetadata {
  return {
    session_id: row.session_id,
    pane_id: row.pane_id,
    model: row.model,
    tools: JSON.parse(row.tools),
    cwd: row.cwd,
    started_at: row.started_at,
    total_cost: row.total_cost,
    total_tokens: {
      input: row.input_tokens,
      output: row.output_tokens,
    },
  };
}

/**
 * StreamEventStore - SQLite persistence for stream-json events
 */
export class StreamEventStore {
  private db: DatabaseType | null = null;
  private config: StreamEventStoreConfig;
  private insertEventStmt: ReturnType<DatabaseType["prepare"]> | null = null;
  private upsertSessionStmt: ReturnType<DatabaseType["prepare"]> | null = null;
  private pruneScheduled = false;

  constructor(config: Partial<StreamEventStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the database connection and schema
   */
  public initialize(): void {
    if (this.db) {
      console.warn("[StreamEventStore] Already initialized");
      return;
    }

    // Ensure directory exists
    const dbDir = dirname(this.config.dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // Open database
    this.db = new Database(this.config.dbPath);
    console.log(`[StreamEventStore] Opened database: ${this.config.dbPath}`);

    // Enable WAL mode
    if (this.config.enableWal) {
      this.db.pragma("journal_mode = WAL");
    }

    // Optimize for performance
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("cache_size = 10000");

    // Create schema
    this.createSchema();

    // Prepare statements
    this.prepareStatements();

    console.log("[StreamEventStore] Initialization complete");
  }

  /**
   * Create the stream_events and sessions tables
   */
  private createSchema(): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.exec(`
      -- Stream events table
      CREATE TABLE IF NOT EXISTS stream_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        pane_id TEXT NOT NULL,
        category TEXT NOT NULL,
        original_type TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        tool_info TEXT,
        cost_info TEXT,
        model TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Indexes for stream_events
      CREATE INDEX IF NOT EXISTS idx_stream_events_session ON stream_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_stream_events_pane ON stream_events(pane_id);
      CREATE INDEX IF NOT EXISTS idx_stream_events_category ON stream_events(category);
      CREATE INDEX IF NOT EXISTS idx_stream_events_timestamp ON stream_events(timestamp);

      -- Sessions table for tracking session metadata
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        pane_id TEXT NOT NULL,
        model TEXT NOT NULL,
        tools TEXT NOT NULL,
        cwd TEXT NOT NULL,
        started_at TEXT NOT NULL,
        total_cost REAL NOT NULL DEFAULT 0,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_pane ON sessions(pane_id);
    `);

    console.log("[StreamEventStore] Schema created/verified");
  }

  /**
   * Prepare commonly used SQL statements
   */
  private prepareStatements(): void {
    if (!this.db) throw new Error("Database not initialized");

    this.insertEventStmt = this.db.prepare(`
      INSERT OR REPLACE INTO stream_events
        (id, session_id, pane_id, category, original_type, content, timestamp, tool_info, cost_info, model, created_at)
      VALUES
        (@id, @session_id, @pane_id, @category, @original_type, @content, @timestamp, @tool_info, @cost_info, @model, datetime('now'))
    `);

    this.upsertSessionStmt = this.db.prepare(`
      INSERT INTO sessions
        (session_id, pane_id, model, tools, cwd, started_at, total_cost, input_tokens, output_tokens, updated_at)
      VALUES
        (@session_id, @pane_id, @model, @tools, @cwd, @started_at, @total_cost, @input_tokens, @output_tokens, datetime('now'))
      ON CONFLICT(session_id) DO UPDATE SET
        total_cost = @total_cost,
        input_tokens = @input_tokens,
        output_tokens = @output_tokens,
        updated_at = datetime('now')
    `);
  }

  /**
   * Insert an event asynchronously (non-blocking)
   */
  public insertEventAsync(event: NormalizedStreamEvent): void {
    setImmediate(() => {
      try {
        this.insertEvent(event);
      } catch (error) {
        console.error("[StreamEventStore] Async insert failed:", error);
      }
    });
  }

  /**
   * Insert an event synchronously
   */
  public insertEvent(event: NormalizedStreamEvent): void {
    if (!this.db || !this.insertEventStmt) {
      throw new Error("Database not initialized");
    }

    const row = streamEventToRow(event);
    this.insertEventStmt.run(row);

    this.schedulePrune();
  }

  /**
   * Insert multiple events in a transaction
   */
  public insertEventBatch(events: NormalizedStreamEvent[]): void {
    if (!this.db || !this.insertEventStmt) {
      throw new Error("Database not initialized");
    }

    const insertMany = this.db.transaction((evts: NormalizedStreamEvent[]) => {
      for (const event of evts) {
        const row = streamEventToRow(event);
        this.insertEventStmt!.run(row);
      }
    });

    insertMany(events);
    this.schedulePrune();
  }

  /**
   * Upsert session metadata
   */
  public upsertSession(session: SessionMetadata): void {
    if (!this.db || !this.upsertSessionStmt) {
      throw new Error("Database not initialized");
    }

    const row = sessionToRow(session);
    this.upsertSessionStmt.run(row);
  }

  /**
   * Query events with filtering options
   */
  public queryEvents(options: StreamEventQueryOptions = {}): StreamEventQueryResult {
    if (!this.db) throw new Error("Database not initialized");

    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.sessionId) {
      conditions.push("session_id = @sessionId");
      params["sessionId"] = options.sessionId;
    }

    if (options.paneId) {
      conditions.push("pane_id = @paneId");
      params["paneId"] = options.paneId;
    }

    if (options.category) {
      conditions.push("category = @category");
      params["category"] = options.category;
    }

    if (options.since) {
      conditions.push("timestamp > @since");
      params["since"] = options.since;
    }

    if (options.afterId) {
      const refEvent = this.db
        .prepare("SELECT timestamp FROM stream_events WHERE id = ?")
        .get(options.afterId) as { timestamp: string } | undefined;

      if (refEvent) {
        conditions.push("(timestamp > @afterTimestamp OR (timestamp = @afterTimestamp AND id > @afterId))");
        params["afterTimestamp"] = refEvent.timestamp;
        params["afterId"] = options.afterId;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const order = options.order === "desc" ? "DESC" : "ASC";
    const limit = options.limit ?? 1000;

    const countSql = `SELECT COUNT(*) as count FROM stream_events ${whereClause}`;
    const countResult = this.db.prepare(countSql).get(params) as { count: number };

    const selectSql = `
      SELECT * FROM stream_events
      ${whereClause}
      ORDER BY timestamp ${order}, id ${order}
      LIMIT ${limit + 1}
    `;

    const rows = this.db.prepare(selectSql).all(params) as StreamEventRow[];
    const hasMore = rows.length > limit;
    const events = rows.slice(0, limit).map(rowToStreamEvent);

    return {
      events,
      total: countResult.count,
      hasMore,
    };
  }

  /**
   * Get recent events
   */
  public getRecentEvents(limit = 100): NormalizedStreamEvent[] {
    return this.queryEvents({ limit, order: "desc" }).events.reverse();
  }

  /**
   * Get session by ID
   */
  public getSession(sessionId: string): SessionMetadata | null {
    if (!this.db) throw new Error("Database not initialized");

    const row = this.db
      .prepare("SELECT * FROM sessions WHERE session_id = ?")
      .get(sessionId) as SessionRow | undefined;

    return row ? rowToSession(row) : null;
  }

  /**
   * Get session by pane ID
   */
  public getSessionByPane(paneId: string): SessionMetadata | null {
    if (!this.db) throw new Error("Database not initialized");

    const row = this.db
      .prepare("SELECT * FROM sessions WHERE pane_id = ? ORDER BY started_at DESC LIMIT 1")
      .get(paneId) as SessionRow | undefined;

    return row ? rowToSession(row) : null;
  }

  /**
   * Get all active sessions
   */
  public getAllSessions(): SessionMetadata[] {
    if (!this.db) throw new Error("Database not initialized");

    const rows = this.db
      .prepare("SELECT * FROM sessions ORDER BY started_at DESC")
      .all() as SessionRow[];

    return rows.map(rowToSession);
  }

  /**
   * Schedule a non-blocking prune operation
   */
  private schedulePrune(): void {
    if (this.pruneScheduled) return;

    this.pruneScheduled = true;
    setImmediate(() => {
      this.pruneScheduled = false;
      try {
        this.prune();
      } catch (error) {
        console.error("[StreamEventStore] Prune failed:", error);
      }
    });
  }

  /**
   * Prune old events
   */
  public prune(): { deletedEvents: number; deletedSessions: number } {
    if (!this.db) throw new Error("Database not initialized");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxAgeDays);
    const cutoffTimestamp = cutoffDate.toISOString();

    // Delete old events
    const eventResult = this.db
      .prepare("DELETE FROM stream_events WHERE timestamp < ?")
      .run(cutoffTimestamp);

    // Delete old sessions
    const sessionResult = this.db
      .prepare("DELETE FROM sessions WHERE started_at < ?")
      .run(cutoffTimestamp);

    // Also enforce max events limit
    const countResult = this.db
      .prepare("SELECT COUNT(*) as count FROM stream_events")
      .get() as { count: number };

    let excessDeleted = 0;
    if (countResult.count > this.config.maxEvents) {
      const excessCount = countResult.count - this.config.maxEvents;
      const excessResult = this.db
        .prepare(`
          DELETE FROM stream_events WHERE id IN (
            SELECT id FROM stream_events ORDER BY timestamp ASC LIMIT ?
          )
        `)
        .run(excessCount);
      excessDeleted = excessResult.changes;
    }

    const deletedEvents = eventResult.changes + excessDeleted;
    const deletedSessions = sessionResult.changes;

    if (deletedEvents > 0 || deletedSessions > 0) {
      console.log(`[StreamEventStore] Pruned ${deletedEvents} events, ${deletedSessions} sessions`);
    }

    return { deletedEvents, deletedSessions };
  }

  /**
   * Get statistics
   */
  public getStats(): {
    eventCount: number;
    sessionCount: number;
    totalCost: number;
  } {
    if (!this.db) throw new Error("Database not initialized");

    const eventCount = (this.db.prepare("SELECT COUNT(*) as count FROM stream_events").get() as { count: number }).count;
    const sessionCount = (this.db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number }).count;
    const totalCost = (this.db.prepare("SELECT SUM(total_cost) as total FROM sessions").get() as { total: number | null }).total ?? 0;

    return { eventCount, sessionCount, totalCost };
  }

  /**
   * Close database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.insertEventStmt = null;
      this.upsertSessionStmt = null;
      console.log("[StreamEventStore] Database closed");
    }
  }

  /**
   * Check if initialized
   */
  public isInitialized(): boolean {
    return this.db !== null;
  }
}

// Singleton instance
let streamEventStoreInstance: StreamEventStore | null = null;

/**
 * Get or create the StreamEventStore singleton
 */
export function getStreamEventStore(config?: Partial<StreamEventStoreConfig>): StreamEventStore {
  if (!streamEventStoreInstance) {
    streamEventStoreInstance = new StreamEventStore(config);
  }
  return streamEventStoreInstance;
}

/**
 * Reset the StreamEventStore singleton (for testing)
 */
export function resetStreamEventStore(): void {
  if (streamEventStoreInstance) {
    streamEventStoreInstance.close();
    streamEventStoreInstance = null;
  }
}
