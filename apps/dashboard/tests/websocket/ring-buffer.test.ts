/**
 * RingBuffer Tests
 * Story 1.4 — WebSocket Server
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RingBuffer } from "../../src/lib/websocket/ring-buffer";

interface TestEvent {
  id: string;
  timestamp: string;
  content: string;
}

function createEvent(id: string, timestamp: Date, content = "test"): TestEvent {
  return {
    id,
    timestamp: timestamp.toISOString(),
    content,
  };
}

describe("RingBuffer", () => {
  let buffer: RingBuffer<TestEvent>;

  beforeEach(() => {
    buffer = new RingBuffer<TestEvent>(5);
  });

  describe("push", () => {
    it("should add events to the buffer", () => {
      const event = createEvent("1", new Date());
      buffer.push(event);

      expect(buffer.size()).toBe(1);
      expect(buffer.getAll()).toContainEqual(event);
    });

    it("should maintain order of events", () => {
      const events = [
        createEvent("1", new Date("2024-01-01T00:00:00Z")),
        createEvent("2", new Date("2024-01-01T00:01:00Z")),
        createEvent("3", new Date("2024-01-01T00:02:00Z")),
      ];

      events.forEach((e) => buffer.push(e));

      const all = buffer.getAll();
      expect(all[0]?.id).toBe("1");
      expect(all[1]?.id).toBe("2");
      expect(all[2]?.id).toBe("3");
    });

    it("should evict oldest event when capacity is reached", () => {
      // Buffer capacity is 5
      for (let i = 1; i <= 6; i++) {
        buffer.push(createEvent(String(i), new Date()));
      }

      expect(buffer.size()).toBe(5);

      const all = buffer.getAll();
      // First event should be evicted
      expect(all.find((e) => e.id === "1")).toBeUndefined();
      // Events 2-6 should remain
      expect(all.map((e) => e.id)).toEqual(["2", "3", "4", "5", "6"]);
    });

    it("should handle max capacity of 1000 (AC5)", () => {
      const largeBuffer = new RingBuffer<TestEvent>(1000);

      for (let i = 1; i <= 1100; i++) {
        largeBuffer.push(createEvent(String(i), new Date()));
      }

      expect(largeBuffer.size()).toBe(1000);
      expect(largeBuffer.capacity()).toBe(1000);

      // First 100 events should be evicted
      const all = largeBuffer.getAll();
      expect(all[0]?.id).toBe("101");
      expect(all[999]?.id).toBe("1100");
    });
  });

  describe("getRecent", () => {
    it("should return events after the specified timestamp", () => {
      const baseTime = new Date("2024-01-01T00:00:00Z");

      buffer.push(createEvent("1", new Date(baseTime.getTime() - 2000)));
      buffer.push(createEvent("2", new Date(baseTime.getTime() - 1000)));
      buffer.push(createEvent("3", new Date(baseTime.getTime() + 1000)));
      buffer.push(createEvent("4", new Date(baseTime.getTime() + 2000)));

      const recent = buffer.getRecent(baseTime);

      expect(recent.length).toBe(2);
      expect(recent.map((e) => e.id)).toEqual(["3", "4"]);
    });

    it("should return empty array if no events after timestamp", () => {
      const futureTime = new Date("2030-01-01T00:00:00Z");

      buffer.push(createEvent("1", new Date("2024-01-01T00:00:00Z")));

      const recent = buffer.getRecent(futureTime);

      expect(recent).toEqual([]);
    });

    it("should return all events if timestamp is in the past", () => {
      const pastTime = new Date("2020-01-01T00:00:00Z");

      buffer.push(createEvent("1", new Date("2024-01-01T00:00:00Z")));
      buffer.push(createEvent("2", new Date("2024-01-01T00:01:00Z")));

      const recent = buffer.getRecent(pastTime);

      expect(recent.length).toBe(2);
    });
  });

  describe("getSince", () => {
    it("should return events after the specified event ID", () => {
      buffer.push(createEvent("1", new Date()));
      buffer.push(createEvent("2", new Date()));
      buffer.push(createEvent("3", new Date()));
      buffer.push(createEvent("4", new Date()));

      const since = buffer.getSince("2");

      expect(since.length).toBe(2);
      expect(since.map((e) => e.id)).toEqual(["3", "4"]);
    });

    it("should return all events if event ID not found", () => {
      buffer.push(createEvent("1", new Date()));
      buffer.push(createEvent("2", new Date()));

      const since = buffer.getSince("nonexistent");

      expect(since.length).toBe(2);
    });

    it("should return empty array if specified event is the last one", () => {
      buffer.push(createEvent("1", new Date()));
      buffer.push(createEvent("2", new Date()));

      const since = buffer.getSince("2");

      expect(since).toEqual([]);
    });
  });

  describe("getAll", () => {
    it("should return a copy of all events", () => {
      buffer.push(createEvent("1", new Date()));
      buffer.push(createEvent("2", new Date()));

      const all1 = buffer.getAll();
      const all2 = buffer.getAll();

      // Should be equal but not the same reference
      expect(all1).toEqual(all2);
      expect(all1).not.toBe(all2);
    });

    it("should return empty array for empty buffer", () => {
      expect(buffer.getAll()).toEqual([]);
    });
  });

  describe("size", () => {
    it("should return 0 for empty buffer", () => {
      expect(buffer.size()).toBe(0);
    });

    it("should return correct count after adding events", () => {
      buffer.push(createEvent("1", new Date()));
      expect(buffer.size()).toBe(1);

      buffer.push(createEvent("2", new Date()));
      expect(buffer.size()).toBe(2);
    });
  });

  describe("capacity", () => {
    it("should return the maximum capacity", () => {
      expect(buffer.capacity()).toBe(5);

      const largeBuffer = new RingBuffer<TestEvent>(1000);
      expect(largeBuffer.capacity()).toBe(1000);
    });
  });

  describe("clear", () => {
    it("should remove all events from the buffer", () => {
      buffer.push(createEvent("1", new Date()));
      buffer.push(createEvent("2", new Date()));

      expect(buffer.size()).toBe(2);

      buffer.clear();

      expect(buffer.size()).toBe(0);
      expect(buffer.getAll()).toEqual([]);
    });
  });

  describe("AC5: Events stored without clients", () => {
    it("should store events up to max capacity regardless of client connections", () => {
      const largeBuffer = new RingBuffer<TestEvent>(1000);

      // Simulate events being pushed without any WebSocket clients
      for (let i = 0; i < 1000; i++) {
        largeBuffer.push(createEvent(String(i), new Date()));
      }

      expect(largeBuffer.size()).toBe(1000);

      // All events should be retrievable
      const all = largeBuffer.getAll();
      expect(all.length).toBe(1000);
    });
  });
});
