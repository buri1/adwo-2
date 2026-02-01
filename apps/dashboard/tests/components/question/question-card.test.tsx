/**
 * QuestionCard Component Tests
 * Story 3.2 — Question Display in Chat UI
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionCard } from "@/components/question/question-card";
import type { PendingQuestion } from "@/stores/question-store";

function createPendingQuestion(
  overrides: Partial<PendingQuestion> = {}
): PendingQuestion {
  return {
    id: "q_001",
    paneId: "%42",
    timestamp: "2024-01-15T10:30:00Z",
    metadata: {
      header: "Test Header",
      question: "What would you like to do?",
      options: [
        { number: 1, label: "Option A", description: "Description A" },
        { number: 2, label: "Option B", description: "Description B" },
      ],
    },
    ...overrides,
  };
}

describe("QuestionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render question header", () => {
      const question = createPendingQuestion();
      render(<QuestionCard question={question} />);

      expect(screen.getByText("Test Header")).toBeInTheDocument();
    });

    it("should render question text", () => {
      const question = createPendingQuestion();
      render(<QuestionCard question={question} />);

      expect(screen.getByText("What would you like to do?")).toBeInTheDocument();
    });

    it("should render all options as buttons", () => {
      const question = createPendingQuestion();
      render(<QuestionCard question={question} />);

      expect(screen.getByRole("button", { name: /1.*Option A/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /2.*Option B/i })).toBeInTheDocument();
    });

    it("should render pane/agent identifier", () => {
      const question = createPendingQuestion({ paneId: "%42" });
      render(<QuestionCard question={question} />);

      expect(screen.getByText("Agent 42")).toBeInTheDocument();
    });

    it("should render timestamp", () => {
      const question = createPendingQuestion({
        timestamp: "2024-01-15T10:30:00Z",
      });
      render(<QuestionCard question={question} />);

      // Timestamp format depends on locale, check for time pattern
      expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument();
    });

    it("should render option descriptions", () => {
      const question = createPendingQuestion();
      render(<QuestionCard question={question} />);

      expect(screen.getByText("Description A")).toBeInTheDocument();
      expect(screen.getByText("Description B")).toBeInTheDocument();
    });

    it("should handle options without descriptions", () => {
      const question = createPendingQuestion({
        metadata: {
          header: "No Desc",
          question: "Choose?",
          options: [
            { number: 1, label: "Yes" },
            { number: 2, label: "No" },
          ],
        },
      });

      render(<QuestionCard question={question} />);

      expect(screen.getByRole("button", { name: /1.*Yes/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /2.*No/i })).toBeInTheDocument();
      expect(screen.queryByText("Description")).not.toBeInTheDocument();
    });

    it("should handle many options", () => {
      const question = createPendingQuestion({
        metadata: {
          header: "Many Options",
          question: "Which one?",
          options: [
            { number: 1, label: "First" },
            { number: 2, label: "Second" },
            { number: 3, label: "Third" },
            { number: 4, label: "Fourth" },
          ],
        },
      });

      render(<QuestionCard question={question} />);

      expect(screen.getAllByRole("button")).toHaveLength(4);
    });
  });

  describe("visual styling", () => {
    it("should have yellow accent styling for visual distinction", () => {
      const question = createPendingQuestion();
      const { container } = render(<QuestionCard question={question} />);

      // Check for yellow border class
      const card = container.querySelector(".border-l-yellow-500");
      expect(card).toBeInTheDocument();
    });

    it("should have question icon", () => {
      const question = createPendingQuestion();
      render(<QuestionCard question={question} />);

      // HelpCircle icon should be present (svg with specific attributes)
      const icon = document.querySelector("svg.text-yellow-500");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("should call onOptionSelect when option button is clicked", () => {
      const onOptionSelect = vi.fn();
      const question = createPendingQuestion({ id: "q_test" });

      render(
        <QuestionCard question={question} onOptionSelect={onOptionSelect} />
      );

      const optionButton = screen.getByRole("button", { name: /1.*Option A/i });
      fireEvent.click(optionButton);

      expect(onOptionSelect).toHaveBeenCalledWith("q_test", 1);
    });

    it("should call onOptionSelect with correct option number", () => {
      const onOptionSelect = vi.fn();
      const question = createPendingQuestion({ id: "q_test" });

      render(
        <QuestionCard question={question} onOptionSelect={onOptionSelect} />
      );

      const optionButton = screen.getByRole("button", { name: /2.*Option B/i });
      fireEvent.click(optionButton);

      expect(onOptionSelect).toHaveBeenCalledWith("q_test", 2);
    });

    it("should work without onOptionSelect handler", () => {
      const question = createPendingQuestion();

      render(<QuestionCard question={question} />);

      const optionButton = screen.getByRole("button", { name: /1.*Option A/i });
      expect(() => fireEvent.click(optionButton)).not.toThrow();
    });
  });

  describe("pane formatting", () => {
    it("should format pane ID with percentage sign", () => {
      const question = createPendingQuestion({ paneId: "%123" });
      render(<QuestionCard question={question} />);

      expect(screen.getByText("Agent 123")).toBeInTheDocument();
    });

    it("should truncate long pane IDs", () => {
      const question = createPendingQuestion({
        paneId: "very-long-pane-id-that-should-be-truncated",
      });
      render(<QuestionCard question={question} />);

      expect(screen.getByText(/^very-long-pa\.\.\.$/)).toBeInTheDocument();
    });

    it("should show short pane IDs as-is", () => {
      const question = createPendingQuestion({ paneId: "short" });
      render(<QuestionCard question={question} />);

      expect(screen.getByText("short")).toBeInTheDocument();
    });
  });
});
