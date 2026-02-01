/**
 * Conduit CLI Wrapper
 *
 * Provides async functions for interacting with the Conduit CLI
 * for terminal pane management.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface PaneSplitResult {
  pane_id: string;
}

export interface ConduitError extends Error {
  code?: string;
  stderr?: string;
}

/**
 * Creates a new terminal pane via conduit pane-split
 */
export async function paneSplit(): Promise<PaneSplitResult> {
  try {
    const { stdout } = await execAsync("conduit pane-split --type terminal", {
      timeout: 10000,
    });

    // Parse the JSON response from conduit
    const result = JSON.parse(stdout.trim());

    if (!result.pane_id) {
      throw new Error("No pane_id returned from conduit pane-split");
    }

    return { pane_id: result.pane_id };
  } catch (error) {
    const err = error as ConduitError;
    throw new Error(`Failed to split pane: ${err.message}`);
  }
}

/**
 * Closes a pane via conduit pane-close
 */
export async function paneClose(paneId: string): Promise<void> {
  try {
    await execAsync(`conduit pane-close -p ${paneId}`, {
      timeout: 10000,
    });
  } catch (error) {
    const err = error as ConduitError;
    throw new Error(`Failed to close pane: ${err.message}`);
  }
}

/**
 * Writes text to a terminal pane via conduit terminal-write
 */
export async function terminalWrite(
  paneId: string,
  text: string
): Promise<void> {
  try {
    // Escape the text for shell
    const escapedText = text.replace(/'/g, "'\\''");
    await execAsync(`conduit terminal-write -p ${paneId} '${escapedText}'`, {
      timeout: 10000,
    });
  } catch (error) {
    const err = error as ConduitError;
    throw new Error(`Failed to write to terminal: ${err.message}`);
  }
}

/**
 * Sends Enter key to execute command in terminal
 */
export async function terminalSendEnter(paneId: string): Promise<void> {
  try {
    await execAsync(`conduit terminal-write -p ${paneId} --key Enter`, {
      timeout: 10000,
    });
  } catch (error) {
    const err = error as ConduitError;
    throw new Error(`Failed to send Enter key: ${err.message}`);
  }
}
