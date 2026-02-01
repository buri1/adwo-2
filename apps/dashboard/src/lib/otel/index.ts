/**
 * OTEL Module
 * Story 4.1 — OTEL Receiver for Cost Metrics
 *
 * OpenTelemetry receiver for Claude Code cost and token metrics.
 */

export { OtelReceiver, getOtelReceiver, resetOtelReceiver } from "./otel-receiver";
export type { OtelReceiverOptions } from "./otel-receiver";

export { CostAggregator } from "./cost-aggregator";

export {
  parseOtlpMetrics,
  filterClaudeMetrics,
  isClaudeMetric,
  CLAUDE_METRICS,
  CLAUDE_ATTRIBUTES,
} from "./metric-parser";

export type {
  OtlpMetricsRequest,
  OtlpResourceMetrics,
  OtlpScopeMetrics,
  OtlpMetric,
  ParsedMetric,
} from "./types";
