/**
 * POST /api/questions/answer
 * Story 3.3 — Answer Questions via Dashboard
 *
 * Sends user answer to agent terminal via conduit terminal-write.
 * Accepts { questionId, paneId, answer } and writes to the correct pane.
 */

import { NextResponse } from "next/server";
import { terminalWrite, terminalSendEnter } from "@/lib/conduit";

interface AnswerRequest {
  questionId: string;
  paneId: string;
  answer: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnswerRequest;
    const { questionId, paneId, answer } = body;

    // Validate required fields
    if (!questionId || typeof questionId !== "string") {
      return NextResponse.json(
        { error: "questionId is required" },
        { status: 400 }
      );
    }

    if (!paneId || typeof paneId !== "string") {
      return NextResponse.json(
        { error: "paneId is required" },
        { status: 400 }
      );
    }

    if (!answer || typeof answer !== "string") {
      return NextResponse.json(
        { error: "answer is required" },
        { status: 400 }
      );
    }

    // Write answer to terminal and send Enter
    await terminalWrite(paneId, answer);
    await terminalSendEnter(paneId);

    return NextResponse.json({
      success: true,
      questionId,
      paneId,
      message: "Answer sent successfully",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
