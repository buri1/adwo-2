/**
 * Cost Aggregator Tests
 * Story 4.1 — OTEL Receiver for Cost Metrics
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CostAggregator } from "../../src/lib/otel/cost-aggregator";
import { CLAUDE_METRICS, CLAUDE_ATTRIBUTES } from "../../src/lib/otel/metric-parser";
import type { ParsedMetric } from "../../src/lib/otel/types";
import type { CostMetric, CostTotals } from "@adwo/shared";

function createParsedMetric(
  name: string,
  value: number,
  attributes: Record<string, string | number | boolean> = {}
): ParsedMetric {
  return {
    name,
    value,
    attributes: {
      [CLAUDE_ATTRIBUTES.PANE_ID]: "%0",
      [CLAUDE_ATTRIBUTES.SESSION_ID]: "sess_123",
      ...attributes,
    },
    timestamp: new Date().toISOString(),
    resourceAttributes: {},
  };
}

describe("CostAggregator", () => {
  let aggregator: CostAggregator;

  beforeEach(() => {
    aggregator = new CostAggregator();
  });

  describe("processMetrics", () => {
    it("should process cost metric", () => {
      const metrics = [createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.05)];

      const result = aggregator.processMetrics(metrics);

      expect(result).not.toBeNull();
      expect(result!.costUsd).toBe(0.05);
      expect(result!.paneId).toBe("%0");
      expect(result!.sessionId).toBe("sess_123");
    });

    it("should process token metrics", () => {
      const metrics = [
        createParsedMetric(CLAUDE_METRICS.TOKEN_INPUT, 1000),
        createParsedMetric(CLAUDE_METRICS.TOKEN_OUTPUT, 500),
        createParsedMetric(CLAUDE_METRICS.TOKEN_CACHE_READ, 100),
        createParsedMetric(CLAUDE_METRICS.TOKEN_CACHE_WRITE, 50),
      ];

      const result = aggregator.processMetrics(metrics);

      expect(result).not.toBeNull();
      expect(result!.tokens.input).toBe(1000);
      expect(result!.tokens.output).toBe(500);
      expect(result!.tokens.cacheRead).toBe(100);
      expect(result!.tokens.cacheWrite).toBe(50);
    });

    it("should aggregate multiple metrics into one CostMetric", () => {
      const metrics = [
        createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.05),
        createParsedMetric(CLAUDE_METRICS.TOKEN_INPUT, 1000),
        createParsedMetric(CLAUDE_METRICS.TOKEN_OUTPUT, 500),
      ];

      const result = aggregator.processMetrics(metrics);

      expect(result).not.toBeNull();
      expect(result!.costUsd).toBe(0.05);
      expect(result!.tokens.input).toBe(1000);
      expect(result!.tokens.output).toBe(500);
    });

    it("should return null for empty metrics", () => {
      const result = aggregator.processMetrics([]);
      expect(result).toBeNull();
    });

    it("should return null for metrics without pane ID", () => {
      const metrics = [
        {
          name: CLAUDE_METRICS.COST_USAGE,
          value: 0.05,
          attributes: {}, // No pane ID
          timestamp: new Date().toISOString(),
          resourceAttributes: {},
        },
      ];

      const result = aggregator.processMetrics(metrics);
      expect(result).toBeNull();
    });

    it("should return null if no cost or token data", () => {
      const metrics = [
        createParsedMetric("some.other.metric", 100),
      ];

      const result = aggregator.processMetrics(metrics);
      expect(result).toBeNull();
    });

    it("should get pane ID from resource attributes", () => {
      const metrics: ParsedMetric[] = [
        {
          name: CLAUDE_METRICS.COST_USAGE,
          value: 0.05,
          attributes: {},
          timestamp: new Date().toISOString(),
          resourceAttributes: {
            [CLAUDE_ATTRIBUTES.PANE_ID]: "%1",
          },
        },
      ];

      const result = aggregator.processMetrics(metrics);
      expect(result).not.toBeNull();
      expect(result!.paneId).toBe("%1");
    });
  });

  describe("getTotals", () => {
    it("should return empty totals for unknown pane", () => {
      const totals = aggregator.getTotals("%99");

      expect(totals.totalCostUsd).toBe(0);
      expect(totals.metricCount).toBe(0);
      expect(totals.totalTokens.input).toBe(0);
    });

    it("should accumulate totals across multiple processMetrics calls", () => {
      aggregator.processMetrics([
        createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.05),
        createParsedMetric(CLAUDE_METRICS.TOKEN_INPUT, 1000),
      ]);

      aggregator.processMetrics([
        createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.03),
        createParsedMetric(CLAUDE_METRICS.TOKEN_INPUT, 500),
      ]);

      const totals = aggregator.getTotals("%0");

      expect(totals.totalCostUsd).toBe(0.08);
      expect(totals.totalTokens.input).toBe(1500);
      expect(totals.metricCount).toBe(2);
    });

    it("should track first and last metric timestamps", () => {
      const metrics1 = [
        {
          ...createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.05),
          timestamp: "2024-01-01T10:00:00Z",
        },
      ];

      const metrics2 = [
        {
          ...createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.03),
          timestamp: "2024-01-01T11:00:00Z",
        },
      ];

      aggregator.processMetrics(metrics1);
      aggregator.processMetrics(metrics2);

      const totals = aggregator.getTotals("%0");

      expect(totals.firstMetricAt).toBe("2024-01-01T10:00:00Z");
      expect(totals.lastMetricAt).toBe("2024-01-01T11:00:00Z");
    });
  });

  describe("getPaneIds", () => {
    it("should return all pane IDs with data", () => {
      aggregator.processMetrics([
        createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.05, {
          [CLAUDE_ATTRIBUTES.PANE_ID]: "%0",
        }),
      ]);

      aggregator.processMetrics([
        createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.03, {
          [CLAUDE_ATTRIBUTES.PANE_ID]: "%1",
        }),
      ]);

      const paneIds = aggregator.getPaneIds();
      expect(paneIds).toContain("%0");
      expect(paneIds).toContain("%1");
    });
  });

  describe("getRecentMetrics", () => {
    it("should return recent metrics for pane", () => {
      aggregator.processMetrics([
        createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.05),
      ]);

      aggregator.processMetrics([
        createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.03),
      ]);

      const recent = aggregator.getRecentMetrics("%0");
      expect(recent).toHaveLength(2);
    });

    it("should return empty array for unknown pane", () => {
      const recent = aggregator.getRecentMetrics("%99");
      expect(recent).toEqual([]);
    });
  });

  describe("onMetric listener", () => {
    it("should call listener when metric is processed", () => {
      const listener = vi.fn();
      aggregator.onMetric(listener);

      aggregator.processMetrics([
        createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.05),
      ]);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ costUsd: 0.05 }),
        expect.objectContaining({ totalCostUsd: 0.05 }),
        "%0"
      );
    });

    it("should return unsubscribe function", () => {
      const listener = vi.fn();
      const unsubscribe = aggregator.onMetric(listener);

      unsubscribe();

      aggregator.processMetrics([
        createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.05),
      ]);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("should clear all data", () => {
      aggregator.processMetrics([
        createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.05),
      ]);

      aggregator.clear();

      expect(aggregator.getPaneIds()).toHaveLength(0);
      expect(aggregator.getTotals("%0").totalCostUsd).toBe(0);
    });
  });

  describe("clearPane", () => {
    it("should clear data for specific pane", () => {
      aggregator.processMetrics([
        createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.05, {
          [CLAUDE_ATTRIBUTES.PANE_ID]: "%0",
        }),
      ]);

      aggregator.processMetrics([
        createParsedMetric(CLAUDE_METRICS.COST_USAGE, 0.03, {
          [CLAUDE_ATTRIBUTES.PANE_ID]: "%1",
        }),
      ]);

      aggregator.clearPane("%0");

      expect(aggregator.getTotals("%0").totalCostUsd).toBe(0);
      expect(aggregator.getTotals("%1").totalCostUsd).toBe(0.03);
    });
  });
});
