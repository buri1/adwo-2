/**
 * ADWO 2.0 Message List
 * Displays chat messages with auto-scroll.
 */

"use client";

import { useChatStore } from "@/stores/chat-store";
import { MessageBubble } from "./MessageBubble";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { MessageSquare } from "lucide-react";

export function MessageList() {
  const messages = useChatStore((state) => state.messages);
  const isTyping = useChatStore((state) => state.isTyping);

  if (messages.length === 0 && !isTyping) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-muted-foreground">
        <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">No messages yet</p>
        <p className="text-xs mt-1">
          Messages from the orchestrator will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isTyping && <ThinkingIndicator />}
    </div>
  );
}
