/**
 * ADWO 2.0 Chat Input
 * Input field for sending messages to the orchestrator.
 */

"use client";

import { useState, useCallback, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatStore, createTextMessage } from "@/stores/chat-store";
import { useConnectionStore } from "@/stores/connection-store";
import { Send, Loader2 } from "lucide-react";

export function ChatInput() {
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addMessage = useChatStore((state) => state.addMessage);
  const addToCommandHistory = useChatStore((state) => state.addToCommandHistory);
  const navigateCommandHistory = useChatStore((state) => state.navigateCommandHistory);
  const resetCommandHistoryIndex = useChatStore((state) => state.resetCommandHistoryIndex);
  const status = useConnectionStore((state) => state.status);

  const isConnected = status === "connected";

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    setInput("");
    addToCommandHistory(text);

    // Add user message to chat
    const userMessage = createTextMessage("user", text);
    addMessage(userMessage);

    try {
      // Send to backend API (to be implemented)
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        // Add error message
        const errorMessage = createTextMessage(
          "system",
          `Failed to send message: ${response.statusText}`
        );
        addMessage({ ...errorMessage, content: { type: "error", text: errorMessage.content.text } });
      }
    } catch (error) {
      // Add error message
      const errorMessage = createTextMessage(
        "system",
        `Error: ${error instanceof Error ? error.message : "Failed to send"}`
      );
      addMessage({ ...errorMessage, content: { type: "error", text: errorMessage.content.text } });
    } finally {
      setIsSubmitting(false);
    }
  }, [input, isSubmitting, addMessage, addToCommandHistory]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const cmd = navigateCommandHistory("up");
      if (cmd !== null) setInput(cmd);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const cmd = navigateCommandHistory("down");
      setInput(cmd ?? "");
    } else {
      // Reset history navigation on any other key
      resetCommandHistoryIndex();
    }
  };

  return (
    <div className="border-t p-3">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          placeholder={isConnected ? "Type a message..." : "Disconnected..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isConnected || isSubmitting}
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!input.trim() || !isConnected || isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      {!isConnected && (
        <p className="mt-1 text-xs text-muted-foreground">
          Connect to the orchestrator to send messages
        </p>
      )}
    </div>
  );
}
