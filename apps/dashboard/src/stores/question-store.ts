/**
 * ADWO 2.0 Question Store
 * Story 3.2 & 3.3 — Question Display and Answer in Chat UI
 *
 * Manages pending questions from agent events.
 * Questions are tracked by event ID and displayed in chronological order.
 * Supports answering questions and tracking answered state.
 */

import { create } from "zustand";
import type { NormalizedTerminalEvent, QuestionMetadata } from "@adwo/shared";

/**
 * A pending question with its source event information
 */
export interface PendingQuestion {
  id: string;
  paneId: string;
  timestamp: string;
  metadata: QuestionMetadata;
  /** Whether the question has been answered */
  answered?: boolean;
  /** The user's answer text */
  userAnswer?: string;
  /** Timestamp when answered */
  answeredAt?: string;
}

export interface QuestionState {
  /** Pending questions sorted chronologically (oldest first) */
  questions: PendingQuestion[];
}

interface QuestionActions {
  /** Add a question from a question event */
  addQuestion: (event: NormalizedTerminalEvent) => void;
  /** Add multiple questions from events */
  addQuestions: (events: NormalizedTerminalEvent[]) => void;
  /** Mark a question as answered with the user's response */
  answerQuestion: (questionId: string, answer: string) => void;
  /** Remove a question by its ID (e.g., when answered) */
  removeQuestion: (questionId: string) => void;
  /** Remove all questions from a specific pane */
  removeQuestionsForPane: (paneId: string) => void;
  /** Clear all questions */
  clearQuestions: () => void;
  /** Get questions for a specific pane */
  getQuestionsByPane: (paneId: string) => PendingQuestion[];
  /** Check if there are any pending questions */
  hasPendingQuestions: () => boolean;
  /** Get a question by ID */
  getQuestion: (questionId: string) => PendingQuestion | undefined;
}

const initialState: QuestionState = {
  questions: [],
};

export const useQuestionStore = create<QuestionState & QuestionActions>(
  (set, get) => ({
    ...initialState,

    addQuestion: (event: NormalizedTerminalEvent) =>
      set((state) => {
        // Only process question events with metadata
        if (event.type !== "question" || !event.question_metadata) {
          return state;
        }

        // Check for duplicate
        if (state.questions.some((q) => q.id === event.id)) {
          return state;
        }

        const newQuestion: PendingQuestion = {
          id: event.id,
          paneId: event.pane_id,
          timestamp: event.timestamp,
          metadata: event.question_metadata,
        };

        // Insert in chronological order
        const questions = [...state.questions, newQuestion].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        return { questions };
      }),

    addQuestions: (events: NormalizedTerminalEvent[]) =>
      set((state) => {
        // Filter to question events with metadata
        const questionEvents = events.filter(
          (e) => e.type === "question" && e.question_metadata
        );

        if (questionEvents.length === 0) return state;

        // Filter duplicates
        const existingIds = new Set(state.questions.map((q) => q.id));
        const newQuestions: PendingQuestion[] = questionEvents
          .filter((e) => !existingIds.has(e.id))
          .map((e) => ({
            id: e.id,
            paneId: e.pane_id,
            timestamp: e.timestamp,
            metadata: e.question_metadata!,
          }));

        if (newQuestions.length === 0) return state;

        // Merge and sort chronologically
        const questions = [...state.questions, ...newQuestions].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        return { questions };
      }),

    answerQuestion: (questionId: string, answer: string) =>
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === questionId
            ? {
                ...q,
                answered: true,
                userAnswer: answer,
                answeredAt: new Date().toISOString(),
              }
            : q
        ),
      })),

    removeQuestion: (questionId: string) =>
      set((state) => ({
        questions: state.questions.filter((q) => q.id !== questionId),
      })),

    removeQuestionsForPane: (paneId: string) =>
      set((state) => ({
        questions: state.questions.filter((q) => q.paneId !== paneId),
      })),

    clearQuestions: () => set(initialState),

    getQuestionsByPane: (paneId: string) => {
      return get().questions.filter((q) => q.paneId === paneId);
    },

    hasPendingQuestions: () => {
      return get().questions.some((q) => !q.answered);
    },

    getQuestion: (questionId: string) => {
      return get().questions.find((q) => q.id === questionId);
    },
  })
);
