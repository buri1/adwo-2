/**
 * ADWO 2.0 Right Panel
 * O-Agent chat panel for interaction.
 */

"use client";

import { OAgentChatPanel } from "@/components/o-agent-chat";

export function RightPanel() {
  return (
    <div className="flex h-full flex-col border-l bg-muted/30">
      <OAgentChatPanel />
    </div>
  );
}
