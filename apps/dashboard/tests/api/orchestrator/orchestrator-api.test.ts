/**
 * Orchestrator API Routes Tests
 *
 * Tests for the REST API endpoints:
 * - POST /api/orchestrator/start
 * - POST /api/orchestrator/stop
 * - POST /api/orchestrator/message
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock state storage
let mockState: {
  paneId: string;
  startedAt: string;
  status: string;
} | null = null;

// Mock conduit module
vi.mock("@/lib/conduit", () => ({
  paneSplit: vi.fn(),
  paneClose: vi.fn(),
  terminalWrite: vi.fn(),
  terminalSendEnter: vi.fn(),
}));

// Mock orchestrator state module
vi.mock("@/lib/orchestrator/state", () => ({
  getOrchestratorState: vi.fn(() => mockState),
  setOrchestratorState: vi.fn((state: typeof mockState) => {
    mockState = state;
  }),
  isOrchestratorRunning: vi.fn(
    () => mockState !== null && mockState.status !== "stopping"
  ),
  saveStateToFile: vi.fn(),
}));

import {
  paneSplit,
  paneClose,
  terminalWrite,
  terminalSendEnter,
} from "@/lib/conduit";
import {
  getOrchestratorState,
  setOrchestratorState,
  isOrchestratorRunning,
  saveStateToFile,
} from "@/lib/orchestrator/state";

const mockPaneSplit = paneSplit as ReturnType<typeof vi.fn>;
const mockPaneClose = paneClose as ReturnType<typeof vi.fn>;
const mockTerminalWrite = terminalWrite as ReturnType<typeof vi.fn>;
const mockTerminalSendEnter = terminalSendEnter as ReturnType<typeof vi.fn>;
const mockSaveStateToFile = saveStateToFile as ReturnType<typeof vi.fn>;
const mockGetOrchestratorState = getOrchestratorState as ReturnType<
  typeof vi.fn
>;
const mockIsOrchestratorRunning = isOrchestratorRunning as ReturnType<
  typeof vi.fn
>;

// Import route handlers after mocks are set up
import { POST as startHandler } from "@/app/api/orchestrator/start/route";
import { POST as stopHandler } from "@/app/api/orchestrator/stop/route";
import { POST as messageHandler } from "@/app/api/orchestrator/message/route";

// Helper to create NextRequest
function createRequest(body?: unknown): Request {
  return new Request("http://localhost:3000/api/orchestrator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Orchestrator API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock state
    mockState = null;
    // Reset implementation to use current mockState
    mockGetOrchestratorState.mockImplementation(() => mockState);
    mockIsOrchestratorRunning.mockImplementation(
      () => mockState !== null && mockState.status !== "stopping"
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockState = null;
  });

  describe("POST /api/orchestrator/start", () => {
    it("should start orchestrator and return pane_id", async () => {
      mockPaneSplit.mockResolvedValue({ pane_id: "new-pane-123" });
      mockTerminalWrite.mockResolvedValue(undefined);
      mockTerminalSendEnter.mockResolvedValue(undefined);
      mockSaveStateToFile.mockResolvedValue(undefined);

      const response = await startHandler();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pane_id).toBe("new-pane-123");
      expect(data.message).toBe("Orchestrator started successfully");

      // Verify conduit calls
      expect(mockPaneSplit).toHaveBeenCalled();
      expect(mockTerminalWrite).toHaveBeenCalledWith("new-pane-123", "claude");
      expect(mockTerminalSendEnter).toHaveBeenCalled();
      expect(mockTerminalWrite).toHaveBeenCalledWith(
        "new-pane-123",
        "/orchestrator"
      );
    });

    it("should return 409 if orchestrator already running", async () => {
      // Set up running state
      mockState = {
        paneId: "existing-pane",
        startedAt: new Date().toISOString(),
        status: "running",
      };

      const response = await startHandler();
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Orchestrator is already running");
      expect(data.pane_id).toBe("existing-pane");

      // Conduit should not be called
      expect(mockPaneSplit).not.toHaveBeenCalled();
    });

    it("should handle conduit errors gracefully", async () => {
      mockPaneSplit.mockRejectedValue(new Error("Conduit unavailable"));

      const response = await startHandler();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Conduit unavailable");
    });
  });

  describe("POST /api/orchestrator/stop", () => {
    it("should stop orchestrator with correct pane_id", async () => {
      // Set up running state
      mockState = {
        paneId: "running-pane",
        startedAt: new Date().toISOString(),
        status: "running",
      };

      mockPaneClose.mockResolvedValue(undefined);
      mockSaveStateToFile.mockResolvedValue(undefined);

      const request = createRequest({ pane_id: "running-pane" });
      const response = await stopHandler(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Orchestrator stopped successfully");

      expect(mockPaneClose).toHaveBeenCalledWith("running-pane");
    });

    it("should return 400 if pane_id is missing", async () => {
      mockState = {
        paneId: "running-pane",
        startedAt: new Date().toISOString(),
        status: "running",
      };

      const request = createRequest({});
      const response = await stopHandler(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("pane_id is required");
    });

    it("should return 404 if orchestrator not running", async () => {
      const request = createRequest({ pane_id: "any-pane" });
      const response = await stopHandler(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Orchestrator is not running");
    });

    it("should return 400 if pane_id mismatch", async () => {
      mockState = {
        paneId: "correct-pane",
        startedAt: new Date().toISOString(),
        status: "running",
      };

      const request = createRequest({ pane_id: "wrong-pane" });
      const response = await stopHandler(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("pane_id mismatch");
      expect(data.expected).toBe("correct-pane");
      expect(data.provided).toBe("wrong-pane");
    });
  });

  describe("POST /api/orchestrator/message", () => {
    it("should send message to orchestrator", async () => {
      mockState = {
        paneId: "running-pane",
        startedAt: new Date().toISOString(),
        status: "running",
      };

      mockTerminalWrite.mockResolvedValue(undefined);
      mockTerminalSendEnter.mockResolvedValue(undefined);

      const request = createRequest({ text: "Hello orchestrator" });
      const response = await messageHandler(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pane_id).toBe("running-pane");

      expect(mockTerminalWrite).toHaveBeenCalledWith(
        "running-pane",
        "Hello orchestrator"
      );
      expect(mockTerminalSendEnter).toHaveBeenCalledWith("running-pane");
    });

    it("should return 400 if text is missing", async () => {
      mockState = {
        paneId: "running-pane",
        startedAt: new Date().toISOString(),
        status: "running",
      };

      const request = createRequest({});
      const response = await messageHandler(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("text is required and must be a string");
    });

    it("should return 404 if orchestrator not running", async () => {
      const request = createRequest({ text: "test message" });
      const response = await messageHandler(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Orchestrator is not running");
    });
  });
});
