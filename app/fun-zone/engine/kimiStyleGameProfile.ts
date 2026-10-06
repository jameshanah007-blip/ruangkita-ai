import type { GameBlueprint } from "../laboratory/types";
import { composeGamePlan } from "./gameComposer";

export type KimiStyleGameProfile = {
  genre: string;
  worldType: "forest" | "village" | "dungeon" | "city" | "island" | "fantasy";
  systems: string[];
  playerActions: string[];
  locations: string[];
  worldProps: string[];
  objectiveLabel: string;
  artDirection: {
    style: "pixel-adventure";
    camera: "top-down";
    lighting: "readable-ambient";
    characterPriority: "foreground";
  };
};

function textOf(b: GameBlueprint): string {
  return [
    b.title, b.concept, b.genre, b.theme, b.world,
    b.coreLoop, b.objective, b.visualStyle,
    ...b.mechanics, ...b.playerActions,
  ].join(" ").toLowerCase();
}

function has(text: string, re: RegExp): boolean {
  return re.test(text);
}

export function createKimiStyleGameProfile(b: GameBlueprint): KimiStyleGameProfile {
  const text = textOf(b);
  // Use the central Game Composer as the authority. This prevents the
  // visual runtime from inventing a different set of systems than the
  // blueprint/test architecture.
  const composed = composeGamePlan(b);
  const systems = new Set<string>(composed.systems.map((system) => system.id));
  systems.add("movement");
  systems.add("interaction");
  systems.add("collectibles");

  const worldType: KimiStyleGameProfile["worldType"] =
    has(text, /village|desa|kampung|town|farm|farming/) ? "village" :
    has(text, /dungeon|ruins|castle|cave|gua/) ? "dungeon" :
    has(text, /city|kota|urban/) ? "city" :
    has(text, /island|pulau|beach|pantai|ocean|laut/) ? "island" :
    has(text, /forest|hutan|woods|jungle/) ? "forest" :
    "fantasy";

  const locations = [
    ...(worldType === "village" ? ["village square", "shop", "farm", "forest path"] : []),
    ...(worldType === "forest" ? ["forest path", "clearing", "ancient grove"] : []),
    ...(worldType === "dungeon" ? ["entrance", "stone hall", "treasure chamber"] : []),
    ...(worldType === "city" ? ["town street", "market", "back alley"] : []),
    ...(worldType === "island" ? ["shore", "village", "wild coast"] : []),
    ...(worldType === "fantasy" ? ["village", "wild path", "ancient landmark"] : []),
  ];

  return {
    genre: b.genre || "2D adventure",
    worldType,
    systems: [...systems],
    playerActions: [...new Set(["move", "interact", ...composed.requiredActions])],
    locations,
    worldProps: [
      "paths", "trees", "rocks", "landmarks",
      ...(systems.has("npc") || systems.has("dialogue") ? ["signs", "conversation spots"] : []),
      ...(systems.has("economy") ? ["shop stalls", "currency props"] : []),
      ...(systems.has("farming") ? ["farm plots", "crop props"] : []),
      ...(systems.has("crafting") ? ["workbench", "crafting props"] : []),
    ],
    objectiveLabel: b.objective || b.winCondition || "Explore the world and complete the objective.",
    artDirection: {
      style: "pixel-adventure",
      camera: "top-down",
      lighting: "readable-ambient",
      characterPriority: "foreground",
    },
  };
}
