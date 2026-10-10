import type { GameBlueprint } from "../laboratory/types";

export type GameBuildDimension = "2d";
export type GameCameraModel = "top-down" | "side-scroller";

export type GameBuildPlan = {
  version: 2;
  dimension: "2d";
  camera: GameCameraModel;
  worldArchitecture: "tilemap" | "scene";
  renderArchitecture: "phaser-2d";
  systems: string[];
  actors: string[];
  assets: {
    required: string[];
    animated: string[];
    directional: string[];
    originalOnly: boolean;
  };
  controls: {
    keyboard: string[];
    touch: string[];
    gamepad: string[];
  };
  audio: { required: boolean; events: string[] };
  buildStages: string[];
  testStages: string[];
  repairLoop: string[];
  runtimeEvidence: { required: boolean; capture: string[] };
};

function textOf(b: GameBlueprint): string {
  return [
    b.title, b.concept, b.genre, b.mood, b.theme, b.world,
    b.coreLoop, b.objective, b.visualStyle,
    ...b.mechanics, ...b.playerActions, ...b.controls,
  ].join(" ").toLowerCase();
}

export function createGameBuildPlan(b: GameBlueprint): GameBuildPlan {
  const text = textOf(b);
  const sideScroller = /platformer|platform|side.?scroll|metroidvania|mario-like/.test(text);
  const camera: GameCameraModel = sideScroller ? "side-scroller" : "top-down";

  return {
    version: 2,
    dimension: "2d",
    camera,
    worldArchitecture: sideScroller ? "scene" : "tilemap",
    renderArchitecture: "phaser-2d",
    systems: [...new Set(["phaser-2d", "game-loop", "input", "collision", ...b.mechanics])],
    actors: ["player"],
    assets: {
      required: ["player", "environment", "ui"],
      animated: ["player"],
      directional: camera === "top-down" ? ["player"] : [],
      originalOnly: true,
    },
    controls: {
      keyboard: ["WASD", "Arrow keys", "Space", "E"],
      touch: ["virtual directional pad", "action buttons"],
      gamepad: ["d-pad", "action buttons"],
    },
    audio: {
      required: true,
      events: ["movement", "interaction", "objective", "victory", "defeat"],
    },
    buildStages: [
      "parse-intent",
      "create-game-specification",
      "resolve-2d-genre",
      "select-phaser-2d-adapter",
      "plan-assets",
      "materialize-assets",
      "validate-runtime-contract",
      "build-phaser-runtime",
      "run-in-sandbox",
      "collect-runtime-evidence",
      "repair",
      "retest",
      "finalize",
    ],
    testStages: [
      "phaser-boot",
      "rendering",
      "sprite-animation",
      "keyboard-input",
      "touch-input",
      "collision",
      "gameplay-state",
      "objective",
      "restart",
      "mobile-layout",
      "runtime-stability",
    ],
    runtimeEvidence: {
      required: true,
      capture: [
        "canvas-size",
        "visible-player",
        "animation-frame",
        "input-events",
        "runtime-errors",
        "screenshot",
      ],
    },
    repairLoop: [
      "inspect-test-report",
      "identify-root-cause",
      "repair-smallest-safe-scope",
      "rebuild",
      "retest",
      "keep-working-version-on-failure",
    ],
  };
}
