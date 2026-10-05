import type { GameBlueprint } from "../laboratory/types";

export type VisualCharacterSpec = {
  id: string;
  role: "protagonist" | "npc" | "enemy" | "companion";
  archetype: string;
  appearance: string[];
  outfit: string[];
  equipment: string[];
  expression: string;
  animationNeeds: string[];
};

export type VisualEnvironmentSpec = {
  id: string;
  role: "world" | "area" | "battlefield" | "interior";
  description: string;
  props: string[];
  atmosphere: string[];
};

export type VisualBlueprint = {
  artDirection: {
    style: string[];
    genre: string;
    mood: string;
    theme: string;
    camera: "top-down" | "side-view" | "third-person" | "isometric" | "2d-ui";
  };
  protagonist: VisualCharacterSpec;
  characters: VisualCharacterSpec[];
  environments: VisualEnvironmentSpec[];
  props: string[];
  effects: string[];
  ui: string[];
  assetTags: string[];
};

function sourceText(b: GameBlueprint): string {
  return [
    b.genre,
    b.concept,
    b.mood,
    b.theme,
    b.world,
    b.visualStyle,
    ...b.mechanics,
    ...b.playerActions,
  ].join(" ");
}

function pickCamera(text: string): VisualBlueprint["artDirection"]["camera"] {
  if (/(platformer|side.?scroll|2d)/i.test(text)) return "side-view";
  if (/(top.?down|dungeon|rpg|pokemon|farm|farming)/i.test(text)) return "top-down";
  if (/(racing|driving|car)/i.test(text)) return "third-person";
  if (/(strategy|tactical|isometric)/i.test(text)) return "isometric";
  return "third-person";
}

function characterFromPrompt(text: string): VisualCharacterSpec {
  const appearance: string[] = [];
  const outfit: string[] = [];
  const equipment: string[] = [];

  if (/black.?hair|rambut hitam/i.test(text)) appearance.push("black hair");
  if (/white.?hair|rambut putih/i.test(text)) appearance.push("white hair");
  if (/blue.?eyes|mata biru/i.test(text)) appearance.push("blue eyes");
  if (/red.?eyes|mata merah/i.test(text)) appearance.push("red eyes");
  if (/young man|pemuda|cowok|pria muda/i.test(text)) appearance.push("young male");
  if (/young woman|gadis|cewek|wanita muda/i.test(text)) appearance.push("young female");
  if (/long hair|rambut panjang/i.test(text)) appearance.push("long hair");
  if (/short hair|rambut pendek/i.test(text)) appearance.push("short hair");

  if (/sword|pedang|swordsman/i.test(text)) equipment.push("sword");
  if (/staff|staf|mage|wizard|magic/i.test(text)) equipment.push("magic staff");
  if (/bow|busur|archer/i.test(text)) equipment.push("bow");
  if (/gun|pistol|shooter/i.test(text)) equipment.push("ranged weapon");

  if (/fantasy|isekai|anime/i.test(text)) outfit.push("anime fantasy outfit");
  if (/school|sekolah/i.test(text)) outfit.push("school-inspired outfit");
  if (/armor|knight|ksatria/i.test(text)) outfit.push("protective armor");
  if (/modern|kota|city/i.test(text)) outfit.push("modern clothing");

  if (!appearance.length) appearance.push("appearance derived from the user's character description");
  if (!outfit.length) outfit.push("outfit derived from the game's world and role");
  if (!equipment.length) equipment.push("role-appropriate equipment");

  return {
    id: "protagonist",
    role: "protagonist",
    archetype: /mage|wizard|magic|staff/i.test(text)
      ? "magic-user"
      : /sword|swordsman|pedang/i.test(text)
        ? "fighter"
        : /archer|bow|busur/i.test(text)
          ? "ranged-fighter"
          : "player-avatar",
    appearance,
    outfit,
    equipment,
    expression: /horror|dark|survival/i.test(text) ? "alert and tense" : "focused and expressive",
    animationNeeds: ["idle", "walk", "primary action", "hurt", "victory"],
  };
}

