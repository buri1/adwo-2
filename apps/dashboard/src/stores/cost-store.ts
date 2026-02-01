/**
 * ADWO 2.0 Cost Store
 * Story 4.1 — OTEL Receiver for Cost Metrics
 *
 * Manages cost metrics state for the dashboard.
 * Receives cost_update events via WebSocket and maintains totals by pane.
 */

import { create } from "zustand";
import type { CostMetric, CostTotals, TokenUsage } from "@adwo/shared";

const MAX_RECENT_METRICS = 50;

/**
 * Creates empty token usage
 */
function createEmptyTokenUsage(): TokenUsage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  };
}

/**
 * Creates empty cost totals
 */
function createEmptyCostTotals(): CostTotals {
  return {
    totalCostUsd: 0,
    totalTokens: createEmptyTokenUsage(),
    metricCount: 0,
    firstMetricAt: null,
    lastMetricAt: null,
  };
}

/**
 * Pane cost data
 */
export interface PaneCostData {
  paneId: string;
  totals: CostTotals;
  recentMetrics: CostMetric[];
}

export interface CostState {
  /** Cost data by pane ID */
  paneData: Record<string, PaneCostData>;
  /** Global totals across all panes */
  globalTotals: CostTotals;
  /** Last received metric */
  lastMetric: CostMetric | null;
  /** Last update timestamp */
  lastUpdateAt: string | null;
}

interface CostActions {
  /** Add a cost metric and update totals */
  addCostMetric: (metric: CostMetric, totals: CostTotals, paneId: string) => void;
  /** Get totals for a specific pane */
  getPaneTotals: (paneId: string) => CostTotals;
  /** Get recent metrics for a pane */
  getPaneRecentMetrics: (paneId: string) => CostMetric[];
  /** Get all pane IDs with cost data */
  getPaneIds: () => string[];
  /** Clear all cost data */
  clearCosts: () => void;
  /** Clear cost data for a specific pane */
  clearPaneCosts: (paneId: string) => void;
}

const initialState: CostState = {
  paneData: {},
  globalTotals: createEmptyCostTotals(),
  lastMetric: null,
  lastUpdateAt: null,
};

export const useCostStore = create<CostState & CostActions>((set, get) => ({
  ...initialState,

  addCostMetric: (metric: CostMetric, totals: CostTotals, paneId: string) =>
    set((state) => {
      // Get or create pane data
      const existingPaneData = state.paneData[paneId];

      // Check for duplicate metric
      if (existingPaneData?.recentMetrics.some((m) => m.id === metric.id)) {
        return state;
      }

      // Update pane data
      const newRecentMetrics = existingPaneData
        ? [...existingPaneData.recentMetrics, metric]
        : [metric];

      // Trim to max size
      if (newRecentMetrics.length > MAX_RECENT_METRICS) {
        newRecentMetrics.shift();
      }

      const newPaneData: PaneCostData = {
        paneId,
        totals, // Use server-provided totals
        recentMetrics: newRecentMetrics,
      };

      // Recalculate global totals from all panes
      const allPaneData = {
        ...state.paneData,
        [paneId]: newPaneData,
      };

      const globalTotals = Object.values(allPaneData).reduce(
        (acc, data) => ({
          totalCostUsd: acc.totalCostUsd + data.totals.totalCostUsd,
          totalTokens: {
            input: acc.totalTokens.input + data.totals.totalTokens.input,
            output: acc.totalTokens.output + data.totals.totalTokens.output,
            cacheRead: acc.totalTokens.cacheRead + data.totals.totalTokens.cacheRead,
            cacheWrite: acc.totalTokens.cacheWrite + data.totals.totalTokens.cacheWrite,
          },
          metricCount: acc.metricCount + data.totals.metricCount,
          firstMetricAt:
            !acc.firstMetricAt ||
            (data.totals.firstMetricAt && data.totals.firstMetricAt < acc.firstMetricAt)
              ? data.totals.firstMetricAt
              : acc.firstMetricAt,
          lastMetricAt:
            !acc.lastMetricAt ||
            (data.totals.lastMetricAt && data.totals.lastMetricAt > acc.lastMetricAt)
              ? data.totals.lastMetricAt
              : acc.lastMetricAt,
        }),
        createEmptyCostTotals()
      );

      return {
        paneData: allPaneData,
        globalTotals,
        lastMetric: metric,
        lastUpdateAt: new Date().toISOString(),
      };
    }),

  getPaneTotals: (paneId: string) => {
    const paneData = get().paneData[paneId];
    return paneData?.totals ?? createEmptyCostTotals();
  },

  getPaneRecentMetrics: (paneId: string) => {
    const paneData = get().paneData[paneId];
    return paneData?.recentMetrics ?? [];
  },

  getPaneIds: () => {
    return Object.keys(get().paneData);
  },

  clearCosts: () => set(initialState),

  clearPaneCosts: (paneId: string) =>
    set((state) => {
      const { [paneId]: removed, ...remainingPaneData } = state.paneData;

      // Recalculate global totals
      const globalTotals = Object.values(remainingPaneData).reduce(
        (acc, data) => ({
          totalCostUsd: acc.totalCostUsd + data.totals.totalCostUsd,
          totalTokens: {
            input: acc.totalTokens.input + data.totals.totalTokens.input,
            output: acc.totalTokens.output + data.totals.totalTokens.output,
            cacheRead: acc.totalTokens.cacheRead + data.totals.totalTokens.cacheRead,
            cacheWrite: acc.totalTokens.cacheWrite + data.totals.totalTokens.cacheWrite,
          },
          metricCount: acc.metricCount + data.totals.metricCount,
          firstMetricAt:
            !acc.firstMetricAt ||
            (data.totals.firstMetricAt && data.totals.firstMetricAt < acc.firstMetricAt)
              ? data.totals.firstMetricAt
              : acc.firstMetricAt,
          lastMetricAt:
            !acc.lastMetricAt ||
            (data.totals.lastMetricAt && data.totals.lastMetricAt > acc.lastMetricAt)
              ? data.totals.lastMetricAt
              : acc.lastMetricAt,
        }),
        createEmptyCostTotals()
      );

      return {
        paneData: remainingPaneData,
        globalTotals,
        lastMetric:
          state.lastMetric?.paneId === paneId ? null : state.lastMetric,
        lastUpdateAt: state.lastUpdateAt,
      };
    }),
}));
