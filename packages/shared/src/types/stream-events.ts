/**
 * ADWO 2.0 Stream-JSON Event Types
 * Types for Claude Code's --output-format stream-json events
 */

/**
 * Top-level event types from stream-json output
 */
export type StreamEventType =
  | "system"
  | "stream_event"
  | "assistant"
  | "user"
  | "result";

/**
 * System event subtypes
 */
export type SystemSubtype = "init" | "hook_started" | "hook_response";

/**
 * Stream event subtypes (nested in event.type)
 */
export type StreamSubtype =
  | "message_start"
  | "content_block_start"
  | "content_block_delta"
  | "content_block_stop"
  | "message_delta"
  | "message_stop";

/**
 * Content block types
 */
export type ContentBlockType = "text" | "tool_use" | "tool_result";

/**
 * Delta types for streaming content
 */
export type DeltaType = "text_delta" | "input_json_delta";

/**
 * System init event - first event in a session
 */
export interface SystemInitEvent {
  type: "system";
  subtype: "init";
  session_id: string;
  cwd: string;
  model: string;
  tools: string[];
  mcp_servers?: Array<{ name: string; status: string }>;
  permissionMode: string;
  agents?: string[];
  uuid: string;
}

/**
 * System hook event
 */
export interface SystemHookEvent {
  type: "system";
  subtype: "hook_started" | "hook_response";
  hook_id: string;
  hook_name: string;
  hook_event: string;
  output?: string;
  exit_code?: number;
  outcome?: string;
  uuid: string;
  session_id: string;
}

/**
 * Content block for tool use
 */
export interface ToolUseContentBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Content block for text
 */
export interface TextContentBlock {
  type: "text";
  text: string;
}

/**
 * Stream event - message_start
 */
export interface MessageStartEvent {
  type: "stream_event";
  event: {
    type: "message_start";
    message: {
      model: string;
      id: string;
      type: "message";
      role: "assistant";
      content: [];
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };
  };
  session_id: string;
  parent_tool_use_id: string | null;
  uuid: string;
}

/**
 * Stream event - content_block_start
 */
export interface ContentBlockStartEvent {
  type: "stream_event";
  event: {
    type: "content_block_start";
    index: number;
    content_block: ToolUseContentBlock | TextContentBlock;
  };
  session_id: string;
  parent_tool_use_id: string | null;
  uuid: string;
}

/**
 * Stream event - content_block_delta
 */
export interface ContentBlockDeltaEvent {
  type: "stream_event";
  event: {
    type: "content_block_delta";
    index: number;
    delta:
      | { type: "text_delta"; text: string }
      | { type: "input_json_delta"; partial_json: string };
  };
  session_id: string;
  parent_tool_use_id: string | null;
  uuid: string;
}

/**
 * Stream event - message_delta (with usage)
 */
export interface MessageDeltaEvent {
  type: "stream_event";
  event: {
    type: "message_delta";
    delta: {
      stop_reason: string;
      stop_sequence: string | null;
    };
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  session_id: string;
  parent_tool_use_id: string | null;
  uuid: string;
}

/**
 * Result event - final event with cost information
 */
export interface ResultEvent {
  type: "result";
  subtype: "success" | "error";
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  session_id: string;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  modelUsage: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      costUSD: number;
    }
  >;
  uuid: string;
}

/**
 * Union type for all stream-json events
 */
export type StreamJsonEvent =
  | SystemInitEvent
  | SystemHookEvent
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | MessageDeltaEvent
  | ResultEvent
  | { type: string; [key: string]: unknown }; // Fallback for unknown events

/**
 * Parsed and normalized stream event for dashboard display
 */
export interface NormalizedStreamEvent {
  id: string;
  session_id: string;
  pane_id: string;
  timestamp: string;

  /** Simplified event category for filtering */
  category: "text" | "tool" | "hook" | "result" | "system" | "error";

  /** Original event type */
  original_type: string;

  /** Event content - varies by category */
  content: string;

  /** Tool information (when category === "tool") */
  tool?: {
    name: string;
    input?: Record<string, unknown>;
    status: "started" | "completed" | "error";
  };

  /** Cost information (when category === "result") */
  cost?: {
    total_usd: number;
    input_tokens: number;
    output_tokens: number;
    duration_ms: number;
  };

  /** Model information */
  model?: string;

  /** Raw event for debugging */
  raw?: StreamJsonEvent;
}

/**
 * Session metadata extracted from init events
 */
export interface SessionMetadata {
  session_id: string;
  pane_id: string;
  model: string;
  tools: string[];
  cwd: string;
  started_at: string;
  total_cost: number;
  total_tokens: {
    input: number;
    output: number;
  };
}
