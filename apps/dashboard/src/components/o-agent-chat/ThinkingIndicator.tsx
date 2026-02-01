/**
 * ADWO 2.0 Thinking Indicator
 * Animated typing indicator for when the orchestrator is processing.
 */

"use client";

import { useChatStore } from "@/stores/chat-store";

export function ThinkingIndicator() {
  const typingAgent = useChatStore((state) => state.typingAgent);

  return (
    <div className="flex items-start gap-2">
      <div className="rounded-lg bg-muted px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {typingAgent ?? "Orchestrator"} is thinking
          </span>
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
          </span>
        </div>
      </div>
    </div>
  );
}
