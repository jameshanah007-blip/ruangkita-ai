import type { PhaserGenre } from "./types";

export type PhaserGenreContract = {
  requiredActions: string[];
  requiredSignals: string[];
};

export const PHASER_GENRE_CONTRACTS: Record<PhaserGenre, PhaserGenreContract> = {
  monster_tamer: {
    requiredActions: ["talk","accept_quest","encounter","attack","capture","add_party"],
    requiredSignals: ["dialogueStarted","questAccepted","encounterStarted","battleStarted","battleCompleted","captureCount","partyCount"],
  },
  farming: {
    requiredActions: ["till","plant","water","harvest","sell"],
    requiredSignals: ["tilled","planted","watered","harvested","sold","money"],
  },
  adventure: {
    requiredActions: ["talk","collect","open_exit"],
    requiredSignals: ["dialogueStarted","itemsCollected","exitOpened"],
  },
  rpg: {
    requiredActions: ["talk","battle","loot","level_up"],
    requiredSignals: ["dialogueStarted","battleWins","lootCount","level"],
  },
  platformer: {
    requiredActions: ["move","jump","collect","reach_goal"],
    requiredSignals: ["jumps","collectCount","goalReached"],
  },
  racing: {
    requiredActions: ["accelerate","steer","checkpoint","finish"],
    requiredSignals: ["maxSpeed","checkpoints","finished"],
  },
  puzzle: {
    requiredActions: ["select","solve"],
    requiredSignals: ["selections","solved"],
  },
  shooter: {
    requiredActions: ["aim","shoot","reload","defeat"],
    requiredSignals: ["aimed","shots","reloads","enemiesDefeated"],
  },
  strategy: {
    requiredActions: ["place","command","capture_point"],
    requiredSignals: ["unitsPlaced","commands","pointsCaptured"],
  },
  simulation: {
    requiredActions: ["build","allocate","upgrade"],
    requiredSignals: ["buildings","allocated","upgrades"],
  },
  survival: {
    requiredActions: ["scavenge","craft","defend","survive_wave"],
    requiredSignals: ["resources","crafted","defended","waves"],
  },
};
