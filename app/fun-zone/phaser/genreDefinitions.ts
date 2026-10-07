import type { GameBlueprint } from "../laboratory/types";
import type { PhaserGameSpec, PhaserGenre, PhaserAssetManifestEntry } from "./types";

type GenreDefinition = {
  genre: PhaserGenre;
  systems: string[];
  scenes: PhaserGameSpec["scenes"];
  actions: string[];
  visualMode: string;
  palette: PhaserGameSpec["visual"]["palette"];
  keyboard: string[];
  touch: string[];
};

const DEFINITIONS: Record<PhaserGenre, GenreDefinition> = {
  monster_tamer: {
    genre: "monster_tamer",
    systems: ["movement", "dialogue", "quest", "encounter", "battle", "capture", "party", "progression"],
    scenes: [
      { id: "village", name: "Village", role: "world" },
      { id: "route", name: "Route", role: "world" },
      { id: "forest", name: "Forest", role: "world" },
      { id: "battle", name: "Battle", role: "battle" },
    ],
    actions: ["talk", "accept_quest", "encounter", "attack", "capture", "add_party"],
    visualMode: "creature-adventure",
    palette: { background: "#132238", ground: "#356a4f", accent: "#ffd166", danger: "#ef476f", light: "#f1faee" },
    keyboard: ["Arrow keys", "WASD", "E", "Space"],
    touch: ["4-direction D-pad", "Action buttons"],
  },
  farming: {
    genre: "farming",
    systems: ["movement", "farming", "inventory", "economy", "npc", "dialogue", "day_cycle"],
    scenes: [
      { id: "farm", name: "Farm", role: "world" },
      { id: "market", name: "Market", role: "shop" },
    ],
    actions: ["till", "plant", "water", "harvest", "sell"],
    visualMode: "cozy-farm",
    palette: { background: "#5c4033", ground: "#8bb174", accent: "#f6bd60", danger: "#d1495b", light: "#fff8e7" },
    keyboard: ["Arrow keys", "WASD", "E", "Space"],
    touch: ["4-direction D-pad", "Action buttons"],
  },
  adventure: {
    genre: "adventure",
    systems: ["movement", "dialogue", "collection", "exploration"],
    scenes: [{ id: "ruins", name: "Ruins", role: "world" }],
    actions: ["talk", "collect", "open_exit"],
    visualMode: "ancient-ruins",
    palette: { background: "#1d2433", ground: "#5b6475", accent: "#e9c46a", danger: "#e76f51", light: "#f4f1de" },
    keyboard: ["Arrow keys", "WASD", "E"],
    touch: ["4-direction D-pad", "Action button"],
  },
  rpg: {
    genre: "rpg",
    systems: ["movement", "dialogue", "battle", "loot", "progression"],
    scenes: [
      { id: "town", name: "Town", role: "world" },
      { id: "battle", name: "Battle", role: "battle" },
    ],
    actions: ["talk", "battle", "loot", "level_up"],
    visualMode: "classic-rpg",
    palette: { background: "#17152a", ground: "#493b73", accent: "#c77dff", danger: "#ff5d73", light: "#f8edff" },
    keyboard: ["Arrow keys", "WASD", "E", "Space"],
    touch: ["4-direction D-pad", "Action buttons"],
  },
  platformer: {
    genre: "platformer",
    systems: ["movement", "platform", "collision", "progression"],
    scenes: [{ id: "level-1", name: "Level 1", role: "world" }],
    actions: ["move", "jump", "collect", "reach_goal"],
    visualMode: "arcade-platform",
    palette: { background: "#70c1ff", ground: "#2d6a4f", accent: "#ffca3a", danger: "#ff595e", light: "#ffffff" },
    keyboard: ["Arrow keys", "A/D", "Space"],
    touch: ["Left/Right", "Jump"],
  },
  racing: {
    genre: "racing",
    systems: ["movement", "racing", "collision", "progression"],
    scenes: [
      { id: "garage", name: "Garage", role: "menu" },
      { id: "circuit", name: "Circuit", role: "world" },
      { id: "results", name: "Results", role: "results" },
    ],
    actions: ["accelerate", "steer", "checkpoint", "finish"],
    visualMode: "top-down-racing",
    palette: { background: "#101820", ground: "#3b3f46", accent: "#00d4ff", danger: "#ff4d6d", light: "#f5f7fa" },
    keyboard: ["Arrow keys", "WASD"],
    touch: ["Steer", "Accelerate"],
  },
  puzzle: {
    genre: "puzzle",
    systems: ["puzzle", "selection", "progression"],
    scenes: [{ id: "grid-room", name: "Grid Room", role: "world" }],
    actions: ["select", "solve"],
    visualMode: "neon-grid-puzzle",
    palette: { background: "#090b16", ground: "#1b1f3a", accent: "#00f5d4", danger: "#ff006e", light: "#f8f9ff" },
    keyboard: ["Arrow keys", "Enter", "Space"],
    touch: ["Tile selection"],
  },
  shooter: {
    genre: "shooter",
    systems: ["movement", "shooting", "collision", "survival"],
    scenes: [{ id: "arena", name: "Arena", role: "world" }],
    actions: ["aim", "shoot", "reload", "defeat"],
    visualMode: "arena-shooter",
    palette: { background: "#120b0b", ground: "#382525", accent: "#ffb703", danger: "#fb5607", light: "#fff3e6" },
    keyboard: ["Arrow keys", "WASD", "Mouse", "Space"],
    touch: ["Virtual stick", "Fire"],
  },
  strategy: {
    genre: "strategy",
    systems: ["strategy", "placement", "command", "capture", "economy"],
    scenes: [{ id: "command-map", name: "Command Map", role: "world" }],
    actions: ["place", "command", "capture_point"],
    visualMode: "tactical-map",
    palette: { background: "#0e1726", ground: "#23395d", accent: "#4cc9f0", danger: "#f72585", light: "#edf6ff" },
    keyboard: ["Arrow keys", "Enter"],
    touch: ["Select unit", "Command"],
  },
  simulation: {
    genre: "simulation",
    systems: ["simulation", "building", "allocation", "progression"],
    scenes: [{ id: "settlement", name: "Settlement", role: "world" }],
    actions: ["build", "allocate", "upgrade"],
    visualMode: "settlement-sim",
    palette: { background: "#203a43", ground: "#456268", accent: "#e9c46a", danger: "#e76f51", light: "#f0f7f4" },
    keyboard: ["Arrow keys", "Enter"],
    touch: ["Select building", "Build"],
  },
  survival: {
    genre: "survival",
    systems: ["movement", "survival", "scavenge", "crafting", "defense", "progression"],
    scenes: [{ id: "night-camp", name: "Night Camp", role: "world" }],
    actions: ["scavenge", "craft", "defend", "survive_wave"],
    visualMode: "night-survival",
    palette: { background: "#0b1020", ground: "#273043", accent: "#80ed99", danger: "#ff595e", light: "#e9ecef" },
    keyboard: ["Arrow keys", "WASD", "E", "Space"],
    touch: ["4-direction D-pad", "Action buttons"],
  },
};

