import type { GameBlueprint } from "../laboratory/types";
import { buildAuthoritativePhaserGame } from "../phaser";

export type Authoritative2DBuild = {
  html: string;
  genre: string;
  runtimeId: string;
  systems: string[];
};

export function buildAuthoritative2DGame(
  blueprint: GameBlueprint,
  prompt?: string,
): Authoritative2DBuild | null {
  const runtime = buildAuthoritativePhaserGame(blueprint, prompt);
  if (!runtime) return null;

  return {
    html: runtime.html,
    genre: runtime.genre,
    runtimeId: runtime.runtimeId,
    systems: runtime.systems,
  };
}
