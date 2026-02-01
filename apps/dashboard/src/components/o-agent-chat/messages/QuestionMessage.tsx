/**
 * ADWO 2.0 Question Message
 * Renders question with options and optional timeout.
 */

"use client";

import { Badge } from "@/components/ui/badge";
import type { QuestionContent } from "@/stores/chat-store";
import { HelpCircle, AlertTriangle } from "lucide-react";

interface QuestionMessageProps {
  content: QuestionContent;
}

export function QuestionMessage({ content }: QuestionMessageProps) {
  const isCritical = content.type === "question_critical";

  return (
    <div className="space-y-2">
      {/* Header */}
      {content.header && (
        <div className="flex items-center gap-2">
          {isCritical ? (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          ) : (
            <HelpCircle className="h-4 w-4 text-purple-500" />
          )}
          <Badge
            variant={isCritical ? "destructive" : "secondary"}
            className="text-xs"
          >
            {content.header}
          </Badge>
        </div>
      )}

      {/* Question text */}
      <p className="text-sm font-medium">{content.question}</p>

      {/* Options */}
      {content.options && content.options.length > 0 && (
        <div className="space-y-1 pl-2 border-l-2 border-muted">
          {content.options.map((option) => (
            <div key={option.number} className="text-sm">
              <span className="font-mono text-muted-foreground mr-2">
                {option.number}.
              </span>
              <span>{option.label}</span>
              {option.description && (
                <span className="text-muted-foreground ml-1">
                  - {option.description}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Timeout indicator */}
      {content.timeout && (
        <p className="text-xs text-muted-foreground">
          Timeout: {content.timeout}s
        </p>
      )}
    </div>
  );
}
