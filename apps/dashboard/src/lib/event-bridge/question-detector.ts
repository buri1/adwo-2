/**
 * Question Detector
 *
 * Detects and parses Claude's AskUserQuestion pattern from terminal output.
 * Extracts header, question text, and options for dashboard display.
 *
 * Story 3.1: Question Detection in Terminal Output
 *
 * Pattern format:
 * ```
 * ─────────────────────────────────────────────────
 *  ☐ Header
 *
 * Question text here?
 *
 * ❯ 1. Option A
 *      Description of option A
 *   2. Option B
 *      Description of option B
 * ─────────────────────────────────────────────────
 *
 * Enter to select · ↑/↓ to navigate · Esc to cancel
 * ```
 */

import type { QuestionMetadata, QuestionOption } from "@adwo/shared";

/**
 * Main pattern to detect AskUserQuestion blocks
 * Matches: ☐ header ... numbered options ... Enter to select
 */
const QUESTION_BLOCK_PATTERN =
  /☐\s*([^\n]+)[\s\S]*?(\d+\.\s+[^\n]+(?:\n(?:\s+[^\n]+|\s*\d+\.\s+[^\n]+))*)[\s\S]*?Enter to select/;

/**
 * Pattern to extract individual options
 * Matches: "1. Label" optionally followed by indented description lines
 */
const OPTION_PATTERN = /^\s*(\d+)\.\s+(.+?)$/gm;

/**
 * Pattern to detect if content might be a question (quick check)
 * Used for fast filtering before full parse
 */
const QUICK_QUESTION_CHECK = /☐.*Enter to select/s;

/**
 * Pattern to extract the question text (line ending with ?)
 */
const QUESTION_TEXT_PATTERN = /^([^\n]*\?)\s*$/m;

/**
 * Detect if content contains an AskUserQuestion pattern
 */
export function isQuestionPattern(content: string): boolean {
  return QUICK_QUESTION_CHECK.test(content);
}

/**
 * Parse question content to extract metadata
 * Returns null if content doesn't match the AskUserQuestion pattern
 */
export function parseQuestion(content: string): QuestionMetadata | null {
  // Quick check first
  if (!isQuestionPattern(content)) {
    return null;
  }

  // Try to match the full question block
  const blockMatch = QUESTION_BLOCK_PATTERN.exec(content);
  if (!blockMatch) {
    return null;
  }

  // Extract header (text after ☐)
  const header = blockMatch[1]?.trim() ?? "";

  // Extract options section
  const optionsSection = blockMatch[2] ?? "";

  // Find question text (line ending with ?)
  const questionMatch = QUESTION_TEXT_PATTERN.exec(content);
  const question = questionMatch?.[1]?.trim() ?? "";

  // Parse individual options
  const options = parseOptions(optionsSection);

  // Validate we have the minimum required components
  if (!header || options.length === 0) {
    return null;
  }

  return {
    header,
    question,
    options,
  };
}

/**
 * Parse options section to extract individual options
 */
function parseOptions(optionsSection: string): QuestionOption[] {
  const options: QuestionOption[] = [];
  const lines = optionsSection.split("\n");

  let currentOption: QuestionOption | null = null;

  for (const line of lines) {
    // Check if this line starts a new option (number followed by dot)
    const optionMatch = /^\s*(?:❯\s*)?(\d+)\.\s+(.+)$/.exec(line);

    if (optionMatch) {
      // Save previous option if exists
      if (currentOption) {
        options.push(currentOption);
      }

      // Start new option
      currentOption = {
        number: parseInt(optionMatch[1]!, 10),
        label: optionMatch[2]!.trim(),
      };
    } else if (currentOption && line.trim()) {
      // This is a description line for the current option
      const trimmedLine = line.trim();
      // Skip separator lines (just dashes)
      if (!/^─+$/.test(trimmedLine)) {
        if (currentOption.description) {
          currentOption.description += " " + trimmedLine;
        } else {
          currentOption.description = trimmedLine;
        }
      }
    }
  }

  // Don't forget the last option
  if (currentOption) {
    options.push(currentOption);
  }

  return options;
}

/**
 * Question Detector class for managing detection state
 * Tracks pending questions per pane
 */
export class QuestionDetector {
  private pendingQuestions: Map<string, QuestionMetadata> = new Map();

  /**
   * Process content and detect questions
   * Returns question metadata if detected, null otherwise
   */
  detect(paneId: string, content: string): QuestionMetadata | null {
    const metadata = parseQuestion(content);

    if (metadata) {
      // Track as pending question for this pane
      this.pendingQuestions.set(paneId, metadata);
    }

    return metadata;
  }

  /**
   * Get pending question for a pane
   */
  getPendingQuestion(paneId: string): QuestionMetadata | undefined {
    return this.pendingQuestions.get(paneId);
  }

  /**
   * Get all pending questions
   */
  getAllPendingQuestions(): Map<string, QuestionMetadata> {
    return new Map(this.pendingQuestions);
  }

  /**
   * Get pane IDs with pending questions
   */
  getPanesWithQuestions(): string[] {
    return Array.from(this.pendingQuestions.keys());
  }

  /**
   * Mark a question as answered/resolved
   */
  clearQuestion(paneId: string): void {
    this.pendingQuestions.delete(paneId);
  }

  /**
   * Clear all pending questions
   */
  clearAll(): void {
    this.pendingQuestions.clear();
  }

  /**
   * Check if a pane has a pending question
   */
  hasPendingQuestion(paneId: string): boolean {
    return this.pendingQuestions.has(paneId);
  }

  /**
   * Get count of pending questions
   */
  getPendingCount(): number {
    return this.pendingQuestions.size;
  }
}

// Singleton instance
let questionDetectorInstance: QuestionDetector | null = null;

/**
 * Get or create the QuestionDetector singleton
 */
export function getQuestionDetector(): QuestionDetector {
  if (!questionDetectorInstance) {
    questionDetectorInstance = new QuestionDetector();
  }
  return questionDetectorInstance;
}

/**
 * Reset the QuestionDetector singleton (for testing)
 */
export function resetQuestionDetector(): void {
  if (questionDetectorInstance) {
    questionDetectorInstance.clearAll();
    questionDetectorInstance = null;
  }
}
