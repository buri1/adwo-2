/**
 * State Watcher Tests
 *
 * Tests for AC1 (Pane Registration) and AC3 (Pane Cleanup)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StateWatcher } from "../../src/lib/event-bridge/state-watcher";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("StateWatcher", () => {
  let testDir: string;
  let stateFilePath: string;
  let watcher: StateWatcher;

  beforeEach(async () => {
    // Create unique temp directory for each test
    testDir = join(tmpdir(), `state-watcher-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    stateFilePath = join(testDir, "orchestrator-state.json");
  });

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
    }
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  async function writeState(state: Record<string, unknown>) {
    await writeFile(stateFilePath, JSON.stringify(state, null, 2));
    // Small delay for file system and debounce
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  describe("AC1: Pane Registration", () => {
    it("should detect pane from current_agent.pane_id", async () => {
      // Write initial state
      await writeState({
        version: "1.0",
        current_session: {
          phase: "implementation",
          current_agent: {
            pane_id: "pane-abc123",
            started_at: "2024-01-01T00:00:00Z",
          },
        },
      });

      watcher = new StateWatcher({ stateFilePath });

      const changes: Array<{ added: string[]; removed: string[] }> = [];
      watcher.onChange((added, removed) => changes.push({ added, removed }));

      await watcher.start();

      // Wait for initial read
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(changes.length).toBeGreaterThanOrEqual(1);
      expect(changes[0].added).toContain("pane-abc123");
    });

    it("should detect multiple panes from panes array", async () => {
      await writeState({
        version: "1.0",
        current_session: {
          phase: "implementation",
          current_agent: {
            pane_id: null,
            started_at: null,
          },
        },
        panes: ["pane-1", "pane-2", "pane-3"],
      });

      watcher = new StateWatcher({ stateFilePath });

      const changes: Array<{ added: string[]; removed: string[] }> = [];
      watcher.onChange((added, removed) => changes.push({ added, removed }));

      await watcher.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(changes.length).toBeGreaterThanOrEqual(1);
      expect(changes[0].added).toContain("pane-1");
      expect(changes[0].added).toContain("pane-2");
      expect(changes[0].added).toContain("pane-3");
    });

    it("should detect new pane when added", async () => {
      await writeState({
        version: "1.0",
        current_session: {
          phase: "idle",
          current_agent: {
            pane_id: null,
            started_at: null,
          },
        },
      });

      watcher = new StateWatcher({ stateFilePath });

      const changes: Array<{ added: string[]; removed: string[] }> = [];
      watcher.onChange((added, removed) => changes.push({ added, removed }));

      await watcher.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now add a pane
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

      // Check for new pane detection
      expect(changes.some((c) => c.added.includes("new-pane"))).toBe(true);
    });
  });

  describe("AC3: Pane Cleanup", () => {
    it("should detect pane removal", async () => {
      // Start with a pane
      await writeState({
        version: "1.0",
        current_session: {
          phase: "implementation",
          current_agent: {
            pane_id: "active-pane",
            started_at: "2024-01-01T00:00:00Z",
          },
        },
      });

      watcher = new StateWatcher({ stateFilePath });

      const changes: Array<{ added: string[]; removed: string[] }> = [];
      watcher.onChange((added, removed) => changes.push({ added, removed }));

      await watcher.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Remove the pane
      await writeState({
        version: "1.0",
        current_session: {
          phase: "idle",
          current_agent: {
            pane_id: null,
            started_at: null,
          },
        },
      });

      expect(changes.some((c) => c.removed.includes("active-pane"))).toBe(true);
    });

    it("should handle multiple panes being removed", async () => {
      await writeState({
        version: "1.0",
        current_session: {
          phase: "implementation",
          current_agent: { pane_id: null, started_at: null },
        },
        panes: ["pane-1", "pane-2", "pane-3"],
      });

      watcher = new StateWatcher({ stateFilePath });

      const changes: Array<{ added: string[]; removed: string[] }> = [];
      watcher.onChange((added, removed) => changes.push({ added, removed }));

      await watcher.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Remove panes 1 and 2
      await writeState({
        version: "1.0",
        current_session: {
          phase: "implementation",
          current_agent: { pane_id: null, started_at: null },
        },
        panes: ["pane-3"],
      });

      const removedPanes = changes.flatMap((c) => c.removed);
      expect(removedPanes).toContain("pane-1");
      expect(removedPanes).toContain("pane-2");
    });

    it("should handle file deletion gracefully", async () => {
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

      watcher = new StateWatcher({ stateFilePath });

      const changes: Array<{ added: string[]; removed: string[] }> = [];
      watcher.onChange((added, removed) => changes.push({ added, removed }));

      await watcher.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Delete the file
      await rm(stateFilePath);
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Pane should be removed
      expect(changes.some((c) => c.removed.includes("pane-1"))).toBe(true);
    });
  });

  describe("File Watch Edge Cases", () => {
    it("should handle file not existing at startup", async () => {
      watcher = new StateWatcher({ stateFilePath });

      const changes: Array<{ added: string[]; removed: string[] }> = [];
      watcher.onChange((added, removed) => changes.push({ added, removed }));

      // Start without file existing
      await watcher.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create file with pane
      await writeState({
        version: "1.0",
        current_session: {
          phase: "implementation",
          current_agent: {
            pane_id: "late-pane",
            started_at: "2024-01-01T00:00:00Z",
          },
        },
      });

      expect(changes.some((c) => c.added.includes("late-pane"))).toBe(true);
    });

    it("should handle invalid JSON gracefully", async () => {
      watcher = new StateWatcher({ stateFilePath });

      const changes: Array<{ added: string[]; removed: string[] }> = [];
      watcher.onChange((added, removed) => changes.push({ added, removed }));

      await watcher.start();

      // Write invalid JSON
      await writeFile(stateFilePath, "{ invalid json }");
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should not throw, changes may be empty but should continue working
      // Write valid JSON afterwards
      await writeState({
        version: "1.0",
        current_session: {
          phase: "implementation",
          current_agent: {
            pane_id: "recovered-pane",
            started_at: "2024-01-01T00:00:00Z",
          },
        },
      });

      expect(changes.some((c) => c.added.includes("recovered-pane"))).toBe(
        true
      );
    });

    it("should return current panes via getCurrentPanes", async () => {
      await writeState({
        version: "1.0",
        current_session: {
          phase: "implementation",
          current_agent: { pane_id: null, started_at: null },
        },
        panes: ["pane-a", "pane-b"],
      });

      watcher = new StateWatcher({ stateFilePath });
      await watcher.start();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const panes = watcher.getCurrentPanes();
      expect(panes).toContain("pane-a");
      expect(panes).toContain("pane-b");
    });
  });
});
