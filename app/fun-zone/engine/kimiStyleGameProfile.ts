import type { GameBlueprint } from "../laboratory/types";

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
  const systems = new Set<string>(["exploration", "movement", "interaction", "collectibles"]);

  if (has(text, /combat|battle|fight|bertarung|monster|musuh|boss/)) systems.add("combat");
  if (has(text, /npc|villager|dialog|dialogue|story|cerita|quest|misi/)) systems.add("npc-dialogue");
  if (has(text, /shop|merchant|pedagang|toko|buy|sell|jual|beli/)) systems.add("economy");
  if (has(text, /farm|farming|bertani|tanam|panen|kebun/)) systems.add("farming");
  if (has(text, /craft|crafting|kerajinan|recipe|resep/)) systems.add("crafting");
  if (has(text, /relationship|friendship|social|bond|hubungan/)) systems.add("relationship");
  if (has(text, /party|companion|teman|tim/)) systems.add("party");
  if (has(text, /inventory|item|loot|resource|collect|kumpul/)) systems.add("inventory");
  if (has(text, /level|xp|experience|upgrade|skill|progression/)) systems.add("progression");
  if (has(text, /puzzle|teka|labyrinth|labirin/)) systems.add("puzzle");

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
    playerActions: [...new Set(["move", "interact", ...b.playerActions])],
    locations,
    worldProps: [
      "paths", "trees", "rocks", "landmarks",
      ...(systems.has("npc-dialogue") ? ["signs", "conversation spots"] : []),
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
