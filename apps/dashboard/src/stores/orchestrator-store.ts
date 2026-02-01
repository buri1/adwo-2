/**
 * ADWO 2.0 Orchestrator Store
 * Story 2.2 — Start Orchestrator Button
 * Story 2.3 — Stop Orchestrator Button
 *
 * Tracks orchestrator state for the dashboard UI.
 */

import { create } from "zustand";

export type OrchestratorStatus = "stopped" | "starting" | "running" | "stopping";

export interface OrchestratorState {
  status: OrchestratorStatus;
  paneId: string | null;
  startedAt: string | null;
  lastError: string | null;
  isLoading: boolean;
}

interface OrchestratorActions {
  setStatus: (status: OrchestratorStatus) => void;
  setStarting: () => void;
  setRunning: (paneId: string, startedAt: string) => void;
  setStopping: () => void;
  setStopped: () => void;
  setError: (error: string) => void;
  clearError: () => void;
  setLoading: (isLoading: boolean) => void;
  reset: () => void;
}

const initialState: OrchestratorState = {
  status: "stopped",
  paneId: null,
  startedAt: null,
  lastError: null,
  isLoading: false,
};

export const useOrchestratorStore = create<OrchestratorState & OrchestratorActions>(
  (set) => ({
    ...initialState,

    setStatus: (status: OrchestratorStatus) =>
      set({ status }),

    setStarting: () =>
      set({
        status: "starting",
        isLoading: true,
        lastError: null,
      }),

    setRunning: (paneId: string, startedAt: string) =>
      set({
        status: "running",
        paneId,
        startedAt,
        isLoading: false,
        lastError: null,
      }),

    setStopping: () =>
      set({
        status: "stopping",
        isLoading: true,
        lastError: null,
      }),

    setStopped: () =>
      set({
        status: "stopped",
        paneId: null,
        startedAt: null,
        isLoading: false,
      }),

    setError: (error: string) =>
      set({
        lastError: error,
        isLoading: false,
        status: "stopped",
      }),

    clearError: () =>
      set({ lastError: null }),

    setLoading: (isLoading: boolean) =>
      set({ isLoading }),

    reset: () => set(initialState),
  })
);
