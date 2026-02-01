/**
 * Custom Next.js Server with WebSocket Support
 * Story 1.4 — WebSocket Server
 *
 * This server enables WebSocket connections at ws://localhost:3000/api/ws
 * alongside the standard Next.js HTTP server.
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { getEventManager } from "./src/lib/websocket/event-manager";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env["PORT"] || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Initialize EventManager with the HTTP server
  // This creates the WebSocket server on /api/ws
  const eventManager = getEventManager();
  eventManager.initialize(server);

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket available at ws://${hostname}:${port}/api/ws`);
  });
});
