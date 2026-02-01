/**
 * ADWO 2.0 Event Item Component
 * Story 1.5 — Dashboard Event Stream UI
 *
 * Displays a single event with visual distinction based on pane/type.
 */

"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Terminal,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import type { NormalizedTerminalEvent, TerminalEventType } from "@adwo/shared";

interface EventItemProps {
  event: NormalizedTerminalEvent;
  paneColors: Map<string, string>;
}

// Color palette for panes (will cycle through)
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

// Event type configurations
const EVENT_TYPE_CONFIG: Record<
  TerminalEventType,
  {
    icon: typeof Terminal;
    iconColor: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
    bgColor: string;
  }
> = {
  output: {
    icon: Terminal,
    iconColor: "text-muted-foreground",
    badgeVariant: "secondary",
    bgColor: "",
  },
  question: {
    icon: HelpCircle,
    iconColor: "text-yellow-500",
    badgeVariant: "outline",
    bgColor: "bg-yellow-500/5 border-l-2 border-l-yellow-500",
  },
  error: {
    icon: AlertCircle,
    iconColor: "text-red-500",
    badgeVariant: "destructive",
    bgColor: "bg-red-500/5 border-l-2 border-l-red-500",
  },
  status: {
    icon: CheckCircle,
    iconColor: "text-green-500",
    badgeVariant: "default",
    bgColor: "bg-green-500/5 border-l-2 border-l-green-500",
  },
};

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const DEFAULT_PANE_COLOR = "bg-blue-500/20 text-blue-400 border-blue-500/30";

function getPaneColor(paneId: string, paneColors: Map<string, string>): string {
  if (!paneColors.has(paneId)) {
    const colorIndex = paneColors.size % PANE_COLORS.length;
    const color = PANE_COLORS[colorIndex] ?? DEFAULT_PANE_COLOR;
    paneColors.set(paneId, color);
  }
  return paneColors.get(paneId) ?? DEFAULT_PANE_COLOR;
}

function formatPaneId(paneId: string): string {
  // Extract meaningful part from pane ID (e.g., "%42" -> "42")
  const match = paneId.match(/%(\d+)/);
  if (match) {
    return `Pane ${match[1]}`;
  }
  // Truncate long IDs
  return paneId.length > 12 ? `${paneId.slice(0, 12)}...` : paneId;
}

export const EventItem = memo(function EventItem({
  event,
  paneColors,
}: EventItemProps) {
  const config = EVENT_TYPE_CONFIG[event.type];
  const Icon = config.icon;
  const paneColor = getPaneColor(event.pane_id, paneColors);

  return (
    <div
      className={`group flex items-start gap-3 px-3 py-2 hover:bg-accent/50 transition-colors ${config.bgColor}`}
    >
      {/* Type Icon */}
      <div className={`mt-0.5 shrink-0 ${config.iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content Area */}
      <div className="min-w-0 flex-1 space-y-1">
        {/* Header: Pane Badge + Time */}
        <div className="flex items-center gap-2 text-xs">
          <Badge
            variant="outline"
            className={`${paneColor} text-[10px] font-medium px-1.5 py-0`}
          >
            {formatPaneId(event.pane_id)}
          </Badge>
          <span className="text-muted-foreground">
            {formatTimestamp(event.timestamp)}
          </span>
          {event.type !== "output" && (
            <Badge
              variant={config.badgeVariant}
              className="text-[10px] px-1.5 py-0"
            >
              {event.type}
            </Badge>
          )}
        </div>

        {/* Event Content */}
        <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-foreground/90">
          {event.content.trim()}
        </pre>
      </div>
    </div>
  );
});

// Loading indicator component
export function EventItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground">
        Waiting for events...
      </span>
    </div>
  );
}
