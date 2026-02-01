/**
 * CostIndicator Component Tests
 * Story 4.2 — Cost Display in Dashboard
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { CostIndicator } from "@/components/cost/cost-indicator";
import { useCostStore } from "@/stores/cost-store";
import type { CostMetric, CostTotals, TokenUsage } from "@adwo/shared";

function createTokenUsage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return {
    input: 1000,
    output: 500,
    cacheRead: 100,
    cacheWrite: 50,
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

describe("CostIndicator", () => {
  beforeEach(() => {
    useCostStore.getState().clearCosts();
  });

  afterEach(() => {
    useCostStore.getState().clearCosts();
  });

  describe("rendering", () => {
    it("should render with zero cost when no data", () => {
      render(<CostIndicator />);

      expect(screen.getByText("$0.00")).toBeInTheDocument();
    });

    it("should display current cost in USD", async () => {
      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals({ totalCostUsd: 1.23 });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      render(<CostIndicator />);

      expect(screen.getByText("$1.23")).toBeInTheDocument();
    });

    it("should format small amounts with more precision", async () => {
      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals({ totalCostUsd: 0.0025 });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      render(<CostIndicator />);

      expect(screen.getByText("$0.0025")).toBeInTheDocument();
    });

    it("should show token count when activity exists", async () => {
      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals({
        totalTokens: createTokenUsage({
          input: 1500,
          output: 500,
          cacheRead: 0,
          cacheWrite: 0,
        }),
      });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      render(<CostIndicator />);

      // 1500 + 500 = 2000 tokens = 2.0K
      expect(screen.getByText("2.0K tokens")).toBeInTheDocument();
    });

    it("should show pane count badge when active", async () => {
      const metric1 = createCostMetric({ id: "metric_001", paneId: "%0" });
      const metric2 = createCostMetric({ id: "metric_002", paneId: "%1" });
      const totals = createCostTotals();

      await act(async () => {
        useCostStore.getState().addCostMetric(metric1, totals, "%0");
        useCostStore.getState().addCostMetric(metric2, totals, "%1");
      });

      const { container } = render(<CostIndicator />);

      // Should have a badge showing pane count (contains TrendingUp icon)
      const badge = container.querySelector(".lucide-trending-up");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("warning threshold", () => {
    it("should not show warning when below threshold", async () => {
      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals({ totalCostUsd: 4.99 });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      const { container } = render(<CostIndicator warningThreshold={5.0} />);

      // Should have emerald color (not yellow)
      expect(container.querySelector(".text-emerald-500")).toBeInTheDocument();
      expect(container.querySelector(".text-yellow-500")).not.toBeInTheDocument();
    });

    it("should show warning when at or above threshold", async () => {
      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals({ totalCostUsd: 5.0 });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      const { container } = render(<CostIndicator warningThreshold={5.0} />);

      // Should have yellow color
      expect(container.querySelector(".text-yellow-500")).toBeInTheDocument();
    });

    it("should respect custom threshold", async () => {
      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals({ totalCostUsd: 2.5 });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      const { container } = render(<CostIndicator warningThreshold={2.0} />);

      // Should show warning at custom threshold
      expect(container.querySelector(".text-yellow-500")).toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("should apply custom className", () => {
      const { container } = render(<CostIndicator className="custom-class" />);

      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });
  });

  describe("real-time updates", () => {
    it("should update when cost store changes", async () => {
      const { rerender } = render(<CostIndicator />);

      expect(screen.getByText("$0.00")).toBeInTheDocument();

      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals({ totalCostUsd: 2.50 });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      rerender(<CostIndicator />);

      expect(screen.getByText("$2.50")).toBeInTheDocument();
    });
  });
});
