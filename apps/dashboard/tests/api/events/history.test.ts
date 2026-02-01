/**
 * Events History API Tests
 * Story 5.1 — SQLite Persistence for Events (AC4)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NormalizedTerminalEvent } from "@adwo/shared";

// Mock event data
const mockEvents: NormalizedTerminalEvent[] = [
  {
    id: "1",
    project_id: "test-project",
    pane_id: "pane-1",
    type: "output",
    content: "Test output 1",
    timestamp: "2024-01-01T10:00:00Z",
  },
  {
    id: "2",
    project_id: "test-project",
    pane_id: "pane-1",
    type: "question",
    content: "Test question",
    timestamp: "2024-01-01T11:00:00Z",
    question_metadata: {
      header: "Test",
      question: "What?",
      options: [{ number: 1, label: "Option A" }],
    },
  },
];

// Mock EventManager
const mockGetEventManager = vi.fn();
const mockIsPersistenceEnabled = vi.fn();
const mockGetAll = vi.fn();
const mockQueryHistory = vi.fn();

vi.mock("@/lib/websocket/event-manager", () => ({
  getEventManager: () => mockGetEventManager(),
}));

// Import route handler after mocks
import { GET } from "@/app/api/events/history/route";
import { NextRequest } from "next/server";

// Helper to create NextRequest with query params
function createRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/events/history");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

describe("GET /api/events/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock setup
    mockGetEventManager.mockReturnValue({
      isPersistenceEnabled: mockIsPersistenceEnabled,
      getAll: mockGetAll,
      queryHistory: mockQueryHistory,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("with persistence enabled", () => {
    beforeEach(() => {
      mockIsPersistenceEnabled.mockReturnValue(true);
    });

    it("should return events from SQLite", async () => {
      mockQueryHistory.mockReturnValue({
        events: mockEvents,
        total: 2,
        hasMore: false,
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.hasMore).toBe(false);
      expect(data.source).toBe("sqlite");
    });

    it("should respect limit parameter", async () => {
      mockQueryHistory.mockReturnValue({
        events: [mockEvents[0]],
        total: 2,
        hasMore: true,
      });

      const response = await GET(createRequest({ limit: "1" }));
      const data = await response.json();

      expect(data.events).toHaveLength(1);
      expect(data.hasMore).toBe(true);

      expect(mockQueryHistory).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 1 })
      );
    });

    it("should cap limit at 1000", async () => {
      mockQueryHistory.mockReturnValue({
        events: [],
        total: 0,
        hasMore: false,
      });

      await GET(createRequest({ limit: "9999" }));

      expect(mockQueryHistory).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 1000 })
      );
    });

    it("should pass filter parameters to query", async () => {
      mockQueryHistory.mockReturnValue({
        events: [],
        total: 0,
        hasMore: false,
      });

      await GET(
        createRequest({
          project_id: "proj-1",
          pane_id: "pane-1",
          type: "error",
          since: "2024-01-01T00:00:00Z",
          after_id: "event-5",
          order: "desc",
        })
      );

      expect(mockQueryHistory).toHaveBeenCalledWith({
        projectId: "proj-1",
        paneId: "pane-1",
        type: "error",
        since: "2024-01-01T00:00:00Z",
        afterId: "event-5",
        limit: 100,
        order: "desc",
      });
    });

    it("should ignore invalid event types", async () => {
      mockQueryHistory.mockReturnValue({
        events: [],
        total: 0,
        hasMore: false,
      });

      await GET(createRequest({ type: "invalid-type" }));

      expect(mockQueryHistory).toHaveBeenCalledWith(
        expect.objectContaining({ type: undefined })
      );
    });

    it("should handle query failure", async () => {
      mockQueryHistory.mockReturnValue(null);

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to query event history");
    });
  });

  describe("without persistence", () => {
    beforeEach(() => {
      mockIsPersistenceEnabled.mockReturnValue(false);
      mockGetAll.mockReturnValue(mockEvents);
    });

    it("should fall back to buffer", async () => {
      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events).toHaveLength(2);
      expect(data.source).toBe("buffer");
      expect(data.hasMore).toBe(false);

      expect(mockGetAll).toHaveBeenCalled();
      expect(mockQueryHistory).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle exceptions gracefully", async () => {
      mockIsPersistenceEnabled.mockImplementation(() => {
        throw new Error("Connection failed");
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Connection failed");
    });
  });
});
