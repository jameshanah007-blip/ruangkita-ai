import type { GameBlueprint } from "../laboratory/types";
import { buildVisualBlueprint, type VisualBlueprint } from "./visualBlueprint";

/**
 * Visual Director turns a game blueprint into a prompt-driven visual specification.
 * It does not select a permanent character or reuse a hard-coded protagonist.
 */
export function createVisualBlueprint(blueprint: GameBlueprint): VisualBlueprint {
  return buildVisualBlueprint(blueprint);
}
