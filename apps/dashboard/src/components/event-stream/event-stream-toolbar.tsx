/**
 * ADWO 2.0 Event Stream Toolbar
 * Filter controls for stream-json events.
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEventStore } from "@/stores/event-store";
import {
  Search,
  X,
  MessageSquare,
  Wrench,
  Zap,
  CheckCircle,
  AlertTriangle,
  ArrowDown,
} from "lucide-react";

// Stream-json event type filters
type StreamEventType = "text" | "tool" | "hook" | "result" | "error";

const TYPE_CONFIG: Record<
  StreamEventType,
  { label: string; icon: React.ReactNode; className: string }
> = {
  text: {
    label: "Text",
    icon: <MessageSquare className="h-3 w-3" />,
    className: "event-pill-text",
  },
  tool: {
    label: "Tool",
    icon: <Wrench className="h-3 w-3" />,
    className: "event-pill-tool",
  },
  hook: {
    label: "Hook",
    icon: <Zap className="h-3 w-3" />,
    className: "event-pill-hook",
  },
  result: {
    label: "Result",
    icon: <CheckCircle className="h-3 w-3" />,
    className: "event-pill-result",
  },
  error: {
    label: "Error",
    icon: <AlertTriangle className="h-3 w-3" />,
    className: "event-pill-error",
  },
};

interface FilterPillProps {
  type: StreamEventType;
  active: boolean;
  onToggle: () => void;
}

function FilterPill({ type, active, onToggle }: FilterPillProps) {
  const config = TYPE_CONFIG[type];

  return (
    <button
      onClick={onToggle}
      className={`event-pill transition-all ${
        active
          ? config.className
          : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
      }`}
    >
      {config.icon}
      <span>{config.label}</span>
    </button>
  );
}

export function EventStreamToolbar() {
  const searchQuery = useEventStore((state) => state.searchQuery);
  const autoFollow = useEventStore((state) => state.autoFollow);
  const streamFilters = useEventStore((state) => state.streamFilters);
  const setSearchQuery = useEventStore((state) => state.setSearchQuery);
  const setAutoFollow = useEventStore((state) => state.setAutoFollow);
  const toggleStreamFilter = useEventStore((state) => state.toggleStreamFilter);
  const getFilteredEvents = useEventStore((state) => state.getFilteredEvents);
  const getTotalCost = useEventStore((state) => state.getTotalCost);

  // Convert streamFilters to Set for FilterPill
  const activeFilters = new Set<StreamEventType>(
    (Object.entries(streamFilters) as [StreamEventType, boolean][])
      .filter(([, active]) => active)
      .map(([type]) => type)
  );

  const toggleFilter = (type: StreamEventType) => {
    toggleStreamFilter(type);
  };

  const filteredEvents = getFilteredEvents();
  const totalCount = filteredEvents.length;
  const totalCost = getTotalCost();

  return (
    <div className="flex flex-col gap-3 border-b border-border/50 bg-card/30 backdrop-blur-sm p-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {(Object.keys(TYPE_CONFIG) as StreamEventType[]).map((type) => (
            <FilterPill
              key={type}
              type={type}
              active={activeFilters.has(type)}
              onToggle={() => toggleFilter(type)}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Cost display */}
          {totalCost > 0 && (
            <span className="text-xs font-medium text-event-result tabular-nums">
              ${totalCost.toFixed(4)}
            </span>
          )}

          {/* Event count */}
          <span className="text-xs text-muted-foreground tabular-nums">
            {totalCount.toLocaleString()} events
          </span>

          {/* Auto-follow toggle */}
          <Button
            variant={autoFollow ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoFollow(!autoFollow)}
            className={`h-7 gap-1.5 text-xs ${
              autoFollow ? "glow-primary" : ""
            }`}
          >
            <ArrowDown className={`h-3 w-3 ${autoFollow ? "animate-bounce" : ""}`} />
            {autoFollow ? "Following" : "Paused"}
          </Button>
        </div>
      </div>
    </div>
  );
}
