/**
 * ADWO 2.0 Chat Header
 * Header for the O-Agent chat panel.
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat-store";
import { useConnectionStore } from "@/stores/connection-store";
import { MessageSquare, Trash2, Radio, WifiOff } from "lucide-react";

export function ChatHeader() {
  const messages = useChatStore((state) => state.messages);
  const clearMessages = useChatStore((state) => state.clearMessages);
  const isTyping = useChatStore((state) => state.isTyping);
  const status = useConnectionStore((state) => state.status);

  return (
    <div className="flex h-12 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Chat</h2>
        <Badge variant="secondary" className="text-xs">
          {messages.length}
        </Badge>
        {isTyping && (
          <Badge variant="outline" className="text-xs animate-pulse">
            Typing...
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {status === "connected" ? (
          <Radio className="h-3 w-3 text-green-500 animate-pulse" />
        ) : (
          <WifiOff className="h-3 w-3 text-red-500" />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={clearMessages}
          title="Clear messages"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
