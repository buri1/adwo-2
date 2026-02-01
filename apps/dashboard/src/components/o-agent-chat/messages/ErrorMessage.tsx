/**
 * ADWO 2.0 Error Message
 * Renders error messages with appropriate styling.
 */

"use client";

import type { BaseMessageContent } from "@/stores/chat-store";
import { AlertTriangle } from "lucide-react";

interface ErrorMessageProps {
  content: BaseMessageContent;
}

export function ErrorMessage({ content }: ErrorMessageProps) {
  return (
    <div className="flex items-start gap-2 text-red-500">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <p className="text-sm whitespace-pre-wrap break-words">
        {content.text ?? "An error occurred"}
      </p>
    </div>
  );
}
