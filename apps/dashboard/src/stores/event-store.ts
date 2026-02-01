/**
 * ADWO 2.0 Event Store
 * Story 1.5 — Dashboard Event Stream UI
 *
 * Manages the event stream state for the dashboard.
 * Events are stored in chronological order (oldest first, newest appended).
 * Includes filtering, search, and auto-follow capabilities.
 */

import { create } from "zustand";
import type { NormalizedTerminalEvent, TerminalEventType } from "@adwo/shared";

const MAX_EVENTS = 1000;

/**
 * Event type filter configuration
 */
export type EventTypeFilters = Record<TerminalEventType, boolean>;

export interface EventState {
  events: NormalizedTerminalEvent[];
  eventIds: Set<string>;
  lastEventId: string | null;
  lastEventTimestamp: string | null;

  // Filtering
  filters: EventTypeFilters;
  selectedPaneId: string | null;
  searchQuery: string;

  // UI state
  autoFollow: boolean;
}

interface EventActions {
  addEvent: (event: NormalizedTerminalEvent) => void;
  addEvents: (events: NormalizedTerminalEvent[]) => void;
  clearEvents: () => void;

  // Filtering actions
  toggleFilter: (type: TerminalEventType) => void;
  setSelectedPaneId: (paneId: string | null) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // UI actions
  setAutoFollow: (enabled: boolean) => void;

  // Computed getters
  getFilteredEvents: () => NormalizedTerminalEvent[];
  getEventsByPane: (paneId: string) => NormalizedTerminalEvent[];
  getActivePanes: () => string[];
}

const initialFilters: EventTypeFilters = {
  output: true,
  question: true,
  error: true,
  status: true,
};

const initialState: EventState = {
  events: [],
  eventIds: new Set(),
  lastEventId: null,
  lastEventTimestamp: null,
  filters: initialFilters,
  selectedPaneId: null,
  searchQuery: "",
  autoFollow: true,
};

export const useEventStore = create<EventState & EventActions>((set, get) => ({
  ...initialState,

  addEvent: (event: NormalizedTerminalEvent) =>
    set((state) => {
      // Fast duplicate check using Set
      if (state.eventIds.has(event.id)) {
        return state;
      }

      const newEvents = [...state.events, event];
      const newEventIds = new Set(state.eventIds);
      newEventIds.add(event.id);

      // Trim to max size (remove oldest)
      if (newEvents.length > MAX_EVENTS) {
        const removed = newEvents.splice(0, newEvents.length - MAX_EVENTS);
        // Also remove from Set
        for (const e of removed) {
          newEventIds.delete(e.id);
        }
      }

      return {
        events: newEvents,
        eventIds: newEventIds,
        lastEventId: event.id,
        lastEventTimestamp: event.timestamp,
      };
    }),

  addEvents: (events: NormalizedTerminalEvent[]) =>
    set((state) => {
      if (events.length === 0) return state;

      // Filter duplicates using Set for O(1) lookup
      const newEvents = events.filter((e) => !state.eventIds.has(e.id));

      if (newEvents.length === 0) return state;

      // Sort by timestamp to ensure correct order
      newEvents.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let allEvents = [...state.events, ...newEvents];
      const newEventIds = new Set(state.eventIds);
      for (const e of newEvents) {
        newEventIds.add(e.id);
      }

      // Trim to max size (remove oldest)
      if (allEvents.length > MAX_EVENTS) {
        const removed = allEvents.slice(0, allEvents.length - MAX_EVENTS);
        allEvents = allEvents.slice(-MAX_EVENTS);
        // Also remove from Set
        for (const e of removed) {
          newEventIds.delete(e.id);
        }
      }

      const lastEvent = allEvents[allEvents.length - 1];

      return {
        events: allEvents,
        eventIds: newEventIds,
        lastEventId: lastEvent?.id ?? state.lastEventId,
        lastEventTimestamp: lastEvent?.timestamp ?? state.lastEventTimestamp,
      };
    }),

  clearEvents: () =>
    set({
      ...initialState,
      eventIds: new Set(),
    }),

  // Filtering actions
  toggleFilter: (type: TerminalEventType) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [type]: !state.filters[type],
      },
    })),

  setSelectedPaneId: (paneId: string | null) =>
    set({ selectedPaneId: paneId }),

  setSearchQuery: (query: string) =>
    set({ searchQuery: query }),

  resetFilters: () =>
    set({
      filters: initialFilters,
      selectedPaneId: null,
      searchQuery: "",
    }),

  // UI actions
  setAutoFollow: (enabled: boolean) =>
    set({ autoFollow: enabled }),

  // Computed getters
  getFilteredEvents: () => {
    const state = get();
    let filtered = state.events;

    // Filter by type
    filtered = filtered.filter((e) => state.filters[e.type]);

    // Filter by pane
    if (state.selectedPaneId) {
      filtered = filtered.filter((e) => e.pane_id === state.selectedPaneId);
    }

    // Filter by search query
    if (state.searchQuery.trim()) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter((e) =>
        e.content.toLowerCase().includes(query)
      );
    }

    return filtered;
  },

  getEventsByPane: (paneId: string) => {
    return get().events.filter((e) => e.pane_id === paneId);
  },

  getActivePanes: () => {
    const paneIds = new Set(get().events.map((e) => e.pane_id));
    return Array.from(paneIds);
  },
}));
