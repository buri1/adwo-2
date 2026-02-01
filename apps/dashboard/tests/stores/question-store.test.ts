/**
 * ADWO 2.0 Question Store Tests
 * Story 3.2 & 3.3 — Question Display and Answer in Chat UI
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useQuestionStore } from "../../src/stores/question-store";
import type { NormalizedTerminalEvent, QuestionMetadata } from "@adwo/shared";

function createQuestionMetadata(
  overrides: Partial<QuestionMetadata> = {}
): QuestionMetadata {
  return {
    header: "Test Header",
    question: "What would you like to do?",
    options: [
      { number: 1, label: "Option A", description: "Description A" },
      { number: 2, label: "Option B", description: "Description B" },
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

function createOutputEvent(
  overrides: Partial<NormalizedTerminalEvent> = {}
): NormalizedTerminalEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    pane_id: "%0",
    type: "output",
    content: "Output content",
    timestamp: new Date().toISOString(),
    project_id: "test-project",
    ...overrides,
  };
}

describe("QuestionStore", () => {
  beforeEach(() => {
    useQuestionStore.getState().clearQuestions();
  });

  describe("initial state", () => {
    it("should start with empty questions", () => {
      const state = useQuestionStore.getState();
      expect(state.questions).toEqual([]);
    });
  });

  describe("addQuestion", () => {
    it("should add a question event", () => {
      const event = createQuestionEvent({ id: "evt_001" });
      useQuestionStore.getState().addQuestion(event);

      const state = useQuestionStore.getState();
      expect(state.questions).toHaveLength(1);
      expect(state.questions[0]!.id).toBe("evt_001");
      expect(state.questions[0]!.metadata.header).toBe("Test Header");
    });

    it("should not add non-question events", () => {
      const event = createOutputEvent({ id: "evt_001" });
      useQuestionStore.getState().addQuestion(event);

      expect(useQuestionStore.getState().questions).toHaveLength(0);
    });

    it("should not add question events without metadata", () => {
      const event = createQuestionEvent({ id: "evt_001" });
      delete event.question_metadata;
      useQuestionStore.getState().addQuestion(event);

      expect(useQuestionStore.getState().questions).toHaveLength(0);
    });

    it("should not add duplicate questions", () => {
      const event = createQuestionEvent({ id: "evt_001" });

      useQuestionStore.getState().addQuestion(event);
      useQuestionStore.getState().addQuestion(event);

      expect(useQuestionStore.getState().questions).toHaveLength(1);
    });

    it("should maintain chronological order", () => {
      const event1 = createQuestionEvent({
        id: "evt_001",
        timestamp: "2024-01-01T10:00:00Z",
      });
      const event2 = createQuestionEvent({
        id: "evt_002",
        timestamp: "2024-01-01T09:00:00Z",
      });

      useQuestionStore.getState().addQuestion(event1);
      useQuestionStore.getState().addQuestion(event2);

      const state = useQuestionStore.getState();
      expect(state.questions[0]!.id).toBe("evt_002"); // Earlier timestamp
      expect(state.questions[1]!.id).toBe("evt_001"); // Later timestamp
    });
  });

  describe("addQuestions", () => {
    it("should add multiple question events", () => {
      const events = [
        createQuestionEvent({ id: "evt_001", timestamp: "2024-01-01T10:00:00Z" }),
        createQuestionEvent({ id: "evt_002", timestamp: "2024-01-01T10:00:01Z" }),
        createQuestionEvent({ id: "evt_003", timestamp: "2024-01-01T10:00:02Z" }),
      ];

      useQuestionStore.getState().addQuestions(events);

      expect(useQuestionStore.getState().questions).toHaveLength(3);
    });

    it("should filter out non-question events", () => {
      const events = [
        createQuestionEvent({ id: "evt_001" }),
        createOutputEvent({ id: "evt_002" }),
        createQuestionEvent({ id: "evt_003" }),
      ];

      useQuestionStore.getState().addQuestions(events);

      expect(useQuestionStore.getState().questions).toHaveLength(2);
    });

    it("should filter out duplicates", () => {
      const event = createQuestionEvent({ id: "evt_001" });
      useQuestionStore.getState().addQuestion(event);

      useQuestionStore.getState().addQuestions([
        event,
        createQuestionEvent({ id: "evt_002" }),
      ]);

      expect(useQuestionStore.getState().questions).toHaveLength(2);
    });

    it("should handle empty array", () => {
      useQuestionStore.getState().addQuestions([]);
      expect(useQuestionStore.getState().questions).toHaveLength(0);
    });

    it("should sort by timestamp", () => {
      const events = [
        createQuestionEvent({ id: "evt_002", timestamp: "2024-01-01T10:00:02Z" }),
        createQuestionEvent({ id: "evt_001", timestamp: "2024-01-01T10:00:00Z" }),
        createQuestionEvent({ id: "evt_003", timestamp: "2024-01-01T10:00:05Z" }),
      ];

      useQuestionStore.getState().addQuestions(events);

      const state = useQuestionStore.getState();
      expect(state.questions[0]!.id).toBe("evt_001");
      expect(state.questions[1]!.id).toBe("evt_002");
      expect(state.questions[2]!.id).toBe("evt_003");
    });
  });

  describe("removeQuestion", () => {
    it("should remove a question by ID", () => {
      const events = [
        createQuestionEvent({ id: "evt_001" }),
        createQuestionEvent({ id: "evt_002" }),
        createQuestionEvent({ id: "evt_003" }),
      ];

      useQuestionStore.getState().addQuestions(events);
      useQuestionStore.getState().removeQuestion("evt_002");

      const state = useQuestionStore.getState();
      expect(state.questions).toHaveLength(2);
      expect(state.questions.some((q) => q.id === "evt_002")).toBe(false);
    });

    it("should handle non-existent ID gracefully", () => {
      const event = createQuestionEvent({ id: "evt_001" });
      useQuestionStore.getState().addQuestion(event);

      useQuestionStore.getState().removeQuestion("non_existent");

      expect(useQuestionStore.getState().questions).toHaveLength(1);
    });
  });

  describe("removeQuestionsForPane", () => {
    it("should remove all questions from a specific pane", () => {
      const events = [
        createQuestionEvent({ id: "evt_001", pane_id: "%0" }),
        createQuestionEvent({ id: "evt_002", pane_id: "%1" }),
        createQuestionEvent({ id: "evt_003", pane_id: "%0" }),
      ];

      useQuestionStore.getState().addQuestions(events);
      useQuestionStore.getState().removeQuestionsForPane("%0");

      const state = useQuestionStore.getState();
      expect(state.questions).toHaveLength(1);
      expect(state.questions[0]!.paneId).toBe("%1");
    });
  });

  describe("clearQuestions", () => {
    it("should clear all questions", () => {
      const events = [
        createQuestionEvent({ id: "evt_001" }),
        createQuestionEvent({ id: "evt_002" }),
      ];

      useQuestionStore.getState().addQuestions(events);
      useQuestionStore.getState().clearQuestions();

      expect(useQuestionStore.getState().questions).toEqual([]);
    });
  });

  describe("getQuestionsByPane", () => {
    it("should filter questions by pane ID", () => {
      const events = [
        createQuestionEvent({ id: "evt_001", pane_id: "%0" }),
        createQuestionEvent({ id: "evt_002", pane_id: "%1" }),
        createQuestionEvent({ id: "evt_003", pane_id: "%0" }),
      ];

      useQuestionStore.getState().addQuestions(events);

      const pane0Questions = useQuestionStore.getState().getQuestionsByPane("%0");
      expect(pane0Questions).toHaveLength(2);

      const pane1Questions = useQuestionStore.getState().getQuestionsByPane("%1");
      expect(pane1Questions).toHaveLength(1);

      const pane2Questions = useQuestionStore.getState().getQuestionsByPane("%2");
      expect(pane2Questions).toHaveLength(0);
    });
  });

  describe("hasPendingQuestions", () => {
    it("should return false when no questions", () => {
      expect(useQuestionStore.getState().hasPendingQuestions()).toBe(false);
    });

    it("should return true when unanswered questions exist", () => {
      useQuestionStore.getState().addQuestion(createQuestionEvent());
      expect(useQuestionStore.getState().hasPendingQuestions()).toBe(true);
    });

    it("should return false when all questions are answered", () => {
      const event = createQuestionEvent({ id: "evt_001" });
      useQuestionStore.getState().addQuestion(event);
      useQuestionStore.getState().answerQuestion("evt_001", "1");
      expect(useQuestionStore.getState().hasPendingQuestions()).toBe(false);
    });
  });

  describe("answerQuestion", () => {
    it("should mark question as answered with user answer", () => {
      const event = createQuestionEvent({ id: "evt_001" });
      useQuestionStore.getState().addQuestion(event);

      useQuestionStore.getState().answerQuestion("evt_001", "Option A");

      const state = useQuestionStore.getState();
      const question = state.questions.find((q) => q.id === "evt_001");
      expect(question?.answered).toBe(true);
      expect(question?.userAnswer).toBe("Option A");
      expect(question?.answeredAt).toBeDefined();
    });

    it("should set answeredAt timestamp", () => {
      const event = createQuestionEvent({ id: "evt_001" });
      useQuestionStore.getState().addQuestion(event);

      const beforeAnswer = new Date().toISOString();
      useQuestionStore.getState().answerQuestion("evt_001", "1");
      const afterAnswer = new Date().toISOString();

      const question = useQuestionStore.getState().questions.find((q) => q.id === "evt_001");
      expect(question?.answeredAt).toBeDefined();
      expect(new Date(question!.answeredAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeAnswer).getTime()
      );
      expect(new Date(question!.answeredAt!).getTime()).toBeLessThanOrEqual(
        new Date(afterAnswer).getTime()
      );
    });

    it("should not affect other questions", () => {
      const events = [
        createQuestionEvent({ id: "evt_001" }),
        createQuestionEvent({ id: "evt_002" }),
      ];
      useQuestionStore.getState().addQuestions(events);

      useQuestionStore.getState().answerQuestion("evt_001", "Yes");

      const state = useQuestionStore.getState();
      expect(state.questions.find((q) => q.id === "evt_001")?.answered).toBe(true);
      expect(state.questions.find((q) => q.id === "evt_002")?.answered).toBeUndefined();
    });

    it("should handle answering non-existent question gracefully", () => {
      const event = createQuestionEvent({ id: "evt_001" });
      useQuestionStore.getState().addQuestion(event);

      // Should not throw
      useQuestionStore.getState().answerQuestion("non_existent", "answer");

      expect(useQuestionStore.getState().questions).toHaveLength(1);
    });

    it("should store custom text answers", () => {
      const event = createQuestionEvent({ id: "evt_001" });
      useQuestionStore.getState().addQuestion(event);

      useQuestionStore.getState().answerQuestion("evt_001", "This is a custom long answer");

      const question = useQuestionStore.getState().questions.find((q) => q.id === "evt_001");
      expect(question?.userAnswer).toBe("This is a custom long answer");
    });
  });

  describe("getQuestion", () => {
    it("should return a question by ID", () => {
      const event = createQuestionEvent({ id: "evt_001" });
      useQuestionStore.getState().addQuestion(event);

      const question = useQuestionStore.getState().getQuestion("evt_001");

      expect(question).toBeDefined();
      expect(question?.id).toBe("evt_001");
      expect(question?.metadata.header).toBe("Test Header");
    });

    it("should return undefined for non-existent ID", () => {
      const event = createQuestionEvent({ id: "evt_001" });
      useQuestionStore.getState().addQuestion(event);

      const question = useQuestionStore.getState().getQuestion("non_existent");

      expect(question).toBeUndefined();
    });

    it("should return question with answered state", () => {
      const event = createQuestionEvent({ id: "evt_001" });
      useQuestionStore.getState().addQuestion(event);
      useQuestionStore.getState().answerQuestion("evt_001", "My answer");

      const question = useQuestionStore.getState().getQuestion("evt_001");

      expect(question?.answered).toBe(true);
      expect(question?.userAnswer).toBe("My answer");
    });
  });
});
