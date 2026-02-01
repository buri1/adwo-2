/**
 * QuestionPanel Component Tests
 * Story 3.2 — Question Display in Chat UI
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QuestionPanel } from "@/components/question/question-panel";
import { useQuestionStore } from "@/stores/question-store";
import { useEventStore } from "@/stores/event-store";
import type { NormalizedTerminalEvent, QuestionMetadata } from "@adwo/shared";

function createQuestionMetadata(
  overrides: Partial<QuestionMetadata> = {}
): QuestionMetadata {
  return {
    header: "Test Header",
    question: "What would you like to do?",
    options: [
      { number: 1, label: "Option A" },
      { number: 2, label: "Option B" },
    ],
    ...overrides,
  };
}

function createQuestionEvent(
  overrides: Partial<NormalizedTerminalEvent> = {}
): NormalizedTerminalEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    pane_id: "%0",
    type: "question",
    content: "Question content",
    timestamp: new Date().toISOString(),
    project_id: "test-project",
    question_metadata: createQuestionMetadata(),
    ...overrides,
  };
}

describe("QuestionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQuestionStore.getState().clearQuestions();
    useEventStore.getState().clearEvents();
  });

  afterEach(() => {
    vi.clearAllMocks();
    useQuestionStore.getState().clearQuestions();
    useEventStore.getState().clearEvents();
  });

  describe("rendering", () => {
    it("should render panel header", () => {
      render(<QuestionPanel />);

      expect(screen.getByText("Questions")).toBeInTheDocument();
    });

    it("should show empty state when no questions", () => {
      render(<QuestionPanel />);

      expect(screen.getByText("No pending questions")).toBeInTheDocument();
      expect(
        screen.getByText("Questions from agents will appear here")
      ).toBeInTheDocument();
    });

    it("should render question cards when questions exist", async () => {
      const event = createQuestionEvent({
        id: "q_001",
        question_metadata: createQuestionMetadata({
          header: "First Question",
          question: "Is this working?",
        }),
      });

      await act(async () => {
        useQuestionStore.getState().addQuestion(event);
      });

      render(<QuestionPanel />);

      expect(screen.getByText("First Question")).toBeInTheDocument();
      expect(screen.getByText("Is this working?")).toBeInTheDocument();
    });

    it("should show pending count badge", async () => {
      const events = [
        createQuestionEvent({ id: "q_001" }),
        createQuestionEvent({ id: "q_002" }),
        createQuestionEvent({ id: "q_003" }),
      ];

      await act(async () => {
        events.forEach((e) => useQuestionStore.getState().addQuestion(e));
      });

      render(<QuestionPanel />);

      expect(screen.getByText("3 pending")).toBeInTheDocument();
    });

    it("should not show badge when no pending questions", () => {
      render(<QuestionPanel />);

      // Badge shows "X pending" format, not the empty state text
      expect(screen.queryByText(/\d+ pending/)).not.toBeInTheDocument();
    });
  });

  describe("chronological order", () => {
    it("should display questions in chronological order (oldest first)", async () => {
      const events = [
        createQuestionEvent({
          id: "q_003",
          timestamp: "2024-01-01T12:00:00Z",
          question_metadata: createQuestionMetadata({ header: "Third" }),
        }),
        createQuestionEvent({
          id: "q_001",
          timestamp: "2024-01-01T10:00:00Z",
          question_metadata: createQuestionMetadata({ header: "First" }),
        }),
        createQuestionEvent({
          id: "q_002",
          timestamp: "2024-01-01T11:00:00Z",
          question_metadata: createQuestionMetadata({ header: "Second" }),
        }),
      ];

      await act(async () => {
        useQuestionStore.getState().addQuestions(events);
      });

      render(<QuestionPanel />);

      const headers = screen.getAllByText(/First|Second|Third/);
      expect(headers[0]).toHaveTextContent("First");
      expect(headers[1]).toHaveTextContent("Second");
      expect(headers[2]).toHaveTextContent("Third");
    });
  });

  describe("event store integration", () => {
    it("should sync questions from event store on mount", async () => {
      const event = createQuestionEvent({
        id: "q_from_events",
        question_metadata: createQuestionMetadata({
          header: "From Events",
        }),
      });

      // Add to event store (not question store directly)
      await act(async () => {
        useEventStore.getState().addEvent(event);
      });

      render(<QuestionPanel />);

      // Should sync from event store to question store
      expect(screen.getByText("From Events")).toBeInTheDocument();
    });

    it("should sync when new events arrive", async () => {
      const { rerender } = render(<QuestionPanel />);

      expect(screen.getByText("No pending questions")).toBeInTheDocument();

      const event = createQuestionEvent({
        id: "q_new",
        question_metadata: createQuestionMetadata({
          header: "New Question",
        }),
      });

      await act(async () => {
        useEventStore.getState().addEvent(event);
      });

      rerender(<QuestionPanel />);

      expect(screen.getByText("New Question")).toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("should apply custom className", () => {
      const { container } = render(<QuestionPanel className="custom-class" />);

      const panel = container.firstChild as HTMLElement;
      expect(panel.className).toContain("custom-class");
    });

    it("should apply custom maxHeight", () => {
      const { container } = render(<QuestionPanel maxHeight="h-[500px]" />);

      const panel = container.firstChild as HTMLElement;
      expect(panel.className).toContain("h-[500px]");
    });
  });

  describe("onOptionSelect callback", () => {
    it("should pass onOptionSelect to question cards", async () => {
      const onOptionSelect = vi.fn();
      const event = createQuestionEvent({ id: "q_001" });

      await act(async () => {
        useQuestionStore.getState().addQuestion(event);
      });

      render(<QuestionPanel onOptionSelect={onOptionSelect} />);

      // Verify option buttons are rendered (they should receive the callback)
      expect(screen.getByRole("button", { name: /1.*Option A/i })).toBeInTheDocument();
    });
  });

  describe("multiple panes", () => {
    it("should display questions from different panes", async () => {
      const events = [
        createQuestionEvent({
          id: "q_001",
          pane_id: "%1",
          question_metadata: createQuestionMetadata({ header: "Pane 1 Q" }),
        }),
        createQuestionEvent({
          id: "q_002",
          pane_id: "%2",
          question_metadata: createQuestionMetadata({ header: "Pane 2 Q" }),
        }),
      ];

      await act(async () => {
        useQuestionStore.getState().addQuestions(events);
      });

      render(<QuestionPanel />);

      expect(screen.getByText("Pane 1 Q")).toBeInTheDocument();
      expect(screen.getByText("Pane 2 Q")).toBeInTheDocument();
      expect(screen.getByText("Agent 1")).toBeInTheDocument();
      expect(screen.getByText("Agent 2")).toBeInTheDocument();
    });
  });
});
