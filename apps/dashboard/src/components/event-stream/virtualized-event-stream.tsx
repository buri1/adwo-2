/**
 * ADWO 2.0 Virtualized Event Stream
 * High-performance event list using @tanstack/react-virtual.
 */

"use client";

import { useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEventStore } from "@/stores/event-store";
import { EventItem } from "./event-item";
import { EventStreamToolbar } from "./event-stream-toolbar";
import { Loader2, MessageSquare } from "lucide-react";

export function VirtualizedEventStream() {
  const parentRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);

  // Initialize WebSocket connection
  useWebSocket();

  // Store state
  const getFilteredEvents = useEventStore((state) => state.getFilteredEvents);
  const autoFollow = useEventStore((state) => state.autoFollow);
  const setAutoFollow = useEventStore((state) => state.setAutoFollow);

  const filteredEvents = getFilteredEvents();

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: filteredEvents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Estimated row height
    overscan: 10,
  });

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (!autoFollow || filteredEvents.length === 0) return;

    isAutoScrollingRef.current = true;
    rowVirtualizer.scrollToIndex(filteredEvents.length - 1, {
      align: "end",
      behavior: "auto",
    });

    // Reset flag after scroll completes
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isAutoScrollingRef.current = false;
      });
    });
  }, [filteredEvents.length, autoFollow, rowVirtualizer]);

  // Detect manual scroll to disable auto-follow
  const handleScroll = useCallback(() => {
    // Ignore programmatic scrolls
    if (isAutoScrollingRef.current) return;

    const container = parentRef.current;
    if (!container) return;

    const isAtBottom =
      Math.abs(
        container.scrollHeight - container.scrollTop - container.clientHeight
      ) < 50;

    if (!isAtBottom && autoFollow) {
      setAutoFollow(false);
    } else if (isAtBottom && !autoFollow) {
      setAutoFollow(true);
    }
  }, [autoFollow, setAutoFollow]);

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar with filters */}
      <EventStreamToolbar />

      {/* Virtualized list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        {filteredEvents.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">No events to display</p>
            <p className="text-xs mt-1">
              Events will appear here when the orchestrator runs
            </p>
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualItems.map((virtualItem) => {
              const event = filteredEvents[virtualItem.index];
              if (!event) return null;

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <EventItem event={event} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auto-follow indicator */}
      {!autoFollow && filteredEvents.length > 0 && (
        <button
          onClick={() => setAutoFollow(true)}
          className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <Loader2 className="h-4 w-4" />
          Resume auto-scroll
        </button>
      )}
    </div>
  );
}
