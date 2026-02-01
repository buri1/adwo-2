/**
 * Delta Detector
 *
 * Extracts only new terminal output (delta) from panes, strips ANSI codes,
 * and normalizes events for downstream processing.
 *
 * Story 1.3: Delta Detection & Event Normalization
 */

import type { TerminalOutputEvent } from "./types";
import type {
  NormalizedTerminalEvent,
  TerminalEventType,
  QuestionMetadata,
} from "@adwo/shared";
import { isQuestionPattern, parseQuestion } from "./question-detector";

/**
 * ANSI escape code regex pattern
 * Matches all ANSI escape sequences including colors, cursor movement, etc.
 */
const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

/**
 * Question detection patterns for Claude/AI prompts
 * Note: AskUserQuestion pattern (☐ ... Enter to select) is handled by QuestionDetector
 */
const QUESTION_PATTERNS = [
  /☐.*Enter to select/s, // Claude AskUserQuestion pattern (highest priority)
  /\?\s*$/m, // Ends with question mark
  /\(y\/n\)/i, // Yes/no prompt
  /\[y\/N\]/i, // Yes/No with default
  /\[Y\/n\]/i, // Yes/no with default
  /press enter/i, // Press enter prompt
  /continue\?/i, // Continue prompt
  /proceed\?/i, // Proceed prompt
  /confirm/i, // Confirmation prompt
];

/**
 * Error detection patterns
 */
const ERROR_PATTERNS = [
  /^error:/im,
  /^fatal:/im,
  /exception:/i,
  /failed:/i,
  /\berror\b.*:/i,
  /panic:/i,
  /traceback/i,
];

/**
 * Status detection patterns (command completion, etc.)
 * These patterns are designed to match standalone status messages
 */
const STATUS_PATTERNS = [
  /^\$\s*$/m, // Empty shell prompt
  /^>\s*$/m, // PowerShell-style prompt
  /\bdone\.?\s*$/im, // "done" or "done." at end of line
  /\bcompleted\s*$/im, // "completed" at end of line (not "completed successfully")
  /\bfinished\s*$/im, // "finished" at end of line
  /^build\s+(?:done|completed|finished)/im, // Build done/completed/finished
];

export interface DeltaDetectorConfig {
  projectId: string;
}

interface PaneState {
  lastContent: string;
  lastLineCount: number;
  lastContentHash: string;
  processedHashes: Set<string>;
}

/**
 * Simple hash function for content deduplication
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `evt_${timestamp}_${random}`;
}

/**
 * Strip ANSI escape codes from text
 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

/**
 * Detect the type of terminal output
 */
export function detectEventType(content: string): TerminalEventType {
  const cleanContent = stripAnsi(content);

  // Check for errors first (highest priority)
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(cleanContent)) {
      return "error";
    }
  }

  // Check for questions
  for (const pattern of QUESTION_PATTERNS) {
    if (pattern.test(cleanContent)) {
      return "question";
    }
  }

  // Check for status messages
  for (const pattern of STATUS_PATTERNS) {
    if (pattern.test(cleanContent)) {
      return "status";
    }
  }

  // Default to output
  return "output";
}

export class DeltaDetector {
  private paneStates: Map<string, PaneState> = new Map();
  private config: DeltaDetectorConfig;

  constructor(config: DeltaDetectorConfig) {
    this.config = config;
  }

  /**
   * Process a terminal output event and extract only new content (delta)
   * Returns normalized events for new content only, or empty array if no new content
   */
  process(event: TerminalOutputEvent): NormalizedTerminalEvent[] {
    const { paneId, content, timestamp } = event;

    // Get or create pane state
    let state = this.paneStates.get(paneId);
    if (!state) {
      state = {
        lastContent: "",
        lastLineCount: 0,
        lastContentHash: "",
        processedHashes: new Set(),
      };
      this.paneStates.set(paneId, state);
    }

    // Strip ANSI codes from content
    const cleanContent = stripAnsi(content);

    // Calculate hash of full content for quick comparison
    const contentHash = simpleHash(cleanContent);

    // If content hash matches last processed, no new content
    if (contentHash === state.lastContentHash) {
      return [];
    }

    // Extract delta (new lines only)
    const delta = this.extractDelta(cleanContent, state);

    // If no delta, update state and return empty
    if (!delta || delta.trim().length === 0) {
      state.lastContent = cleanContent;
      state.lastContentHash = contentHash;
      state.lastLineCount = cleanContent.split("\n").length;
      return [];
    }

    // Check if this exact delta was already processed (deduplication)
    const deltaHash = simpleHash(delta);
    if (state.processedHashes.has(deltaHash)) {
      return [];
    }

    // Add to processed hashes (keep limited history to prevent memory growth)
    state.processedHashes.add(deltaHash);
    if (state.processedHashes.size > 1000) {
      // Remove oldest entries (convert to array, slice, back to set)
      const entries = Array.from(state.processedHashes);
      state.processedHashes = new Set(entries.slice(-500));
    }

    // Update state
    state.lastContent = cleanContent;
    state.lastContentHash = contentHash;
    state.lastLineCount = cleanContent.split("\n").length;

    // Create normalized event(s) from delta
    // Split into logical chunks if multiple event types detected
    const events = this.createNormalizedEvents(paneId, delta, timestamp);

    return events;
  }

