/**
 * ADWO 2.0 Event Stream Panel
 * Story 1.5 — Dashboard Event Stream UI
 *
 * Main component for displaying real-time event stream from all panes.
 * Features auto-scroll, connection status, and visual pane distinction.
 */

"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEventStore } from "@/stores/event-store";
import { useConnectionStore } from "@/stores/connection-store";
import { EventItem, EventItemSkeleton } from "./event-item";
import { WifiOff, Loader2, Radio, RefreshCw, AlertTriangle } from "lucide-react";

interface ConnectionStatusProps {
  status: "connected" | "connecting" | "disconnected";
  reconnectAttempts: number;
  lastError: string | null;
}

function ConnectionStatus({
  status,
  reconnectAttempts,
  lastError,
}: ConnectionStatusProps) {
  if (status === "connected") {
    return (
      <Badge
        variant="outline"
        className="bg-green-500/10 text-green-500 border-green-500/30 gap-1.5"
      >
        <Radio className="h-3 w-3 animate-pulse" />
        Live
      </Badge>
    );
  }

  if (status === "connecting") {
    return (
      <Badge
        variant="outline"
        className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 gap-1.5"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Connecting...
      </Badge>
    );
  }

  // Disconnected
  return (
    <Badge
      variant="outline"
      className="bg-red-500/10 text-red-500 border-red-500/30 gap-1.5"
      title={lastError ?? "Disconnected from server"}
    >
      <WifiOff className="h-3 w-3" />
      Disconnected
      {reconnectAttempts > 0 && (
        <span className="flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />
          {reconnectAttempts}
        </span>
      )}
    </Badge>
  );
}

interface EventStreamPanelProps {
  className?: string;
  maxHeight?: string;
}

export function EventStreamPanel({
  className = "",
  maxHeight = "h-[600px]",
}: EventStreamPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollEnabled = useRef(true);
  const lastEventCountRef = useRef(0);
  const paneColors = useMemo(() => new Map<string, string>(), []);

  // WebSocket connection (initializes on mount)
  useWebSocket();

  // Store state
  const events = useEventStore((state) => state.events);
  const { status, reconnectAttempts, lastError } = useConnectionStore();

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isAutoScrollEnabled.current) return;

    // Only scroll if new events were added
    if (events.length > lastEventCountRef.current) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
    lastEventCountRef.current = events.length;
  }, [events.length]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isAtBottom =
      Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) < 50;
    isAutoScrollEnabled.current = isAtBottom;
  }, []);

  // Unique panes for stats
  const uniquePanes = useMemo(() => {
    const panes = new Set(events.map((e) => e.pane_id));
    return panes.size;
  }, [events]);

  return (
    <Card className={`flex flex-col ${maxHeight} ${className}`}>
      <CardHeader className="flex-none border-b pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold">Event Stream</CardTitle>
            <ConnectionStatus
              status={status}
              reconnectAttempts={reconnectAttempts}
              lastError={lastError}
            />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{events.length}</strong> events
            </span>
            <span>
              <strong className="text-foreground">{uniquePanes}</strong> panes
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
          onScroll={handleScroll}
        >
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
              {status === "connected" ? (
                <>
                  <EventItemSkeleton />
                  <p className="text-sm mt-2">Waiting for terminal events...</p>
                </>
              ) : status === "connecting" ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p className="text-sm">Connecting to event stream...</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-8 w-8 mb-2 text-yellow-500" />
                  <p className="text-sm">Disconnected. Reconnecting in 2s...</p>
                  {lastError && (
                    <p className="text-xs mt-1 text-red-400">{lastError}</p>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {events.map((event) => (
                <EventItem key={event.id} event={event} paneColors={paneColors} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
