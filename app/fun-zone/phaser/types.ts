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
  role: "world" | "menu" | "battle" | "shop" | "results";
};

export type PhaserGameSpec = {
  version: "ruangkita-game-spec-v1";
  title: string;
  concept: string;
  genre: PhaserGenre;
  objective: string;
  winCondition: string;
  loseCondition: string;
  scenes: PhaserSceneSpec[];
  systems: string[];
  actions: string[];
  controls: {
    keyboard: string[];
    touch: string[];
  };
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
};

export type PhaserRuntimeBuild = {
  html: string;
  genre: PhaserGenre;
  runtimeId: string;
  engine: "phaser";
  phaserVersion: "3.90.0";
  systems: string[];
  spec: PhaserGameSpec;
};
