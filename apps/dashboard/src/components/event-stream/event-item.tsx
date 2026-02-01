/**
 * ADWO 2.0 Event Item Component
 * Story 1.5 — Dashboard Event Stream UI
 *
 * Displays a single event with visual distinction based on pane/type.
 * Supports both terminal events (legacy) and stream-json events.
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
  MessageSquare,
  Wrench,
  Zap,
  DollarSign,
  Settings,
} from "lucide-react";
import type { TerminalEventType } from "@adwo/shared";
import type { UnifiedEvent, StreamEventCategory } from "@/stores/event-store";

interface EventItemProps {
  event: UnifiedEvent;
  paneColors?: Map<string, string>;
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

// Event type configurations for terminal events (legacy)
const TERMINAL_TYPE_CONFIG: Record<
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

// Event category configurations for stream-json events
const STREAM_CATEGORY_CONFIG: Record<
  StreamEventCategory,
  {
    icon: typeof Terminal;
    iconColor: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
    bgColor: string;
    label: string;
  }
> = {
  text: {
    icon: MessageSquare,
    iconColor: "text-event-text",
    badgeVariant: "secondary",
    bgColor: "",
    label: "text",
  },
  tool: {
    icon: Wrench,
    iconColor: "text-event-tool",
    badgeVariant: "outline",
    bgColor: "bg-event-tool/5 border-l-2 border-l-event-tool",
    label: "tool",
  },
  hook: {
    icon: Zap,
    iconColor: "text-event-hook",
    badgeVariant: "outline",
    bgColor: "bg-event-hook/5 border-l-2 border-l-event-hook",
    label: "hook",
  },
  result: {
    icon: DollarSign,
    iconColor: "text-event-result",
    badgeVariant: "default",
    bgColor: "bg-event-result/5 border-l-2 border-l-event-result",
    label: "result",
  },
  system: {
    icon: Settings,
    iconColor: "text-muted-foreground",
    badgeVariant: "secondary",
    bgColor: "",
    label: "system",
  },
  error: {
    icon: AlertCircle,
    iconColor: "text-red-500",
    badgeVariant: "destructive",
    bgColor: "bg-red-500/5 border-l-2 border-l-red-500",
    label: "error",
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

// Global pane color cache for when paneColors prop is not provided
const globalPaneColors = new Map<string, string>();

function getPaneColor(paneId: string, paneColors?: Map<string, string>): string {
  const colorMap = paneColors ?? globalPaneColors;
  if (!colorMap.has(paneId)) {
    const colorIndex = colorMap.size % PANE_COLORS.length;
    const color = PANE_COLORS[colorIndex] ?? DEFAULT_PANE_COLOR;
    colorMap.set(paneId, color);
  }
  return colorMap.get(paneId) ?? DEFAULT_PANE_COLOR;
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
  // Get config based on event source
  const isStreamEvent = event.source === "stream";
  const config = isStreamEvent && event.category
    ? STREAM_CATEGORY_CONFIG[event.category]
    : event.type
      ? TERMINAL_TYPE_CONFIG[event.type]
      : TERMINAL_TYPE_CONFIG.output;

  const Icon = config.icon;
  const paneColor = getPaneColor(event.pane_id, paneColors);

  // Get display label
  const typeLabel = isStreamEvent && event.category
    ? (STREAM_CATEGORY_CONFIG[event.category]?.label ?? event.category)
    : event.type;

  // Format content - for tool events, show tool name prominently
  const displayContent = isStreamEvent && event.tool
    ? `${event.tool.name}: ${event.content}`
    : event.content;

  // Show cost for result events
  const showCost = isStreamEvent && event.cost && event.cost.total_usd > 0;

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
        {/* Header: Pane Badge + Time + Type */}
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
          {typeLabel && typeLabel !== "output" && typeLabel !== "text" && (
            <Badge
              variant={config.badgeVariant}
              className="text-[10px] px-1.5 py-0"
            >
              {typeLabel}
            </Badge>
          )}
          {showCost && event.cost && (
            <span className="text-event-result font-medium tabular-nums">
              ${event.cost.total_usd.toFixed(4)}
            </span>
          )}
        </div>

        {/* Event Content */}
        <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-foreground/90">
          {displayContent.trim()}
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
