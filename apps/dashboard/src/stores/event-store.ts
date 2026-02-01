/**
 * ADWO 2.0 Event Store
 * Story 1.5 — Dashboard Event Stream UI
 *
 * Manages the event stream state for the dashboard.
 * Supports both terminal events (legacy) and stream-json events (new).
 * Events are stored in chronological order (oldest first, newest appended).
 * Includes filtering, search, and auto-follow capabilities.
 */

import { create } from "zustand";
import type {
  NormalizedTerminalEvent,
  TerminalEventType,
  NormalizedStreamEvent,
  SessionMetadata,
} from "@adwo/shared";

const MAX_EVENTS = 1000;

/**
 * Stream event category type
 */
export type StreamEventCategory = "text" | "tool" | "hook" | "result" | "system" | "error";

/**
 * Legacy terminal event type filter configuration
 */
export type EventTypeFilters = Record<TerminalEventType, boolean>;

/**
 * Stream event category filter configuration
 */
export type StreamCategoryFilters = Record<StreamEventCategory, boolean>;

/**
 * Question metadata from terminal events
 */
export interface QuestionMeta {
  header: string;
  question: string;
  options: Array<{ number: number; label: string; description?: string }>;
}

/**
 * Unified event type that can represent both terminal and stream events
 */
export interface UnifiedEvent {
  id: string;
  pane_id: string;
  timestamp: string;
  content: string;
  // Source type
  source: "terminal" | "stream";
  // Terminal event fields
  type?: TerminalEventType;
  project_id?: string;
  question_metadata?: QuestionMeta;
  // Stream event fields
  category?: StreamEventCategory;
  session_id?: string;
  original_type?: string;
  tool?: { name: string; input?: Record<string, unknown>; status: "started" | "completed" | "error" };
  cost?: { total_usd: number; input_tokens: number; output_tokens: number; duration_ms: number };
  model?: string;
}

export interface EventState {
  events: UnifiedEvent[];
  eventIds: Set<string>;
  lastEventId: string | null;
  lastEventTimestamp: string | null;

  // Stream sessions
  sessions: Map<string, SessionMetadata>;

  // Filtering - support both legacy and stream event filters
  terminalFilters: EventTypeFilters;
  streamFilters: StreamCategoryFilters;
  selectedPaneId: string | null;
  searchQuery: string;

  // UI state
  autoFollow: boolean;
}

interface EventActions {
  // Legacy terminal events
  addEvent: (event: NormalizedTerminalEvent) => void;
  addEvents: (events: NormalizedTerminalEvent[]) => void;

  // Stream events
  addStreamEvent: (event: NormalizedStreamEvent) => void;
  addStreamEvents: (events: NormalizedStreamEvent[]) => void;
  updateSession: (session: SessionMetadata) => void;

  clearEvents: () => void;

  // Filtering actions
  toggleTerminalFilter: (type: TerminalEventType) => void;
  toggleStreamFilter: (category: StreamEventCategory) => void;
  setSelectedPaneId: (paneId: string | null) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // UI actions
  setAutoFollow: (enabled: boolean) => void;

  // Computed getters
  getFilteredEvents: () => UnifiedEvent[];
  getEventsByPane: (paneId: string) => UnifiedEvent[];
  getActivePanes: () => string[];
  getSession: (paneId: string) => SessionMetadata | undefined;
  getTotalCost: () => number;
}

const initialTerminalFilters: EventTypeFilters = {
  output: true,
  question: true,
  error: true,
  status: true,
};

const initialStreamFilters: StreamCategoryFilters = {
  text: true,
  tool: true,
  hook: true,
  result: true,
  system: true,
  error: true,
};

const initialState: EventState = {
  events: [],
  eventIds: new Set(),
  lastEventId: null,
  lastEventTimestamp: null,
  sessions: new Map(),
  terminalFilters: initialTerminalFilters,
  streamFilters: initialStreamFilters,
  selectedPaneId: null,
  searchQuery: "",
  autoFollow: true,
};

/**
 * Convert NormalizedTerminalEvent to UnifiedEvent
 */
function terminalToUnified(event: NormalizedTerminalEvent): UnifiedEvent {
  return {
    id: event.id,
    pane_id: event.pane_id,
    timestamp: event.timestamp,
    content: event.content,
    source: "terminal",
    type: event.type,
    project_id: event.project_id,
    question_metadata: event.question_metadata,
  };
}

