/**
 * Delta Detector Tests
 *
 * Tests for Story 1.3: Delta Detection & Event Normalization
 * - Delta extraction (only new lines)
 * - ANSI code stripping
 * - Duplicate prevention
 * - Event normalization with id, pane_id, type, content, timestamp, project_id
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  DeltaDetector,
  stripAnsi,
  detectEventType,
} from "../../src/lib/event-bridge/delta-detector";
import type { TerminalOutputEvent } from "../../src/lib/event-bridge/types";

describe("DeltaDetector", () => {
  let detector: DeltaDetector;

  beforeEach(() => {
    detector = new DeltaDetector({ projectId: "test-project" });
  });

  describe("AC1: Delta Extraction (only new lines)", () => {
    it("should return all content on first read", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "line 1\nline 2\nline 3",
        timestamp: Date.now(),
      };

      const events = detector.process(event);

      expect(events).toHaveLength(1);
      expect(events[0]!.content).toBe("line 1\nline 2\nline 3");
    });

    it("should extract only new lines on subsequent reads", () => {
      const event1: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "line 1\nline 2",
        timestamp: Date.now(),
      };
      const event2: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "line 1\nline 2\nline 3\nline 4",
        timestamp: Date.now(),
      };

      detector.process(event1);
      const events = detector.process(event2);

      expect(events).toHaveLength(1);
      expect(events[0]!.content).toBe("line 3\nline 4");
    });

    it("should handle streaming output (partial line updates)", () => {
      const event1: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "Processing: 50%",
        timestamp: Date.now(),
      };
      const event2: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "Processing: 50%... done!",
        timestamp: Date.now(),
      };

      detector.process(event1);
      const events = detector.process(event2);

      expect(events).toHaveLength(1);
      expect(events[0]!.content).toBe("... done!");
    });

    it("should track each pane independently", () => {
      const event1: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "pane 1 line 1",
        timestamp: Date.now(),
      };
      const event2: TerminalOutputEvent = {
        paneId: "pane-2",
        content: "pane 2 line 1",
        timestamp: Date.now(),
      };
      const event3: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "pane 1 line 1\npane 1 line 2",
        timestamp: Date.now(),
      };

      detector.process(event1);
      detector.process(event2);
      const events = detector.process(event3);

      expect(events).toHaveLength(1);
      expect(events[0]!.content).toBe("pane 1 line 2");
      expect(events[0]!.pane_id).toBe("pane-1");
    });

    it("should handle screen clear (content becomes shorter)", () => {
      const event1: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10",
        timestamp: Date.now(),
      };
      const event2: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "new screen\nline 1",
        timestamp: Date.now(),
      };

      detector.process(event1);
      const events = detector.process(event2);

      expect(events).toHaveLength(1);
      expect(events[0]!.content).toBe("new screen\nline 1");
    });
  });

  describe("AC2: Duplicate Prevention", () => {
    it("should not emit event if content is identical", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "same content",
        timestamp: Date.now(),
      };

      const events1 = detector.process(event);
      const events2 = detector.process(event);

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(0);
    });

    it("should not emit duplicate delta content", () => {
      const event1: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "line 1",
        timestamp: Date.now(),
      };
      const event2: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "line 1\nline 2",
        timestamp: Date.now(),
      };
      const event3: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "line 1\nline 2\nline 2", // Duplicate delta "line 2"
        timestamp: Date.now(),
      };

      detector.process(event1);
      const events2 = detector.process(event2);
      const events3 = detector.process(event3);

      expect(events2).toHaveLength(1);
      expect(events2[0]!.content).toBe("line 2");
      // The third event's delta is "line 2" which was already processed,
      // so it should be suppressed as a duplicate
      expect(events3).toHaveLength(0);
    });

    it("should handle empty content changes", () => {
      const event1: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "content",
        timestamp: Date.now(),
      };
      const event2: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "",
        timestamp: Date.now(),
      };

      detector.process(event1);
      const events = detector.process(event2);

      expect(events).toHaveLength(0);
    });
  });

  describe("AC3: ANSI Code Stripping", () => {
    it("should strip color codes", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "\x1b[32mgreen text\x1b[0m",
        timestamp: Date.now(),
      };

      const events = detector.process(event);

      expect(events).toHaveLength(1);
      expect(events[0]!.content).toBe("green text");
    });

    it("should strip bold and formatting codes", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "\x1b[1mbold\x1b[0m and \x1b[4munderline\x1b[0m",
        timestamp: Date.now(),
      };

      const events = detector.process(event);

      expect(events).toHaveLength(1);
      expect(events[0]!.content).toBe("bold and underline");
    });

    it("should strip cursor movement codes", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "line 1\x1b[2Kline cleared\x1b[1A",
        timestamp: Date.now(),
      };

      const events = detector.process(event);

      expect(events).toHaveLength(1);
      expect(events[0]!.content).toBe("line 1line cleared");
    });

    it("should strip 256 color codes", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "\x1b[38;5;196mred\x1b[0m",
        timestamp: Date.now(),
      };

      const events = detector.process(event);

      expect(events).toHaveLength(1);
      expect(events[0]!.content).toBe("red");
    });

    it("should strip RGB color codes", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "\x1b[38;2;255;0;0mred\x1b[0m",
        timestamp: Date.now(),
      };

      const events = detector.process(event);

      expect(events).toHaveLength(1);
      expect(events[0]!.content).toBe("red");
    });
  });

  describe("AC4: Event Normalization", () => {
    it("should include all required fields", () => {
      const timestamp = Date.now();
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "test content",
        timestamp,
      };

      const events = detector.process(event);

      expect(events).toHaveLength(1);
      expect(events[0]!).toMatchObject({
        pane_id: "pane-1",
        type: "output",
        content: "test content",
        project_id: "test-project",
      });
      expect(events[0]!.id).toMatch(/^evt_/);
      expect(events[0]!.timestamp).toBeDefined();
    });

    it("should generate unique event IDs", () => {
      const event1: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "content 1",
        timestamp: Date.now(),
      };
      const event2: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "content 1\ncontent 2",
        timestamp: Date.now(),
      };

      const events1 = detector.process(event1);
      const events2 = detector.process(event2);

      expect(events1[0]!.id).not.toBe(events2[0]!.id);
    });

    it("should format timestamp as ISO string", () => {
      const timestamp = Date.now();
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "test",
        timestamp,
      };

      const events = detector.process(event);

      expect(events[0]!.timestamp).toBe(new Date(timestamp).toISOString());
    });

    it("should use configured project ID", () => {
      const customDetector = new DeltaDetector({ projectId: "my-project" });
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "test",
        timestamp: Date.now(),
      };

      const events = customDetector.process(event);

      expect(events[0]!.project_id).toBe("my-project");
    });

    it("should allow updating project ID", () => {
      const event1: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "content 1",
        timestamp: Date.now(),
      };
      const event2: TerminalOutputEvent = {
        paneId: "pane-2",
        content: "content 2",
        timestamp: Date.now(),
      };

      const events1 = detector.process(event1);
      detector.setProjectId("new-project");
      const events2 = detector.process(event2);

      expect(events1[0]!.project_id).toBe("test-project");
      expect(events2[0]!.project_id).toBe("new-project");
    });
  });

  describe("Event Type Detection", () => {
    it("should detect question type for question marks", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "Do you want to continue?",
        timestamp: Date.now(),
      };

      const events = detector.process(event);

      expect(events[0]!.type).toBe("question");
    });

    it("should detect question type for y/n prompts", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "Proceed with installation (y/n)",
        timestamp: Date.now(),
      };

      const events = detector.process(event);

      expect(events[0]!.type).toBe("question");
    });

    it("should detect error type for error messages", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "Error: Could not find file",
        timestamp: Date.now(),
      };

      const events = detector.process(event);

      expect(events[0]!.type).toBe("error");
    });

    it("should detect error type for fatal messages", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "fatal: repository not found",
        timestamp: Date.now(),
      };

      const events = detector.process(event);

      expect(events[0]!.type).toBe("error");
    });

    it("should detect status type for completion messages", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "Build completed",
        timestamp: Date.now(),
      };

      const events = detector.process(event);

      expect(events[0]!.type).toBe("status");
    });

    it("should default to output type", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "Running npm install...",
        timestamp: Date.now(),
      };

      const events = detector.process(event);

      expect(events[0]!.type).toBe("output");
    });

    it("should prioritize error over question", () => {
      const event: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "Error: Did you mean this?",
        timestamp: Date.now(),
      };

      const events = detector.process(event);

      expect(events[0]!.type).toBe("error");
    });
  });

  describe("Pane Management", () => {
    it("should clear state for specific pane", () => {
      const event1: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "content 1",
        timestamp: Date.now(),
      };
      const event2: TerminalOutputEvent = {
        paneId: "pane-2",
        content: "content 2",
        timestamp: Date.now(),
      };

      detector.process(event1);
      detector.process(event2);
      detector.clearPane("pane-1");

      // pane-1 should be cleared, pane-2 should still be tracked
      expect(detector.getTrackedPanes()).toContain("pane-2");
      expect(detector.getTrackedPanes()).not.toContain("pane-1");
    });

    it("should clear all pane states", () => {
      const event1: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "content 1",
        timestamp: Date.now(),
      };
      const event2: TerminalOutputEvent = {
        paneId: "pane-2",
        content: "content 2",
        timestamp: Date.now(),
      };

      detector.process(event1);
      detector.process(event2);
      detector.clearAll();

      expect(detector.getTrackedPanes()).toHaveLength(0);
    });

    it("should return all content after pane is cleared", () => {
      const event1: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "initial content",
        timestamp: Date.now(),
      };
      const event2: TerminalOutputEvent = {
        paneId: "pane-1",
        content: "new content",
        timestamp: Date.now(),
      };

      detector.process(event1);
      detector.clearPane("pane-1");
      const events = detector.process(event2);

      expect(events).toHaveLength(1);
      expect(events[0]!.content).toBe("new content");
    });
  });
});

describe("stripAnsi", () => {
  it("should strip basic color codes", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red");
    expect(stripAnsi("\x1b[32mgreen\x1b[0m")).toBe("green");
    expect(stripAnsi("\x1b[34mblue\x1b[0m")).toBe("blue");
  });

  it("should strip multiple codes", () => {
    expect(stripAnsi("\x1b[1m\x1b[32mbold green\x1b[0m")).toBe("bold green");
  });

  it("should handle text without codes", () => {
    expect(stripAnsi("plain text")).toBe("plain text");
  });

  it("should handle empty string", () => {
    expect(stripAnsi("")).toBe("");
  });

  it("should strip background colors", () => {
    expect(stripAnsi("\x1b[41mred bg\x1b[0m")).toBe("red bg");
  });
});

describe("detectEventType", () => {
  it("should detect output for regular text", () => {
    expect(detectEventType("Downloading package...")).toBe("output");
    expect(detectEventType("Running npm install")).toBe("output");
  });

  it("should detect question for questions", () => {
    expect(detectEventType("Continue?")).toBe("question");
    expect(detectEventType("Install now (y/n)")).toBe("question");
    expect(detectEventType("Press enter to continue")).toBe("question");
  });

  it("should detect error for error messages", () => {
    expect(detectEventType("Error: File not found")).toBe("error");
    expect(detectEventType("FATAL: Cannot connect")).toBe("error");
    expect(detectEventType("Exception: NullPointerException")).toBe("error");
  });

  it("should detect status for status messages", () => {
    expect(detectEventType("Build done.")).toBe("status");
    expect(detectEventType("Task completed")).toBe("status");
    expect(detectEventType("Process finished")).toBe("status");
  });
});
