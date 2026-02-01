/**
 * ADWO 2.0 Orchestrator Store Tests
 * Story 2.2 — Start Orchestrator Button
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useOrchestratorStore } from "../../src/stores/orchestrator-store";

describe("OrchestratorStore", () => {
  beforeEach(() => {
    // Reset store between tests
    useOrchestratorStore.getState().reset();
  });

  describe("initial state", () => {
    it("should start with stopped status", () => {
      const state = useOrchestratorStore.getState();
      expect(state.status).toBe("stopped");
      expect(state.paneId).toBeNull();
      expect(state.startedAt).toBeNull();
      expect(state.lastError).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe("setStarting", () => {
    it("should set starting status and loading state", () => {
      const { setStarting } = useOrchestratorStore.getState();
      setStarting();

      const state = useOrchestratorStore.getState();
      expect(state.status).toBe("starting");
      expect(state.isLoading).toBe(true);
      expect(state.lastError).toBeNull();
    });

    it("should clear error when starting", () => {
      const store = useOrchestratorStore.getState();
      store.setError("Previous error");
      store.setStarting();

      expect(useOrchestratorStore.getState().lastError).toBeNull();
    });
  });

  describe("setRunning", () => {
    it("should set running status with pane info", () => {
      const { setRunning } = useOrchestratorStore.getState();
      const startedAt = new Date().toISOString();
      setRunning("pane-123", startedAt);

      const state = useOrchestratorStore.getState();
      expect(state.status).toBe("running");
      expect(state.paneId).toBe("pane-123");
      expect(state.startedAt).toBe(startedAt);
      expect(state.isLoading).toBe(false);
      expect(state.lastError).toBeNull();
    });

    it("should clear loading and error when running", () => {
      const store = useOrchestratorStore.getState();
      store.setStarting();
      store.setError("Some error");
      store.setRunning("pane-456", "2024-01-01T00:00:00Z");

      const state = useOrchestratorStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.lastError).toBeNull();
    });
  });

  describe("setStopped", () => {
    it("should set stopped status and clear pane info", () => {
      const store = useOrchestratorStore.getState();
      store.setRunning("pane-123", "2024-01-01T00:00:00Z");
      store.setStopped();

      const state = useOrchestratorStore.getState();
      expect(state.status).toBe("stopped");
      expect(state.paneId).toBeNull();
      expect(state.startedAt).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe("setError", () => {
    it("should set error and stop loading", () => {
      const store = useOrchestratorStore.getState();
      store.setStarting();
      store.setError("Connection failed");

      const state = useOrchestratorStore.getState();
      expect(state.lastError).toBe("Connection failed");
      expect(state.isLoading).toBe(false);
      expect(state.status).toBe("stopped");
    });
  });

  describe("clearError", () => {
    it("should clear the error", () => {
      const store = useOrchestratorStore.getState();
      store.setError("Some error");
      store.clearError();

      expect(useOrchestratorStore.getState().lastError).toBeNull();
    });
  });

  describe("setStatus", () => {
    it("should set any status directly", () => {
      const { setStatus } = useOrchestratorStore.getState();

      setStatus("starting");
      expect(useOrchestratorStore.getState().status).toBe("starting");

      setStatus("running");
      expect(useOrchestratorStore.getState().status).toBe("running");

      setStatus("stopping");
      expect(useOrchestratorStore.getState().status).toBe("stopping");

      setStatus("stopped");
      expect(useOrchestratorStore.getState().status).toBe("stopped");
    });
  });

  describe("setLoading", () => {
    it("should set loading state", () => {
      const { setLoading } = useOrchestratorStore.getState();

      setLoading(true);
      expect(useOrchestratorStore.getState().isLoading).toBe(true);

      setLoading(false);
      expect(useOrchestratorStore.getState().isLoading).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset to initial state", () => {
      const store = useOrchestratorStore.getState();
      store.setRunning("pane-123", "2024-01-01T00:00:00Z");
      store.setError("Error");

      store.reset();

      const state = useOrchestratorStore.getState();
      expect(state.status).toBe("stopped");
      expect(state.paneId).toBeNull();
      expect(state.startedAt).toBeNull();
      expect(state.lastError).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});