/**
 * Convert NormalizedStreamEvent to UnifiedEvent
 */
function streamToUnified(event: NormalizedStreamEvent): UnifiedEvent {
  return {
    id: event.id,
    pane_id: event.pane_id,
    timestamp: event.timestamp,
    content: event.content,
    source: "stream",
    category: event.category,
    session_id: event.session_id,
    original_type: event.original_type,
    tool: event.tool,
    cost: event.cost,
    model: event.model,
  };
}

export const useEventStore = create<EventState & EventActions>((set, get) => ({
  ...initialState,

  // Legacy terminal events
  addEvent: (event: NormalizedTerminalEvent) =>
    set((state) => {
      if (state.eventIds.has(event.id)) {
        return state;
      }

      const unified = terminalToUnified(event);
      const newEvents = [...state.events, unified];
      const newEventIds = new Set(state.eventIds);
      newEventIds.add(event.id);

      // Trim to max size (remove oldest)
      if (newEvents.length > MAX_EVENTS) {
        const removed = newEvents.splice(0, newEvents.length - MAX_EVENTS);
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

      const newEvents = events
        .filter((e) => !state.eventIds.has(e.id))
        .map(terminalToUnified);

      if (newEvents.length === 0) return state;

      newEvents.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let allEvents = [...state.events, ...newEvents];
      const newEventIds = new Set(state.eventIds);
      for (const e of newEvents) {
        newEventIds.add(e.id);
      }

      if (allEvents.length > MAX_EVENTS) {
        const removed = allEvents.slice(0, allEvents.length - MAX_EVENTS);
        allEvents = allEvents.slice(-MAX_EVENTS);
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

  // Stream events
  addStreamEvent: (event: NormalizedStreamEvent) =>
    set((state) => {
      if (state.eventIds.has(event.id)) {
        return state;
      }

      const unified = streamToUnified(event);
      const newEvents = [...state.events, unified];
      const newEventIds = new Set(state.eventIds);
      newEventIds.add(event.id);

      if (newEvents.length > MAX_EVENTS) {
        const removed = newEvents.splice(0, newEvents.length - MAX_EVENTS);
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

  addStreamEvents: (events: NormalizedStreamEvent[]) =>
    set((state) => {
      if (events.length === 0) return state;

      const newEvents = events
        .filter((e) => !state.eventIds.has(e.id))
        .map(streamToUnified);

      if (newEvents.length === 0) return state;

      newEvents.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let allEvents = [...state.events, ...newEvents];
      const newEventIds = new Set(state.eventIds);
      for (const e of newEvents) {
        newEventIds.add(e.id);
      }

      if (allEvents.length > MAX_EVENTS) {
        const removed = allEvents.slice(0, allEvents.length - MAX_EVENTS);
        allEvents = allEvents.slice(-MAX_EVENTS);
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

  updateSession: (session: SessionMetadata) =>
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.set(session.pane_id, session);
      return { sessions: newSessions };
    }),

  clearEvents: () =>
    set({
      ...initialState,
      eventIds: new Set(),
      sessions: new Map(),
    }),

  // Filtering actions
  toggleTerminalFilter: (type: TerminalEventType) =>
    set((state) => ({
      terminalFilters: {
        ...state.terminalFilters,
        [type]: !state.terminalFilters[type],
      },
    })),

  toggleStreamFilter: (category: StreamEventCategory) =>
    set((state) => ({
      streamFilters: {
        ...state.streamFilters,
        [category]: !state.streamFilters[category],
      },
    })),

  setSelectedPaneId: (paneId: string | null) =>
    set({ selectedPaneId: paneId }),

  setSearchQuery: (query: string) =>
    set({ searchQuery: query }),

  resetFilters: () =>
    set({
      terminalFilters: initialTerminalFilters,
      streamFilters: initialStreamFilters,
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

    // Filter by source and type/category
    filtered = filtered.filter((e) => {
      if (e.source === "terminal" && e.type) {
        return state.terminalFilters[e.type];
      }
      if (e.source === "stream" && e.category) {
        return state.streamFilters[e.category];
      }
      return true;
    });

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

  getSession: (paneId: string) => {
    return get().sessions.get(paneId);
  },

  getTotalCost: () => {
    const sessions = get().sessions;
    let total = 0;
    for (const session of sessions.values()) {
      total += session.total_cost;
    }
    return total;
  },
}));
