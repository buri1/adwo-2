/**
 * ADWO 2.0 Cost Panel Component
 * Story 4.2 — Cost Display in Dashboard
 *
 * Detailed panel showing token breakdown and per-pane costs.
 * Displays real-time cost metrics with visual indicators.
 */

"use client";

import { memo, useMemo, useState } from "react";
import {
  DollarSign,
  Coins,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Layers,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  Database,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCostStore } from "@/stores/cost-store";
import { cn } from "@/lib/utils";
import type { CostTotals, TokenUsage } from "@adwo/shared";

interface CostPanelProps {
  /** Cost threshold in USD for warning indicator */
  warningThreshold?: number;
  /** Additional CSS classes */
  className?: string;
  /** Maximum height */
  maxHeight?: string;
}

/**
 * Format USD currency with appropriate precision
 */
function formatCurrency(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  if (amount < 1) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(2)}`;
}

/**
 * Format large numbers with K/M suffixes
 */
function formatTokenCount(count: number): string {
  if (count === 0) return "0";
  if (count < 1000) return count.toLocaleString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(2)}M`;
}

/**
 * Token breakdown display component
 */
const TokenBreakdown = memo(function TokenBreakdown({
  tokens,
  compact = false,
}: {
  tokens: TokenUsage;
  compact?: boolean;
}) {
  const items = [
    {
      label: "Input",
      value: tokens.input,
      icon: ArrowUpRight,
      color: "text-blue-500",
    },
    {
      label: "Output",
      value: tokens.output,
      icon: ArrowDownLeft,
      color: "text-green-500",
    },
    {
      label: "Cache Read",
      value: tokens.cacheRead,
      icon: Database,
      color: "text-purple-500",
    },
    {
      label: "Cache Write",
      value: tokens.cacheWrite,
      icon: Zap,
      color: "text-orange-500",
    },
  ];

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2 text-xs">
        {items.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-1">
            <Icon className={cn("h-3 w-3", color)} />
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-mono">{formatTokenCount(value)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2"
        >
          <Icon className={cn("h-4 w-4", color)} />
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">{label}</span>
            <span className="font-mono text-sm font-medium">
              {formatTokenCount(value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
});

/**
 * Pane cost row component
 */
const PaneCostRow = memo(function PaneCostRow({
  paneId,
  totals,
  isExpanded,
  onToggle,
}: {
  paneId: string;
  totals: CostTotals;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const totalTokens = useMemo(() => {
    const { input, output, cacheRead, cacheWrite } = totals.totalTokens;
    return input + output + cacheRead + cacheWrite;
  }, [totals.totalTokens]);

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm">{paneId}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {totals.metricCount} calls
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-mono text-sm font-semibold">
              {formatCurrency(totals.totalCostUsd)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {formatTokenCount(totalTokens)} tokens
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="border-t bg-muted/20 p-3">
          <TokenBreakdown tokens={totals.totalTokens} compact />
          {totals.lastMetricAt && (
            <div className="mt-2 text-[10px] text-muted-foreground">
              Last activity: {new Date(totals.lastMetricAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export const CostPanel = memo(function CostPanel({
  warningThreshold = 5.0,
  className = "",
  maxHeight = "h-[400px]",
}: CostPanelProps) {
  const globalTotals = useCostStore((state) => state.globalTotals);
  const paneData = useCostStore((state) => state.paneData);
  const lastUpdateAt = useCostStore((state) => state.lastUpdateAt);

  const [expandedPanes, setExpandedPanes] = useState<Set<string>>(new Set());

  const paneIds = useMemo(() => Object.keys(paneData), [paneData]);
  const isOverThreshold = globalTotals.totalCostUsd >= warningThreshold;
  const hasActivity = globalTotals.metricCount > 0;

  const togglePane = (paneId: string) => {
    setExpandedPanes((prev) => {
      const next = new Set(prev);
      if (next.has(paneId)) {
        next.delete(paneId);
      } else {
        next.add(paneId);
      }
      return next;
    });
  };

  return (
    <Card className={cn("flex flex-col", maxHeight, className)}>
      <CardHeader className="flex-none border-b pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins
              className={cn(
                "h-5 w-5",
                isOverThreshold ? "text-yellow-500" : "text-emerald-500"
              )}
            />
            <CardTitle className="text-lg font-semibold">Cost Metrics</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isOverThreshold && (
              <Badge
                variant="outline"
                className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Over ${warningThreshold}
              </Badge>
            )}
            {hasActivity && (
              <Badge variant="outline" className="text-muted-foreground">
                {paneIds.length} pane{paneIds.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent p-4">
          {!hasActivity ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[150px] text-muted-foreground">
              <DollarSign className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No cost data yet</p>
              <p className="text-xs mt-1">
                Cost metrics will appear as agents run
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Global Summary */}
              <div
                className={cn(
                  "rounded-lg border p-4",
                  isOverThreshold
                    ? "border-yellow-500/30 bg-yellow-500/5"
                    : "border-emerald-500/30 bg-emerald-500/5"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    Total Spent
                  </span>
                  <span
                    className={cn(
                      "text-2xl font-bold tabular-nums",
                      isOverThreshold ? "text-yellow-500" : "text-emerald-500"
                    )}
                  >
                    {formatCurrency(globalTotals.totalCostUsd)}
                  </span>
                </div>
                <TokenBreakdown tokens={globalTotals.totalTokens} />
                {lastUpdateAt && (
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                    Last update: {new Date(lastUpdateAt).toLocaleTimeString()}
                  </div>
                )}
              </div>

              {/* Per-Pane Breakdown */}
              {paneIds.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Cost by Agent/Pane
                    </h3>
                    {paneIds.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          if (expandedPanes.size === paneIds.length) {
                            setExpandedPanes(new Set());
                          } else {
                            setExpandedPanes(new Set(paneIds));
                          }
                        }}
                      >
                        {expandedPanes.size === paneIds.length
                          ? "Collapse All"
                          : "Expand All"}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {paneIds.map((paneId) => {
                      const data = paneData[paneId];
                      if (!data) return null;
                      return (
                        <PaneCostRow
                          key={paneId}
                          paneId={paneId}
                          totals={data.totals}
                          isExpanded={expandedPanes.has(paneId)}
                          onToggle={() => togglePane(paneId)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
