import type { GameBlueprint } from "../laboratory/types";
import { compilePhaserGameSpec } from "./genreDefinitions";
import { buildPhaserRuntime } from "./runtime";
import type { PhaserRuntimeBuild } from "./types";

export function buildAuthoritativePhaserGame(
  blueprint: GameBlueprint,
  prompt?: string,
): PhaserRuntimeBuild | null {
  const sourcePrompt = String(prompt || blueprint.concept || blueprint.title || "").trim();
  if (!sourcePrompt) return null;

  const spec = compilePhaserGameSpec(blueprint, sourcePrompt);
  if (!spec) return null;

  return buildPhaserRuntime(spec);
}
