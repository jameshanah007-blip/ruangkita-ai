import type { GameBlueprint } from "../laboratory/types";

export type GameBuildDimension = "2d" | "2.5d" | "3d" | "voxel-3d";

export type GameCameraModel =
  | "top-down"
  | "side-scroller"
  | "isometric"
  | "third-person"
  | "first-person";

export type GameBuildPlan = {
  version: 1;
  dimension: GameBuildDimension;
  camera: GameCameraModel;
  worldArchitecture: "tilemap" | "scene" | "voxel";
  renderArchitecture: "sprite-runtime" | "hybrid-runtime" | "3d-runtime" | "voxel-runtime";
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
  audio: {
    required: boolean;
    events: string[];
  };
  buildStages: string[];
  testStages: string[];
  repairLoop: string[];
  runtimeEvidence: {
    required: boolean;
    capture: string[];
  };
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
  const topDown = /(pokemon|pokémon|top.?down|monster tamer|creature collection|pixel art|pixel-art|2d rpg)/.test(text);
  const sideScroller = /(platformer|side.?scroll|metroidvania|platform game|mario-like)/.test(text);
  const voxel = /(minecraft|voxel|block world|block-based|sandbox building)/.test(text);
  const thirdPerson = /(third.?person|open world|3d adventure|3d rpg)/.test(text);
  const firstPerson = /(first.?person|fps|shooter 3d)/.test(text);

  let dimension: GameBuildDimension = "2d";
  let camera: GameCameraModel = "top-down";
  let worldArchitecture: GameBuildPlan["worldArchitecture"] = "tilemap";
  let renderArchitecture: GameBuildPlan["renderArchitecture"] = "sprite-runtime";

  if (voxel) {
    dimension = "voxel-3d";
    camera = "third-person";
    worldArchitecture = "voxel";
    renderArchitecture = "voxel-runtime";
  } else if (thirdPerson || firstPerson) {
    dimension = "3d";
    camera = firstPerson ? "first-person" : "third-person";
    worldArchitecture = "scene";
    renderArchitecture = "3d-runtime";
  } else if (sideScroller) {
    dimension = "2d";
    camera = "side-scroller";
    worldArchitecture = "scene";
    renderArchitecture = "sprite-runtime";
  } else if (topDown) {
    dimension = "2d";
    camera = "top-down";
    worldArchitecture = "tilemap";
    renderArchitecture = "sprite-runtime";
  } else if (/(isometric|diagonal map)/.test(text)) {
    dimension = "2.5d";
    camera = "isometric";
    worldArchitecture = "tilemap";
    renderArchitecture = "hybrid-runtime";
  }

  const systems = [...new Set([
    "game-loop",
    "input",
    "collision",
    ...b.mechanics,
    ...(topDown ? ["tilemap", "camera-follow", "directional-sprites", "npc", "world-interaction"] : []),
    ...(sideScroller ? ["platform-physics", "camera-scroll", "level-flow"] : []),
    ...(voxel ? ["voxel-world", "chunk-streaming", "block-interaction", "inventory", "crafting"] : []),
    ...(thirdPerson || firstPerson ? ["scene-graph", "3d-camera", "3d-collision", "lighting"] : []),
  ])];

  const actors = [...new Set([
    "player",
    ...(b.mechanics.includes("dialogue") ? ["npc"] : []),
    ...(b.mechanics.includes("combat") || /monster|enemy|creature|zombie|boss/.test(text) ? ["enemy"] : []),
    ...(topDown ? ["npc", "creature", "companion"] : []),
  ])];

  const requiredAssets = [...new Set([
    "player",
    ...(actors.includes("npc") ? ["npc"] : []),
    ...(actors.includes("enemy") || actors.includes("creature") ? ["enemy"] : []),
    ...(topDown ? ["tileset", "environment-props", "effects", "ui"] : []),
  ])];

  const animated = [...new Set([
    "player",
    ...(topDown ? ["npc", "creature", "effects"] : []),
    ...(b.mechanics.includes("combat") ? ["attack", "hit"] : []),
  ])];

  const directional = topDown ? ["player", "npc", "creature"] : [];

  if (referenceDriven) {
    systems.add("reference-visual-qa");
    testStages.push("reference-visual-comparison");
    buildStages.push("analyze-reference-visual-target");
  }

  return {
    version: 1,
    dimension,
    camera,
    worldArchitecture,
    renderArchitecture,
    systems,
    actors,
    assets: {
      required: requiredAssets,
      animated,
      directional,
      originalOnly: true,
    },
    controls: {
      keyboard: ["WASD", "Arrow keys", "Space", "Enter", "E"],
      touch: ["virtual directional pad", "action buttons"],
      gamepad: ["d-pad", "action buttons"],
    },
    audio: {
      required: true,
      events: ["movement", "interaction", "combat", "collect", "objective", "victory", "defeat"],
    },
    buildStages: [
      "parse-intent",
      "create-game-specification",
      "select-runtime",
      "compose-systems",
      "plan-assets",
      "build-runtime",
      "run-in-sandbox",
      "collect-runtime-evidence",
      "analyze-runtime-evidence",
      "repair",
      "retest",
      "finalize",
    ],
    testStages: [
      "rendering",
      "animation",
      "keyboard-input",
      "touch-input",
      "audio",
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
        "visible-pixels",
        "animation-frames",
        "input-events",
        "audio-events",
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
