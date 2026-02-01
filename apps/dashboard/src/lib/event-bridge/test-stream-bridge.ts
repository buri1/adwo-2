/**
 * Test script for StreamJsonBridge
 *
 * Run with: npx tsx apps/dashboard/src/lib/event-bridge/test-stream-bridge.ts
 */

import { StreamJsonBridge } from "./stream-json-bridge";
import { writeFileSync, unlinkSync, existsSync, appendFileSync } from "fs";
import { join } from "path";

const TEST_DIR = "/tmp";
const TEST_PANE_ID = "test-pane-001";
const TEST_FILE = join(TEST_DIR, `events-${TEST_PANE_ID}.jsonl`);

// Sample stream-json events (real format from Claude Code)
const SAMPLE_EVENTS = [
  // System init event
  {
    type: "system",
    subtype: "init",
    cwd: "/Users/test/project",
    session_id: "test-session-123",
    tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
    model: "claude-opus-4-5-20251101",
    permissionMode: "default",
    uuid: "uuid-init-001"
  },
  // Hook started
  {
    type: "system",
    subtype: "hook_started",
    hook_id: "hook-001",
    hook_name: "SessionStart:startup",
    hook_event: "SessionStart",
    uuid: "uuid-hook-001",
    session_id: "test-session-123"
  },
  // Hook response
  {
    type: "system",
    subtype: "hook_response",
    hook_id: "hook-001",
    hook_name: "SessionStart:startup",
    hook_event: "SessionStart",
    output: "Hook executed successfully",
    exit_code: 0,
    outcome: "success",
    uuid: "uuid-hook-002",
    session_id: "test-session-123"
  },
  // Message start
  {
    type: "stream_event",
    event: {
      type: "message_start",
      message: {
        model: "claude-opus-4-5-20251101",
        id: "msg_001",
        type: "message",
        role: "assistant",
        content: [],
        usage: {
          input_tokens: 1500,
          output_tokens: 10,
          cache_creation_input_tokens: 5000
        }
      }
    },
    session_id: "test-session-123",
    parent_tool_use_id: null,
    uuid: "uuid-msg-start-001"
  },
  // Tool use start (Read)
  {
    type: "stream_event",
    event: {
      type: "content_block_start",
      index: 0,
      content_block: {
        type: "tool_use",
        id: "toolu_001",
        name: "Read",
        input: {}
      }
    },
    session_id: "test-session-123",
    parent_tool_use_id: null,
    uuid: "uuid-tool-001"
  },
  // Text delta
  {
    type: "stream_event",
    event: {
      type: "content_block_delta",
      index: 1,
      delta: {
        type: "text_delta",
        text: "I'll read the file and analyze it for you."
      }
    },
    session_id: "test-session-123",
    parent_tool_use_id: null,
    uuid: "uuid-text-001"
  },
  // Another text delta
  {
    type: "stream_event",
    event: {
      type: "content_block_delta",
      index: 1,
      delta: {
        type: "text_delta",
        text: " The code looks good!"
      }
    },
    session_id: "test-session-123",
    parent_tool_use_id: null,
    uuid: "uuid-text-002"
  },
  // Result event (with cost!)
  {
    type: "result",
    subtype: "success",
    is_error: false,
    duration_ms: 2500,
    duration_api_ms: 3200,
    num_turns: 1,
    result: "Task completed successfully",
    session_id: "test-session-123",
    total_cost_usd: 0.0425,
    usage: {
      input_tokens: 1500,
      output_tokens: 150,
      cache_creation_input_tokens: 5000
    },
    modelUsage: {
      "claude-opus-4-5-20251101": {
        inputTokens: 1500,
        outputTokens: 150,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 5000,
        costUSD: 0.0425
      }
    },
    uuid: "uuid-result-001"
  }
];

async function runTest() {
  console.log("=".repeat(60));
  console.log("StreamJsonBridge Test");
  console.log("=".repeat(60));

  // Clean up any existing test file
  if (existsSync(TEST_FILE)) {
    unlinkSync(TEST_FILE);
    console.log(`\n[Setup] Removed existing test file: ${TEST_FILE}`);
  }

  // Create the bridge
  const bridge = new StreamJsonBridge({
    watchDir: TEST_DIR,
    filePattern: `events-${TEST_PANE_ID}.jsonl`,
    projectId: "test-project"
  });

  // Track received events
  const receivedEvents: Array<{ category: string; content: string }> = [];
  let sessionUpdates = 0;

  // Register handlers
  bridge.onEvent((event) => {
    receivedEvents.push({ category: event.category, content: event.content });
    console.log(`\n[Event] ${event.category.toUpperCase()}: ${event.content.slice(0, 60)}...`);
    if (event.cost) {
      console.log(`        Cost: $${event.cost.total_usd.toFixed(4)} | Tokens: ${event.cost.input_tokens}/${event.cost.output_tokens}`);
    }
  });

  bridge.onSession((session) => {
    sessionUpdates++;
    console.log(`\n[Session Update #${sessionUpdates}]`);
    console.log(`  Pane: ${session.pane_id}`);
    console.log(`  Total Cost: $${session.total_cost.toFixed(4)}`);
    console.log(`  Total Tokens: ${session.total_tokens.input}/${session.total_tokens.output}`);
  });

  bridge.onError((paneId, error) => {
    console.error(`\n[Error] Pane ${paneId}: ${error.message}`);
  });

  // Start the bridge
  console.log("\n[Test] Starting StreamJsonBridge...");
  await bridge.start();

  // Wait for watcher to initialize
  await sleep(500);

  // Create the test file with first few events
  console.log(`\n[Test] Creating test file: ${TEST_FILE}`);
  writeFileSync(TEST_FILE, "");
  await sleep(200);

  // Write events one by one with small delays
  console.log("[Test] Writing events to file...\n");

  for (let i = 0; i < SAMPLE_EVENTS.length; i++) {
    const event = SAMPLE_EVENTS[i]!;
    appendFileSync(TEST_FILE, JSON.stringify(event) + "\n");
    console.log(`  [${i + 1}/${SAMPLE_EVENTS.length}] Wrote ${event.type}${(event as { subtype?: string }).subtype ? `:${(event as { subtype?: string }).subtype}` : ""} event`);
    await sleep(150); // Give time for file watcher to detect changes
  }

  // Wait for processing
  await sleep(1000);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("Test Results");
  console.log("=".repeat(60));
  console.log(`\nEvents written: ${SAMPLE_EVENTS.length}`);
  console.log(`Events received: ${receivedEvents.length}`);
  console.log(`Session updates: ${sessionUpdates}`);

  console.log("\nReceived events by category:");
  const byCategory = receivedEvents.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  for (const [category, count] of Object.entries(byCategory)) {
    console.log(`  ${category}: ${count}`);
  }

  // Get final session state
  const sessions = bridge.getSessions();
  if (sessions.length > 0) {
    console.log("\nFinal session state:");
    const session = sessions[0]!;
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

  // Validate results
  const expectedCategories = ["system", "hook", "hook", "tool", "text", "text", "result"];
  const pass = receivedEvents.length >= 4; // At least system, hook, tool, result

  if (pass) {
    console.log("\n✅ TEST PASSED");
  } else {
    console.log("\n❌ TEST FAILED - Not enough events received");
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
runTest().catch(console.error);
