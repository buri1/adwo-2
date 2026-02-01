/**
 * Event Bridge Integration Tests
 *
 * Tests the complete EventBridge module integrating StateWatcher and TerminalReader
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  EventBridge,
  resetEventBridge,
  getEventBridge,
} from "../../src/lib/event-bridge";
import type { TerminalOutputEvent } from "../../src/lib/event-bridge/types";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock child_process for conduit commands
vi.mock("node:child_process", () => ({
  exec: vi.fn((cmd: string, _opts: unknown, callback?: unknown) => {
    // Extract pane ID from command
    const match = cmd.match(/conduit terminal-read -p (\S+)/);
    const paneId = match?.[1] || "unknown";

    // If callback style
    if (typeof callback === "function") {
      callback(null, { stdout: `output from ${paneId}` });
      return;
    }

    // Return promise style
    return Promise.resolve({ stdout: `output from ${paneId}` });
  }),
}));

vi.mock("node:util", () => ({
  promisify: (fn: unknown) => fn,
}));

describe("EventBridge", () => {
  let testDir: string;
  let stateFilePath: string;
  let bridge: EventBridge;

  beforeEach(async () => {
    // Reset singleton
    await resetEventBridge();

    // Create unique temp directory
    testDir = join(tmpdir(), `event-bridge-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    stateFilePath = join(testDir, "orchestrator-state.json");
  });

  afterEach(async () => {
    if (bridge) {
      await bridge.stop();
    }
    await resetEventBridge();

    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  async function writeState(state: Record<string, unknown>) {
    await writeFile(stateFilePath, JSON.stringify(state, null, 2));
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  describe("Lifecycle", () => {
    it("should start and stop without errors", async () => {
      await writeState({
        version: "1.0",
        current_session: {
          phase: "idle",
          current_agent: { pane_id: null, started_at: null },
        },
      });

      bridge = new EventBridge({ stateFilePath });

      await bridge.start();
      expect(bridge.isRunning()).toBe(true);

      await bridge.stop();
      expect(bridge.isRunning()).toBe(false);
    });

    it("should ignore multiple start calls", async () => {
      await writeState({
        version: "1.0",
        current_session: {
          phase: "idle",
          current_agent: { pane_id: null, started_at: null },
        },
      });

      bridge = new EventBridge({ stateFilePath });

      await bridge.start();
      await bridge.start(); // Second call should be ignored

      expect(bridge.isRunning()).toBe(true);
    });
  });

  describe("Pane Tracking Integration", () => {
    it("should track panes from state file", async () => {
      await writeState({
        version: "1.0",
        current_session: {
          phase: "implementation",
          current_agent: {
            pane_id: "agent-pane",
            started_at: "2024-01-01T00:00:00Z",
          },
        },
        panes: ["pane-1", "pane-2"],
      });

      bridge = new EventBridge({ stateFilePath });
      await bridge.start();

      await new Promise((resolve) => setTimeout(resolve, 300));

      const trackedPanes = bridge.getTrackedPanes();
      expect(trackedPanes).toContain("agent-pane");
      expect(trackedPanes).toContain("pane-1");
      expect(trackedPanes).toContain("pane-2");
    });

    it("should emit pane change events", async () => {
      await writeState({
        version: "1.0",
        current_session: {
          phase: "idle",
          current_agent: { pane_id: null, started_at: null },
        },
      });

      bridge = new EventBridge({ stateFilePath });

      const paneChanges: Array<{ added: string[]; removed: string[] }> = [];
      bridge.onPaneChange((added, removed) =>
        paneChanges.push({ added, removed })
      );

      await bridge.start();
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Add a pane
      await writeState({
        version: "1.0",
        current_session: {
          phase: "implementation",
          current_agent: {
            pane_id: "new-pane",
            started_at: "2024-01-01T00:00:00Z",
          },
        },
      });

      expect(paneChanges.some((c) => c.added.includes("new-pane"))).toBe(true);
    });
  });

  describe("Output Events", () => {
    it("should emit output events from registered panes", async () => {
      await writeState({
        version: "1.0",
        current_session: {
          phase: "implementation",
          current_agent: {
            pane_id: "pane-1",
            started_at: "2024-01-01T00:00:00Z",
          },
        },
      });

      bridge = new EventBridge({
        stateFilePath,
        pollIntervalMs: 50,
      });

      const events: TerminalOutputEvent[] = [];
      bridge.onOutput((event) => events.push(event));

      await bridge.start();
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]!.paneId).toBe("pane-1");
      expect(events[0]!.content).toContain("output from pane-1");
    });
  });

  describe("Error Handling", () => {
    it("should emit error events", async () => {
      // Override mock to throw for specific pane
      const { exec } = await import("node:child_process");
      (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (cmd: string) => {
          if (cmd.includes("error-pane")) {
            return Promise.reject(new Error("conduit failed"));
          }
          return Promise.resolve({ stdout: "ok" });
        }
      );

      await writeState({
        version: "1.0",
        current_session: {
          phase: "implementation",
          current_agent: { pane_id: null, started_at: null },
        },
        panes: ["error-pane", "good-pane"],
      });

      bridge = new EventBridge({
        stateFilePath,
        pollIntervalMs: 50,
      });

      const errors: Array<{ paneId: string; error: Error }> = [];
      bridge.onError((paneId, error) => errors.push({ paneId, error }));

      await bridge.start();
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(errors.some((e) => e.paneId === "error-pane")).toBe(true);
    });
  });

  describe("Manual Pane Control", () => {
    it("should allow manual pane addition", async () => {
      await writeState({
        version: "1.0",
        current_session: {
          phase: "idle",
          current_agent: { pane_id: null, started_at: null },
        },
      });

      bridge = new EventBridge({ stateFilePath });
      await bridge.start();

      bridge.addPane("manual-pane", "Test Pane");

      expect(bridge.getTrackedPanes()).toContain("manual-pane");
    });

    it("should allow manual pane removal", async () => {
      await writeState({
        version: "1.0",
        current_session: {
          phase: "implementation",
          current_agent: { pane_id: null, started_at: null },
        },
        panes: ["pane-1", "pane-2"],
      });

      bridge = new EventBridge({ stateFilePath });
      await bridge.start();
      await new Promise((resolve) => setTimeout(resolve, 200));

      bridge.removePane("pane-1");

      expect(bridge.getTrackedPanes()).not.toContain("pane-1");
      expect(bridge.getTrackedPanes()).toContain("pane-2");
    });
  });

  describe("Singleton Pattern", () => {
    it("should return same instance from getEventBridge", async () => {
      await writeState({
        version: "1.0",
        current_session: {
          phase: "idle",
          current_agent: { pane_id: null, started_at: null },
        },
      });

      const bridge1 = getEventBridge({ stateFilePath });
      const bridge2 = getEventBridge({ stateFilePath });

      expect(bridge1).toBe(bridge2);
      bridge = bridge1;
    });

    it("should throw if first call lacks stateFilePath", async () => {
      expect(() => getEventBridge()).toThrow(
        "EventBridge requires stateFilePath on first initialization"
      );
    });
  });
});
