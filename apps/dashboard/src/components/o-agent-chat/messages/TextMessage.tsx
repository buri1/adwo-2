/**
 * ADWO 2.0 Text Message
 * Renders plain text or markdown content.
 */

"use client";

import type { BaseMessageContent } from "@/stores/chat-store";

interface TextMessageProps {
  content: BaseMessageContent;
}

export function TextMessage({ content }: TextMessageProps) {
  return (
    <p className="text-sm whitespace-pre-wrap break-words">
      {content.text ?? ""}
    </p>
  );
}
