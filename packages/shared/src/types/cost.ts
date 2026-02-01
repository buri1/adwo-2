/**
 * ADWO 2.0 Cost Metric Types
 * Story 4.1 — OTEL Receiver for Cost Metrics
 *
 * Types for OpenTelemetry cost and token usage metrics from Claude Code.
 */

/**
 * Token usage breakdown from Claude Code
 */
export interface TokenUsage {
  /** Input tokens consumed */
  input: number;
  /** Output tokens generated */
  output: number;
  /** Cache read tokens */
  cacheRead: number;
  /** Cache write tokens */
  cacheWrite: number;
}

/**
 * Cost metric from Claude Code OTEL telemetry
 */
export interface CostMetric {
  /** Unique metric ID */
  id: string;
  /** Associated pane ID */
  paneId: string;
  /** Session ID from Claude Code */
  sessionId: string;
  /** Cost in USD */
  costUsd: number;
  /** Token usage breakdown */
  tokens: TokenUsage;
  /** Timestamp when metric was received */
  timestamp: string;
}

/**
 * Aggregated cost totals for a session/pane
 */
export interface CostTotals {
  /** Total cost in USD */
  totalCostUsd: number;
  /** Total token usage */
  totalTokens: TokenUsage;
  /** Number of metrics aggregated */
  metricCount: number;
  /** First metric timestamp */
  firstMetricAt: string | null;
  /** Last metric timestamp */
  lastMetricAt: string | null;
}

/**
 * Cost state for a specific pane
 */
export interface PaneCostState {
  paneId: string;
  sessionId: string | null;
  totals: CostTotals;
  /** Recent metrics (last N) */
  recentMetrics: CostMetric[];
}
