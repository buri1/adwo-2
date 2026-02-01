/**
 * ADWO 2.0 Question Card Component
 * Story 3.2 — Question Display in Chat UI
 *
 * Displays a single question with clickable option buttons.
 * Features visual distinction from regular log messages.
 */

"use client";

import { memo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, User } from "lucide-react";
import type { PendingQuestion } from "@/stores/question-store";

interface QuestionCardProps {
  question: PendingQuestion;
  onOptionSelect?: (questionId: string, optionNumber: number) => void;
}

// Color palette for panes (matches event-item.tsx)
const PANE_COLORS = [
  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "bg-green-500/20 text-green-400 border-green-500/30",
  "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "bg-pink-500/20 text-pink-400 border-pink-500/30",
  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "bg-red-500/20 text-red-400 border-red-500/30",
];

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatPaneId(paneId: string): string {
  // Extract meaningful part from pane ID (e.g., "%42" -> "Agent 42")
  const match = paneId.match(/%(\d+)/);
  if (match) {
    return `Agent ${match[1]}`;
  }
  return paneId.length > 12 ? `${paneId.slice(0, 12)}...` : paneId;
}

function getPaneColor(paneId: string): string {
  // Simple hash to get consistent color per pane
  let hash = 0;
  for (let i = 0; i < paneId.length; i++) {
    hash = (hash << 5) - hash + paneId.charCodeAt(i);
    hash |= 0;
  }
  return PANE_COLORS[Math.abs(hash) % PANE_COLORS.length]!;
}

export const QuestionCard = memo(function QuestionCard({
  question,
  onOptionSelect,
}: QuestionCardProps) {
  const { metadata, paneId, timestamp, id } = question;
  const paneColor = getPaneColor(paneId);

  return (
    <Card className="border-l-4 border-l-yellow-500 bg-yellow-500/5 shadow-sm">
      <CardHeader className="pb-2 pt-3 px-4">
        {/* Header with pane info and icon */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-500/20">
              <HelpCircle className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${paneColor} text-[10px] font-medium px-1.5 py-0`}
              >
                <User className="h-3 w-3 mr-1" />
                {formatPaneId(paneId)}
              </Badge>
              {metadata.header && (
                <span className="text-sm font-medium text-foreground">
                  {metadata.header}
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(timestamp)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0">
        {/* Question text */}
        <p className="text-sm text-foreground leading-relaxed mb-3">
          {metadata.question}
        </p>

        {/* Options as buttons */}
        <div className="flex flex-wrap gap-2">
          {metadata.options.map((option) => (
            <Button
              key={option.number}
              variant="outline"
              size="sm"
              className="h-auto py-2 px-3 text-left justify-start whitespace-normal hover:bg-yellow-500/10 hover:border-yellow-500/50"
              onClick={() => onOptionSelect?.(id, option.number)}
              title={option.description}
            >
              <span className="inline-flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {option.number}
                </span>
                <span className="text-sm">{option.label}</span>
              </span>
            </Button>
          ))}
        </div>

        {/* Option descriptions if any */}
        {metadata.options.some((o) => o.description) && (
          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            {metadata.options
              .filter((o) => o.description)
              .map((option) => (
                <div key={option.number} className="flex gap-2">
                  <span className="font-medium shrink-0">{option.number}.</span>
                  <span>{option.description}</span>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
