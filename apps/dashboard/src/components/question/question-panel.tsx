/**
 * ADWO 2.0 Question Panel Component
 * Story 3.2 & 3.3 — Question Display and Answer in Chat UI
 *
 * Displays multiple pending questions in a chat-style UI.
 * Questions appear in chronological order with visual distinction.
 * Supports answering questions via API call to backend.
 */

"use client";

import { useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircleQuestion, Inbox } from "lucide-react";
import { useQuestionStore } from "@/stores/question-store";
import { useEventStore } from "@/stores/event-store";
import { QuestionCard } from "./question-card";

interface QuestionPanelProps {
  className?: string;
  maxHeight?: string;
  /** @deprecated Use onAnswer instead */
  onOptionSelect?: (questionId: string, optionNumber: number) => void;
}

async function sendAnswerToBackend(
  questionId: string,
  paneId: string,
  answer: string
): Promise<void> {
  const response = await fetch("/api/questions/answer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ questionId, paneId, answer }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to send answer");
  }
}

export function QuestionPanel({
  className = "",
  maxHeight = "h-[400px]",
  onOptionSelect,
}: QuestionPanelProps) {
  const questions = useQuestionStore((state) => state.questions);
  const addQuestions = useQuestionStore((state) => state.addQuestions);
  const answerQuestion = useQuestionStore((state) => state.answerQuestion);
  const events = useEventStore((state) => state.events);

  // Sync question events from event store
  // Only terminal events can have question_metadata (legacy behavior)
  useEffect(() => {
    const questionEvents = events
      .filter((e) => e.source === "terminal" && e.type === "question" && e.question_metadata)
      .map((e) => ({
        id: e.id,
        pane_id: e.pane_id,
        type: e.type as "question",
        content: e.content,
        timestamp: e.timestamp,
        project_id: e.project_id ?? "default",
        question_metadata: e.question_metadata,
      }));
    if (questionEvents.length > 0) {
      addQuestions(questionEvents);
    }
  }, [events, addQuestions]);

  const handleAnswer = useCallback(
    async (questionId: string, paneId: string, answer: string) => {
      // Send to backend first
      await sendAnswerToBackend(questionId, paneId, answer);
      // Mark as answered in store
      answerQuestion(questionId, answer);
    },
    [answerQuestion]
  );

  // Count only unanswered questions
  const pendingCount = questions.filter((q) => !q.answered).length;

  return (
    <Card className={`flex flex-col ${maxHeight} ${className}`}>
      <CardHeader className="flex-none border-b pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg font-semibold">Questions</CardTitle>
          </div>
          {pendingCount > 0 && (
            <Badge
              variant="outline"
              className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
            >
              {pendingCount} pending
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent p-4">
          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[150px] text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No pending questions</p>
              <p className="text-xs mt-1">
                Questions from agents will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  onAnswer={handleAnswer}
                  onOptionSelect={onOptionSelect}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
