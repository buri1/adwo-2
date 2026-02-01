/**
 * Conduit CLI Wrapper Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { paneSplit, paneClose, terminalWrite, terminalSendEnter } from "@/lib/conduit";

// Mock child_process exec
vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: (fn: unknown) => fn,
}));

import { exec } from "node:child_process";

const mockExec = exec as unknown as ReturnType<typeof vi.fn>;

describe("Conduit CLI Wrapper", () => {
  beforeEach(() => {
    mockExec.mockReset();
  });

  describe("paneSplit", () => {
    it("should create a new terminal pane and return pane_id", async () => {
      mockExec.mockResolvedValue({
        stdout: JSON.stringify({ pane_id: "test-pane-123" }),
      });

      const result = await paneSplit();

      expect(mockExec).toHaveBeenCalledWith(
        "conduit pane-split --type terminal",
        expect.objectContaining({ timeout: 10000 })
      );
      expect(result.pane_id).toBe("test-pane-123");
    });

    it("should throw error if no pane_id returned", async () => {
      mockExec.mockResolvedValue({ stdout: JSON.stringify({}) });

      await expect(paneSplit()).rejects.toThrow(
        "No pane_id returned from conduit pane-split"
      );
    });

    it("should throw error on conduit failure", async () => {
      mockExec.mockRejectedValue(new Error("conduit not available"));

      await expect(paneSplit()).rejects.toThrow(
        "Failed to split pane: conduit not available"
      );
    });
  });

  describe("paneClose", () => {
    it("should close a pane by id", async () => {
      mockExec.mockResolvedValue({ stdout: "" });

      await paneClose("pane-123");

      expect(mockExec).toHaveBeenCalledWith(
        "conduit pane-close -p pane-123",
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it("should throw error on failure", async () => {
      mockExec.mockRejectedValue(new Error("pane not found"));

      await expect(paneClose("invalid-pane")).rejects.toThrow(
        "Failed to close pane: pane not found"
      );
    });
  });

  describe("terminalWrite", () => {
    it("should write text to terminal pane", async () => {
      mockExec.mockResolvedValue({ stdout: "" });

      await terminalWrite("pane-123", "hello world");

      expect(mockExec).toHaveBeenCalledWith(
        "conduit terminal-write -p pane-123 'hello world'",
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it("should escape single quotes in text", async () => {
      mockExec.mockResolvedValue({ stdout: "" });

      await terminalWrite("pane-123", "it's a test");

      expect(mockExec).toHaveBeenCalledWith(
        "conduit terminal-write -p pane-123 'it'\\''s a test'",
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it("should throw error on failure", async () => {
      mockExec.mockRejectedValue(new Error("write failed"));

      await expect(terminalWrite("pane-123", "test")).rejects.toThrow(
        "Failed to write to terminal: write failed"
      );
    });
  });

  describe("terminalSendEnter", () => {
    it("should send Enter key to terminal", async () => {
      mockExec.mockResolvedValue({ stdout: "" });

      await terminalSendEnter("pane-123");

      expect(mockExec).toHaveBeenCalledWith(
        "conduit terminal-write -p pane-123 --key Enter",
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it("should throw error on failure", async () => {
      mockExec.mockRejectedValue(new Error("key send failed"));

      await expect(terminalSendEnter("pane-123")).rejects.toThrow(
        "Failed to send Enter key: key send failed"
      );
    });
  });
});
