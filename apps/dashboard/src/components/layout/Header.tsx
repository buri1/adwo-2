/**
 * ADWO 2.0 Dashboard Header
 * Minimal status bar with connection indicator and key metrics.
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CostIndicator } from "@/components/cost";
import { StartOrchestratorButton, StopOrchestratorButton } from "@/components/orchestrator";
import { useConnectionStore } from "@/stores/connection-store";
import { useEventStore } from "@/stores/event-store";
import {
  Radio,
  WifiOff,
  Loader2,
  Zap,
  Activity,
  Bot,
  Settings,
  Coins
} from "lucide-react";

function ConnectionBadge() {
  const status = useConnectionStore((state) => state.status);

  if (status === "connected") {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="text-green-500 font-medium">Live</span>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-yellow-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="font-medium">Connecting</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-red-500">
      <WifiOff className="h-3 w-3" />
      <span className="font-medium">Offline</span>
    </div>
  );
}

function QuickStats() {
  const events = useEventStore((state) => state.events);
  const getActivePanes = useEventStore((state) => state.getActivePanes);
  const paneCount = getActivePanes().length;

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Bot className="h-3.5 w-3.5" />
        <span className="tabular-nums font-medium text-foreground">{paneCount}</span>
        <span>agents</span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5" />
        <span className="tabular-nums font-medium text-foreground">{events.length.toLocaleString()}</span>
        <span>events</span>
      </div>
    </div>
  );
}

export function Header() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 bg-card/30 backdrop-blur-sm px-4">
      {/* Left side - Logo and connection */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-bold tracking-tight">ADWO</span>
          <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
            2.0
          </Badge>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-border/50" />

        {/* Connection status */}
        <ConnectionBadge />

        {/* Separator */}
        <div className="h-4 w-px bg-border/50" />

        {/* Quick stats */}
        <QuickStats />
      </div>

      {/* Right side - Controls */}
      <div className="flex items-center gap-3">
        {/* Cost */}
        <CostIndicator warningThreshold={5.0} />

        {/* Separator */}
        <div className="h-4 w-px bg-border/50" />

        {/* Orchestrator controls */}
        <div className="flex items-center gap-1.5">
          <StartOrchestratorButton />
          <StopOrchestratorButton />
        </div>

        {/* Settings */}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
