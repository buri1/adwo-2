/**
 * OTEL Protocol Types
 * Story 4.1 — OTEL Receiver for Cost Metrics
 *
 * Types for OTLP/HTTP JSON format as defined by OpenTelemetry spec.
 */

/**
 * OTLP Attribute value types
 */
export interface OtlpAnyValue {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: string; // int64 as string
  doubleValue?: number;
  arrayValue?: { values: OtlpAnyValue[] };
  kvlistValue?: { values: OtlpKeyValue[] };
  bytesValue?: string; // base64
}

export interface OtlpKeyValue {
  key: string;
  value: OtlpAnyValue;
}

/**
 * OTLP Resource
 */
export interface OtlpResource {
  attributes?: OtlpKeyValue[];
  droppedAttributesCount?: number;
}

/**
 * OTLP InstrumentationScope
 */
export interface OtlpInstrumentationScope {
  name?: string;
  version?: string;
  attributes?: OtlpKeyValue[];
}

/**
 * OTLP NumberDataPoint
 */
export interface OtlpNumberDataPoint {
  attributes?: OtlpKeyValue[];
  startTimeUnixNano?: string;
  timeUnixNano?: string;
  asDouble?: number;
  asInt?: string; // int64 as string
  exemplars?: unknown[];
  flags?: number;
}

/**
 * OTLP Sum metric type
 */
export interface OtlpSum {
  dataPoints?: OtlpNumberDataPoint[];
  aggregationTemporality?: number; // 1=DELTA, 2=CUMULATIVE
  isMonotonic?: boolean;
}

/**
 * OTLP Gauge metric type
 */
export interface OtlpGauge {
  dataPoints?: OtlpNumberDataPoint[];
}

/**
 * OTLP Histogram metric type
 */
export interface OtlpHistogram {
  dataPoints?: unknown[];
  aggregationTemporality?: number;
}

/**
 * OTLP Metric
 */
export interface OtlpMetric {
  name: string;
  description?: string;
  unit?: string;
  sum?: OtlpSum;
  gauge?: OtlpGauge;
  histogram?: OtlpHistogram;
}

/**
 * OTLP ScopeMetrics
 */
export interface OtlpScopeMetrics {
  scope?: OtlpInstrumentationScope;
  metrics?: OtlpMetric[];
  schemaUrl?: string;
}

/**
 * OTLP ResourceMetrics
 */
export interface OtlpResourceMetrics {
  resource?: OtlpResource;
  scopeMetrics?: OtlpScopeMetrics[];
  schemaUrl?: string;
}

/**
 * OTLP ExportMetricsServiceRequest (top-level payload)
 */
export interface OtlpMetricsRequest {
  resourceMetrics?: OtlpResourceMetrics[];
}

/**
 * Parsed metric data from OTLP
 */
export interface ParsedMetric {
  name: string;
  value: number;
  attributes: Record<string, string | number | boolean>;
  timestamp: string;
  resourceAttributes: Record<string, string | number | boolean>;
}
