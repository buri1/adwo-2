/**
 * OTEL Metric Parser
 * Story 4.1 — OTEL Receiver for Cost Metrics
 *
 * Parses OTLP metrics and extracts Claude Code cost/token metrics.
 */

import type {
  OtlpMetricsRequest,
  OtlpKeyValue,
  OtlpAnyValue,
  OtlpNumberDataPoint,
  ParsedMetric,
} from "./types";

/**
 * Metric names from Claude Code OTEL telemetry
 */
export const CLAUDE_METRICS = {
  COST_USAGE: "claude_code.cost.usage",
  TOKEN_INPUT: "claude_code.token.input",
  TOKEN_OUTPUT: "claude_code.token.output",
  TOKEN_CACHE_READ: "claude_code.token.cache_read",
  TOKEN_CACHE_WRITE: "claude_code.token.cache_write",
} as const;

/**
 * Attribute keys used by Claude Code
 */
export const CLAUDE_ATTRIBUTES = {
  SESSION_ID: "session.id",
  PANE_ID: "pane.id",
  MODEL: "model",
} as const;

/**
 * Extract primitive value from OtlpAnyValue
 */
function extractValue(
  value: OtlpAnyValue | undefined
): string | number | boolean | undefined {
  if (!value) return undefined;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.intValue !== undefined) return parseInt(value.intValue, 10);
  if (value.doubleValue !== undefined) return value.doubleValue;
  return undefined;
}

/**
 * Convert OtlpKeyValue array to Record
 */
function attributesToRecord(
  attributes: OtlpKeyValue[] | undefined
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  if (!attributes) return result;

  for (const attr of attributes) {
    const value = extractValue(attr.value);
    if (value !== undefined) {
      result[attr.key] = value;
    }
  }
  return result;
}

/**
 * Extract numeric value from data point
 */
function extractNumericValue(dataPoint: OtlpNumberDataPoint): number {
  if (dataPoint.asDouble !== undefined) return dataPoint.asDouble;
  if (dataPoint.asInt !== undefined) return parseInt(dataPoint.asInt, 10);
  return 0;
}

/**
 * Convert nanosecond timestamp to ISO string
 */
function nanoToIso(nanoTimestamp: string | undefined): string {
  if (!nanoTimestamp) return new Date().toISOString();
  const ms = BigInt(nanoTimestamp) / BigInt(1_000_000);
  return new Date(Number(ms)).toISOString();
}

/**
 * Parse OTLP metrics request and extract relevant Claude Code metrics
 */
export function parseOtlpMetrics(request: OtlpMetricsRequest): ParsedMetric[] {
  const metrics: ParsedMetric[] = [];

  if (!request.resourceMetrics) return metrics;

  for (const resourceMetric of request.resourceMetrics) {
    const resourceAttributes = attributesToRecord(
      resourceMetric.resource?.attributes
    );

    if (!resourceMetric.scopeMetrics) continue;

    for (const scopeMetric of resourceMetric.scopeMetrics) {
      if (!scopeMetric.metrics) continue;

      for (const metric of scopeMetric.metrics) {
        // Get data points from sum or gauge
        const dataPoints =
          metric.sum?.dataPoints || metric.gauge?.dataPoints || [];

        for (const dataPoint of dataPoints) {
          const value = extractNumericValue(dataPoint);
          const attributes = attributesToRecord(dataPoint.attributes);
          const timestamp = nanoToIso(dataPoint.timeUnixNano);

          metrics.push({
            name: metric.name,
            value,
            attributes,
            timestamp,
            resourceAttributes,
          });
        }
      }
    }
  }

  return metrics;
}

/**
 * Check if a metric is a Claude Code metric
 */
export function isClaudeMetric(metricName: string): boolean {
  return metricName.startsWith("claude_code.");
}

/**
 * Filter for only Claude Code related metrics
 */
export function filterClaudeMetrics(metrics: ParsedMetric[]): ParsedMetric[] {
  return metrics.filter((m) => isClaudeMetric(m.name));
}