  /**
   * Extract only new lines from content compared to previous state
   */
  private extractDelta(content: string, state: PaneState): string {
    const lines = content.split("\n");
    const previousLines = state.lastContent.split("\n");

    // If this is the first content, return all of it
    if (state.lastContent === "") {
      return content;
    }

    // Quick check: if new content is shorter, it might be a clear screen
    if (lines.length < previousLines.length * 0.5) {
      // Likely a screen clear, treat all as new
      return content;
    }

    // Check for streaming output (same line count, content extends previous)
    // This handles cases like "Processing: 50%" -> "Processing: 50%... done!"
    if (lines.length === previousLines.length && lines.length > 0) {
      // Check if all lines except possibly the last are identical
      const allButLastMatch =
        lines.length === 1 ||
        lines.slice(0, -1).join("\n") === previousLines.slice(0, -1).join("\n");

      if (allButLastMatch) {
        const lastNew = lines[lines.length - 1] ?? "";
        const lastOld = previousLines[previousLines.length - 1] ?? "";

        if (lastNew !== lastOld) {
          if (lastNew.startsWith(lastOld)) {
            // Streaming case: new content extends the old
            return lastNew.substring(lastOld.length);
          }
          // Last line was replaced entirely
          return lastNew;
        }
      }
    }

    // Find common prefix (lines that haven't changed)
    let matchIndex = 0;
    const maxCheck = Math.min(previousLines.length, lines.length);
    for (let i = 0; i < maxCheck; i++) {
      if (lines[i] === previousLines[i]) {
        matchIndex = i + 1;
      } else {
        break;
      }
    }

    // If all previous lines match and there are new lines, return new lines
    if (
      matchIndex >= previousLines.length &&
      lines.length > previousLines.length
    ) {
      return lines.slice(previousLines.length).join("\n");
    }

    // If match broke early, return from break point
    if (matchIndex < previousLines.length && matchIndex < lines.length) {
      return lines.slice(matchIndex).join("\n");
    }

    // Fallback: if content is different but we can't find delta, return new lines
    if (lines.length > previousLines.length) {
      return lines.slice(previousLines.length).join("\n");
    }

    // Content changed but fewer/same lines - return last line as delta
    return lines[lines.length - 1] || "";
  }

  /**
   * Create normalized event(s) from delta content
   */
  private createNormalizedEvents(
    paneId: string,
    delta: string,
    timestamp: number
  ): NormalizedTerminalEvent[] {
    const trimmedDelta = delta.trim();
    if (!trimmedDelta) {
      return [];
    }

    const eventType = detectEventType(trimmedDelta);

    const event: NormalizedTerminalEvent = {
      id: generateEventId(),
      pane_id: paneId,
      type: eventType,
      content: trimmedDelta,
      timestamp: new Date(timestamp).toISOString(),
      project_id: this.config.projectId,
    };

    // If this is a question type, try to parse AskUserQuestion metadata
    if (eventType === "question" && isQuestionPattern(trimmedDelta)) {
      const questionMetadata = parseQuestion(trimmedDelta);
      if (questionMetadata) {
        event.question_metadata = questionMetadata;
      }
    }

    return [event];
  }

  /**
   * Clear state for a specific pane
   */
  clearPane(paneId: string): void {
    this.paneStates.delete(paneId);
  }

  /**
   * Clear all pane states
   */
  clearAll(): void {
    this.paneStates.clear();
  }

  /**
   * Get tracked pane IDs
   */
  getTrackedPanes(): string[] {
    return Array.from(this.paneStates.keys());
  }

  /**
   * Update project ID
   */
  setProjectId(projectId: string): void {
    this.config.projectId = projectId;
  }
}
