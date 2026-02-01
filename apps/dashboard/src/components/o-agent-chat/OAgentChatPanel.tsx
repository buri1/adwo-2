/**
 * ADWO 2.0 O-Agent Chat Panel
 * Main chat interface for orchestrator interaction.
 */

"use client";

import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatStore } from "@/stores/chat-store";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

export function OAgentChatPanel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = useChatStore((state) => state.messages);
  const isTyping = useChatStore((state) => state.isTyping);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isTyping]);

  return (
    <div className="flex h-full flex-col">
      <ChatHeader />

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          <MessageList />
        </ScrollArea>
      </div>

      <ChatInput />
    </div>
  );
}