export function buildVisualBlueprint(b: GameBlueprint): VisualBlueprint {
  const text = sourceText(b);
  const protagonist = characterFromPrompt(text);
  const isAnime = /anime|manga|isekai|japanese animation/i.test(text);
  const style = isAnime ? ["anime-inspired"] : (Array.isArray(b.visualStyle) ? b.visualStyle.filter(Boolean) : [b.visualStyle || "game-specific visual style"]);

  const characters: VisualCharacterSpec[] = [protagonist];

  if (/(npc|villager|merchant|pedagang|shop|toko|story|dialog|quest|misi)/i.test(text)) {
    characters.push({
      id: "npc-primary",
      role: "npc",
      archetype: /merchant|pedagang|shop|toko/i.test(text) ? "merchant" : "story-npc",
      appearance: ["distinct silhouette from protagonist", "prompt-derived facial and hair traits"],
      outfit: ["world-appropriate clothing"],
      equipment: ["role-appropriate prop"],
      expression: "friendly or context-appropriate",
      animationNeeds: ["idle", "talk", "gesture"],
    });
  }

  if (/(enemy|monster|creature|combat|battle|zombie|horror)/i.test(text)) {
    characters.push({
      id: "enemy-primary",
      role: "enemy",
      archetype: /zombie/i.test(text) ? "undead creature" : /monster|creature/i.test(text) ? "fantasy creature" : "combat enemy",
      appearance: ["visually distinct from player", "prompt-derived creature traits"],
      outfit: ["role-specific visual markings"],
      equipment: ["attack-specific visual element"],
      expression: "hostile or threatening",
      animationNeeds: ["idle", "move", "attack", "hurt", "defeat"],
    });
  }

  const environments: VisualEnvironmentSpec[] = [{
    id: "world-primary",
    role: "world",
    description: b.world || "Environment derived from the game world.",
    props: ["ground", "landmarks", "interactive objects"],
    atmosphere: [b.mood || "mood derived from prompt"],
  }];

  if (/(forest|hutan)/i.test(text)) {
    environments.push({
      id: "forest",
      role: "area",
      description: "Prompt-derived fantasy forest",
      props: ["trees", "rocks", "plants", "path"],
      atmosphere: ["layered foliage", "depth haze", "ambient particles"],
    });
  }
  if (/(village|desa|town|city|kota)/i.test(text)) {
    environments.push({
      id: "settlement",
      role: "area",
      description: "Prompt-derived settlement",
      props: ["buildings", "signs", "market props", "paths"],
      atmosphere: ["inhabited", "interactive", "story-focused"],
    });
  }
  if (/(dungeon|ruins|castle|istana)/i.test(text)) {
    environments.push({
      id: "dungeon",
      role: "area",
      description: "Prompt-derived dungeon or ruins",
      props: ["walls", "doors", "treasure", "hazards"],
      atmosphere: ["mysterious", "dramatic lighting", "environmental effects"],
    });
  }

  const effects = [
    ...(isAnime ? ["anime impact effects", "stylized motion accents"] : ["contextual impact effects"]),
    ...(b.mechanics.some((m) => /magic|spell|sihir/i.test(m)) ? ["spell particles", "magic glow"] : []),
    ...(b.mechanics.some((m) => /evolution|evolusi|transform/i.test(m)) ? ["transformation effect"] : []),
  ];

  return {
    artDirection: {
      style,
      genre: b.genre,
      mood: b.mood,
      theme: b.theme,
      camera: pickCamera(text),
    },
    protagonist,
    characters,
    environments,
    props: ["interactive world props", "collectible props", "system-specific props"],
    effects,
    ui: ["responsive HUD", "system-specific panels", "mobile-friendly controls"],
    assetTags: [
      style.toLowerCase(),
      b.genre.toLowerCase(),
      b.theme.toLowerCase(),
      ...characters.map((c) => c.archetype),
      ...environments.map((e) => e.id),
    ].filter(Boolean),
  };
}
