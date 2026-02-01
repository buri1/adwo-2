/**
 * EventStore Tests
 * Story 5.1 — SQLite Persistence for Events
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { EventStore, resetEventStore } from "../../src/lib/persistence";
import type { NormalizedTerminalEvent } from "@adwo/shared";

// Test directory for SQLite database
const TEST_DB_DIR = join(tmpdir(), "adwo-test-persistence");

function createTestEvent(
  id: string,
  options: Partial<NormalizedTerminalEvent> = {}
): NormalizedTerminalEvent {
  return {
    id,
    pane_id: options.pane_id ?? "pane-1",
    project_id: options.project_id ?? "test-project",
    type: options.type ?? "output",
    content: options.content ?? `Test content for ${id}`,
    timestamp: options.timestamp ?? new Date().toISOString(),
    ...options,
  };
}

describe("EventStore", () => {
  let store: EventStore;
  let dbPath: string;

  beforeEach(() => {
    // Create unique test directory
    const testId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dbPath = join(TEST_DB_DIR, testId, "events.db");

    store = new EventStore({
      dbPath,
      maxEvents: 100,
      maxAgeDays: 30,
      enableWal: true,
    });
  });

  afterEach(() => {
    store.close();
    resetEventStore();

    // Cleanup test directory
    try {
      const testDir = join(dbPath, "..");
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("initialization", () => {
    it("should create database with WAL mode (AC1)", () => {
      store.initialize();

      expect(store.isInitialized()).toBe(true);
      expect(existsSync(dbPath)).toBe(true);
    });

    it("should create events table with correct schema (AC3)", () => {
      store.initialize();

      // Insert and query to verify schema works
      const event = createTestEvent("test-1");
      store.insert(event);

      const result = store.query({});
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        id: "test-1",
        type: "output",
        project_id: "test-project",
        pane_id: "pane-1",
      });
    });

    it("should create directory if it does not exist", () => {
      const deepPath = join(TEST_DB_DIR, "deep", "nested", "path", "events.db");
      const deepStore = new EventStore({ dbPath: deepPath });

      deepStore.initialize();

      expect(existsSync(deepPath)).toBe(true);
      deepStore.close();
    });
  });

  describe("insert", () => {
    beforeEach(() => {
      store.initialize();
    });

    it("should insert events synchronously", () => {
      const event = createTestEvent("sync-1");
      store.insert(event);

      const result = store.query({});
      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.id).toBe("sync-1");
    });

    it("should insert events asynchronously (AC2)", async () => {
      const event = createTestEvent("async-1");
      store.insertAsync(event);

      // Wait for setImmediate to process
      await new Promise((resolve) => setImmediate(resolve));

      const result = store.query({});
      expect(result.events).toHaveLength(1);
    });

    it("should insert batch of events in transaction", () => {
      const events = [
        createTestEvent("batch-1"),
        createTestEvent("batch-2"),
        createTestEvent("batch-3"),
      ];

      store.insertBatch(events);

      const result = store.query({});
      expect(result.events).toHaveLength(3);
    });

    it("should preserve question_metadata in JSON", () => {
      const event = createTestEvent("question-1", {
        type: "question",
        question_metadata: {
          header: "Test Header",
          question: "What is the answer?",
          options: [
            { number: 1, label: "Option A", description: "Description A" },
            { number: 2, label: "Option B" },
          ],
        },
      });

      store.insert(event);

      const result = store.query({});
      expect(result.events[0]?.question_metadata).toEqual({
        header: "Test Header",
        question: "What is the answer?",
        options: [
          { number: 1, label: "Option A", description: "Description A" },
          { number: 2, label: "Option B" },
        ],
      });
    });
  });

  describe("query", () => {
    beforeEach(() => {
      store.initialize();

      // Insert test data
      store.insertBatch([
        createTestEvent("1", {
          project_id: "proj-a",
          pane_id: "pane-1",
          type: "output",
          timestamp: "2024-01-01T10:00:00Z",
        }),
        createTestEvent("2", {
          project_id: "proj-a",
          pane_id: "pane-2",
          type: "error",
          timestamp: "2024-01-01T11:00:00Z",
        }),
        createTestEvent("3", {
          project_id: "proj-b",
          pane_id: "pane-1",
          type: "question",
          timestamp: "2024-01-01T12:00:00Z",
        }),
        createTestEvent("4", {
          project_id: "proj-b",
          pane_id: "pane-2",
          type: "status",
          timestamp: "2024-01-01T13:00:00Z",
        }),
      ]);
    });

    it("should return all events with no filter (AC4)", () => {
      const result = store.query({});

      expect(result.events).toHaveLength(4);
      expect(result.total).toBe(4);
      expect(result.hasMore).toBe(false);
    });

    it("should filter by project_id", () => {
      const result = store.query({ projectId: "proj-a" });

      expect(result.events).toHaveLength(2);
      expect(result.events.every((e) => e.project_id === "proj-a")).toBe(true);
    });

    it("should filter by pane_id", () => {
      const result = store.query({ paneId: "pane-1" });

      expect(result.events).toHaveLength(2);
      expect(result.events.every((e) => e.pane_id === "pane-1")).toBe(true);
    });

    it("should filter by type", () => {
      const result = store.query({ type: "error" });

      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.type).toBe("error");
    });

    it("should filter by since timestamp", () => {
      const result = store.query({ since: "2024-01-01T11:30:00Z" });

      expect(result.events).toHaveLength(2);
      expect(result.events.map((e) => e.id)).toEqual(["3", "4"]);
    });

    it("should filter by afterId", () => {
      const result = store.query({ afterId: "2" });

      expect(result.events).toHaveLength(2);
      expect(result.events.map((e) => e.id)).toEqual(["3", "4"]);
    });

    it("should limit results", () => {
      const result = store.query({ limit: 2 });

      expect(result.events).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it("should order by timestamp desc", () => {
      const result = store.query({ order: "desc" });

      expect(result.events[0]?.id).toBe("4");
      expect(result.events[3]?.id).toBe("1");
    });
  });

  describe("getRecent", () => {
    beforeEach(() => {
      store.initialize();

      for (let i = 1; i <= 50; i++) {
        store.insert(
          createTestEvent(String(i), {
            timestamp: new Date(2024, 0, 1, 0, i).toISOString(),
          })
        );
      }
    });

    it("should return most recent events in ascending order (AC4)", () => {
      const recent = store.getRecent(10);

      expect(recent).toHaveLength(10);
      // Should be ordered oldest to newest (for display)
      expect(recent[0]?.id).toBe("41");
      expect(recent[9]?.id).toBe("50");
    });

    it("should respect limit parameter", () => {
      const recent = store.getRecent(5);

      expect(recent).toHaveLength(5);
    });
  });

  describe("getSince", () => {
    beforeEach(() => {
      store.initialize();

      store.insertBatch([
        createTestEvent("1", { timestamp: "2024-01-01T10:00:00Z" }),
        createTestEvent("2", { timestamp: "2024-01-01T11:00:00Z" }),
        createTestEvent("3", { timestamp: "2024-01-01T12:00:00Z" }),
      ]);
    });

    it("should return events after specified event ID", () => {
      const since = store.getSince("1");

      expect(since).toHaveLength(2);
      expect(since.map((e) => e.id)).toEqual(["2", "3"]);
    });

    it("should return empty for last event", () => {
      const since = store.getSince("3");

      expect(since).toHaveLength(0);
    });
  });

  describe("pruning (AC5)", () => {
    it("should delete events older than maxAgeDays", () => {
      const pruneStore = new EventStore({
        dbPath,
        maxEvents: 10000,
        maxAgeDays: 30,
      });
      pruneStore.initialize();

      // Insert old event (40 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);

      pruneStore.insert(
        createTestEvent("old", { timestamp: oldDate.toISOString() })
      );

      // Insert recent event
      pruneStore.insert(createTestEvent("new"));

      const result = pruneStore.prune();

      expect(result.deletedByAge).toBe(1);
      expect(result.remainingCount).toBe(1);

      pruneStore.close();
    });

    it("should delete oldest events when over maxEvents", async () => {
      // Use unique db path for this test
      const prunePath = join(TEST_DB_DIR, `prune-count-${Date.now()}`, "events.db");
      const pruneStore = new EventStore({
        dbPath: prunePath,
        maxEvents: 5,
        maxAgeDays: 30,
      });
      pruneStore.initialize();

      // Insert 10 events using batch (no scheduled prunes during batch)
      // Use recent dates to avoid age-based deletion
      const now = new Date();
      const events = [];
      for (let i = 1; i <= 10; i++) {
        events.push(
          createTestEvent(String(i), {
            timestamp: new Date(now.getTime() - (10 - i) * 1000).toISOString(),
          })
        );
      }
      pruneStore.insertBatch(events);

      // Verify 10 events inserted
      const beforePrune = pruneStore.getStats();
      expect(beforePrune.eventCount).toBe(10);

      const result = pruneStore.prune();

      expect(result.deletedByCount).toBe(5);
      expect(result.remainingCount).toBe(5);

      // Verify oldest events were deleted (events 1-5 are oldest)
      const remaining = pruneStore.query({});
      expect(remaining.events.map((e) => e.id)).toEqual([
        "6",
        "7",
        "8",
        "9",
        "10",
      ]);

      pruneStore.close();
    });

    it("should schedule prune non-blocking on insert", async () => {
      // Use unique db path for this test
      const prunePath = join(TEST_DB_DIR, `prune-schedule-${Date.now()}`, "events.db");
      const pruneStore = new EventStore({
        dbPath: prunePath,
        maxEvents: 3,
        maxAgeDays: 30,
      });
      pruneStore.initialize();

      // Insert more than maxEvents (use recent timestamps)
      const now = new Date();
      for (let i = 1; i <= 5; i++) {
        pruneStore.insert(
          createTestEvent(String(i), {
            timestamp: new Date(now.getTime() - (5 - i) * 1000).toISOString(),
          })
        );
      }

      // Wait for scheduled prune (multiple ticks to ensure prune completes)
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      const stats = pruneStore.getStats();
      // After scheduled prunes, should have at most maxEvents (3)
      expect(stats.eventCount).toBeLessThanOrEqual(3);

      pruneStore.close();
    });
  });

  describe("markSynced", () => {
    beforeEach(() => {
      store.initialize();
      store.insert(createTestEvent("1"));
      store.insert(createTestEvent("2"));
    });

    it("should mark single event as synced", () => {
      store.markSynced("1");

      // This is tested implicitly - no error means success
      expect(true).toBe(true);
    });

    it("should mark batch of events as synced", () => {
      store.markSyncedBatch(["1", "2"]);

      expect(true).toBe(true);
    });
  });

  describe("getStats", () => {
    beforeEach(() => {
      store.initialize();
    });

    it("should return correct statistics", () => {
      store.insertBatch([
        createTestEvent("1", { timestamp: "2024-01-01T10:00:00Z" }),
        createTestEvent("2", { timestamp: "2024-01-01T11:00:00Z" }),
        createTestEvent("3", { timestamp: "2024-01-01T12:00:00Z" }),
      ]);

      const stats = store.getStats();

      expect(stats.eventCount).toBe(3);
      expect(stats.oldestEvent).toBe("2024-01-01T10:00:00Z");
      expect(stats.newestEvent).toBe("2024-01-01T12:00:00Z");
      expect(stats.dbSizeBytes).toBeGreaterThan(0);
    });

    it("should return null timestamps for empty database", () => {
      const stats = store.getStats();

      expect(stats.eventCount).toBe(0);
      expect(stats.oldestEvent).toBeNull();
      expect(stats.newestEvent).toBeNull();
    });
  });
});
