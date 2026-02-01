/**
 * ADWO 2.0 Message Bubble
 * Routes messages to appropriate display components based on content type.
 */

"use client";

import type {
  ChatMessage,
  MessageContent,
  QuestionContent,
  CodeContent,
} from "@/stores/chat-store";
import { TextMessage } from "./messages/TextMessage";
import { QuestionMessage } from "./messages/QuestionMessage";
import { CodeMessage } from "./messages/CodeMessage";
import { ErrorMessage } from "./messages/ErrorMessage";
import { formatDistanceToNow } from "date-fns";

interface MessageBubbleProps {
  message: ChatMessage;
}

function isQuestionContent(content: MessageContent): content is QuestionContent {
  return content.type === "question" || content.type === "question_critical";
}

function isCodeContent(content: MessageContent): content is CodeContent {
  return content.type === "code";
}

function MessageContentRenderer({ content }: { content: MessageContent }) {
  if (isQuestionContent(content)) {
    return <QuestionMessage content={content} />;
  }
  if (isCodeContent(content)) {
    return <CodeMessage content={content} />;
  }
  if (content.type === "error") {
    return <ErrorMessage content={content} />;
  }
  return <TextMessage content={content} />;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === "user";
  const isSystem = message.sender === "system";

  return (
    <div
      className={`flex flex-col ${
        isUser ? "items-end" : "items-start"
      }`}
    >
      {/* Sender label */}
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">
          {isUser
            ? "You"
            : isSystem
            ? "System"
            : message.agentId ?? "Orchestrator"}
        </span>
        <span>
          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
        </span>
      </div>

      {/* Message content */}
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : isSystem
            ? "bg-muted text-muted-foreground italic"
            : "bg-muted"
        }`}
      >
        <MessageContentRenderer content={message.content} />
      </div>
    </div>
  );
}
