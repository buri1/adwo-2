/**
 * POST /api/questions/answer Tests
 * Story 3.3 — Answer Questions via Dashboard
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/questions/answer/route";

// Mock conduit functions
vi.mock("@/lib/conduit", () => ({
  terminalWrite: vi.fn(),
  terminalSendEnter: vi.fn(),
}));

import { terminalWrite, terminalSendEnter } from "@/lib/conduit";

const mockTerminalWrite = terminalWrite as ReturnType<typeof vi.fn>;
const mockTerminalSendEnter = terminalSendEnter as ReturnType<typeof vi.fn>;

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/questions/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/questions/answer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminalWrite.mockResolvedValue(undefined);
    mockTerminalSendEnter.mockResolvedValue(undefined);
  });

  describe("successful requests", () => {
    it("should send answer to terminal and return success", async () => {
      const request = createRequest({
        questionId: "q_001",
        paneId: "%42",
        answer: "1",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.questionId).toBe("q_001");
      expect(data.paneId).toBe("%42");
      expect(data.message).toBe("Answer sent successfully");
    });

    it("should call terminalWrite with correct paneId and answer", async () => {
      const request = createRequest({
        questionId: "q_001",
        paneId: "%42",
        answer: "2",
      });

      await POST(request);

      expect(mockTerminalWrite).toHaveBeenCalledWith("%42", "2");
    });

    it("should call terminalSendEnter after terminalWrite", async () => {
      const request = createRequest({
        questionId: "q_001",
        paneId: "%42",
        answer: "1",
      });

      await POST(request);

      expect(mockTerminalSendEnter).toHaveBeenCalledWith("%42");
      expect(mockTerminalWrite).toHaveBeenCalledBefore(mockTerminalSendEnter);
    });

    it("should handle custom text answers", async () => {
      const request = createRequest({
        questionId: "q_001",
        paneId: "%42",
        answer: "Custom answer with multiple words",
      });

      await POST(request);

      expect(mockTerminalWrite).toHaveBeenCalledWith(
        "%42",
        "Custom answer with multiple words"
      );
    });
  });

  describe("validation errors", () => {
    it("should return 400 if questionId is missing", async () => {
      const request = createRequest({
        paneId: "%42",
        answer: "1",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("questionId is required");
    });

    it("should return 400 if paneId is missing", async () => {
      const request = createRequest({
        questionId: "q_001",
        answer: "1",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("paneId is required");
    });

    it("should return 400 if answer is missing", async () => {
      const request = createRequest({
        questionId: "q_001",
        paneId: "%42",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("answer is required");
    });

    it("should return 400 if questionId is not a string", async () => {
      const request = createRequest({
        questionId: 123,
        paneId: "%42",
        answer: "1",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("questionId is required");
    });

    it("should return 400 if paneId is not a string", async () => {
      const request = createRequest({
        questionId: "q_001",
        paneId: null,
        answer: "1",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("paneId is required");
    });

    it("should return 400 if answer is not a string", async () => {
      const request = createRequest({
        questionId: "q_001",
        paneId: "%42",
        answer: 1,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("answer is required");
    });
  });

  describe("error handling", () => {
    it("should return 500 if terminalWrite fails", async () => {
      mockTerminalWrite.mockRejectedValue(new Error("Terminal not available"));

      const request = createRequest({
        questionId: "q_001",
        paneId: "%42",
        answer: "1",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Terminal not available");
    });

    it("should return 500 if terminalSendEnter fails", async () => {
      mockTerminalSendEnter.mockRejectedValue(new Error("Enter key failed"));

      const request = createRequest({
        questionId: "q_001",
        paneId: "%42",
        answer: "1",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Enter key failed");
    });

    it("should handle unknown errors gracefully", async () => {
      mockTerminalWrite.mockRejectedValue("Unknown error");

      const request = createRequest({
        questionId: "q_001",
        paneId: "%42",
        answer: "1",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Unknown error occurred");
    });
  });
});
