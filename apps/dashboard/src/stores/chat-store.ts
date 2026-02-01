/**
 * ADWO 2.0 Chat Store
 * Manages O-Agent chat messages, commands, and typing state.
 */

import { create } from "zustand";

/**
 * Message content types for specialized rendering
 */
export type MessageContentType =
  | "text"
  | "question"
  | "question_critical"
  | "code"
  | "diff"
  | "task_summary"
  | "file_created"
  | "file_modified"
  | "thinking"
  | "agent_handoff"
  | "error";

/**
 * Base message content
 */
export interface BaseMessageContent {
  type: MessageContentType;
  text?: string;
}

/**
 * Question content with options
 */
export interface QuestionContent extends BaseMessageContent {
  type: "question" | "question_critical";
  header?: string;
  question: string;
  options?: Array<{
    number: number;
    label: string;
    description?: string;
  }>;
  timeout?: number;
  questionId?: string;
}

/**
 * Code content with syntax highlighting
 */
export interface CodeContent extends BaseMessageContent {
  type: "code";
  code: string;
  language?: string;
  filename?: string;
}

/**
 * Diff content for file changes
 */
export interface DiffContent extends BaseMessageContent {
  type: "diff";
  diff: string;
  filename?: string;
}

/**
 * Task summary content
 */
export interface TaskSummaryContent extends BaseMessageContent {
  type: "task_summary";
  title: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  items?: Array<{
    text: string;
    completed: boolean;
  }>;
}

/**
 * File change content
 */
export interface FileChangeContent extends BaseMessageContent {
  type: "file_created" | "file_modified";
  filename: string;
  action?: string;
}

/**
 * Agent handoff content
 */
export interface AgentHandoffContent extends BaseMessageContent {
  type: "agent_handoff";
  fromAgent?: string;
  toAgent: string;
  reason?: string;
}

/**
 * Union of all message content types
 */
export type MessageContent =
  | BaseMessageContent
  | QuestionContent
  | CodeContent
  | DiffContent
  | TaskSummaryContent
  | FileChangeContent
  | AgentHandoffContent;

/**
 * Chat message structure
 */
export interface ChatMessage {
  id: string;
  sender: "user" | "orchestrator" | "system" | "agent";
  content: MessageContent;
  timestamp: string;
  agentId?: string;
  paneId?: string;
}

/**
 * Chat state
 */
export interface ChatState {
  messages: ChatMessage[];
  messageIds: Set<string>;
  isTyping: boolean;
  typingAgent?: string;
  commandHistory: string[];
  commandHistoryIndex: number;
}

/**
 * Chat actions
 */
interface ChatActions {
  addMessage: (message: ChatMessage) => void;
  addMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  setTyping: (isTyping: boolean, agentId?: string) => void;
  addToCommandHistory: (command: string) => void;
  navigateCommandHistory: (direction: "up" | "down") => string | null;
  resetCommandHistoryIndex: () => void;
}

const MAX_MESSAGES = 500;
const MAX_COMMAND_HISTORY = 50;

const initialState: ChatState = {
  messages: [],
  messageIds: new Set(),
  isTyping: false,
  typingAgent: undefined,
  commandHistory: [],
  commandHistoryIndex: -1,
};

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  ...initialState,

  addMessage: (message: ChatMessage) =>
    set((state) => {
      // Deduplicate by ID
      if (state.messageIds.has(message.id)) {
        return state;
      }

      const newMessages = [...state.messages, message];
      const newMessageIds = new Set(state.messageIds);
      newMessageIds.add(message.id);

      // Trim to max size
      if (newMessages.length > MAX_MESSAGES) {
        const removed = newMessages.splice(0, newMessages.length - MAX_MESSAGES);
        for (const m of removed) {
          newMessageIds.delete(m.id);
        }
      }

      return {
        messages: newMessages,
        messageIds: newMessageIds,
        // Clear typing indicator when message arrives from orchestrator
        isTyping: message.sender === "orchestrator" ? false : state.isTyping,
      };
    }),

  addMessages: (messages: ChatMessage[]) =>
    set((state) => {
      if (messages.length === 0) return state;

      const newMessages = messages.filter((m) => !state.messageIds.has(m.id));
      if (newMessages.length === 0) return state;

      // Sort by timestamp
      newMessages.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let allMessages = [...state.messages, ...newMessages];
      const newMessageIds = new Set(state.messageIds);
      for (const m of newMessages) {
        newMessageIds.add(m.id);
      }

      // Trim to max size
      if (allMessages.length > MAX_MESSAGES) {
        const removed = allMessages.slice(0, allMessages.length - MAX_MESSAGES);
        allMessages = allMessages.slice(-MAX_MESSAGES);
        for (const m of removed) {
          newMessageIds.delete(m.id);
        }
      }

      return {
        messages: allMessages,
        messageIds: newMessageIds,
      };
    }),

  clearMessages: () =>
    set({
      messages: [],
      messageIds: new Set(),
    }),

  setTyping: (isTyping: boolean, agentId?: string) =>
    set({
      isTyping,
      typingAgent: agentId,
    }),

  addToCommandHistory: (command: string) =>
    set((state) => {
      // Don't add duplicates of the last command
      if (state.commandHistory[state.commandHistory.length - 1] === command) {
        return { commandHistoryIndex: -1 };
      }

      const newHistory = [...state.commandHistory, command];
      if (newHistory.length > MAX_COMMAND_HISTORY) {
        newHistory.shift();
      }

      return {
        commandHistory: newHistory,
        commandHistoryIndex: -1,
      };
    }),

  navigateCommandHistory: (direction: "up" | "down") => {
    const state = get();
    const { commandHistory, commandHistoryIndex } = state;

    if (commandHistory.length === 0) return null;

    let newIndex: number;
    if (direction === "up") {
      // Move backwards in history (older commands)
      newIndex =
        commandHistoryIndex === -1
          ? commandHistory.length - 1
          : Math.max(0, commandHistoryIndex - 1);
    } else {
      // Move forwards in history (newer commands)
      if (commandHistoryIndex === -1) return null;
      newIndex =
        commandHistoryIndex >= commandHistory.length - 1
          ? -1
          : commandHistoryIndex + 1;
    }

    set({ commandHistoryIndex: newIndex });
    return newIndex === -1 ? null : commandHistory[newIndex] ?? null;
  },

  resetCommandHistoryIndex: () =>
    set({ commandHistoryIndex: -1 }),
}));

/**
 * Helper to create a text message
 */
export function createTextMessage(
  sender: ChatMessage["sender"],
  text: string,
  options?: Partial<ChatMessage>
): ChatMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sender,
    content: { type: "text", text },
    timestamp: new Date().toISOString(),
    ...options,
  };
}

/**
 * Helper to create a system message
 */
export function createSystemMessage(text: string): ChatMessage {
  return createTextMessage("system", text);
}
