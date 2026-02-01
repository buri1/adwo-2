/**
 * ADWO 2.0 Event Store
 * Story 1.5 — Dashboard Event Stream UI
 *
 * Manages the event stream state for the dashboard.
 * Events are stored in chronological order (oldest first, newest appended).
 */

import { create } from "zustand";
import type { NormalizedTerminalEvent } from "@adwo/shared";

const MAX_EVENTS = 1000;

export interface EventState {
  events: NormalizedTerminalEvent[];
  lastEventId: string | null;
  lastEventTimestamp: string | null;
}

interface EventActions {
  addEvent: (event: NormalizedTerminalEvent) => void;
  addEvents: (events: NormalizedTerminalEvent[]) => void;
  clearEvents: () => void;
  getEventsByPane: (paneId: string) => NormalizedTerminalEvent[];
}

const initialState: EventState = {
  events: [],
  lastEventId: null,
  lastEventTimestamp: null,
};

export const useEventStore = create<EventState & EventActions>((set, get) => ({
  ...initialState,

  addEvent: (event: NormalizedTerminalEvent) =>
    set((state) => {
      // Check for duplicate
      if (state.events.some((e) => e.id === event.id)) {
        return state;
      }

      const newEvents = [...state.events, event];

      // Trim to max size (remove oldest)
      if (newEvents.length > MAX_EVENTS) {
        newEvents.splice(0, newEvents.length - MAX_EVENTS);
      }

      return {
        events: newEvents,
        lastEventId: event.id,
        lastEventTimestamp: event.timestamp,
      };
    }),

  addEvents: (events: NormalizedTerminalEvent[]) =>
    set((state) => {
      if (events.length === 0) return state;

      // Filter duplicates
      const existingIds = new Set(state.events.map((e) => e.id));
      const newEvents = events.filter((e) => !existingIds.has(e.id));

      if (newEvents.length === 0) return state;

      // Sort by timestamp to ensure correct order
      newEvents.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let allEvents = [...state.events, ...newEvents];

      // Trim to max size (remove oldest)
      if (allEvents.length > MAX_EVENTS) {
        allEvents = allEvents.slice(-MAX_EVENTS);
      }

      const lastEvent = allEvents[allEvents.length - 1];

      return {
        events: allEvents,
        lastEventId: lastEvent?.id ?? state.lastEventId,
        lastEventTimestamp: lastEvent?.timestamp ?? state.lastEventTimestamp,
      };
    }),

  clearEvents: () => set(initialState),

  getEventsByPane: (paneId: string) => {
    return get().events.filter((e) => e.pane_id === paneId);
  },
}));
