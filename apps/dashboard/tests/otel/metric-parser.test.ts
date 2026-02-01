/**
 * OTEL Metric Parser Tests
 * Story 4.1 — OTEL Receiver for Cost Metrics
 */

import { describe, it, expect } from "vitest";
import {
  parseOtlpMetrics,
  filterClaudeMetrics,
  isClaudeMetric,
  CLAUDE_METRICS,
} from "../../src/lib/otel/metric-parser";
import type { OtlpMetricsRequest } from "../../src/lib/otel/types";

function createOtlpRequest(
  metrics: Array<{
    name: string;
    value: number;
    attributes?: Record<string, string | number>;
    resourceAttributes?: Record<string, string | number>;
  }>
): OtlpMetricsRequest {
  const dataPoints = metrics.map((m) => ({
    attributes: m.attributes
      ? Object.entries(m.attributes).map(([key, value]) => ({
          key,
          value:
            typeof value === "string"
              ? { stringValue: value }
              : { doubleValue: value },
        }))
      : [],
    timeUnixNano: String(Date.now() * 1_000_000),
    asDouble: m.value,
  }));

  const resourceAttributes = metrics[0]?.resourceAttributes
    ? Object.entries(metrics[0].resourceAttributes).map(([key, value]) => ({
        key,
        value:
          typeof value === "string"
            ? { stringValue: value }
            : { doubleValue: value },
      }))
    : [];

  return {
    resourceMetrics: [
      {
        resource: {
          attributes: resourceAttributes,
        },
        scopeMetrics: [
          {
            scope: {
              name: "claude_code",
              version: "1.0.0",
            },
            metrics: metrics.map((m, i) => ({
              name: m.name,
              sum: {
                dataPoints: [dataPoints[i]!],
                aggregationTemporality: 2,
                isMonotonic: true,
              },
            })),
          },
        ],
      },
    ],
  };
}

describe("metric-parser", () => {
  describe("isClaudeMetric", () => {
    it("should return true for claude_code metrics", () => {
      expect(isClaudeMetric("claude_code.cost.usage")).toBe(true);
      expect(isClaudeMetric("claude_code.token.input")).toBe(true);
      expect(isClaudeMetric("claude_code.anything")).toBe(true);
    });

    it("should return false for non-claude metrics", () => {
      expect(isClaudeMetric("http.requests")).toBe(false);
      expect(isClaudeMetric("system.cpu")).toBe(false);
      expect(isClaudeMetric("claude")).toBe(false);
    });
  });

  describe("parseOtlpMetrics", () => {
    it("should parse empty request", () => {
      const result = parseOtlpMetrics({});
      expect(result).toEqual([]);
    });

    it("should parse request with no resourceMetrics", () => {
      const result = parseOtlpMetrics({ resourceMetrics: [] });
      expect(result).toEqual([]);
    });

    it("should parse single metric", () => {
      const request = createOtlpRequest([
        {
          name: CLAUDE_METRICS.COST_USAGE,
          value: 0.05,
        },
      ]);

      const result = parseOtlpMetrics(request);
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe(CLAUDE_METRICS.COST_USAGE);
      expect(result[0]!.value).toBe(0.05);
    });

    it("should parse multiple metrics", () => {
      const request = createOtlpRequest([
        { name: CLAUDE_METRICS.COST_USAGE, value: 0.05 },
        { name: CLAUDE_METRICS.TOKEN_INPUT, value: 1000 },
        { name: CLAUDE_METRICS.TOKEN_OUTPUT, value: 500 },
      ]);

      const result = parseOtlpMetrics(request);
      expect(result).toHaveLength(3);
    });

    it("should extract metric attributes", () => {
      const request = createOtlpRequest([
        {
          name: CLAUDE_METRICS.COST_USAGE,
          value: 0.05,
          attributes: {
            "session.id": "sess_123",
            "pane.id": "%0",
            model: "claude-3-opus",
          },
        },
      ]);

      const result = parseOtlpMetrics(request);
      expect(result[0]!.attributes["session.id"]).toBe("sess_123");
      expect(result[0]!.attributes["pane.id"]).toBe("%0");
      expect(result[0]!.attributes["model"]).toBe("claude-3-opus");
    });

    it("should extract resource attributes", () => {
      const request = createOtlpRequest([
        {
          name: CLAUDE_METRICS.COST_USAGE,
          value: 0.05,
          resourceAttributes: {
            "service.name": "claude-code",
            "session.id": "sess_456",
          },
        },
      ]);

      const result = parseOtlpMetrics(request);
      expect(result[0]!.resourceAttributes["service.name"]).toBe("claude-code");
      expect(result[0]!.resourceAttributes["session.id"]).toBe("sess_456");
    });

    it("should handle integer values", () => {
      const request: OtlpMetricsRequest = {
        resourceMetrics: [
          {
            scopeMetrics: [
              {
                metrics: [
                  {
                    name: CLAUDE_METRICS.TOKEN_INPUT,
                    sum: {
                      dataPoints: [
                        {
                          asInt: "12345",
                          timeUnixNano: String(Date.now() * 1_000_000),
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = parseOtlpMetrics(request);
      expect(result[0]!.value).toBe(12345);
    });

    it("should handle gauge metrics", () => {
      const request: OtlpMetricsRequest = {
        resourceMetrics: [
          {
            scopeMetrics: [
              {
                metrics: [
                  {
                    name: "claude_code.active_sessions",
                    gauge: {
                      dataPoints: [
                        {
                          asDouble: 3,
                          timeUnixNano: String(Date.now() * 1_000_000),
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = parseOtlpMetrics(request);
      expect(result).toHaveLength(1);
      expect(result[0]!.value).toBe(3);
    });
  });

  describe("filterClaudeMetrics", () => {
    it("should filter only claude_code metrics", () => {
      const metrics = [
        {
          name: CLAUDE_METRICS.COST_USAGE,
          value: 0.05,
          attributes: {},
          timestamp: new Date().toISOString(),
          resourceAttributes: {},
        },
        {
          name: "http.requests",
          value: 100,
          attributes: {},
          timestamp: new Date().toISOString(),
          resourceAttributes: {},
        },
        {
          name: CLAUDE_METRICS.TOKEN_INPUT,
          value: 1000,
          attributes: {},
          timestamp: new Date().toISOString(),
          resourceAttributes: {},
        },
      ];

      const result = filterClaudeMetrics(metrics);
      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe(CLAUDE_METRICS.COST_USAGE);
      expect(result[1]!.name).toBe(CLAUDE_METRICS.TOKEN_INPUT);
    });

    it("should return empty array if no claude metrics", () => {
      const metrics = [
        {
          name: "http.requests",
          value: 100,
          attributes: {},
          timestamp: new Date().toISOString(),
          resourceAttributes: {},
        },
      ];

      const result = filterClaudeMetrics(metrics);
      expect(result).toEqual([]);
    });
  });

  describe("CLAUDE_METRICS constants", () => {
    it("should have correct metric names", () => {
      expect(CLAUDE_METRICS.COST_USAGE).toBe("claude_code.cost.usage");
      expect(CLAUDE_METRICS.TOKEN_INPUT).toBe("claude_code.token.input");
      expect(CLAUDE_METRICS.TOKEN_OUTPUT).toBe("claude_code.token.output");
      expect(CLAUDE_METRICS.TOKEN_CACHE_READ).toBe("claude_code.token.cache_read");
      expect(CLAUDE_METRICS.TOKEN_CACHE_WRITE).toBe("claude_code.token.cache_write");
    });
  });
});
