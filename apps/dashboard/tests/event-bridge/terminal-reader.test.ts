/**
 * Terminal Reader Tests
 *
 * Tests for AC1 (Pane Registration), AC2 (Multi-Pane Parallel Reading),
 * and AC4 (Error Handling with Retry and Backoff)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TerminalReader } from "../../src/lib/event-bridge/terminal-reader";
import type { TerminalOutputEvent } from "../../src/lib/event-bridge/types";

// Mock child_process exec
vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: (fn: unknown) => fn,
}));

import { exec } from "node:child_process";

const mockExec = exec as unknown as ReturnType<typeof vi.fn>;

describe("TerminalReader", () => {
  let reader: TerminalReader;

  beforeEach(() => {
    vi.useFakeTimers();
    reader = new TerminalReader({
      pollIntervalMs: 100,
      maxErrorCount: 3,
      baseBackoffMs: 100,
      maxBackoffMs: 1000,
    });
    mockExec.mockReset();
  });

  afterEach(() => {
    reader.stop();
    vi.useRealTimers();
  });

  describe("AC1: Pane Registration", () => {
    it("should add panes for tracking", () => {
      reader.addPane("pane-1");
      reader.addPane("pane-2");

      expect(reader.getTrackedPanes()).toEqual(["pane-1", "pane-2"]);
    });

    it("should not duplicate panes", () => {
      reader.addPane("pane-1");
      reader.addPane("pane-1");

      expect(reader.getTrackedPanes()).toEqual(["pane-1"]);
    });

    it("should read from panes via conduit terminal-read", async () => {
      mockExec.mockResolvedValue({ stdout: "terminal output" });

      const events: TerminalOutputEvent[] = [];
      reader.onOutput((event) => events.push(event));

      reader.addPane("pane-1");
      reader.start();

      // Advance timer to trigger poll
      await vi.advanceTimersByTimeAsync(100);

      expect(mockExec).toHaveBeenCalledWith(
        "conduit terminal-read -p pane-1",
        expect.objectContaining({
          timeout: 5000,
          maxBuffer: 1024 * 1024,
        })
      );
    });

    it("should poll at configured interval (100-200ms)", async () => {
      mockExec.mockResolvedValue({ stdout: "output" });

      reader.addPane("pane-1");
      reader.start();

      // Advance 300ms - should poll 3 times
      await vi.advanceTimersByTimeAsync(300);

      expect(mockExec).toHaveBeenCalledTimes(3);
    });

    it("should emit output events with pane ID and content", async () => {
      mockExec.mockResolvedValue({ stdout: "hello world" });

      const events: TerminalOutputEvent[] = [];
      reader.onOutput((event) => events.push(event));

      reader.addPane("pane-1");
      reader.start();

      await vi.advanceTimersByTimeAsync(100);

      expect(events).toHaveLength(1);
      expect(events[0]!).toMatchObject({
        paneId: "pane-1",
        content: "hello world",
      });
      expect(events[0]!.timestamp).toBeGreaterThan(0);
    });
  });

  describe("AC2: Multi-Pane Parallel Reading", () => {
    it("should read all panes in parallel", async () => {
      let resolvePane1: (value: { stdout: string }) => void;
      let resolvePane2: (value: { stdout: string }) => void;

      mockExec.mockImplementation((cmd: string) => {
        if (cmd.includes("pane-1")) {
          return new Promise((resolve) => {
            resolvePane1 = resolve;
          });
        }
        if (cmd.includes("pane-2")) {
          return new Promise((resolve) => {
            resolvePane2 = resolve;
          });
        }
        return Promise.resolve({ stdout: "" });
      });

      reader.addPane("pane-1");
      reader.addPane("pane-2");
      reader.start();

      // Trigger poll
      await vi.advanceTimersByTimeAsync(100);

      // Both should be called before either resolves
      expect(mockExec).toHaveBeenCalledWith(
        "conduit terminal-read -p pane-1",
        expect.anything()
      );
      expect(mockExec).toHaveBeenCalledWith(
        "conduit terminal-read -p pane-2",
        expect.anything()
      );

      // Resolve both
      resolvePane1!({ stdout: "output1" });
      resolvePane2!({ stdout: "output2" });
    });

    it("should tag events with source pane_id", async () => {
      mockExec.mockImplementation((cmd: string) => {
        if (cmd.includes("pane-1")) {
          return Promise.resolve({ stdout: "output from pane 1" });
        }
        if (cmd.includes("pane-2")) {
          return Promise.resolve({ stdout: "output from pane 2" });
        }
        return Promise.resolve({ stdout: "" });
      });

      const events: TerminalOutputEvent[] = [];
      reader.onOutput((event) => events.push(event));

      reader.addPane("pane-1");
      reader.addPane("pane-2");
      reader.start();

      await vi.advanceTimersByTimeAsync(100);

      expect(events).toHaveLength(2);
      expect(events.find((e) => e.paneId === "pane-1")?.content).toBe(
        "output from pane 1"
      );
      expect(events.find((e) => e.paneId === "pane-2")?.content).toBe(
        "output from pane 2"
      );
    });
  });

  describe("AC3: Pane Cleanup", () => {
    it("should remove pane and clean up resources", () => {
      reader.addPane("pane-1");
      reader.addPane("pane-2");

      reader.removePane("pane-1");

      expect(reader.getTrackedPanes()).toEqual(["pane-2"]);
    });

    it("should stop reading from removed pane", async () => {
      mockExec.mockResolvedValue({ stdout: "output" });

      reader.addPane("pane-1");
      reader.addPane("pane-2");
      reader.start();

      await vi.advanceTimersByTimeAsync(100);

      // Remove pane-1
      reader.removePane("pane-1");
      mockExec.mockClear();

      await vi.advanceTimersByTimeAsync(100);

      // Only pane-2 should be polled
      expect(mockExec).toHaveBeenCalledTimes(1);
      expect(mockExec).toHaveBeenCalledWith(
        "conduit terminal-read -p pane-2",
        expect.anything()
      );
    });

    it("should clear all panes on clearPanes", () => {
      reader.addPane("pane-1");
      reader.addPane("pane-2");
      reader.addPane("pane-3");

      reader.clearPanes();

      expect(reader.getTrackedPanes()).toEqual([]);
    });
  });

  describe("AC4: Error Handling with Backoff", () => {
    it("should log error and continue reading other panes", async () => {
      mockExec.mockImplementation((cmd: string) => {
        if (cmd.includes("pane-1")) {
          return Promise.reject(new Error("connection refused"));
        }
        return Promise.resolve({ stdout: "output" });
      });

      const errors: Array<{ paneId: string; error: Error }> = [];
      reader.onError((paneId, error) => errors.push({ paneId, error }));

      const events: TerminalOutputEvent[] = [];
      reader.onOutput((event) => events.push(event));

      reader.addPane("pane-1");
      reader.addPane("pane-2");
      reader.start();

      await vi.advanceTimersByTimeAsync(100);

      // Error should be logged
      expect(errors).toHaveLength(1);
      expect(errors[0]!.paneId).toBe("pane-1");
      expect(errors[0]!.error.message).toBe("connection refused");

      // pane-2 should still work
      expect(events).toHaveLength(1);
      expect(events[0]!.paneId).toBe("pane-2");
    });

    it("should apply exponential backoff on errors", async () => {
      mockExec.mockRejectedValue(new Error("conduit error"));

      reader.addPane("pane-1");
      reader.start();

      // First error
      await vi.advanceTimersByTimeAsync(100);
      expect(mockExec).toHaveBeenCalledTimes(1);

      // Should be in backoff for 100ms
      await vi.advanceTimersByTimeAsync(50);
      expect(mockExec).toHaveBeenCalledTimes(1);

      // After backoff
      await vi.advanceTimersByTimeAsync(100);
      expect(mockExec).toHaveBeenCalledTimes(2);

      // Second error - backoff doubles to 200ms
      await vi.advanceTimersByTimeAsync(100);
      expect(mockExec).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(200);
      expect(mockExec).toHaveBeenCalledTimes(3);
    });

    it("should retry failed pane after backoff", async () => {
      let callCount = 0;
      mockExec.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("temporary error"));
        }
        return Promise.resolve({ stdout: "recovered" });
      });

      const events: TerminalOutputEvent[] = [];
      reader.onOutput((event) => events.push(event));

      reader.addPane("pane-1");
      reader.start();

      // First call fails
      await vi.advanceTimersByTimeAsync(100);
      expect(events).toHaveLength(0);

      // After backoff, should retry and succeed
      await vi.advanceTimersByTimeAsync(200);
      expect(events).toHaveLength(1);
      expect(events[0]!.content).toBe("recovered");
    });

    it("should cap backoff at maxBackoffMs", async () => {
      mockExec.mockRejectedValue(new Error("persistent error"));

      reader.addPane("pane-1");
      reader.start();

      // Trigger multiple errors to hit max backoff
      // baseBackoffMs = 100, so: 100, 200, 400, 800, 1000 (capped)
      for (let i = 0; i < 6; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      // After max backoff reached, should still retry
      expect(mockExec.mock.calls.length).toBeGreaterThan(5);
    });
  });

  describe("Output Change Detection", () => {
    it("should only emit event when content changes", async () => {
      mockExec.mockResolvedValue({ stdout: "same content" });

      const events: TerminalOutputEvent[] = [];
      reader.onOutput((event) => events.push(event));

      reader.addPane("pane-1");
      reader.start();

      // First poll
      await vi.advanceTimersByTimeAsync(100);
      expect(events).toHaveLength(1);

      // Second poll with same content
      await vi.advanceTimersByTimeAsync(100);
      expect(events).toHaveLength(1); // No new event

      // Third poll with different content
      mockExec.mockResolvedValue({ stdout: "new content" });
      await vi.advanceTimersByTimeAsync(100);
      expect(events).toHaveLength(2);
    });
  });
});
