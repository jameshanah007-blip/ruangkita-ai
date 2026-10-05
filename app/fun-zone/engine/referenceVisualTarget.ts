import type { GameBlueprint } from "../laboratory/types";

export type ReferenceVisualTarget = {
  version: 1;
  available: boolean;
  source: "prompt";
  style: string[];
  camera: string[];
  composition: string[];
  character: string[];
  world: string[];
  animation: string[];
  mobile: string[];
};

function terms(text: string, patterns: Array<[string, string]>): string[] {
  return patterns.filter(([pattern]) => new RegExp(pattern, "i").test(text)).map(([, value]) => value);
}

/**
 * Builds a deterministic visual target contract from the user's natural-language request.
 * This is the first half of reference-driven QA. It deliberately does not pretend that
 * prompt text is equivalent to an uploaded reference image; image comparison is added later.
 */
export function createReferenceVisualTarget(blueprint: GameBlueprint): ReferenceVisualTarget {
  const text = [
    blueprint.concept,
    blueprint.genre,
    blueprint.theme,
    blueprint.world,
    blueprint.visualStyle,
    ...blueprint.mechanics,
    ...blueprint.playerActions,
  ].join(" ");

  const style = terms(text, [
    ["pixel|pixel-art|pixel art", "pixel-art"],
    ["anime|animasi anime", "anime-inspired"],
    ["cartoon|kartun", "cartoon"],
    ["realistic|realistis", "realistic"],
    ["fantasy|fantasi", "fantasy"],
    ["dark|horror|horor", "dark atmosphere"],
  ]);

  const camera = terms(text, [
    ["top.?down|pokemon|monster.?tamer|2d rpg", "top-down"],
    ["side.?scroll|platformer|mario|metroidvania", "side-scroller"],
    ["isometric", "isometric"],
    ["third.?person|open.?world 3d", "third-person"],
    ["first.?person|fps", "first-person"],
  ]);

  const composition = terms(text, [
    ["village|desa|town|kota", "village/town composition"],
    ["forest|hutan", "forest environment"],
    ["dungeon|ruins|reruntuhan", "dungeon/ruins"],
    ["house|rumah|building|bangunan", "buildings"],
    ["npc|villager|penduduk", "NPC presence"],
    ["creature|monster|pokemon", "creature presence"],
  ]);

  const character = terms(text, [
    ["anime|female|girl|woman|cewek|perempuan", "distinct anime-style protagonist"],
    ["knight|warrior|kesatria", "warrior character"],
    ["mage|wizard|penyihir", "magic-user character"],
    ["archer|pemanah", "archer character"],
    ["creature.?collection|monster.?tamer|pokemon", "creature/companion identity"],
  ]);

  const world = terms(text, [
    ["explore|exploration|petualangan", "exploration-focused world"],
    ["farming|bertani", "farmable areas"],
    ["craft|crafting", "crafting spaces/props"],
    ["shop|toko|economy", "shop/economy spaces"],
    ["quest|misi", "quest locations"],
    ["survival|bertahan hidup", "survival resource spaces"],
  ]);

  const animation = terms(text, [
    ["walk|movement|move|bergerak", "movement animation"],
    ["attack|combat|serang", "attack animation"],
    ["talk|dialogue|npc", "talk animation"],
    ["hit|damage|terkena", "hit reaction"],
    ["idle|diam", "idle animation"],
  ]);

  const mobile = terms(text, [
    ["android|mobile|phone|hp|touch", "Android/touch presentation"],
    ["portrait|vertical", "portrait layout"],
    ["landscape|horizontal", "landscape layout"],
  ]);

  return {
    version: 1,
    available: style.length + camera.length + composition.length + character.length + world.length + animation.length + mobile.length > 0,
    source: "prompt",
    style,
    camera,
    composition,
    character,
    world,
    animation,
    mobile,
  };
}
