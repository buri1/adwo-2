/**
 * ADWO 2.0 Connection Store
 * Story 1.5 — Dashboard Event Stream UI
 *
 * Tracks WebSocket connection state for the dashboard.
 */

import { create } from "zustand";

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

export interface ConnectionState {
  status: ConnectionStatus;
  clientId: string | null;
  lastConnectedAt: Date | null;
  reconnectAttempts: number;
  lastError: string | null;
}

interface ConnectionActions {
  setConnected: (clientId: string) => void;
  setConnecting: () => void;
  setDisconnected: (error?: string) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  reset: () => void;
}

const initialState: ConnectionState = {
  status: "disconnected",
  clientId: null,
  lastConnectedAt: null,
  reconnectAttempts: 0,
  lastError: null,
};

export const useConnectionStore = create<ConnectionState & ConnectionActions>(
  (set) => ({
    ...initialState,

    setConnected: (clientId: string) =>
      set({
        status: "connected",
        clientId,
        lastConnectedAt: new Date(),
        reconnectAttempts: 0,
        lastError: null,
      }),

    setConnecting: () =>
      set({
        status: "connecting",
        lastError: null,
      }),

    setDisconnected: (error?: string) =>
      set({
        status: "disconnected",
        lastError: error ?? null,
      }),

    incrementReconnectAttempts: () =>
      set((state) => ({
        reconnectAttempts: state.reconnectAttempts + 1,
      })),

    resetReconnectAttempts: () =>
      set({
        reconnectAttempts: 0,
      }),

    reset: () => set(initialState),
  })
);
