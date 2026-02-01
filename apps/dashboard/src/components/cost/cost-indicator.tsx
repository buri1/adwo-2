/**
 * ADWO 2.0 Cost Indicator Component
 * Story 4.2 — Cost Display in Dashboard
 *
 * Compact indicator for dashboard header showing total USD spent.
 * Updates in real-time as cost_update events arrive via WebSocket.
 * Shows warning indicator when configurable threshold is exceeded.
 */

"use client";

import { memo, useMemo } from "react";
import { DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCostStore } from "@/stores/cost-store";
import { cn } from "@/lib/utils";

interface CostIndicatorProps {
  /** Cost threshold in USD for warning indicator */
  warningThreshold?: number;
  /** Additional CSS classes */
  className?: string;
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
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(2)}M`;
}

export const CostIndicator = memo(function CostIndicator({
  warningThreshold = 5.0,
  className,
}: CostIndicatorProps) {
  const globalTotals = useCostStore((state) => state.globalTotals);
  const lastUpdateAt = useCostStore((state) => state.lastUpdateAt);
  const paneCount = useCostStore((state) => Object.keys(state.paneData).length);

  const isOverThreshold = globalTotals.totalCostUsd >= warningThreshold;
  const hasActivity = globalTotals.metricCount > 0;

  const totalTokens = useMemo(() => {
    const { input, output, cacheRead, cacheWrite } = globalTotals.totalTokens;
    return input + output + cacheRead + cacheWrite;
  }, [globalTotals.totalTokens]);

  const tooltipContent = useMemo(() => {
    const { input, output, cacheRead, cacheWrite } = globalTotals.totalTokens;
    return (
      <div className="space-y-2 text-xs">
        <div className="font-semibold border-b pb-1">Token Breakdown</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-muted-foreground">Input:</span>
          <span className="text-right font-mono">{formatTokenCount(input)}</span>
          <span className="text-muted-foreground">Output:</span>
          <span className="text-right font-mono">{formatTokenCount(output)}</span>
          <span className="text-muted-foreground">Cache Read:</span>
          <span className="text-right font-mono">{formatTokenCount(cacheRead)}</span>
          <span className="text-muted-foreground">Cache Write:</span>
          <span className="text-right font-mono">{formatTokenCount(cacheWrite)}</span>
        </div>
        <div className="border-t pt-1 grid grid-cols-2 gap-x-4">
          <span className="text-muted-foreground">Active Panes:</span>
          <span className="text-right font-mono">{paneCount}</span>
          <span className="text-muted-foreground">API Calls:</span>
          <span className="text-right font-mono">{globalTotals.metricCount}</span>
        </div>
        {lastUpdateAt && (
          <div className="text-muted-foreground/70 pt-1 border-t">
            Last update: {new Date(lastUpdateAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    );
  }, [globalTotals, paneCount, lastUpdateAt]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
              isOverThreshold
                ? "border-yellow-500/50 bg-yellow-500/10"
                : "border-border bg-muted/50",
              className
            )}
          >
            {/* Cost Icon */}
            <div
              className={cn(
                "flex items-center justify-center rounded-full p-1",
                isOverThreshold ? "text-yellow-500" : "text-emerald-500"
              )}
            >
              {isOverThreshold ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <DollarSign className="h-4 w-4" />
              )}
            </div>

            {/* Cost Amount */}
            <div className="flex flex-col">
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  isOverThreshold ? "text-yellow-500" : "text-foreground"
                )}
              >
                {formatCurrency(globalTotals.totalCostUsd)}
              </span>
              {hasActivity && (
                <span className="text-[10px] text-muted-foreground">
                  {formatTokenCount(totalTokens)} tokens
                </span>
              )}
            </div>

            {/* Activity Indicator */}
            {hasActivity && (
              <Badge
                variant="outline"
                className={cn(
                  "ml-1 text-[10px] px-1.5 py-0",
                  isOverThreshold
                    ? "border-yellow-500/30 text-yellow-500"
                    : "border-emerald-500/30 text-emerald-500"
                )}
              >
                <TrendingUp className="h-3 w-3 mr-0.5" />
                {paneCount}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-48">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
