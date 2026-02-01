/**
 * ADWO 2.0 Center Panel
 * Main content area with event stream.
 */

"use client";

import { VirtualizedEventStream } from "@/components/event-stream/virtualized-event-stream";

export function CenterPanel() {
  return (
    <div className="flex h-full flex-col bg-background">
      <VirtualizedEventStream />
    </div>
  );
}
