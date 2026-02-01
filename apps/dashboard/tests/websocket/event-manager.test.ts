/**
 * EventManager Tests
 * Story 1.4 — WebSocket Server
 * Story 5.1 — SQLite Persistence for Events
 * Story 5.2 — Crash Recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "path";
import { rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import {
  EventManager,
  getEventManager,
  resetEventManager,
} from "../../src/lib/websocket/event-manager";
import { EventStore, resetEventStore } from "../../src/lib/persistence";
import type { NormalizedTerminalEvent } from "@adwo/shared";

// Test directory for SQLite database
const TEST_DB_DIR = join(tmpdir(), "adwo-test-eventmanager");

function createEvent(
  id: string,
  content = "test content"
): NormalizedTerminalEvent {
  return {
    id,
    pane_id: "test-pane",
    type: "output",
    content,
    timestamp: new Date().toISOString(),
    project_id: "test-project",
  };
}

describe("EventManager", () => {
  let manager: EventManager;
  let eventCounter = 0;

  // Create unique event IDs to avoid duplicate tracking across tests
  function createUniqueEvent(content = "test content"): NormalizedTerminalEvent {
    eventCounter++;
    return createEvent(`unique-${eventCounter}-${Date.now()}`, content);
  }

  beforeEach(() => {
    // Reset to clear duplicate tracking
    resetEventManager();
    // Disable persistence for unit tests to avoid SQLite file creation
    manager = new EventManager({ maxBufferSize: 100, enablePersistence: false });
  });

  afterEach(() => {
    manager.close();
    resetEventManager();
  });

  describe("emit", () => {
    it("should store events in the buffer", () => {
      const event = createUniqueEvent();
      manager.emit(event);

      expect(manager.getBufferSize()).toBe(1);
      expect(manager.getAll()).toContainEqual(event);
    });

    it("should store events even without broadcaster initialized (AC5)", () => {
      // Broadcaster not initialized, but events should still be stored
      expect(manager.isInitialized()).toBe(false);

      const events = [createUniqueEvent(), createUniqueEvent(), createUniqueEvent()];
      events.forEach((e) => manager.emit(e));

      expect(manager.getBufferSize()).toBe(3);
      expect(manager.getAll()).toEqual(events);
    });

    it("should respect buffer capacity of 1000 (AC5)", () => {
      const largeManager = new EventManager({ maxBufferSize: 1000, enablePersistence: false });

      for (let i = 0; i < 1100; i++) {
        largeManager.emit(createEvent(`capacity-${i}-${Date.now()}`));
      }

      expect(largeManager.getBufferSize()).toBe(1000);

      largeManager.close();
    });
  });

  describe("getRecent", () => {
    it("should return events after the specified timestamp", () => {
      const baseTime = new Date();
      const oldId = `old-${Date.now()}`;
      const newId = `new-${Date.now()}`;

      const oldEvent = createEvent(oldId);
      (oldEvent as any).timestamp = new Date(
        baseTime.getTime() - 5000
      ).toISOString();

      const newEvent = createEvent(newId);
      (newEvent as any).timestamp = new Date(
        baseTime.getTime() + 5000
      ).toISOString();

      manager.emit(oldEvent);
      manager.emit(newEvent);

      const recent = manager.getRecent(baseTime);

      expect(recent.length).toBe(1);
      expect(recent[0]?.id).toBe(newId);
    });
  });

  describe("getSince", () => {
    it("should return events after the specified event ID", () => {
      const id1 = `since-1-${Date.now()}`;
      const id2 = `since-2-${Date.now()}`;
      const id3 = `since-3-${Date.now()}`;

      manager.emit(createEvent(id1));
      manager.emit(createEvent(id2));
      manager.emit(createEvent(id3));

      const since = manager.getSince(id1);

      expect(since.length).toBe(2);
      expect(since.map((e) => e.id)).toEqual([id2, id3]);
    });
  });

  describe("getBufferCapacity", () => {
    it("should return the configured capacity", () => {
      expect(manager.getBufferCapacity()).toBe(100);

      const customManager = new EventManager({ maxBufferSize: 500, enablePersistence: false });
      expect(customManager.getBufferCapacity()).toBe(500);
      customManager.close();
    });

    it("should default to 1000", () => {
      const defaultManager = new EventManager({ enablePersistence: false });
      expect(defaultManager.getBufferCapacity()).toBe(1000);
      defaultManager.close();
    });
  });

  describe("isInitialized", () => {
    it("should return false before initialization", () => {
      expect(manager.isInitialized()).toBe(false);
    });

    // Note: Testing initialization requires a real HTTP server
    // which is covered in integration tests
  });

  describe("getClientCount", () => {
    it("should return 0 when broadcaster not initialized", () => {
      expect(manager.getClientCount()).toBe(0);
    });
  });
});

describe("EventManager Singleton", () => {
  afterEach(() => {
    resetEventManager();
  });

  it("should return the same instance on multiple calls", () => {
    const manager1 = getEventManager({ enablePersistence: false });
    const manager2 = getEventManager({ enablePersistence: false });

    expect(manager1).toBe(manager2);
  });

  it("should reset the singleton", () => {
    const manager1 = getEventManager({ enablePersistence: false });
    resetEventManager();
    const manager2 = getEventManager({ enablePersistence: false });

    expect(manager1).not.toBe(manager2);
  });

  it("should use custom buffer size on first call", () => {
    const manager = getEventManager({ maxBufferSize: 500, enablePersistence: false });

    expect(manager.getBufferCapacity()).toBe(500);
  });
});

describe("EventManager Recovery Integration (Story 5.2)", () => {
  let manager: EventManager;
  let dbPath: string;

  beforeEach(() => {
    // Create unique test directory
    const testId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dbPath = join(TEST_DB_DIR, testId, "events.db");
  });

  afterEach(async () => {
    if (manager) {
      manager.close();
    }
    resetEventManager();

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

  it("should recover events from SQLite on startup (AC1)", async () => {
    // First, create a store and insert events
    const store = new EventStore({ dbPath });
    store.initialize();
    store.insert(createEvent("recovered-1"));
    store.insert(createEvent("recovered-2"));
    store.close();
    resetEventStore();

    // Now create EventManager which should recover events
    manager = new EventManager({
      maxBufferSize: 100,
      enablePersistence: true,
      enableRecovery: true,
      persistence: { dbPath },
    });

    // Wait for async recovery
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check recovery result
    expect(manager.isRecoveryComplete()).toBe(true);

    const result = manager.getRecoveryResult();
    expect(result).not.toBeNull();
    expect(result?.eventsLoaded).toBe(2);
    expect(result?.status).toBe("success");

    // Verify events are in buffer
    expect(manager.getBufferSize()).toBe(2);
  });

  it("should prevent duplicate events after recovery (AC3)", async () => {
    // Setup: Create store with one event
    const store = new EventStore({ dbPath });
    store.initialize();
    store.insert(createEvent("dup-check"));
    store.close();
    resetEventStore();

    // Create EventManager (will recover the event)
    manager = new EventManager({
      maxBufferSize: 100,
      enablePersistence: true,
      enableRecovery: true,
      persistence: { dbPath },
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(manager.getBufferSize()).toBe(1);

    // Try to emit the same event again
    manager.emit(createEvent("dup-check"));

    // Should still be 1 (duplicate prevented)
    expect(manager.getBufferSize()).toBe(1);
  });

  it("should enter memory-only mode on SQLite failure (AC4)", () => {
    // Use invalid path to trigger failure
    manager = new EventManager({
      maxBufferSize: 100,
      enablePersistence: true,
      enableRecovery: true,
      persistence: { dbPath: "/invalid/path/to/db.sqlite" },
    });

    // Should be in memory-only mode
    expect(manager.isMemoryOnlyMode()).toBe(true);
    expect(manager.isPersistenceEnabled()).toBe(false);
  });

  it("should not persist events in memory-only mode (AC4)", async () => {
    // Create manager in memory-only mode
    manager = new EventManager({
      maxBufferSize: 100,
      enablePersistence: true,
      enableRecovery: true,
      persistence: { dbPath: "/invalid/path/to/db.sqlite" },
    });

    expect(manager.isMemoryOnlyMode()).toBe(true);

    // Emit an event
    manager.emit(createEvent("memory-only-event"));

    // Event should be in buffer
    expect(manager.getBufferSize()).toBe(1);

    // But persistence should be disabled
    expect(manager.isPersistenceEnabled()).toBe(false);
  });

  it("should disable recovery when enableRecovery is false", async () => {
    // Create store with events
    const store = new EventStore({ dbPath });
    store.initialize();
    store.insert(createEvent("should-not-load"));
    store.close();
    resetEventStore();

    // Create EventManager with recovery disabled
    manager = new EventManager({
      maxBufferSize: 100,
      enablePersistence: true,
      enableRecovery: false,
      persistence: { dbPath },
    });

    // Buffer should be empty (no recovery)
    expect(manager.getBufferSize()).toBe(0);
  });
});
