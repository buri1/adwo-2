/**
 * JSONL File Reader
 * Watches and reads JSONL files from Claude Code's --output-format stream-json
 *
 * Features:
 * - File system watching with chokidar
 * - Incremental reading (only new lines)
 * - NDJSON parsing (one JSON object per line)
 * - Graceful handling of partial writes
 */

import { watch, type FSWatcher } from "chokidar";
import { open, stat } from "fs/promises";
import type { FileHandle } from "fs/promises";
import type {
  StreamJsonEvent,
  NormalizedStreamEvent,
} from "@adwo/shared";

export interface JsonlFileReaderConfig {
  /** Directory to watch for JSONL files */
  watchDir: string;
  /** File pattern to match (default: events-*.jsonl) */
  filePattern?: string;
  /** Debounce interval for file changes in ms */
  debounceMs?: number;
}

export type StreamEventHandler = (event: NormalizedStreamEvent) => void;
export type FileErrorHandler = (filePath: string, error: Error) => void;
export type FileAddedHandler = (filePath: string, paneId: string) => void;

interface TrackedFile {
  path: string;
  paneId: string;
  position: number;
  handle: FileHandle | null;
  sessionId: string | null;
  model: string | null;
}

/**
 * Extract pane ID from file path
 * Expected format: /tmp/events-{pane_id}.jsonl
 */
function extractPaneId(filePath: string): string {
  const match = filePath.match(/events-([^.]+)\.jsonl$/);
  return match?.[1] ?? filePath;
}

/**
 * Parse a single line of JSONL
 */
function parseJsonLine(line: string): StreamJsonEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as StreamJsonEvent;
  } catch (e) {
    // Partial write or malformed JSON
    console.warn("[JsonlFileReader] Failed to parse JSON line:", trimmed.slice(0, 100));
    return null;
  }
}

/**
 * Normalize a stream-json event for dashboard display
 */
function normalizeEvent(
  event: StreamJsonEvent,
  paneId: string,
  sessionId: string | null
): NormalizedStreamEvent | null {
  const baseEvent = {
    id: (event as { uuid?: string }).uuid || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    session_id: (event as { session_id?: string }).session_id || sessionId || "unknown",
    pane_id: paneId,
    timestamp: new Date().toISOString(),
    original_type: event.type,
  };

  // System events
  if (event.type === "system") {
    const sysEvent = event as { subtype?: string; hook_name?: string; output?: string; model?: string; tools?: string[] };

    if (sysEvent.subtype === "init") {
      return {
        ...baseEvent,
        category: "system",
        content: `Session initialized with model ${sysEvent.model}`,
        model: sysEvent.model,
      };
    }

    if (sysEvent.subtype === "hook_started" || sysEvent.subtype === "hook_response") {
      return {
        ...baseEvent,
        category: "hook",
        content: sysEvent.hook_name || "Hook event",
      };
    }

    return null;
  }

  // Stream events
  if (event.type === "stream_event") {
    const streamEvent = event as { event?: { type?: string; content_block?: { type?: string; name?: string }; delta?: { type?: string; text?: string } } };
    const innerEvent = streamEvent.event;

    if (!innerEvent) return null;

    // Tool use start
    if (innerEvent.type === "content_block_start" && innerEvent.content_block?.type === "tool_use") {
      return {
        ...baseEvent,
        category: "tool",
        content: `Tool: ${innerEvent.content_block.name}`,
        tool: {
          name: innerEvent.content_block.name || "unknown",
          status: "started",
        },
      };
    }

    // Text delta
    if (innerEvent.type === "content_block_delta" && innerEvent.delta?.type === "text_delta") {
      return {
        ...baseEvent,
        category: "text",
        content: innerEvent.delta.text || "",
      };
    }

    // Skip other stream events (message_start, etc.)
    return null;
  }

  // Result event
  if (event.type === "result") {
    const resultEvent = event as {
      total_cost_usd?: number;
      usage?: { input_tokens?: number; output_tokens?: number };
      duration_ms?: number;
      result?: string;
    };

    return {
      ...baseEvent,
      category: "result",
      content: resultEvent.result || "Task completed",
      cost: {
        total_usd: resultEvent.total_cost_usd || 0,
        input_tokens: resultEvent.usage?.input_tokens || 0,
        output_tokens: resultEvent.usage?.output_tokens || 0,
        duration_ms: resultEvent.duration_ms || 0,
      },
    };
  }

  // Assistant message
  if (event.type === "assistant") {
    const assistantEvent = event as { message?: { content?: Array<{ type?: string; text?: string }> } };
    const textContent = assistantEvent.message?.content?.find(c => c.type === "text");
    if (textContent?.text) {
      return {
        ...baseEvent,
        category: "text",
        content: textContent.text,
      };
    }
  }

  return null;
}

