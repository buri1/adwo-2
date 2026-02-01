/**
 * Cost Aggregator
 * Story 4.1 — OTEL Receiver for Cost Metrics
 *
 * Aggregates cost metrics by pane/session and maintains totals.
 */

import { randomUUID } from "crypto";
import type { CostMetric, CostTotals, TokenUsage } from "@adwo/shared";
import type { ParsedMetric } from "./types";
import { CLAUDE_METRICS, CLAUDE_ATTRIBUTES } from "./metric-parser";

const MAX_RECENT_METRICS = 100;

/**
 * Creates an empty token usage object
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
 * Pane cost state
 */
interface PaneCostData {
  sessionId: string | null;
  totals: CostTotals;
  recentMetrics: CostMetric[];
}

/**
 * Cost Aggregator - maintains cost totals by pane
 */
export class CostAggregator {
  private paneData: Map<string, PaneCostData> = new Map();
  private listeners: Set<(metric: CostMetric, totals: CostTotals, paneId: string) => void> = new Set();

  /**
   * Process parsed metrics and aggregate cost data
   * Returns the newly created CostMetric if cost/token metrics were found
   */
  public processMetrics(metrics: ParsedMetric[]): CostMetric | null {
    // Group metrics by pane to build a single CostMetric per batch
    const metricsByPane = new Map<string, ParsedMetric[]>();

    for (const metric of metrics) {
      const paneId = this.extractPaneId(metric);
      if (!paneId) continue;

      if (!metricsByPane.has(paneId)) {
        metricsByPane.set(paneId, []);
      }
      metricsByPane.get(paneId)!.push(metric);
    }

    // Process each pane's metrics
    let lastMetric: CostMetric | null = null;

    for (const [paneId, paneMetrics] of metricsByPane) {
      const costMetric = this.createCostMetric(paneId, paneMetrics);
      if (costMetric) {
        this.aggregateMetric(paneId, costMetric);
        lastMetric = costMetric;

        // Notify listeners
        const data = this.paneData.get(paneId);
        if (data) {
          for (const listener of this.listeners) {
            listener(costMetric, data.totals, paneId);
          }
        }
      }
    }

    return lastMetric;
  }

  /**
   * Extract pane ID from metric attributes
   */
  private extractPaneId(metric: ParsedMetric): string | null {
    // Check metric attributes first, then resource attributes
    const paneId =
      metric.attributes[CLAUDE_ATTRIBUTES.PANE_ID] ||
      metric.resourceAttributes[CLAUDE_ATTRIBUTES.PANE_ID];

    return typeof paneId === "string" ? paneId : null;
  }

  /**
   * Extract session ID from metric attributes
   */
  private extractSessionId(metric: ParsedMetric): string | null {
    const sessionId =
      metric.attributes[CLAUDE_ATTRIBUTES.SESSION_ID] ||
      metric.resourceAttributes[CLAUDE_ATTRIBUTES.SESSION_ID];

    return typeof sessionId === "string" ? sessionId : null;
  }

  /**
   * Create a CostMetric from parsed metrics
   */
  private createCostMetric(
    paneId: string,
    metrics: ParsedMetric[]
  ): CostMetric | null {
    if (metrics.length === 0) return null;

    let costUsd = 0;
    const tokens: TokenUsage = createEmptyTokenUsage();
    let sessionId: string | null = null;
    // Start with the first metric's timestamp
    let timestamp = metrics[0]!.timestamp;

    for (const metric of metrics) {
      // Extract session ID from any metric
      if (!sessionId) {
        sessionId = this.extractSessionId(metric);
      }

      // Use the latest timestamp (string comparison works for ISO 8601)
      if (metric.timestamp > timestamp) {
        timestamp = metric.timestamp;
      }

      switch (metric.name) {
        case CLAUDE_METRICS.COST_USAGE:
          costUsd += metric.value;
          break;
        case CLAUDE_METRICS.TOKEN_INPUT:
          tokens.input += metric.value;
          break;
        case CLAUDE_METRICS.TOKEN_OUTPUT:
          tokens.output += metric.value;
          break;
        case CLAUDE_METRICS.TOKEN_CACHE_READ:
          tokens.cacheRead += metric.value;
          break;
        case CLAUDE_METRICS.TOKEN_CACHE_WRITE:
          tokens.cacheWrite += metric.value;
          break;
      }
    }

    // Only create metric if we have cost or token data
    if (costUsd === 0 && tokens.input === 0 && tokens.output === 0) {
      return null;
    }

    return {
      id: randomUUID(),
      paneId,
      sessionId: sessionId || "unknown",
      costUsd,
      tokens,
      timestamp,
    };
  }

  /**
   * Aggregate a cost metric into pane totals
   */
  private aggregateMetric(paneId: string, metric: CostMetric): void {
    let data = this.paneData.get(paneId);

    if (!data) {
      data = {
        sessionId: metric.sessionId,
        totals: createEmptyCostTotals(),
        recentMetrics: [],
      };
      this.paneData.set(paneId, data);
    }

    // Update session ID if present
    if (metric.sessionId !== "unknown") {
      data.sessionId = metric.sessionId;
    }

    // Update totals
    data.totals.totalCostUsd += metric.costUsd;
    data.totals.totalTokens.input += metric.tokens.input;
    data.totals.totalTokens.output += metric.tokens.output;
    data.totals.totalTokens.cacheRead += metric.tokens.cacheRead;
    data.totals.totalTokens.cacheWrite += metric.tokens.cacheWrite;
    data.totals.metricCount += 1;

    if (!data.totals.firstMetricAt) {
      data.totals.firstMetricAt = metric.timestamp;
    }
    data.totals.lastMetricAt = metric.timestamp;

    // Add to recent metrics, trim if needed
    data.recentMetrics.push(metric);
    if (data.recentMetrics.length > MAX_RECENT_METRICS) {
      data.recentMetrics.shift();
    }
  }

  /**
   * Get totals for a specific pane
   */
  public getTotals(paneId: string): CostTotals {
    return this.paneData.get(paneId)?.totals || createEmptyCostTotals();
  }

  /**
   * Get all pane IDs with cost data
   */
  public getPaneIds(): string[] {
    return Array.from(this.paneData.keys());
  }

  /**
   * Get recent metrics for a pane
   */
  public getRecentMetrics(paneId: string): CostMetric[] {
    return this.paneData.get(paneId)?.recentMetrics || [];
  }

  /**
   * Register a listener for new cost metrics
   */
  public onMetric(
    listener: (metric: CostMetric, totals: CostTotals, paneId: string) => void
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all data
   */
  public clear(): void {
    this.paneData.clear();
  }

  /**
   * Clear data for a specific pane
   */
  public clearPane(paneId: string): void {
    this.paneData.delete(paneId);
  }
}
