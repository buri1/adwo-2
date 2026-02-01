/**
 * OTEL Receiver Tests
 * Story 4.1 — OTEL Receiver for Cost Metrics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OtelReceiver, resetOtelReceiver } from "../../src/lib/otel/otel-receiver";
import { CLAUDE_METRICS, CLAUDE_ATTRIBUTES } from "../../src/lib/otel/metric-parser";
import type { CostUpdatePayload } from "@adwo/shared";

// Test port to avoid conflicts
const TEST_PORT = 14318;

function createMetricsPayload(
  metrics: Array<{
    name: string;
    value: number;
    paneId?: string;
    sessionId?: string;
  }>
): object {
  return {
    resourceMetrics: [
      {
        resource: {
          attributes: [],
        },
        scopeMetrics: [
          {
            scope: {
              name: "claude_code",
            },
            metrics: metrics.map((m) => ({
              name: m.name,
              sum: {
                dataPoints: [
                  {
                    attributes: [
                      {
                        key: CLAUDE_ATTRIBUTES.PANE_ID,
                        value: { stringValue: m.paneId || "%0" },
                      },
                      {
                        key: CLAUDE_ATTRIBUTES.SESSION_ID,
                        value: { stringValue: m.sessionId || "sess_123" },
                      },
                    ],
                    timeUnixNano: String(Date.now() * 1_000_000),
                    asDouble: m.value,
                  },
                ],
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

async function postMetrics(port: number, payload: object): Promise<Response> {
  return fetch(`http://localhost:${port}/v1/metrics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

describe("OtelReceiver", () => {
  let receiver: OtelReceiver;

  beforeEach(async () => {
    await resetOtelReceiver();
  });

  afterEach(async () => {
    if (receiver?.isRunning()) {
      await receiver.stop();
    }
  });

  describe("start/stop", () => {
    it("should start and stop successfully", async () => {
      receiver = new OtelReceiver({ port: TEST_PORT });

      expect(receiver.isRunning()).toBe(false);

      await receiver.start();
      expect(receiver.isRunning()).toBe(true);

      await receiver.stop();
      expect(receiver.isRunning()).toBe(false);
    });

    it("should handle multiple start calls", async () => {
      receiver = new OtelReceiver({ port: TEST_PORT });

      await receiver.start();
      await receiver.start(); // Should not throw

      expect(receiver.isRunning()).toBe(true);
    });

    it("should handle stop without start", async () => {
      receiver = new OtelReceiver({ port: TEST_PORT });

      await receiver.stop(); // Should not throw
      expect(receiver.isRunning()).toBe(false);
    });
  });

  describe("HTTP endpoints", () => {
    beforeEach(async () => {
      receiver = new OtelReceiver({ port: TEST_PORT });
      await receiver.start();
    });

    it("should accept POST /v1/metrics", async () => {
      const payload = createMetricsPayload([
        { name: CLAUDE_METRICS.COST_USAGE, value: 0.05 },
      ]);

      const response = await postMetrics(TEST_PORT, payload);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("partialSuccess");
    });

    it("should reject non-POST methods", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/v1/metrics`, {
        method: "GET",
      });

      expect(response.status).toBe(405);
    });

    it("should return 404 for unknown paths", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/unknown`, {
        method: "POST",
      });

      expect(response.status).toBe(404);
    });

    it("should handle CORS preflight", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/v1/metrics`, {
        method: "OPTIONS",
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("should return 400 for invalid JSON", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/v1/metrics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "not valid json",
      });

      expect(response.status).toBe(400);
    });
  });

  describe("metrics processing", () => {
    it("should call onCostUpdate when metrics received", async () => {
      const onCostUpdate = vi.fn();
      receiver = new OtelReceiver({
        port: TEST_PORT,
        onCostUpdate,
      });
      await receiver.start();

      const payload = createMetricsPayload([
        { name: CLAUDE_METRICS.COST_USAGE, value: 0.05 },
        { name: CLAUDE_METRICS.TOKEN_INPUT, value: 1000 },
      ]);

      await postMetrics(TEST_PORT, payload);

      // Give time for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onCostUpdate).toHaveBeenCalledTimes(1);
      expect(onCostUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: expect.objectContaining({
            costUsd: 0.05,
            tokens: expect.objectContaining({ input: 1000 }),
          }),
          paneId: "%0",
        })
      );
    });

    it("should aggregate totals correctly", async () => {
      receiver = new OtelReceiver({ port: TEST_PORT });
      await receiver.start();

      // Send first batch
      await postMetrics(
        TEST_PORT,
        createMetricsPayload([
          { name: CLAUDE_METRICS.COST_USAGE, value: 0.05 },
        ])
      );

      // Send second batch
      await postMetrics(
        TEST_PORT,
        createMetricsPayload([
          { name: CLAUDE_METRICS.COST_USAGE, value: 0.03 },
        ])
      );

      // Give time for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      const totals = receiver.getTotals("%0");
      expect(totals.totalCostUsd).toBe(0.08);
      expect(totals.metricCount).toBe(2);
    });
  });

  describe("getPort", () => {
    it("should return configured port", () => {
      receiver = new OtelReceiver({ port: 5555 });
      expect(receiver.getPort()).toBe(5555);
    });

    it("should use default port 4318", () => {
      receiver = new OtelReceiver({});
      expect(receiver.getPort()).toBe(4318);
    });
  });

  describe("getAggregator", () => {
    it("should return the aggregator instance", () => {
      receiver = new OtelReceiver({ port: TEST_PORT });
      const aggregator = receiver.getAggregator();
      expect(aggregator).toBeDefined();
    });
  });
});
