/**
 * Question Detector Tests
 *
 * Tests for Story 3.1: Question Detection in Terminal Output
 * - AskUserQuestion pattern detection
 * - Metadata extraction (header, question, options)
 * - Multi-pane question tracking
 * - Non-matching output handling
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  QuestionDetector,
  isQuestionPattern,
  parseQuestion,
  getQuestionDetector,
  resetQuestionDetector,
} from "../../src/lib/event-bridge/question-detector";

// Sample Claude AskUserQuestion output
const SAMPLE_QUESTION_OUTPUT = `─────────────────────────────────────────────────
 ☐ Auth method

Which authentication method should we use?

❯ 1. OAuth 2.0
     Industry standard, supports social login
  2. JWT
     Simple, stateless authentication
  3. Session-based
     Traditional server-side sessions
  4. Type something.
─────────────────────────────────────────────────

Enter to select · ↑/↓ to navigate · Esc to cancel`;

const SAMPLE_QUESTION_MINIMAL = `☐ Choose option

Select one:

1. Option A
2. Option B

Enter to select`;

const SAMPLE_NON_QUESTION_OUTPUT = `Running npm install...
Installing dependencies...
Done.`;

const SAMPLE_QUESTION_MARK_ONLY = `Do you want to continue?`;

describe("QuestionDetector", () => {
  let detector: QuestionDetector;

  beforeEach(() => {
    detector = new QuestionDetector();
  });

  describe("AC1: Terminal output checked for AskUserQuestion pattern", () => {
    it("should detect full AskUserQuestion pattern", () => {
      expect(isQuestionPattern(SAMPLE_QUESTION_OUTPUT)).toBe(true);
    });

    it("should detect minimal AskUserQuestion pattern", () => {
      expect(isQuestionPattern(SAMPLE_QUESTION_MINIMAL)).toBe(true);
    });

    it("should not detect regular output as question pattern", () => {
      expect(isQuestionPattern(SAMPLE_NON_QUESTION_OUTPUT)).toBe(false);
    });

    it("should not detect simple question mark as AskUserQuestion pattern", () => {
      // Simple questions should not be detected as AskUserQuestion
      expect(isQuestionPattern(SAMPLE_QUESTION_MARK_ONLY)).toBe(false);
    });

    it("should require both ☐ header and Enter to select footer", () => {
      expect(isQuestionPattern("☐ Header only")).toBe(false);
      expect(isQuestionPattern("Enter to select only")).toBe(false);
    });
  });

  describe("AC2: Question metadata extraction", () => {
    it("should extract header from full question", () => {
      const metadata = parseQuestion(SAMPLE_QUESTION_OUTPUT);
      expect(metadata).not.toBeNull();
      expect(metadata!.header).toBe("Auth method");
    });

    it("should extract question text", () => {
      const metadata = parseQuestion(SAMPLE_QUESTION_OUTPUT);
      expect(metadata).not.toBeNull();
      expect(metadata!.question).toBe(
        "Which authentication method should we use?"
      );
    });

    it("should extract all options with numbers and labels", () => {
      const metadata = parseQuestion(SAMPLE_QUESTION_OUTPUT);
      expect(metadata).not.toBeNull();
      expect(metadata!.options).toHaveLength(4);

      expect(metadata!.options[0]).toMatchObject({
        number: 1,
        label: "OAuth 2.0",
      });
      expect(metadata!.options[1]).toMatchObject({
        number: 2,
        label: "JWT",
      });
      expect(metadata!.options[2]).toMatchObject({
        number: 3,
        label: "Session-based",
      });
      expect(metadata!.options[3]).toMatchObject({
        number: 4,
        label: "Type something.",
      });
    });

    it("should extract option descriptions when present", () => {
      const metadata = parseQuestion(SAMPLE_QUESTION_OUTPUT);
      expect(metadata).not.toBeNull();

      expect(metadata!.options[0]!.description).toBe(
        "Industry standard, supports social login"
      );
      expect(metadata!.options[1]!.description).toBe(
        "Simple, stateless authentication"
      );
      expect(metadata!.options[2]!.description).toBe(
        "Traditional server-side sessions"
      );
      // Option 4 has no description
      expect(metadata!.options[3]!.description).toBeUndefined();
    });

    it("should handle minimal question format", () => {
      const metadata = parseQuestion(SAMPLE_QUESTION_MINIMAL);
      expect(metadata).not.toBeNull();
      expect(metadata!.header).toBe("Choose option");
      expect(metadata!.options).toHaveLength(2);
      expect(metadata!.options[0]!.label).toBe("Option A");
      expect(metadata!.options[1]!.label).toBe("Option B");
    });

    it("should return null for non-question content", () => {
      const metadata = parseQuestion(SAMPLE_NON_QUESTION_OUTPUT);
      expect(metadata).toBeNull();
    });

    it("should return null for partial patterns", () => {
      expect(parseQuestion("☐ Header only")).toBeNull();
      expect(parseQuestion("Enter to select only")).toBeNull();
    });
  });

  describe("AC3: Multiple panes with pending questions tracked separately", () => {
    it("should track questions for different panes", () => {
      detector.detect("pane-1", SAMPLE_QUESTION_OUTPUT);
      detector.detect("pane-2", SAMPLE_QUESTION_MINIMAL);

      expect(detector.getPanesWithQuestions()).toHaveLength(2);
      expect(detector.getPanesWithQuestions()).toContain("pane-1");
      expect(detector.getPanesWithQuestions()).toContain("pane-2");
    });

    it("should return correct question for each pane", () => {
      detector.detect("pane-1", SAMPLE_QUESTION_OUTPUT);
      detector.detect("pane-2", SAMPLE_QUESTION_MINIMAL);

      const q1 = detector.getPendingQuestion("pane-1");
      const q2 = detector.getPendingQuestion("pane-2");

      expect(q1!.header).toBe("Auth method");
      expect(q2!.header).toBe("Choose option");
    });

    it("should clear question for specific pane only", () => {
      detector.detect("pane-1", SAMPLE_QUESTION_OUTPUT);
      detector.detect("pane-2", SAMPLE_QUESTION_MINIMAL);

      detector.clearQuestion("pane-1");

      expect(detector.hasPendingQuestion("pane-1")).toBe(false);
      expect(detector.hasPendingQuestion("pane-2")).toBe(true);
    });

    it("should get all pending questions", () => {
      detector.detect("pane-1", SAMPLE_QUESTION_OUTPUT);
      detector.detect("pane-2", SAMPLE_QUESTION_MINIMAL);

      const allQuestions = detector.getAllPendingQuestions();

      expect(allQuestions.size).toBe(2);
      expect(allQuestions.get("pane-1")!.header).toBe("Auth method");
      expect(allQuestions.get("pane-2")!.header).toBe("Choose option");
    });

    it("should return pending count", () => {
      expect(detector.getPendingCount()).toBe(0);

      detector.detect("pane-1", SAMPLE_QUESTION_OUTPUT);
      expect(detector.getPendingCount()).toBe(1);

      detector.detect("pane-2", SAMPLE_QUESTION_MINIMAL);
      expect(detector.getPendingCount()).toBe(2);

      detector.clearQuestion("pane-1");
      expect(detector.getPendingCount()).toBe(1);
    });

    it("should replace question when new one detected for same pane", () => {
      detector.detect("pane-1", SAMPLE_QUESTION_OUTPUT);
      detector.detect("pane-1", SAMPLE_QUESTION_MINIMAL);

      expect(detector.getPendingCount()).toBe(1);
      expect(detector.getPendingQuestion("pane-1")!.header).toBe(
        "Choose option"
      );
    });
  });

  describe("AC4: Non-matching output classified as output type", () => {
    it("should return null for non-question content", () => {
      const result = detector.detect("pane-1", SAMPLE_NON_QUESTION_OUTPUT);
      expect(result).toBeNull();
    });

    it("should not track non-question content", () => {
      detector.detect("pane-1", SAMPLE_NON_QUESTION_OUTPUT);
      expect(detector.hasPendingQuestion("pane-1")).toBe(false);
      expect(detector.getPendingCount()).toBe(0);
    });

    it("should return question metadata when detected", () => {
      const result = detector.detect("pane-1", SAMPLE_QUESTION_OUTPUT);
      expect(result).not.toBeNull();
      expect(result!.header).toBe("Auth method");
    });
  });

  describe("Edge cases", () => {
    it("should handle question with no question text line", () => {
      const noQuestionText = `☐ Select

1. First
2. Second

Enter to select`;
      const metadata = parseQuestion(noQuestionText);
      expect(metadata).not.toBeNull();
      expect(metadata!.header).toBe("Select");
      expect(metadata!.question).toBe(""); // No question text found
      expect(metadata!.options).toHaveLength(2);
    });

    it("should handle ANSI codes in content", () => {
      // Note: ANSI codes should be stripped before question detection
      const withAnsi = `\x1b[32m☐ Test\x1b[0m

Question?

1. Option

Enter to select`;
      // With ANSI codes, pattern might not match - this is expected
      // The DeltaDetector strips ANSI codes before passing to QuestionDetector
      expect(isQuestionPattern(withAnsi)).toBe(true);
    });

    it("should handle multiline option descriptions", () => {
      const multilineDesc = `☐ Complex

Choose:

1. First option
   This is a long description
   that spans multiple lines
2. Second option

Enter to select`;
      const metadata = parseQuestion(multilineDesc);
      expect(metadata).not.toBeNull();
      expect(metadata!.options).toHaveLength(2);
      expect(metadata!.options[0]!.description).toContain(
        "This is a long description"
      );
    });

    it("should handle options with special characters", () => {
      const special = `☐ Special chars

Select:

1. Option with "quotes"
2. Option with (parentheses)
3. Option with [brackets]

Enter to select`;
      const metadata = parseQuestion(special);
      expect(metadata).not.toBeNull();
      expect(metadata!.options).toHaveLength(3);
      expect(metadata!.options[0]!.label).toBe('Option with "quotes"');
    });

    it("should handle the ❯ selector marker on options", () => {
      const withSelector = `☐ Header

Question?

❯ 1. Selected option
  2. Other option

Enter to select`;
      const metadata = parseQuestion(withSelector);
      expect(metadata).not.toBeNull();
      expect(metadata!.options).toHaveLength(2);
      expect(metadata!.options[0]!.label).toBe("Selected option");
    });

    it("should clear all questions", () => {
      detector.detect("pane-1", SAMPLE_QUESTION_OUTPUT);
      detector.detect("pane-2", SAMPLE_QUESTION_MINIMAL);

      detector.clearAll();

      expect(detector.getPendingCount()).toBe(0);
      expect(detector.getPanesWithQuestions()).toHaveLength(0);
    });
  });
});

describe("Singleton functions", () => {
  beforeEach(() => {
    resetQuestionDetector();
  });

  it("should return same instance", () => {
    const d1 = getQuestionDetector();
    const d2 = getQuestionDetector();
    expect(d1).toBe(d2);
  });

  it("should reset instance", () => {
    const d1 = getQuestionDetector();
    d1.detect("pane-1", SAMPLE_QUESTION_OUTPUT);

    resetQuestionDetector();

    const d2 = getQuestionDetector();
    expect(d2.getPendingCount()).toBe(0);
  });
});

describe("Integration with DeltaDetector patterns", () => {
  it("should handle content that matches both simple question and AskUserQuestion", () => {
    // This content has a question mark AND the AskUserQuestion pattern
    // The AskUserQuestion pattern should take precedence
    const metadata = parseQuestion(SAMPLE_QUESTION_OUTPUT);
    expect(metadata).not.toBeNull();
    // Should extract the full question, not just detect the question mark
    expect(metadata!.options.length).toBeGreaterThan(0);
  });
});