export class JsonlFileReader {
  private config: Required<JsonlFileReaderConfig>;
  private watcher: FSWatcher | null = null;
  private files: Map<string, TrackedFile> = new Map();
  private handlers: {
    event: StreamEventHandler[];
    error: FileErrorHandler[];
    fileAdded: FileAddedHandler[];
  } = {
    event: [],
    error: [],
    fileAdded: [],
  };

  constructor(config: JsonlFileReaderConfig) {
    this.config = {
      watchDir: config.watchDir,
      filePattern: config.filePattern || "events-*.jsonl",
      debounceMs: config.debounceMs || 100,
    };
  }

  /**
   * Register event handler
   */
  onEvent(handler: StreamEventHandler): void {
    this.handlers.event.push(handler);
  }

  /**
   * Register error handler
   */
  onError(handler: FileErrorHandler): void {
    this.handlers.error.push(handler);
  }

  /**
   * Register file added handler
   */
  onFileAdded(handler: FileAddedHandler): void {
    this.handlers.fileAdded.push(handler);
  }

  /**
   * Start watching for JSONL files
   */
  async start(): Promise<void> {
    const watchPattern = `${this.config.watchDir}/${this.config.filePattern}`;
    console.log(`[JsonlFileReader] Watching: ${watchPattern}`);

    this.watcher = watch(watchPattern, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: this.config.debounceMs,
        pollInterval: 50,
      },
    });

    this.watcher.on("add", (filePath) => this.handleFileAdded(filePath));
    this.watcher.on("change", (filePath) => this.handleFileChanged(filePath));
    this.watcher.on("unlink", (filePath) => this.handleFileRemoved(filePath));
    this.watcher.on("error", (error) => {
      console.error("[JsonlFileReader] Watcher error:", error);
    });
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    // Close all file handles
    for (const [, file] of this.files) {
      if (file.handle) {
        await file.handle.close();
      }
    }
    this.files.clear();

    console.log("[JsonlFileReader] Stopped");
  }

  /**
   * Handle new file detected
   */
  private async handleFileAdded(filePath: string): Promise<void> {
    const paneId = extractPaneId(filePath);
    console.log(`[JsonlFileReader] File added: ${filePath} (pane: ${paneId})`);

    this.files.set(filePath, {
      path: filePath,
      paneId,
      position: 0,
      handle: null,
      sessionId: null,
      model: null,
    });

    // Notify handlers
    for (const handler of this.handlers.fileAdded) {
      handler(filePath, paneId);
    }

    // Read existing content
    await this.readNewContent(filePath);
  }

  /**
   * Handle file content changed
   */
  private async handleFileChanged(filePath: string): Promise<void> {
    await this.readNewContent(filePath);
  }

  /**
   * Handle file removed
   */
  private async handleFileRemoved(filePath: string): Promise<void> {
    const file = this.files.get(filePath);
    if (file?.handle) {
      await file.handle.close();
    }
    this.files.delete(filePath);
    console.log(`[JsonlFileReader] File removed: ${filePath}`);
  }

  /**
   * Read new content from file
   */
  private async readNewContent(filePath: string): Promise<void> {
    const file = this.files.get(filePath);
    if (!file) {
      console.warn(`[JsonlFileReader] Unknown file: ${filePath}`);
      return;
    }

    try {
      // Get file size
      const stats = await stat(filePath);
      if (stats.size <= file.position) {
        return; // No new content
      }

      // Open file if needed
      if (!file.handle) {
        file.handle = await open(filePath, "r");
      }

      // Read new content
      const buffer = Buffer.alloc(stats.size - file.position);
      const { bytesRead } = await file.handle.read(buffer, 0, buffer.length, file.position);

      if (bytesRead > 0) {
        file.position += bytesRead;
        const content = buffer.toString("utf-8", 0, bytesRead);

        // Process each line
        const lines = content.split("\n");
        for (const line of lines) {
          const event = parseJsonLine(line);
          if (event) {
            // Extract session info from init event
            if (event.type === "system" && (event as { subtype?: string }).subtype === "init") {
              const initEvent = event as { session_id?: string; model?: string };
              file.sessionId = initEvent.session_id || null;
              file.model = initEvent.model || null;
            }

            // Normalize and emit
            const normalized = normalizeEvent(event, file.paneId, file.sessionId);
            if (normalized) {
              for (const handler of this.handlers.event) {
                handler(normalized);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`[JsonlFileReader] Error reading ${filePath}:`, error);
      for (const handler of this.handlers.error) {
        handler(filePath, error as Error);
      }
    }
  }

  /**
   * Get all tracked files
   */
  getTrackedFiles(): Array<{ path: string; paneId: string; sessionId: string | null }> {
    return Array.from(this.files.values()).map((f) => ({
      path: f.path,
      paneId: f.paneId,
      sessionId: f.sessionId,
    }));
  }

  /**
   * Manually add a file to track (for testing or explicit registration)
   */
  async addFile(filePath: string): Promise<void> {
    if (!this.files.has(filePath)) {
      await this.handleFileAdded(filePath);
    }
  }
}
