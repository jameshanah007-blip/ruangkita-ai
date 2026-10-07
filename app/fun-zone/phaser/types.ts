export type PhaserGenre =
  | "monster_tamer"
  | "farming"
  | "adventure"
  | "rpg"
  | "platformer"
  | "racing"
  | "puzzle"
  | "shooter"
  | "strategy"
  | "simulation"
  | "survival";

export type PhaserSceneSpec = {
  id: string;
  name: string;
  role: string;
};

export type PhaserAssetManifestEntry = {
  id: string;
  kind: "character" | "npc" | "enemy" | "companion" | "environment" | "prop" | "effect" | "ui";
  uri: string;
  animationNeeds: string[];
  characterDNA?: Record<string, unknown> | null;
};

export type PhaserGameSpec = {
  version: string;
  title: string;
  concept: string;
  genre: PhaserGenre;
  objective: string;
  winCondition: string;
  loseCondition: string;
  scenes: PhaserSceneSpec[];
  systems: string[];
  actions: string[];
  controls: { keyboard: string[]; touch: string[] };
  visual: {
    mode: string;
    palette: {
      background: string;
      ground: string;
      accent: string;
      danger: string;
      light: string;
    };
  };
  sourcePrompt: string;
  runtimeId: string;
  assets: PhaserAssetManifestEntry[];
  playerAssetId?: string;
};

export type PhaserRuntimeBuild = {
  html: string;
  genre: PhaserGenre;
  runtimeId: string;
  engine: "phaser";
  phaserVersion: string;
  systems: string[];
};