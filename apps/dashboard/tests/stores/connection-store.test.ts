/**
 * ADWO 2.0 Connection Store Tests
 * Story 1.5 — Dashboard Event Stream UI
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useConnectionStore } from "../../src/stores/connection-store";

describe("ConnectionStore", () => {
  beforeEach(() => {
    // Reset store between tests
    useConnectionStore.getState().reset();
  });

  describe("initial state", () => {
    it("should start with disconnected status", () => {
      const state = useConnectionStore.getState();
      expect(state.status).toBe("disconnected");
      expect(state.clientId).toBeNull();
      expect(state.lastConnectedAt).toBeNull();
      expect(state.reconnectAttempts).toBe(0);
      expect(state.lastError).toBeNull();
    });
  });

  describe("setConnected", () => {
    it("should set connected status with client ID", () => {
      const { setConnected } = useConnectionStore.getState();
      setConnected("client-123");

      const state = useConnectionStore.getState();
      expect(state.status).toBe("connected");
      expect(state.clientId).toBe("client-123");
      expect(state.lastConnectedAt).toBeInstanceOf(Date);
      expect(state.reconnectAttempts).toBe(0);
      expect(state.lastError).toBeNull();
    });

    it("should reset reconnect attempts on connect", () => {
      const store = useConnectionStore.getState();
      store.incrementReconnectAttempts();
      store.incrementReconnectAttempts();
      expect(useConnectionStore.getState().reconnectAttempts).toBe(2);

      store.setConnected("client-456");
      expect(useConnectionStore.getState().reconnectAttempts).toBe(0);
    });

    it("should clear last error on connect", () => {
      const store = useConnectionStore.getState();
      store.setDisconnected("Some error");
      expect(useConnectionStore.getState().lastError).toBe("Some error");

      store.setConnected("client-789");
      expect(useConnectionStore.getState().lastError).toBeNull();
    });
  });

  describe("setConnecting", () => {
    it("should set connecting status", () => {
      const { setConnecting } = useConnectionStore.getState();
      setConnecting();

      const state = useConnectionStore.getState();
      expect(state.status).toBe("connecting");
      expect(state.lastError).toBeNull();
    });

    it("should clear error when connecting", () => {
      const store = useConnectionStore.getState();
      store.setDisconnected("Previous error");
      store.setConnecting();

      expect(useConnectionStore.getState().lastError).toBeNull();
    });
  });

  describe("setDisconnected", () => {
    it("should set disconnected status without error", () => {
      const store = useConnectionStore.getState();
      store.setConnected("client-123");
      store.setDisconnected();

      const state = useConnectionStore.getState();
      expect(state.status).toBe("disconnected");
      expect(state.lastError).toBeNull();
    });

    it("should set disconnected status with error", () => {
      const { setDisconnected } = useConnectionStore.getState();
      setDisconnected("Connection lost");

      const state = useConnectionStore.getState();
      expect(state.status).toBe("disconnected");
      expect(state.lastError).toBe("Connection lost");
    });
  });

  describe("incrementReconnectAttempts", () => {
    it("should increment reconnect attempts", () => {
      const { incrementReconnectAttempts } = useConnectionStore.getState();

      incrementReconnectAttempts();
      expect(useConnectionStore.getState().reconnectAttempts).toBe(1);

      incrementReconnectAttempts();
      expect(useConnectionStore.getState().reconnectAttempts).toBe(2);

      incrementReconnectAttempts();
      expect(useConnectionStore.getState().reconnectAttempts).toBe(3);
    });
  });

  describe("resetReconnectAttempts", () => {
    it("should reset reconnect attempts to zero", () => {
      const store = useConnectionStore.getState();
      store.incrementReconnectAttempts();
      store.incrementReconnectAttempts();
      store.incrementReconnectAttempts();

      store.resetReconnectAttempts();
      expect(useConnectionStore.getState().reconnectAttempts).toBe(0);
    });
  });

  describe("reset", () => {
    it("should reset to initial state", () => {
      const store = useConnectionStore.getState();
      store.setConnected("client-123");
      store.incrementReconnectAttempts();

      store.reset();

      const state = useConnectionStore.getState();
      expect(state.status).toBe("disconnected");
      expect(state.clientId).toBeNull();
      expect(state.lastConnectedAt).toBeNull();
      expect(state.reconnectAttempts).toBe(0);
      expect(state.lastError).toBeNull();
    });
  });
});
