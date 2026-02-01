/**
 * ADWO 2.0 Left Panel
 * Agent sidebar with status, model, and metrics.
 */

"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useEventStore } from "@/stores/event-store";
import {
  Bot,
  Activity,
  Cpu,
  Coins,
  Layers,
  ChevronRight,
  Sparkles
} from "lucide-react";

interface AgentMetrics {
  eventCount: number;
  model?: string;
  cost?: number;
  tokens?: number;
  status: "active" | "idle" | "completed";
}

interface AgentCardProps {
  paneId: string;
  metrics: AgentMetrics;
  isSelected: boolean;
  onSelect: () => void;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

function AgentCard({ paneId, metrics, isSelected, onSelect }: AgentCardProps) {
  const statusColors = {
    active: "bg-green-500",
    idle: "bg-yellow-500",
    completed: "bg-blue-500",
  };

  // Extract agent type from paneId or use default
  const agentName = paneId.includes("orch") ? "Orchestrator" : `Agent ${paneId.slice(0, 4)}`;

  return (
    <button
      onClick={onSelect}
      className={`group w-full rounded-xl border p-3 text-left transition-all duration-200 hover:bg-accent/50 ${
        isSelected
          ? "border-primary/50 bg-primary/5 glow-primary"
          : "border-border/50 bg-card/30 hover:border-border"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        {/* Avatar with status indicator */}
        <div className="relative">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            isSelected ? "bg-primary/20" : "bg-muted/50"
          }`}>
            <Bot className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${statusColors[metrics.status]}`} />
        </div>

        {/* Name and model */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{agentName}</p>
            <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${
              isSelected ? "rotate-90" : "group-hover:translate-x-0.5"
            }`} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Cpu className="h-3 w-3" />
            <span>{metrics.model || "opus"}</span>
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="mt-3 flex items-center gap-3 text-xs">
        {/* Events */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <Activity className="h-3 w-3" />
          <span className="tabular-nums">{metrics.eventCount}</span>
        </div>

        {/* Tokens */}
        {metrics.tokens !== undefined && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Layers className="h-3 w-3" />
            <span className="tabular-nums">{formatTokens(metrics.tokens)}</span>
          </div>
        )}

        {/* Cost */}
        {metrics.cost !== undefined && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Coins className="h-3 w-3" />
            <span className="tabular-nums">{formatCost(metrics.cost)}</span>
          </div>
        )}
      </div>
    </button>
  );
}

export function LeftPanel() {
  const events = useEventStore((state) => state.events);
  const selectedPaneId = useEventStore((state) => state.selectedPaneId);
  const setSelectedPaneId = useEventStore((state) => state.setSelectedPaneId);
  const getActivePanes = useEventStore((state) => state.getActivePanes);

  const activePanes = getActivePanes();

  // Calculate metrics per pane
  const paneMetrics = new Map<string, AgentMetrics>();
  for (const paneId of activePanes) {
    const paneEvents = events.filter((e) => e.pane_id === paneId);
    paneMetrics.set(paneId, {
      eventCount: paneEvents.length,
      model: "opus", // TODO: Extract from stream-json init event
      cost: Math.random() * 0.5, // TODO: Extract from stream-json result event
      tokens: Math.floor(Math.random() * 50000), // TODO: Extract from stream-json
      status: "active",
    });
  }

  return (
    <div className="flex h-full flex-col bg-sidebar/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border/50 px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Agents</h2>
        </div>
        <Badge
          variant="secondary"
          className="h-5 min-w-[1.5rem] justify-center rounded-full px-1.5 text-[10px] font-bold"
        >
          {activePanes.length}
        </Badge>
      </div>

      {/* Agent list */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {activePanes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30">
                <Bot className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No active agents</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Start the orchestrator to begin
              </p>
            </div>
          ) : (
            <>
              {/* All panes option */}
              <button
                onClick={() => setSelectedPaneId(null)}
                className={`group w-full rounded-xl border p-3 text-left transition-all duration-200 hover:bg-accent/50 ${
                  selectedPaneId === null
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/50 bg-card/30 hover:border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    selectedPaneId === null ? "bg-primary/20" : "bg-muted/50"
                  }`}>
                    <Activity className={`h-5 w-5 ${
                      selectedPaneId === null ? "text-primary" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">All Agents</p>
                    <p className="text-xs text-muted-foreground">
                      {events.length.toLocaleString()} total events
                    </p>
                  </div>
                </div>
              </button>

              {/* Individual agents */}
              {activePanes.map((paneId) => (
                <AgentCard
                  key={paneId}
                  paneId={paneId}
                  metrics={paneMetrics.get(paneId)!}
                  isSelected={selectedPaneId === paneId}
                  onSelect={() => setSelectedPaneId(paneId)}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
