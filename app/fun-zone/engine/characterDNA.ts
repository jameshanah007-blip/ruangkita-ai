import type { GameAssetSpec } from "./assetRegistry";

export type CharacterDNA = {
  identityKey: string;
  role: "protagonist" | "npc" | "enemy" | "companion";
  archetype: string;
  gender: "female" | "male" | "unknown";
  visualStyle: string;
  hair: string;
  face: string;
  body: string;
  outfit: string;
  equipment: string;
  paletteSeed: number;
  animationNeeds: string[];
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pick(text: string, patterns: Array<[RegExp, string]>, fallback: string): string {
  for (const [pattern, value] of patterns) if (pattern.test(text)) return value;
  return fallback;
}

export function buildCharacterDNA(asset: GameAssetSpec): CharacterDNA | null {
  if (!["character", "npc", "enemy", "companion"].includes(asset.kind)) return null;

  const text = asset.prompt.toLowerCase();
  const role =
    asset.kind === "character" ? "protagonist" :
    asset.kind === "npc" ? "npc" :
    asset.kind === "enemy" ? "enemy" : "companion";

  const gender =
    /female|girl|woman|princess|heroine|perempuan|wanita/.test(text) ? "female" :
    /male|boy|man|prince|hero|laki-laki|lelaki|pria/.test(text) ? "male" : "unknown";

  const hair = pick(text, [
    [/long hair|rambut panjang/, "long flowing hair"],
    [/short hair|rambut pendek/, "short hair"],
    [/ponytail|ekor kuda/, "ponytail"],
    [/white hair|rambut putih/, "white hair"],
    [/silver hair|rambut perak/, "silver hair"],
    [/black hair|rambut hitam/, "black hair"],
    [/blue hair|rambut biru/, "blue hair"],
    [/red hair|rambut merah/, "red hair"],
  ], gender === "female" ? "long stylized hair" : "short stylized hair");

  const face = pick(text, [
    [/serious|tegas|cool/, "calm serious anime face"],
    [/cute|imut|ceria|cheerful/, "bright expressive anime face"],
    [/mysterious|misterius/, "mysterious anime face"],
    [/angry|marah/, "determined anime face"],
  ], "expressive anime face");

  const body = pick(text, [
    [/armor|armour|knight|warrior|ksatria/, "athletic warrior proportions"],
    [/child|kid|anak/, "small youthful proportions"],
    [/giant|raksasa/, "large powerful proportions"],
  ], "stylized game-character proportions");

  const outfit = pick(text, [
    [/samurai|katana|kimono/, "samurai-inspired outfit"],
    [/armor|armour|knight|warrior|ksatria/, "fantasy armor"],
    [/school|sekolah/, "anime school outfit"],
    [/princess|putri/, "fantasy princess outfit"],
  ], "original fantasy game outfit");

  const equipment = pick(text, [
    [/katana|sword|blade|pedang/, "katana sword"],
    [/bow|busur|archer/, "fantasy bow"],
    [/staff|tongkat sihir|magic/, "magic staff"],
    [/gun|pistol|rifle|senjata api/, "ranged weapon"],
  ], "signature equipment");

  const visualStyle = /anime|manga|anime-inspired/.test(text)
    ? "anime-inspired 2D game character"
    : "stylized 2D game character";

  return {
    identityKey: asset.id,
    role,
    archetype: asset.role,
    gender,
    visualStyle,
    hair,
    face,
    body,
    outfit,
    equipment,
    paletteSeed: hash(asset.id + "|" + asset.prompt),
    animationNeeds: asset.animationNeeds.length ? asset.animationNeeds : ["idle", "move", "action", "hit", "talk"],
  };
}

export function characterDNAPrompt(dna: CharacterDNA): string {
  return [
    dna.visualStyle,
    dna.gender,
    dna.hair,
    dna.face,
    dna.body,
    dna.outfit,
    dna.equipment,
    "consistent character identity",
    "same face hair outfit colors across every pose",
  ].join(", ");
}
