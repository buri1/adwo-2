/**
 * Recovery Module
 * Story 5.2 — Crash Recovery
 *
 * Exports for the recovery manager.
 */

export {
  RecoveryManager,
  getRecoveryManager,
  resetRecoveryManager,
} from "./recovery-manager";

export type {
  RecoveryConfig,
  RecoveryResult,
  RecoveryStatus,
  RecoveryWarning,
} from "./types";
