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
  animationMode?: "sprite-sheet" | "single-image";
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  rowCount?: number;
  imageCrop?: { x: number; y: number; width: number; height: number };
  racingTrackLayout?: "square-loop" | "modular-preview";
  characterDNA?: Record<string, unknown> | null;
  entityKind?: "character" | "vehicle" | "creature" | "ship" | "other";
  tags?: string[];
  provider?: string;
};

export type PhaserPlayerEntity = {
  assetId: string;
  entityKind: "character" | "vehicle" | "creature" | "ship" | "other";
  requiredAnimations: string[];
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
  player: PhaserPlayerEntity;
  racing?: {
    laps: number;
    checkpointCount: number;
    trackAssetId: string;
    trackDescription: string;
    vehicleDescription: string;
    maxSpeed: number;
    upgradeEnabled: boolean;
    trackStyle: string;
    checkpointAnchors: Array<{ x: number; y: number }>;
  };
};

export type PhaserRuntimeBuild = {
  html: string;
  genre: PhaserGenre;
  runtimeId: string;
  engine: "phaser";
  phaserVersion: string;
  systems: string[];
};