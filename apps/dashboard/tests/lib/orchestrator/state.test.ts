/**
 * Orchestrator State Manager Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getOrchestratorState,
  setOrchestratorState,
  isOrchestratorRunning,
  loadStateFromFile,
  saveStateToFile,
} from "@/lib/orchestrator/state";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import { readFile, writeFile } from "node:fs/promises";

const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>;
const mockWriteFile = writeFile as unknown as ReturnType<typeof vi.fn>;

describe("Orchestrator State Manager", () => {
  beforeEach(() => {
    // Reset state before each test
    setOrchestratorState(null);
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrchestratorState / setOrchestratorState", () => {
    it("should return null initially", () => {
      expect(getOrchestratorState()).toBeNull();
    });

    it("should set and get orchestrator state", () => {
      const state = {
        paneId: "pane-123",
        startedAt: "2026-02-01T10:00:00Z",
        status: "running" as const,
      };

      setOrchestratorState(state);

      expect(getOrchestratorState()).toEqual(state);
    });

    it("should clear state when set to null", () => {
      setOrchestratorState({
        paneId: "pane-123",
        startedAt: "2026-02-01T10:00:00Z",
        status: "running",
      });

      setOrchestratorState(null);

      expect(getOrchestratorState()).toBeNull();
    });
  });

  describe("isOrchestratorRunning", () => {
    it("should return false when no state", () => {
      expect(isOrchestratorRunning()).toBe(false);
    });

    it("should return true when status is starting", () => {
      setOrchestratorState({
        paneId: "pane-123",
        startedAt: "2026-02-01T10:00:00Z",
        status: "starting",
      });

      expect(isOrchestratorRunning()).toBe(true);
    });

    it("should return true when status is running", () => {
      setOrchestratorState({
        paneId: "pane-123",
        startedAt: "2026-02-01T10:00:00Z",
        status: "running",
      });

      expect(isOrchestratorRunning()).toBe(true);
    });

    it("should return false when status is stopping", () => {
      setOrchestratorState({
        paneId: "pane-123",
        startedAt: "2026-02-01T10:00:00Z",
        status: "stopping",
      });

      expect(isOrchestratorRunning()).toBe(false);
    });
  });

  describe("loadStateFromFile", () => {
    it("should load orchestrator state from file", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          current_agent: {
            pane_id: "existing-pane-456",
            type: "orchestrator",
            spawned_at: "2026-02-01T09:00:00Z",
          },
        })
      );

      await loadStateFromFile();

      const state = getOrchestratorState();
      expect(state).not.toBeNull();
      expect(state?.paneId).toBe("existing-pane-456");
      expect(state?.status).toBe("running");
    });

    it("should not load state if agent type is not orchestrator", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          current_agent: {
            pane_id: "dev-pane",
            type: "dev",
          },
        })
      );

      await loadStateFromFile();

      expect(getOrchestratorState()).toBeNull();
    });

    it("should handle missing file gracefully", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      await loadStateFromFile();

      expect(getOrchestratorState()).toBeNull();
    });

    it("should handle invalid JSON gracefully", async () => {
      mockReadFile.mockResolvedValue("invalid json");

      await loadStateFromFile();

      expect(getOrchestratorState()).toBeNull();
    });
  });

  describe("saveStateToFile", () => {
    it("should save orchestrator state to existing file", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          current_story: { id: "2.1" },
          last_updated: "old-date",
        })
      );
      mockWriteFile.mockResolvedValue(undefined);

      setOrchestratorState({
        paneId: "pane-789",
        startedAt: "2026-02-01T11:00:00Z",
        status: "running",
      });

      await saveStateToFile();

      expect(mockWriteFile).toHaveBeenCalled();
      const writtenContent = JSON.parse(mockWriteFile.mock.calls[0]![1] as string);
      expect(writtenContent.current_agent.pane_id).toBe("pane-789");
      expect(writtenContent.current_agent.type).toBe("orchestrator");
      expect(writtenContent.current_story.id).toBe("2.1"); // Preserved
    });

    it("should clear current_agent when state is null", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          current_agent: { pane_id: "old-pane" },
        })
      );
      mockWriteFile.mockResolvedValue(undefined);

      setOrchestratorState(null);
      await saveStateToFile();

      const writtenContent = JSON.parse(mockWriteFile.mock.calls[0]![1] as string);
      expect(writtenContent.current_agent).toBeNull();
    });

    it("should create new file if it doesn't exist", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));
      mockWriteFile.mockResolvedValue(undefined);

      setOrchestratorState({
        paneId: "new-pane",
        startedAt: "2026-02-01T12:00:00Z",
        status: "running",
      });

      await saveStateToFile();

      expect(mockWriteFile).toHaveBeenCalled();
      const writtenContent = JSON.parse(mockWriteFile.mock.calls[0]![1] as string);
      expect(writtenContent.current_agent.pane_id).toBe("new-pane");
    });
  });
});
