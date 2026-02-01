/**
 * ADWO 2.0 Event Store Tests
 * Story 1.5 — Dashboard Event Stream UI
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useEventStore } from "../../src/stores/event-store";
import type { NormalizedTerminalEvent } from "@adwo/shared";

function createEvent(
  overrides: Partial<NormalizedTerminalEvent> = {}
): NormalizedTerminalEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    pane_id: "%0",
    type: "output",
    content: "Test output",
    timestamp: new Date().toISOString(),
    project_id: "test-project",
    ...overrides,
  };
}

describe("EventStore", () => {
  beforeEach(() => {
    useEventStore.getState().clearEvents();
  });

  describe("initial state", () => {
    it("should start with empty events", () => {
      const state = useEventStore.getState();
      expect(state.events).toEqual([]);
      expect(state.lastEventId).toBeNull();
      expect(state.lastEventTimestamp).toBeNull();
    });
  });

  describe("addEvent", () => {
    it("should add a single event", () => {
      const event = createEvent({ id: "evt_001" });
      useEventStore.getState().addEvent(event);

      const state = useEventStore.getState();
      expect(state.events).toHaveLength(1);
      expect(state.events[0]!).toEqual(event);
      expect(state.lastEventId).toBe("evt_001");
      expect(state.lastEventTimestamp).toBe(event.timestamp);
    });

    it("should append events in order", () => {
      const event1 = createEvent({ id: "evt_001" });
      const event2 = createEvent({ id: "evt_002" });

      useEventStore.getState().addEvent(event1);
      useEventStore.getState().addEvent(event2);

      const state = useEventStore.getState();
      expect(state.events).toHaveLength(2);
      expect(state.events[0]!.id).toBe("evt_001");
      expect(state.events[1]!.id).toBe("evt_002");
    });

    it("should not add duplicate events", () => {
      const event = createEvent({ id: "evt_001" });

      useEventStore.getState().addEvent(event);
      useEventStore.getState().addEvent(event);

      expect(useEventStore.getState().events).toHaveLength(1);
    });

    it("should enforce max events limit", () => {
      const store = useEventStore.getState();

      // Add 1001 events (max is 1000)
      for (let i = 0; i < 1001; i++) {
        store.addEvent(createEvent({ id: `evt_${i.toString().padStart(4, "0")}` }));
      }

      const state = useEventStore.getState();
      expect(state.events).toHaveLength(1000);
      // First event should be removed (oldest)
      expect(state.events[0]!.id).toBe("evt_0001");
      expect(state.events[999]!.id).toBe("evt_1000");
    });
  });

  describe("addEvents", () => {
    it("should add multiple events at once", () => {
      const events = [
        createEvent({ id: "evt_001", timestamp: "2024-01-01T10:00:00Z" }),
        createEvent({ id: "evt_002", timestamp: "2024-01-01T10:00:01Z" }),
        createEvent({ id: "evt_003", timestamp: "2024-01-01T10:00:02Z" }),
      ];

      useEventStore.getState().addEvents(events);

      const state = useEventStore.getState();
      expect(state.events).toHaveLength(3);
      expect(state.lastEventId).toBe("evt_003");
    });

    it("should sort events by timestamp", () => {
      const events = [
        createEvent({ id: "evt_002", timestamp: "2024-01-01T10:00:02Z" }),
        createEvent({ id: "evt_001", timestamp: "2024-01-01T10:00:00Z" }),
        createEvent({ id: "evt_003", timestamp: "2024-01-01T10:00:05Z" }),
      ];

      useEventStore.getState().addEvents(events);

      const state = useEventStore.getState();
      expect(state.events[0]!.id).toBe("evt_001");
      expect(state.events[1]!.id).toBe("evt_002");
      expect(state.events[2]!.id).toBe("evt_003");
    });

    it("should filter out duplicates", () => {
      const existing = createEvent({ id: "evt_001", timestamp: "2024-01-01T10:00:00Z" });
      useEventStore.getState().addEvent(existing);

      const events = [
        createEvent({ id: "evt_001", timestamp: "2024-01-01T10:00:00Z" }), // duplicate
        createEvent({ id: "evt_002", timestamp: "2024-01-01T10:00:01Z" }),
      ];

      useEventStore.getState().addEvents(events);

      expect(useEventStore.getState().events).toHaveLength(2);
    });

    it("should handle empty array", () => {
      useEventStore.getState().addEvents([]);
      expect(useEventStore.getState().events).toHaveLength(0);
    });

    it("should not update state if all events are duplicates", () => {
      const event = createEvent({ id: "evt_001" });
      useEventStore.getState().addEvent(event);

      const previousState = useEventStore.getState();
      useEventStore.getState().addEvents([event]);

      expect(useEventStore.getState().events).toBe(previousState.events);
    });
  });

  describe("clearEvents", () => {
    it("should clear all events", () => {
      useEventStore.getState().addEvent(createEvent({ id: "evt_001" }));
      useEventStore.getState().addEvent(createEvent({ id: "evt_002" }));

      useEventStore.getState().clearEvents();

      const state = useEventStore.getState();
      expect(state.events).toEqual([]);
      expect(state.lastEventId).toBeNull();
      expect(state.lastEventTimestamp).toBeNull();
    });
  });

  describe("getEventsByPane", () => {
    it("should filter events by pane ID", () => {
      const events = [
        createEvent({ id: "evt_001", pane_id: "%0" }),
        createEvent({ id: "evt_002", pane_id: "%1" }),
        createEvent({ id: "evt_003", pane_id: "%0" }),
        createEvent({ id: "evt_004", pane_id: "%2" }),
      ];

      events.forEach((e) => useEventStore.getState().addEvent(e));

      const pane0Events = useEventStore.getState().getEventsByPane("%0");
      expect(pane0Events).toHaveLength(2);
      expect(pane0Events[0]!.id).toBe("evt_001");
      expect(pane0Events[1]!.id).toBe("evt_003");

      const pane1Events = useEventStore.getState().getEventsByPane("%1");
      expect(pane1Events).toHaveLength(1);

      const pane3Events = useEventStore.getState().getEventsByPane("%3");
      expect(pane3Events).toHaveLength(0);
    });
  });

  describe("event types", () => {
    it("should handle different event types", () => {
      const events = [
        createEvent({ id: "evt_001", type: "output" }),
        createEvent({ id: "evt_002", type: "question" }),
        createEvent({ id: "evt_003", type: "error" }),
        createEvent({ id: "evt_004", type: "status" }),
      ];

      events.forEach((e) => useEventStore.getState().addEvent(e));

      const state = useEventStore.getState();
      expect(state.events).toHaveLength(4);
      expect(state.events[1]!.type).toBe("question");
      expect(state.events[2]!.type).toBe("error");
    });
  });
});
