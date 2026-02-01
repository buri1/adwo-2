/**
 * QuestionCard Component Tests
 * Story 3.2 & 3.3 — Question Display and Answer in Chat UI
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

      // 4 option buttons + 1 send button = 5 total
      expect(screen.getAllByRole("button")).toHaveLength(5);
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
    it("should call onOptionSelect when option button is clicked (legacy)", () => {
      const onOptionSelect = vi.fn();
      const question = createPendingQuestion({ id: "q_test" });

      render(
        <QuestionCard question={question} onOptionSelect={onOptionSelect} />
      );

      const optionButton = screen.getByRole("button", { name: /1.*Option A/i });
      fireEvent.click(optionButton);

      expect(onOptionSelect).toHaveBeenCalledWith("q_test", 1);
    });

    it("should call onOptionSelect with correct option number (legacy)", () => {
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

    it("should call onAnswer when option button is clicked", async () => {
      const onAnswer = vi.fn().mockResolvedValue(undefined);
      const question = createPendingQuestion({ id: "q_test", paneId: "%42" });

      render(<QuestionCard question={question} onAnswer={onAnswer} />);

      const optionButton = screen.getByRole("button", { name: /1.*Option A/i });
      fireEvent.click(optionButton);

      await waitFor(() => {
        expect(onAnswer).toHaveBeenCalledWith("q_test", "%42", "1");
      });
    });

    it("should prefer onAnswer over onOptionSelect when both provided", async () => {
      const onAnswer = vi.fn().mockResolvedValue(undefined);
      const onOptionSelect = vi.fn();
      const question = createPendingQuestion({ id: "q_test", paneId: "%42" });

      render(
        <QuestionCard
          question={question}
          onAnswer={onAnswer}
          onOptionSelect={onOptionSelect}
        />
      );

      const optionButton = screen.getByRole("button", { name: /1.*Option A/i });
      fireEvent.click(optionButton);

      await waitFor(() => {
        expect(onAnswer).toHaveBeenCalled();
      });
      expect(onOptionSelect).not.toHaveBeenCalled();
    });
  });

  describe("custom answer input", () => {
    it("should render custom answer input field", () => {
      const question = createPendingQuestion();
      render(<QuestionCard question={question} />);

      expect(
        screen.getByPlaceholderText("Type a custom answer...")
      ).toBeInTheDocument();
    });

    it("should render send button", () => {
      const question = createPendingQuestion();
      render(<QuestionCard question={question} />);

      // Find the send button (it contains an SVG icon)
      const buttons = screen.getAllByRole("button");
      const sendButton = buttons.find(
        (btn) => btn.querySelector("svg") && !btn.textContent?.match(/\d/)
      );
      expect(sendButton).toBeInTheDocument();
    });

    it("should disable send button when input is empty", () => {
      const question = createPendingQuestion();
      render(<QuestionCard question={question} />);

      const buttons = screen.getAllByRole("button");
      const sendButton = buttons.find(
        (btn) =>
          btn.querySelector('svg[class*="lucide-send"]') !== null ||
          (btn.querySelector("svg") && !btn.textContent?.match(/\d/))
      );
      expect(sendButton).toBeDisabled();
    });

    it("should call onAnswer when submitting custom answer via Enter", async () => {
      const user = userEvent.setup();
      const onAnswer = vi.fn().mockResolvedValue(undefined);
      const question = createPendingQuestion({ id: "q_test", paneId: "%42" });

      render(<QuestionCard question={question} onAnswer={onAnswer} />);

      const input = screen.getByPlaceholderText("Type a custom answer...");
      await user.type(input, "Custom response{enter}");

      await waitFor(() => {
        expect(onAnswer).toHaveBeenCalledWith("q_test", "%42", "Custom response");
      });
    });

    it("should clear input after successful submission", async () => {
      const user = userEvent.setup();
      const onAnswer = vi.fn().mockResolvedValue(undefined);
      const question = createPendingQuestion({ id: "q_test", paneId: "%42" });

      render(<QuestionCard question={question} onAnswer={onAnswer} />);

      const input = screen.getByPlaceholderText("Type a custom answer...");
      await user.type(input, "My answer{enter}");

      await waitFor(() => {
        expect(input).toHaveValue("");
      });
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

  describe("answered state", () => {
    it("should show answered badge when question is answered", () => {
      const question = createPendingQuestion({
        answered: true,
        userAnswer: "Option A",
        answeredAt: "2024-01-15T10:31:00Z",
      });
      render(<QuestionCard question={question} />);

      expect(screen.getByText("Answered")).toBeInTheDocument();
    });

    it("should display user answer when answered", () => {
      const question = createPendingQuestion({
        answered: true,
        userAnswer: "My custom answer",
        answeredAt: "2024-01-15T10:31:00Z",
      });
      render(<QuestionCard question={question} />);

      expect(screen.getByText("My custom answer")).toBeInTheDocument();
    });

    it("should show 'Your Answer' label", () => {
      const question = createPendingQuestion({
        answered: true,
        userAnswer: "1",
        answeredAt: "2024-01-15T10:31:00Z",
      });
      render(<QuestionCard question={question} />);

      expect(screen.getByText("Your Answer")).toBeInTheDocument();
    });

    it("should have green styling for answered questions", () => {
      const question = createPendingQuestion({
        answered: true,
        userAnswer: "1",
        answeredAt: "2024-01-15T10:31:00Z",
      });
      const { container } = render(<QuestionCard question={question} />);

      const card = container.querySelector(".border-l-green-500");
      expect(card).toBeInTheDocument();
    });

    it("should not show option buttons when answered", () => {
      const question = createPendingQuestion({
        answered: true,
        userAnswer: "1",
        answeredAt: "2024-01-15T10:31:00Z",
      });
      render(<QuestionCard question={question} />);

      expect(
        screen.queryByRole("button", { name: /1.*Option A/i })
      ).not.toBeInTheDocument();
    });

    it("should not show custom answer input when answered", () => {
      const question = createPendingQuestion({
        answered: true,
        userAnswer: "1",
        answeredAt: "2024-01-15T10:31:00Z",
      });
      render(<QuestionCard question={question} />);

      expect(
        screen.queryByPlaceholderText("Type a custom answer...")
      ).not.toBeInTheDocument();
    });

    it("should show original question text with strikethrough", () => {
      const question = createPendingQuestion({
        answered: true,
        userAnswer: "1",
        answeredAt: "2024-01-15T10:31:00Z",
      });
      const { container } = render(<QuestionCard question={question} />);

      const strikethroughText = container.querySelector(".line-through");
      expect(strikethroughText).toBeInTheDocument();
    });

    it("should display answered timestamp", () => {
      const question = createPendingQuestion({
        answered: true,
        userAnswer: "1",
        answeredAt: "2024-01-15T10:31:00Z",
      });
      render(<QuestionCard question={question} />);

      // Should show at least two timestamps (original and answered)
      const timestamps = screen.getAllByText(/\d{2}:\d{2}:\d{2}/);
      expect(timestamps.length).toBeGreaterThanOrEqual(2);
    });
  });
});
