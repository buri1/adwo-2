/**
 * OTEL HTTP Receiver
 * Story 4.1 — OTEL Receiver for Cost Metrics
 *
 * HTTP server that receives OpenTelemetry metrics on port 4318.
 * Parses OTLP/HTTP JSON format and broadcasts cost updates via WebSocket.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "http";
import type { CostMetric, CostTotals, CostUpdatePayload } from "@adwo/shared";
import type { OtlpMetricsRequest } from "./types";
import { parseOtlpMetrics, filterClaudeMetrics } from "./metric-parser";
import { CostAggregator } from "./cost-aggregator";

const DEFAULT_PORT = 4318;

export interface OtelReceiverOptions {
  port?: number;
  onCostUpdate?: (payload: CostUpdatePayload) => void;
}

/**
 * OTEL HTTP Receiver for Claude Code metrics
 */
export class OtelReceiver {
  private server: Server | null = null;
  private port: number;
  private aggregator: CostAggregator;
  private onCostUpdate?: (payload: CostUpdatePayload) => void;

  constructor(options: OtelReceiverOptions = {}) {
    this.port = options.port ?? DEFAULT_PORT;
    this.onCostUpdate = options.onCostUpdate;
    this.aggregator = new CostAggregator();

    // Register internal listener to call onCostUpdate
    this.aggregator.onMetric((metric, totals, paneId) => {
      if (this.onCostUpdate) {
        this.onCostUpdate({ metric, totals, paneId });
      }
    });
  }

  /**
   * Start the OTEL receiver server
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        console.warn("[OtelReceiver] Server already running");
        resolve();
        return;
      }

      this.server = createServer((req, res) => this.handleRequest(req, res));

      this.server.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          console.error(`[OtelReceiver] Port ${this.port} is already in use`);
        }
        reject(error);
      });

      this.server.listen(this.port, () => {
        console.log(`[OtelReceiver] Listening on port ${this.port}`);
        console.log(`[OtelReceiver] OTLP endpoint: http://localhost:${this.port}/v1/metrics`);
        resolve();
      });
    });
  }

  /**
   * Stop the OTEL receiver server
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        console.log("[OtelReceiver] Server stopped");
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Handle incoming HTTP request
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // CORS headers for browser requests (if any)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Only accept POST to /v1/metrics
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const url = req.url || "";
    if (url !== "/v1/metrics" && !url.startsWith("/v1/metrics?")) {
      // Also support root path for flexibility
      if (url !== "/" && !url.startsWith("/?")) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }
    }

    this.handleMetricsPost(req, res);
  }

  /**
   * Handle POST /v1/metrics
   */
  private handleMetricsPost(req: IncomingMessage, res: ServerResponse): void {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        const contentType = req.headers["content-type"] || "";

        // Parse based on content type
        let metricsRequest: OtlpMetricsRequest;

        if (contentType.includes("application/json")) {
          metricsRequest = JSON.parse(body) as OtlpMetricsRequest;
        } else if (contentType.includes("application/x-protobuf")) {
          // For now, we only support JSON format
          // Protobuf would require additional dependencies
          res.writeHead(415, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            error: "Unsupported content type. Use application/json"
          }));
          return;
        } else {
          // Try JSON as default
          metricsRequest = JSON.parse(body) as OtlpMetricsRequest;
        }

        // Parse and process metrics
        const parsedMetrics = parseOtlpMetrics(metricsRequest);
        const claudeMetrics = filterClaudeMetrics(parsedMetrics);

        if (claudeMetrics.length > 0) {
          console.log(
            `[OtelReceiver] Received ${claudeMetrics.length} Claude Code metrics`
          );
          this.aggregator.processMetrics(claudeMetrics);
        }

        // OTLP success response
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ partialSuccess: {} }));
      } catch (error) {
        console.error("[OtelReceiver] Failed to parse metrics:", error);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request body" }));
      }
    });

    req.on("error", (error) => {
      console.error("[OtelReceiver] Request error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    });
  }

  /**
   * Get the cost aggregator instance
   */
  public getAggregator(): CostAggregator {
    return this.aggregator;
  }

  /**
   * Get totals for a pane
   */
  public getTotals(paneId: string): CostTotals {
    return this.aggregator.getTotals(paneId);
  }

  /**
   * Check if server is running
   */
  public isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Get the port number
   */
  public getPort(): number {
    return this.port;
  }
}

// Singleton instance
let otelReceiverInstance: OtelReceiver | null = null;

/**
 * Get or create the OtelReceiver singleton
 */
export function getOtelReceiver(options?: OtelReceiverOptions): OtelReceiver {
  if (!otelReceiverInstance) {
    otelReceiverInstance = new OtelReceiver(options);
  }
  return otelReceiverInstance;
}

/**
 * Reset the OtelReceiver singleton (for testing)
 */
export async function resetOtelReceiver(): Promise<void> {
  if (otelReceiverInstance) {
    await otelReceiverInstance.stop();
    otelReceiverInstance = null;
  }
}
