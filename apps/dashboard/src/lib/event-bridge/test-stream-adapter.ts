/**
 * Test script for StreamJsonBridge (standalone test without WebSocket)
 *
 * Run with: npx tsx apps/dashboard/src/lib/event-bridge/test-stream-adapter.ts
 *
 * This tests the StreamJsonBridge directly to verify event parsing and session tracking.
 * For full adapter testing, run the dashboard server and test with actual events.
 */

import { StreamJsonBridge } from "./stream-json-bridge";
import { writeFileSync, unlinkSync, existsSync, appendFileSync } from "fs";
import { join } from "path";
import type { NormalizedStreamEvent, SessionMetadata } from "@adwo/shared";

const TEST_DIR = "/tmp";
const TEST_PANE_ID = "adapter-test-001";
const TEST_FILE = join(TEST_DIR, `events-${TEST_PANE_ID}.jsonl`);

// Sample events for testing
const SAMPLE_EVENTS = [
  {
    type: "system",
    subtype: "init",
    cwd: "/Users/test/project",
    session_id: "adapter-test-session",
    tools: ["Read", "Write", "Edit"],
    model: "claude-opus-4-5-20251101",
    permissionMode: "default",
    uuid: "uuid-init-001",
  },
  {
    type: "stream_event",
    event: {
      type: "content_block_start",
      index: 0,
      content_block: {
        type: "tool_use",
        id: "toolu_001",
        name: "Read",
        input: {},
      },
    },
    session_id: "adapter-test-session",
    parent_tool_use_id: null,
    uuid: "uuid-tool-001",
  },
  {
    type: "stream_event",
    event: {
      type: "content_block_delta",
      index: 1,
      delta: {
        type: "text_delta",
        text: "Here is the analysis of your code.",
      },
    },
    session_id: "adapter-test-session",
    parent_tool_use_id: null,
    uuid: "uuid-text-001",
  },
  {
    type: "result",
    subtype: "success",
    is_error: false,
    duration_ms: 1500,
    duration_api_ms: 2000,
    num_turns: 1,
    result: "Analysis complete",
    session_id: "adapter-test-session",
    total_cost_usd: 0.0125,
    usage: {
      input_tokens: 500,
      output_tokens: 100,
    },
    modelUsage: {
      "claude-opus-4-5-20251101": {
        inputTokens: 500,
        outputTokens: 100,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        costUSD: 0.0125,
      },
    },
    uuid: "uuid-result-001",
  },
];

async function runTest() {
  console.log("=".repeat(60));
  console.log("StreamJsonBridge Standalone Test");
  console.log("=".repeat(60));

  // Clean up any existing test file
  if (existsSync(TEST_FILE)) {
    unlinkSync(TEST_FILE);
    console.log(`\n[Setup] Removed existing test file: ${TEST_FILE}`);
  }

  // Track received events
  const receivedEvents: NormalizedStreamEvent[] = [];
  const sessionUpdates: SessionMetadata[] = [];

  // Create the bridge directly (no adapter/WebSocket dependency)
  const bridge = new StreamJsonBridge({
    watchDir: TEST_DIR,
    filePattern: `events-${TEST_PANE_ID}.jsonl`,
    projectId: "test-project",
  });

  // Register callbacks
  bridge.onEvent((event) => {
    receivedEvents.push(event);
    console.log(`\n[Callback] Event received: ${event.category}`);
  });

  bridge.onSession((session) => {
    sessionUpdates.push({ ...session }); // Clone to capture state at this moment
    console.log(`\n[Callback] Session update: $${session.total_cost.toFixed(4)}`);
  });

  // Start the bridge
  console.log("\n[Test] Starting StreamJsonBridge...");
  await bridge.start();

  // Wait for watcher to initialize
  await sleep(500);

  // Create the test file
  console.log(`\n[Test] Creating test file: ${TEST_FILE}`);
  writeFileSync(TEST_FILE, "");
  await sleep(200);

  // Write events
  console.log("[Test] Writing events...\n");
  for (let i = 0; i < SAMPLE_EVENTS.length; i++) {
    const event = SAMPLE_EVENTS[i]!;
    appendFileSync(TEST_FILE, JSON.stringify(event) + "\n");
    console.log(`  [${i + 1}/${SAMPLE_EVENTS.length}] Wrote ${event.type} event`);
    await sleep(150);
  }

  // Wait for processing
  await sleep(1000);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("Test Results");
  console.log("=".repeat(60));
  console.log(`\nEvents written: ${SAMPLE_EVENTS.length}`);
  console.log(`Events received via callback: ${receivedEvents.length}`);
  console.log(`Session updates: ${sessionUpdates.length}`);

  // Check sessions
  const sessions = bridge.getSessions();
  console.log(`\nActive sessions: ${sessions.length}`);

  if (sessions.length > 0) {
    const session = sessions[0]!;
    console.log("\nSession state:");
    console.log(`  Pane ID: ${session.pane_id}`);
    console.log(`  Total Cost: $${session.total_cost.toFixed(4)}`);
    console.log(`  Input Tokens: ${session.total_tokens.input}`);
    console.log(`  Output Tokens: ${session.total_tokens.output}`);
  }

  // Stop the bridge
  console.log("\n[Test] Stopping StreamJsonBridge...");
  await bridge.stop();

  // Cleanup
  if (existsSync(TEST_FILE)) {
    unlinkSync(TEST_FILE);
    console.log(`[Cleanup] Removed test file: ${TEST_FILE}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test Complete!");
  console.log("=".repeat(60));

  // Validate
  const expectedEvents = 4; // system, tool, text, result (some may be filtered)
  const pass = receivedEvents.length >= 3 && sessionUpdates.length >= 1;

  if (pass) {
    console.log("\nTEST PASSED");
  } else {
    console.log("\nTEST FAILED");
    console.log(`  Expected >= 3 events, got ${receivedEvents.length}`);
    console.log(`  Expected >= 1 session updates, got ${sessionUpdates.length}`);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run test
runTest().catch(console.error);
