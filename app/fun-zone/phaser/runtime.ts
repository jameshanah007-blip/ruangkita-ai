import type { PhaserGameSpec, PhaserRuntimeBuild } from "./types";
import { assertPhaserGenreAdapter } from "./runtimeAdapters";

const PHASER_VERSION = "4.2.1";
const PHASER_CDN = "https://cdn.jsdelivr.net/npm/phaser@" + PHASER_VERSION + "/dist/phaser.min.js";

function js(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildPhaserGameHtml(spec: PhaserGameSpec): string {
  return assertPhaserGenreAdapter(spec).build(spec);
}
export function buildPhaserRuntime(spec: PhaserGameSpec): PhaserRuntimeBuild {
  return {
    html: buildPhaserGameHtml(spec),
    genre: spec.genre,
    runtimeId: spec.runtimeId,
    engine: "phaser",
    phaserVersion: PHASER_VERSION,
    systems: Array.from(new Set(spec.systems)),
  };
}
