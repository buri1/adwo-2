/**
 * StopOrchestratorButton Component Tests
 * Story 2.3 — Stop Orchestrator Button
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { StopOrchestratorButton } from "@/components/orchestrator/stop-orchestrator-button";
import { useOrchestratorStore } from "@/stores/orchestrator-store";

// Mock sonner toast
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("StopOrchestratorButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOrchestratorStore.getState().reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    useOrchestratorStore.getState().reset();
  });

  describe("visibility", () => {
    it("should not render when orchestrator is stopped", async () => {
      await act(async () => {
        useOrchestratorStore.getState().setStopped();
      });

      const { container } = render(<StopOrchestratorButton />);

      expect(container.firstChild).toBeNull();
    });

    it("should render when orchestrator is running", async () => {
      await act(async () => {
        useOrchestratorStore
          .getState()
          .setRunning("pane-123", new Date().toISOString());
      });

      render(<StopOrchestratorButton />);

      expect(
        screen.getByRole("button", { name: /stop orchestrator/i })
      ).toBeInTheDocument();
    });

    it("should show stopping state with loader", async () => {
      await act(async () => {
        useOrchestratorStore
          .getState()
          .setRunning("pane-123", new Date().toISOString());
        useOrchestratorStore.getState().setStopping();
      });

      render(<StopOrchestratorButton />);

      expect(
        screen.getByRole("button", { name: /stopping/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("confirmation dialog", () => {
    it("should open confirmation dialog when button is clicked", async () => {
      await act(async () => {
        useOrchestratorStore
          .getState()
          .setRunning("pane-123", new Date().toISOString());
      });

      render(<StopOrchestratorButton />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /stop orchestrator/i })
        );
      });

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      expect(screen.getByText(/stop orchestrator\?/i)).toBeInTheDocument();
    });

    it("should close dialog when cancel is clicked", async () => {
      await act(async () => {
        useOrchestratorStore
          .getState()
          .setRunning("pane-123", new Date().toISOString());
      });

      render(<StopOrchestratorButton />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /stop orchestrator/i })
        );
      });

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      });

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("stop action", () => {
    it("should call stop API when dialog action is confirmed", async () => {
      await act(async () => {
        useOrchestratorStore
          .getState()
          .setRunning("pane-123", new Date().toISOString());
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      render(<StopOrchestratorButton />);

      // Click stop button to open dialog
      const stopButton = screen.getByRole("button", { name: /stop orchestrator/i });
      await act(async () => {
        fireEvent.click(stopButton);
      });

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      // Find and click the confirm button in the dialog
      const dialogButtons = screen.getAllByRole("button");
      const confirmButton = dialogButtons.find(
        (btn) => btn.textContent?.includes("Stop Orchestrator") && btn !== stopButton
      );

      if (confirmButton) {
        await act(async () => {
          fireEvent.click(confirmButton);
          await new Promise((r) => setTimeout(r, 100));
        });

        expect(mockFetch).toHaveBeenCalledWith("/api/orchestrator/stop", expect.any(Object));
      }
    });

    it("should handle 404 response (already stopped)", async () => {
      await act(async () => {
        useOrchestratorStore
          .getState()
          .setRunning("pane-123", new Date().toISOString());
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Not running" }),
      });

      render(<StopOrchestratorButton />);

      const stopButton = screen.getByRole("button", { name: /stop orchestrator/i });
      await act(async () => {
        fireEvent.click(stopButton);
      });

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      const dialogButtons = screen.getAllByRole("button");
      const confirmButton = dialogButtons.find(
        (btn) => btn.textContent?.includes("Stop Orchestrator") && btn !== stopButton
      );

      if (confirmButton) {
        await act(async () => {
          fireEvent.click(confirmButton);
          await new Promise((r) => setTimeout(r, 100));
        });

        expect(useOrchestratorStore.getState().status).toBe("stopped");
      }
    });
  });

  describe("styling", () => {
    it("should apply destructive variant to stop button", async () => {
      await act(async () => {
        useOrchestratorStore
          .getState()
          .setRunning("pane-123", new Date().toISOString());
      });

      render(<StopOrchestratorButton />);

      const button = screen.getByRole("button", { name: /stop orchestrator/i });
      expect(button.className).toContain("destructive");
    });

    it("should apply custom className", async () => {
      await act(async () => {
        useOrchestratorStore
          .getState()
          .setRunning("pane-123", new Date().toISOString());
      });

      render(<StopOrchestratorButton className="custom-class" />);

      const button = screen.getByRole("button", { name: /stop orchestrator/i });
      expect(button.className).toContain("custom-class");
    });
  });
});
