import type { PhaserGameSpec } from "./types";
import { buildFarmingGameHtml } from "./farmingRuntime";
import { buildRacingGameHtml } from "./racingRuntime";

export type PhaserGenreAdapter = {
  genre: PhaserGameSpec["genre"];
  runtimeId: string;
  build: (spec: PhaserGameSpec) => string;
};

const ADAPTERS: Partial<Record<PhaserGameSpec["genre"], PhaserGenreAdapter>> = {
  farming: {
    genre: "farming",
    runtimeId: "rk-farming-2d-v1",
    build: buildFarmingGameHtml,
  },
  racing: {
    genre: "racing",
    runtimeId: "rk-racing-2d-v1",
    build: buildRacingGameHtml,
  },
};

export function getPhaserGenreAdapter(
  genre: PhaserGameSpec["genre"],
): PhaserGenreAdapter | null {
  return ADAPTERS[genre] ?? null;
}

export function assertPhaserGenreAdapter(
  spec: PhaserGameSpec,
): PhaserGenreAdapter {
  const adapter = getPhaserGenreAdapter(spec.genre);
  if (!adapter) {
    throw new Error(
      `Fun Zone genre runtime is not implemented yet: "${spec.genre}". Add a dedicated genre adapter instead of using another genre's template.`,
    );
  }
  return adapter;
}