export function getGenreDefinition(genre: PhaserGenre): GenreDefinition {
  return DEFINITIONS[genre];
}

export function resolvePhaserGenre(blueprint: GameBlueprint): PhaserGenre | null {
  const value = String(blueprint.genre || "").toLowerCase();
  const concept = [
    blueprint.title,
    blueprint.concept,
    blueprint.coreLoop,
    blueprint.objective,
    ...(blueprint.mechanics || []),
    ...(blueprint.playerActions || []),
  ].join(" ").toLowerCase();

  if (/pokemon|monster tamer|creature|capture monster|menangkap monster/i.test(concept)) return "monster_tamer";
  if (/farm|farming|tanam|bertani|panen|crop|kebun/i.test(concept)) return "farming";
  if (/platformer|platform|lompat|jump/i.test(value + " " + concept)) return "platformer";
  if (/racing|race|balap|mobil|car/i.test(value + " " + concept)) return "racing";
  if (/puzzle|teka.?teki|match|grid/i.test(value + " " + concept)) return "puzzle";
  if (/shooter|tembak|shoot|bullet|arena/i.test(value + " " + concept)) return "shooter";
  if (/strategy|strategi|tactic|tactical|perang/i.test(value + " " + concept)) return "strategy";
  if (/simulation|simulasi|city builder|management/i.test(value + " " + concept)) return "simulation";
  if (/survival|bertahan|zombie|wave/i.test(value + " " + concept)) return "survival";
  if (/rpg|role.?playing|level up|loot/i.test(value + " " + concept)) return "rpg";
  if (/adventure|petualangan|explore|ruins/i.test(value + " " + concept)) return "adventure";

  const normalizedValue = value.replace(/[^a-z_]/g, "_");
  return (normalizedValue in DEFINITIONS ? normalizedValue : null) as PhaserGenre | null;
}

export function compilePhaserGameSpec(
  blueprint: GameBlueprint,
  prompt: string,
  assets: PhaserAssetManifestEntry[] = [],
): PhaserGameSpec | null {
  const genre = resolvePhaserGenre(blueprint);
  if (!genre) return null;
  const definition = getGenreDefinition(genre);

  return {
    version: "ruangkita-game-spec-v1",
    title: blueprint.title,
    concept: blueprint.concept,
    genre,
    objective: blueprint.objective,
    winCondition: blueprint.winCondition,
    loseCondition: blueprint.loseCondition,
    scenes: definition.scenes,
    systems: Array.from(new Set([
      ...definition.systems,
      ...(blueprint.mechanics || []).map((item) => String(item).trim()).filter(Boolean),
    ])),
    actions: definition.actions,
    controls: {
      keyboard: definition.keyboard,
      touch: definition.touch,
    },
    visual: {
      mode: definition.visualMode,
      palette: definition.palette,
    },
    sourcePrompt: prompt,
    runtimeId: "rk-phaser-" + genre + "-v1",
    assets,
    playerAssetId: assets.find((asset) => asset.kind === "character")?.id,
  };
}
