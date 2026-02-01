/**
 * CostPanel Component Tests
 * Story 4.2 — Cost Display in Dashboard
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { CostPanel } from "@/components/cost/cost-panel";
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

describe("CostPanel", () => {
  beforeEach(() => {
    useCostStore.getState().clearCosts();
  });

  afterEach(() => {
    useCostStore.getState().clearCosts();
  });

  describe("rendering", () => {
    it("should render panel header", () => {
      render(<CostPanel />);

      expect(screen.getByText("Cost Metrics")).toBeInTheDocument();
    });

    it("should show empty state when no cost data", () => {
      render(<CostPanel />);

      expect(screen.getByText("No cost data yet")).toBeInTheDocument();
      expect(
        screen.getByText("Cost metrics will appear as agents run")
      ).toBeInTheDocument();
    });

    it("should display total cost when data exists", async () => {
      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals({ totalCostUsd: 3.45 });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      render(<CostPanel />);

      // Cost appears in both summary and pane row
      expect(screen.getAllByText("$3.45").length).toBeGreaterThan(0);
      expect(screen.getByText("Total Spent")).toBeInTheDocument();
    });
  });

  describe("token breakdown", () => {
    it("should display token breakdown", async () => {
      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals({
        totalTokens: createTokenUsage({
          input: 5000,
          output: 2500,
          cacheRead: 800,
          cacheWrite: 400,
        }),
      });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      render(<CostPanel />);

      // Check for token type labels
      expect(screen.getByText("Input")).toBeInTheDocument();
      expect(screen.getByText("Output")).toBeInTheDocument();
      expect(screen.getByText("Cache Read")).toBeInTheDocument();
      expect(screen.getByText("Cache Write")).toBeInTheDocument();

      // Check for formatted token values (>= 1000 uses K format)
      expect(screen.getByText("5.0K")).toBeInTheDocument();
      expect(screen.getByText("2.5K")).toBeInTheDocument();
      expect(screen.getByText("800")).toBeInTheDocument();
      expect(screen.getByText("400")).toBeInTheDocument();
    });
  });

  describe("per-pane costs", () => {
    it("should show cost breakdown by pane", async () => {
      const metric1 = createCostMetric({ id: "metric_001", paneId: "%0" });
      const metric2 = createCostMetric({ id: "metric_002", paneId: "%1" });
      const totals1 = createCostTotals({ totalCostUsd: 1.00, metricCount: 5 });
      const totals2 = createCostTotals({ totalCostUsd: 2.00, metricCount: 10 });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric1, totals1, "%0");
        useCostStore.getState().addCostMetric(metric2, totals2, "%1");
      });

      render(<CostPanel />);

      // Check pane IDs are shown
      expect(screen.getByText("%0")).toBeInTheDocument();
      expect(screen.getByText("%1")).toBeInTheDocument();

      // Check call counts
      expect(screen.getByText("5 calls")).toBeInTheDocument();
      expect(screen.getByText("10 calls")).toBeInTheDocument();
    });

    it("should show pane count in header badge", async () => {
      const totals = createCostTotals();

      await act(async () => {
        useCostStore.getState().addCostMetric(
          createCostMetric({ id: "m1", paneId: "%0" }),
          totals,
          "%0"
        );
        useCostStore.getState().addCostMetric(
          createCostMetric({ id: "m2", paneId: "%1" }),
          totals,
          "%1"
        );
        useCostStore.getState().addCostMetric(
          createCostMetric({ id: "m3", paneId: "%2" }),
          totals,
          "%2"
        );
      });

      render(<CostPanel />);

      expect(screen.getByText("3 panes")).toBeInTheDocument();
    });

    it("should expand pane row to show details", async () => {
      const metric = createCostMetric({ id: "metric_001", paneId: "%0" });
      const totals = createCostTotals({
        totalTokens: createTokenUsage({ input: 5000 }),
        lastMetricAt: "2024-01-01T15:30:00Z",
      });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      render(<CostPanel />);

      // Click on pane row to expand
      const paneRow = screen.getByText("%0").closest("button");
      expect(paneRow).toBeInTheDocument();
      fireEvent.click(paneRow!);

      // Should show compact token breakdown in expanded view (uses "Label:" format)
      expect(screen.getAllByText("Input:").length).toBeGreaterThan(0);
    });

    it("should collapse all panes by default", async () => {
      const totals = createCostTotals();

      await act(async () => {
        useCostStore.getState().addCostMetric(
          createCostMetric({ id: "m1", paneId: "%0" }),
          totals,
          "%0"
        );
        useCostStore.getState().addCostMetric(
          createCostMetric({ id: "m2", paneId: "%1" }),
          totals,
          "%1"
        );
      });

      render(<CostPanel />);

      // Compact token breakdown text should not be visible initially
      expect(screen.queryByText("Input:")).not.toBeInTheDocument();
    });
  });

  describe("warning threshold", () => {
    it("should not show warning badge when below threshold", async () => {
      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals({ totalCostUsd: 4.99 });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      render(<CostPanel warningThreshold={5.0} />);

      expect(screen.queryByText(/Over \$/)).not.toBeInTheDocument();
    });

    it("should show warning badge when at or above threshold", async () => {
      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals({ totalCostUsd: 5.0 });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      render(<CostPanel warningThreshold={5.0} />);

      expect(screen.getByText("Over $5")).toBeInTheDocument();
    });

    it("should apply warning styling to total cost", async () => {
      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals({ totalCostUsd: 10.0 });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      const { container } = render(<CostPanel warningThreshold={5.0} />);

      // Total cost should have yellow color
      expect(container.querySelector(".text-yellow-500")).toBeInTheDocument();
    });
  });

  describe("expand/collapse all", () => {
    it("should show expand all button when multiple panes exist", async () => {
      const totals = createCostTotals();

      await act(async () => {
        useCostStore.getState().addCostMetric(
          createCostMetric({ id: "m1", paneId: "%0" }),
          totals,
          "%0"
        );
        useCostStore.getState().addCostMetric(
          createCostMetric({ id: "m2", paneId: "%1" }),
          totals,
          "%1"
        );
      });

      render(<CostPanel />);

      expect(screen.getByText("Expand All")).toBeInTheDocument();
    });

    it("should expand all panes when clicking expand all", async () => {
      const totals = createCostTotals();

      await act(async () => {
        useCostStore.getState().addCostMetric(
          createCostMetric({ id: "m1", paneId: "%0" }),
          totals,
          "%0"
        );
        useCostStore.getState().addCostMetric(
          createCostMetric({ id: "m2", paneId: "%1" }),
          totals,
          "%1"
        );
      });

      render(<CostPanel />);

      fireEvent.click(screen.getByText("Expand All"));

      // Both panes should show expanded content
      const inputLabels = screen.getAllByText("Input:");
      expect(inputLabels.length).toBe(2);

      // Button should now say collapse
      expect(screen.getByText("Collapse All")).toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("should apply custom className", () => {
      const { container } = render(<CostPanel className="custom-class" />);

      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });

    it("should apply custom maxHeight", () => {
      const { container } = render(<CostPanel maxHeight="h-[500px]" />);

      expect(container.querySelector(".h-\\[500px\\]")).toBeInTheDocument();
    });
  });

  describe("real-time updates", () => {
    it("should update when cost store changes", async () => {
      const { rerender } = render(<CostPanel />);

      expect(screen.getByText("No cost data yet")).toBeInTheDocument();

      const metric = createCostMetric({ id: "metric_001" });
      const totals = createCostTotals({ totalCostUsd: 1.50 });

      await act(async () => {
        useCostStore.getState().addCostMetric(metric, totals, "%0");
      });

      rerender(<CostPanel />);

      // Should show cost value (appears in global summary and pane row)
      expect(screen.getAllByText("$1.50").length).toBeGreaterThan(0);
      expect(screen.queryByText("No cost data yet")).not.toBeInTheDocument();
    });
  });
});
