/**
 * RecoveryManager Tests
 * Story 5.2 — Crash Recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "path";
import { rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { RecoveryManager, resetRecoveryManager, getRecoveryManager } from "../../src/lib/recovery";
import { EventStore, resetEventStore } from "../../src/lib/persistence";
import { RingBuffer } from "../../src/lib/websocket/ring-buffer";
import type { NormalizedTerminalEvent } from "@adwo/shared";

// Test directory for SQLite database
const TEST_DB_DIR = join(tmpdir(), "adwo-test-recovery");

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

describe("RecoveryManager", () => {
  let recoveryManager: RecoveryManager;
  let eventStore: EventStore;
  let buffer: RingBuffer<NormalizedTerminalEvent>;
  let dbPath: string;

  beforeEach(() => {
    // Create unique test directory
    const testId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dbPath = join(TEST_DB_DIR, testId, "events.db");

    eventStore = new EventStore({
      dbPath,
      maxEvents: 100,
      maxAgeDays: 30,
      enableWal: true,
    });

    buffer = new RingBuffer<NormalizedTerminalEvent>(1000);
    recoveryManager = new RecoveryManager({ verbose: false });
  });

  afterEach(() => {
    if (eventStore.isInitialized()) {
      eventStore.close();
    }
    resetEventStore();
    resetRecoveryManager();

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

  describe("AC1: Events loaded from SQLite, RingBuffer repopulated", () => {
    it("should load events from SQLite into RingBuffer on recovery", async () => {
      eventStore.initialize();

      // Insert events into SQLite
      const events = [
        createTestEvent("1", { timestamp: "2024-01-01T10:00:00Z" }),
        createTestEvent("2", { timestamp: "2024-01-01T11:00:00Z" }),
        createTestEvent("3", { timestamp: "2024-01-01T12:00:00Z" }),
      ];
      eventStore.insertBatch(events);

      // Perform recovery
      const result = await recoveryManager.recover(eventStore, buffer);

      expect(result.status).toBe("success");
      expect(result.eventsLoaded).toBe(3);
      expect(buffer.size()).toBe(3);

      // Verify events are in buffer
      const bufferEvents = buffer.getAll();
      expect(bufferEvents.map(e => e.id)).toEqual(["1", "2", "3"]);
    });

    it("should limit loaded events to maxEventsToLoad", async () => {
      eventStore.initialize();

      // Insert more events than limit
      const events = [];
      for (let i = 1; i <= 50; i++) {
        events.push(createTestEvent(String(i)));
      }
      eventStore.insertBatch(events);

      // Create recovery manager with small limit
      const limitedRecovery = new RecoveryManager({
        maxEventsToLoad: 10,
        verbose: false,
      });

      const result = await limitedRecovery.recover(eventStore, buffer);

      expect(result.eventsLoaded).toBe(10);
      expect(buffer.size()).toBe(10);
    });

    it("should preserve event order (chronological)", async () => {
      eventStore.initialize();

      eventStore.insertBatch([
        createTestEvent("oldest", { timestamp: "2024-01-01T10:00:00Z" }),
        createTestEvent("middle", { timestamp: "2024-01-01T11:00:00Z" }),
        createTestEvent("newest", { timestamp: "2024-01-01T12:00:00Z" }),
      ]);

      await recoveryManager.recover(eventStore, buffer);

      const bufferEvents = buffer.getAll();
      expect(bufferEvents[0]?.id).toBe("oldest");
      expect(bufferEvents[2]?.id).toBe("newest");
    });
  });

  describe("AC3: Duplicates prevented via event ID checking", () => {
    it("should skip duplicate events during recovery", async () => {
      eventStore.initialize();

      // Insert events with same IDs (simulating duplicates)
      eventStore.insert(createTestEvent("dup-1"));
      eventStore.insert(createTestEvent("dup-2"));

      // Pre-mark one event as seen
      recoveryManager.markEventSeen("dup-1");

      const result = await recoveryManager.recover(eventStore, buffer);

      expect(result.eventsLoaded).toBe(1);
      expect(result.duplicatesSkipped).toBe(1);
      expect(buffer.size()).toBe(1);
      expect(buffer.getAll()[0]?.id).toBe("dup-2");
    });

    it("should track seen event IDs after recovery", async () => {
      eventStore.initialize();
      eventStore.insert(createTestEvent("track-1"));

      await recoveryManager.recover(eventStore, buffer);

      expect(recoveryManager.isEventSeen("track-1")).toBe(true);
      expect(recoveryManager.isEventSeen("never-seen")).toBe(false);
    });

    it("should prune seen event IDs to prevent memory growth", async () => {
      eventStore.initialize();

      // Mark many events as seen (pruning triggers at > 2000)
      for (let i = 0; i < 2500; i++) {
        recoveryManager.markEventSeen(`event-${i}`);
      }

      // Pruning happens at > 2000, keeps 1000, then we add remaining
      // After adding 2500: first 2001 triggers prune (keeps 1000), then add 499 more = 1499
      expect(recoveryManager.getSeenEventCount()).toBeLessThan(2500);

      // Add more to trigger another prune
      for (let i = 2500; i < 3500; i++) {
        recoveryManager.markEventSeen(`event-${i}`);
      }

      // After second prune, should be around 1000
      expect(recoveryManager.getSeenEventCount()).toBeLessThanOrEqual(2000);
    });
  });

  describe("AC4: Memory-only mode with WebSocket warning", () => {
    it("should enter memory-only mode when EventStore is null", async () => {
      const result = await recoveryManager.recover(null, buffer);

      expect(result.status).toBe("memory_only");
      expect(result.memoryOnlyMode).toBe(true);
      expect(result.error).toContain("not provided");
      expect(recoveryManager.isMemoryOnlyMode()).toBe(true);
    });

    it("should enter memory-only mode when EventStore not initialized", async () => {
      // Don't initialize eventStore
      const result = await recoveryManager.recover(eventStore, buffer);

      expect(result.status).toBe("memory_only");
      expect(result.memoryOnlyMode).toBe(true);
      expect(result.error).toContain("not initialized");
    });

    it("should prepare warning for WebSocket broadcast in memory-only mode", async () => {
      await recoveryManager.recover(null, buffer);

      const warning = recoveryManager.consumePendingWarning();

      expect(warning).not.toBeNull();
      expect(warning?.type).toBe("recovery_warning");
      expect(warning?.payload.mode).toBe("memory_only");
      expect(warning?.payload.message).toContain("memory-only mode");
    });

    it("should clear warning after consuming", async () => {
      await recoveryManager.recover(null, buffer);

      recoveryManager.consumePendingWarning();
      const secondConsume = recoveryManager.consumePendingWarning();

      expect(secondConsume).toBeNull();
    });

    it("should not have warning on successful recovery", async () => {
      eventStore.initialize();

      await recoveryManager.recover(eventStore, buffer);

      const warning = recoveryManager.consumePendingWarning();
      expect(warning).toBeNull();
    });
  });

  describe("recovery status", () => {
    it("should mark recovery as complete after success", async () => {
      eventStore.initialize();

      expect(recoveryManager.isRecoveryComplete()).toBe(false);

      await recoveryManager.recover(eventStore, buffer);

      expect(recoveryManager.isRecoveryComplete()).toBe(true);
    });

    it("should mark recovery as complete after memory-only mode", async () => {
      await recoveryManager.recover(null, buffer);

      expect(recoveryManager.isRecoveryComplete()).toBe(true);
    });

    it("should store last recovery result", async () => {
      eventStore.initialize();
      eventStore.insert(createTestEvent("1"));

      await recoveryManager.recover(eventStore, buffer);

      const result = recoveryManager.getLastRecoveryResult();
      expect(result).not.toBeNull();
      expect(result?.eventsLoaded).toBe(1);
      expect(result?.status).toBe("success");
    });

    it("should include timestamp in recovery result", async () => {
      eventStore.initialize();

      const beforeRecovery = new Date().toISOString();
      await recoveryManager.recover(eventStore, buffer);
      const afterRecovery = new Date().toISOString();

      const result = recoveryManager.getLastRecoveryResult();
      expect(result).not.toBeNull();
      expect(result!.timestamp).toBeDefined();
      expect(result!.timestamp >= beforeRecovery).toBe(true);
      expect(result!.timestamp <= afterRecovery).toBe(true);
    });
  });

  describe("singleton behavior", () => {
    it("should return same instance from getRecoveryManager", () => {
      const instance1 = getRecoveryManager();
      const instance2 = getRecoveryManager();

      expect(instance1).toBe(instance2);
    });

    it("should reset singleton state on resetRecoveryManager", async () => {
      const instance = getRecoveryManager();
      eventStore.initialize();
      await instance.recover(eventStore, buffer);

      resetRecoveryManager();

      const newInstance = getRecoveryManager();
      expect(newInstance).not.toBe(instance);
      expect(newInstance.isRecoveryComplete()).toBe(false);
    });
  });

  describe("reset", () => {
    it("should clear all state on reset", async () => {
      eventStore.initialize();
      eventStore.insert(createTestEvent("1"));
      await recoveryManager.recover(eventStore, buffer);

      recoveryManager.reset();

      expect(recoveryManager.isRecoveryComplete()).toBe(false);
      expect(recoveryManager.isMemoryOnlyMode()).toBe(false);
      expect(recoveryManager.getLastRecoveryResult()).toBeNull();
      expect(recoveryManager.getSeenEventCount()).toBe(0);
    });
  });
});

describe("RingBuffer extensions", () => {
  let buffer: RingBuffer<NormalizedTerminalEvent>;

  beforeEach(() => {
    buffer = new RingBuffer<NormalizedTerminalEvent>(10);
  });

  describe("loadBulk", () => {
    it("should load events in bulk", () => {
      const events = [
        createTestEvent("1"),
        createTestEvent("2"),
        createTestEvent("3"),
      ];

      buffer.loadBulk(events);

      expect(buffer.size()).toBe(3);
      expect(buffer.getAll().map(e => e.id)).toEqual(["1", "2", "3"]);
    });

    it("should respect capacity when loading bulk", () => {
      const events = [];
      for (let i = 1; i <= 20; i++) {
        events.push(createTestEvent(String(i)));
      }

      buffer.loadBulk(events);

      // Buffer capacity is 10, should only have last 10
      expect(buffer.size()).toBe(10);
      expect(buffer.getAll().map(e => e.id)).toEqual(
        ["11", "12", "13", "14", "15", "16", "17", "18", "19", "20"]
      );
    });

    it("should replace existing events", () => {
      buffer.push(createTestEvent("old-1"));
      buffer.push(createTestEvent("old-2"));

      buffer.loadBulk([createTestEvent("new-1")]);

      expect(buffer.size()).toBe(1);
      expect(buffer.getAll()[0]?.id).toBe("new-1");
    });
  });

  describe("hasEvent", () => {
    it("should return true for existing event", () => {
      buffer.push(createTestEvent("exists"));

      expect(buffer.hasEvent("exists")).toBe(true);
    });

    it("should return false for non-existing event", () => {
      buffer.push(createTestEvent("other"));

      expect(buffer.hasEvent("not-exists")).toBe(false);
    });
  });
});
