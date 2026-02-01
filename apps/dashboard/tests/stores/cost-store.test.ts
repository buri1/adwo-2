/**
 * ADWO 2.0 Cost Store Tests
 * Story 4.1 — OTEL Receiver for Cost Metrics
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useCostStore } from "../../src/stores/cost-store";
import type { CostMetric, CostTotals, TokenUsage } from "@adwo/shared";

function createTokenUsage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return {
    input: 100,
    output: 50,
    cacheRead: 10,
    cacheWrite: 5,
    ...overrides,
  };
}

function createCostTotals(overrides: Partial<CostTotals> = {}): CostTotals {
  return {
    totalCostUsd: 0.01,
    totalTokens: createTokenUsage(),
    metricCount: 1,
    firstMetricAt: "2024-01-01T10:00:00Z",
    lastMetricAt: "2024-01-01T10:00:00Z",
    ...overrides,
  };
}

function createCostMetric(overrides: Partial<CostMetric> = {}): CostMetric {
  return {
    id: `metric_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    paneId: "%0",
    sessionId: "session_123",
    costUsd: 0.01,
    tokens: createTokenUsage(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("CostStore", () => {
  beforeEach(() => {
    useCostStore.getState().clearCosts();
  });

  describe("initial state", () => {
    it("should start with empty state", () => {
      const state = useCostStore.getState();
      expect(state.paneData).toEqual({});
      expect(state.globalTotals.totalCostUsd).toBe(0);
      expect(state.globalTotals.metricCount).toBe(0);
      expect(state.lastMetric).toBeNull();
      expect(state.lastUpdateAt).toBeNull();
    });
  });

  describe("addCostMetric", () => {
    it("should add a cost metric for a pane", () => {
      const metric = createCostMetric({ id: "metric_001", paneId: "%0" });
      const totals = createCostTotals();

      useCostStore.getState().addCostMetric(metric, totals, "%0");

      const state = useCostStore.getState();
      expect(state.paneData["%0"]).toBeDefined();
      expect(state.paneData["%0"]!.recentMetrics).toHaveLength(1);
      expect(state.paneData["%0"]!.totals).toEqual(totals);
      expect(state.lastMetric).toEqual(metric);
      expect(state.lastUpdateAt).not.toBeNull();
    });

    it("should track multiple panes separately", () => {
      const metric1 = createCostMetric({ id: "metric_001", paneId: "%0" });
      const metric2 = createCostMetric({ id: "metric_002", paneId: "%1" });
      const totals1 = createCostTotals({ totalCostUsd: 0.01 });
      const totals2 = createCostTotals({ totalCostUsd: 0.02 });

      useCostStore.getState().addCostMetric(metric1, totals1, "%0");
      useCostStore.getState().addCostMetric(metric2, totals2, "%1");

      const state = useCostStore.getState();
      expect(Object.keys(state.paneData)).toHaveLength(2);
      expect(state.paneData["%0"]!.totals.totalCostUsd).toBe(0.01);
      expect(state.paneData["%1"]!.totals.totalCostUsd).toBe(0.02);
    });

    it("should calculate global totals from all panes", () => {
      const metric1 = createCostMetric({ id: "metric_001", paneId: "%0" });
      const metric2 = createCostMetric({ id: "metric_002", paneId: "%1" });
      const totals1 = createCostTotals({
        totalCostUsd: 0.01,
        totalTokens: createTokenUsage({ input: 100, output: 50 }),
      });
      const totals2 = createCostTotals({
        totalCostUsd: 0.02,
        totalTokens: createTokenUsage({ input: 200, output: 100 }),
      });

      useCostStore.getState().addCostMetric(metric1, totals1, "%0");
      useCostStore.getState().addCostMetric(metric2, totals2, "%1");

      const state = useCostStore.getState();
      expect(state.globalTotals.totalCostUsd).toBe(0.03);
      expect(state.globalTotals.totalTokens.input).toBe(300);
      expect(state.globalTotals.totalTokens.output).toBe(150);
    });

    it("should not add duplicate metrics", () => {
      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals();

      useCostStore.getState().addCostMetric(metric, totals, "%0");
      useCostStore.getState().addCostMetric(metric, totals, "%0");

      const state = useCostStore.getState();
      expect(state.paneData["%0"]!.recentMetrics).toHaveLength(1);
    });

    it("should trim recent metrics to max limit", () => {
      const totals = createCostTotals();

      // Add 51 metrics (max is 50)
      for (let i = 0; i < 51; i++) {
        const metric = createCostMetric({
          id: `metric_${i.toString().padStart(3, "0")}`,
        });
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      }

      const state = useCostStore.getState();
      expect(state.paneData["%0"]!.recentMetrics).toHaveLength(50);
      // First metric should be removed (oldest)
      expect(state.paneData["%0"]!.recentMetrics[0]!.id).toBe("metric_001");
    });
  });

  describe("getPaneTotals", () => {
    it("should return totals for existing pane", () => {
      const metric = createCostMetric({ paneId: "%0" });
      const totals = createCostTotals({ totalCostUsd: 0.05 });

      useCostStore.getState().addCostMetric(metric, totals, "%0");

      const result = useCostStore.getState().getPaneTotals("%0");
      expect(result.totalCostUsd).toBe(0.05);
    });

    it("should return empty totals for non-existent pane", () => {
      const result = useCostStore.getState().getPaneTotals("%99");
      expect(result.totalCostUsd).toBe(0);
      expect(result.metricCount).toBe(0);
    });
  });

  describe("getPaneRecentMetrics", () => {
    it("should return recent metrics for existing pane", () => {
      const metric = createCostMetric({ id: "metric_001", paneId: "%0" });
      const totals = createCostTotals();

      useCostStore.getState().addCostMetric(metric, totals, "%0");

      const result = useCostStore.getState().getPaneRecentMetrics("%0");
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("metric_001");
    });

    it("should return empty array for non-existent pane", () => {
      const result = useCostStore.getState().getPaneRecentMetrics("%99");
      expect(result).toEqual([]);
    });
  });

  describe("getPaneIds", () => {
    it("should return all pane IDs with cost data", () => {
      const totals = createCostTotals();

      useCostStore.getState().addCostMetric(
        createCostMetric({ paneId: "%0" }),
        totals,
        "%0"
      );
      useCostStore.getState().addCostMetric(
        createCostMetric({ paneId: "%1" }),
        totals,
        "%1"
      );
      useCostStore.getState().addCostMetric(
        createCostMetric({ paneId: "%2" }),
        totals,
        "%2"
      );

      const result = useCostStore.getState().getPaneIds();
      expect(result).toHaveLength(3);
      expect(result).toContain("%0");
      expect(result).toContain("%1");
      expect(result).toContain("%2");
    });
  });

  describe("clearCosts", () => {
    it("should clear all cost data", () => {
      const totals = createCostTotals();

      useCostStore.getState().addCostMetric(
        createCostMetric({ paneId: "%0" }),
        totals,
        "%0"
      );
      useCostStore.getState().addCostMetric(
        createCostMetric({ paneId: "%1" }),
        totals,
        "%1"
      );

      useCostStore.getState().clearCosts();

      const state = useCostStore.getState();
      expect(state.paneData).toEqual({});
      expect(state.globalTotals.totalCostUsd).toBe(0);
      expect(state.lastMetric).toBeNull();
    });
  });

  describe("clearPaneCosts", () => {
    it("should clear cost data for specific pane only", () => {
      const totals1 = createCostTotals({ totalCostUsd: 0.01 });
      const totals2 = createCostTotals({ totalCostUsd: 0.02 });

      useCostStore.getState().addCostMetric(
        createCostMetric({ paneId: "%0" }),
        totals1,
        "%0"
      );
      useCostStore.getState().addCostMetric(
        createCostMetric({ paneId: "%1" }),
        totals2,
        "%1"
      );

      useCostStore.getState().clearPaneCosts("%0");

      const state = useCostStore.getState();
      expect(state.paneData["%0"]).toBeUndefined();
      expect(state.paneData["%1"]).toBeDefined();
      expect(state.globalTotals.totalCostUsd).toBe(0.02);
    });

    it("should clear lastMetric if it was from cleared pane", () => {
      const metric = createCostMetric({ id: "metric_001", paneId: "%0" });
      const totals = createCostTotals();

      useCostStore.getState().addCostMetric(metric, totals, "%0");
      expect(useCostStore.getState().lastMetric).not.toBeNull();

      useCostStore.getState().clearPaneCosts("%0");
      expect(useCostStore.getState().lastMetric).toBeNull();
    });
  });
});
