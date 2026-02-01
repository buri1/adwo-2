/**
 * EventManager Tests
 * Story 1.4 — WebSocket Server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EventManager,
  getEventManager,
  resetEventManager,
} from "../../src/lib/websocket/event-manager";
import type { NormalizedTerminalEvent } from "@adwo/shared";

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

  beforeEach(() => {
    manager = new EventManager(100);
  });

  afterEach(() => {
    manager.close();
  });

  describe("emit", () => {
    it("should store events in the buffer", () => {
      const event = createEvent("1");
      manager.emit(event);

      expect(manager.getBufferSize()).toBe(1);
      expect(manager.getAll()).toContainEqual(event);
    });

    it("should store events even without broadcaster initialized (AC5)", () => {
      // Broadcaster not initialized, but events should still be stored
      expect(manager.isInitialized()).toBe(false);

      const events = [createEvent("1"), createEvent("2"), createEvent("3")];
      events.forEach((e) => manager.emit(e));

      expect(manager.getBufferSize()).toBe(3);
      expect(manager.getAll()).toEqual(events);
    });

    it("should respect buffer capacity of 1000 (AC5)", () => {
      const largeManager = new EventManager(1000);

      for (let i = 0; i < 1100; i++) {
        largeManager.emit(createEvent(String(i)));
      }

      expect(largeManager.getBufferSize()).toBe(1000);

      largeManager.close();
    });
  });

  describe("getRecent", () => {
    it("should return events after the specified timestamp", () => {
      const baseTime = new Date();

      const oldEvent = createEvent("old");
      (oldEvent as any).timestamp = new Date(
        baseTime.getTime() - 5000
      ).toISOString();

      const newEvent = createEvent("new");
      (newEvent as any).timestamp = new Date(
        baseTime.getTime() + 5000
      ).toISOString();

      manager.emit(oldEvent);
      manager.emit(newEvent);

      const recent = manager.getRecent(baseTime);

      expect(recent.length).toBe(1);
      expect(recent[0]?.id).toBe("new");
    });
  });

  describe("getSince", () => {
    it("should return events after the specified event ID", () => {
      manager.emit(createEvent("1"));
      manager.emit(createEvent("2"));
      manager.emit(createEvent("3"));

      const since = manager.getSince("1");

      expect(since.length).toBe(2);
      expect(since.map((e) => e.id)).toEqual(["2", "3"]);
    });
  });

  describe("getBufferCapacity", () => {
    it("should return the configured capacity", () => {
      expect(manager.getBufferCapacity()).toBe(100);

      const customManager = new EventManager(500);
      expect(customManager.getBufferCapacity()).toBe(500);
      customManager.close();
    });

    it("should default to 1000", () => {
      const defaultManager = new EventManager();
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
    const manager1 = getEventManager();
    const manager2 = getEventManager();

    expect(manager1).toBe(manager2);
  });

  it("should reset the singleton", () => {
    const manager1 = getEventManager();
    resetEventManager();
    const manager2 = getEventManager();

    expect(manager1).not.toBe(manager2);
  });

  it("should use custom buffer size on first call", () => {
    const manager = getEventManager(500);

    expect(manager.getBufferCapacity()).toBe(500);
  });
});
