import type { GameBlueprint } from "../laboratory/types";
import { createAutonomousGameBlueprint } from "./jamesAutonomousGameEngine";

/**
 * Compatibility wrapper.
 *
 * Older Laboratory code imports createLocalGameBlueprint.
 * James now uses the autonomous game intelligence as the local
 * director, so the old preset-only blueprint generator no longer
 * owns game design.
 */
export function createLocalGameBlueprint(prompt: string): GameBlueprint {
  return createAutonomousGameBlueprint(prompt);
}
