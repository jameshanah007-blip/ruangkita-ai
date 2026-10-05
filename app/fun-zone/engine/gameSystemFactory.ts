import type { GameBlueprint } from "../laboratory/types";

export type GameSystemId =
  | "exploration"
  | "combat"
  | "turnBasedCombat"
  | "collection"
  | "party"
  | "progression"
  | "evolution"
  | "inventory"
  | "items"
  | "npc"
  | "dialogue"
  | "quest"
  | "relationship"
  | "farming"
  | "crafting"
  | "economy"
  | "racing"
  | "puzzle"
  | "stealth"
  | "survival"
  | "strategy"
  | "platforming";

export type GameSystemPlan = {
  primaryMode: "runner" | "puzzle" | "racing" | "stealth" | "farming" | "strategy" | "combat" | "survival" | "adventure";
  systems: GameSystemId[];
  reasons: Record<GameSystemId, string>;
};

const rules: Array<{ id: GameSystemId; patterns: RegExp[]; reason: string }> = [
  { id: "turnBasedCombat", patterns: [/turn.?based/i, /giliran/i, /bergiliran/i, /jrpg/i, /creature battle/i, /monster battle/i, /pokemon.?style/i], reason: "The concept implies turn-based creature/JRPG battle structure." },
  { id: "collection", patterns: [/collect/i, /collection/i, /kumpul/i, /tangkap/i, /catch/i, /creature/i, /monster/i, /makhluk/i], reason: "The concept contains collection/capture elements." },
  { id: "party", patterns: [/party/i, /team/i, /tim/i, /kelompok/i, /party of creatures/i, /team of creatures/i, /starter team/i], reason: "The concept contains a party/team system." },
  { id: "evolution", patterns: [/evol/i, /berubah bentuk/i, /transform/i, /upgrade form/i], reason: "The concept contains evolution or form changes." },
  { id: "npc", patterns: [/npc/i, /villager/i, /merchant/i, /pedagang/i, /warga/i, /karakter/i], reason: "The concept contains non-player characters." },
  { id: "dialogue", patterns: [/dialog/i, /percakapan/i, /bicara/i, /story/i, /cerita/i], reason: "The concept contains dialogue or narrative." },
  { id: "quest", patterns: [/quest/i, /mission/i, /misi/i, /tugas/i], reason: "The concept contains quests or missions." },
  { id: "relationship", patterns: [/relationship/i, /friendship/i, /bond/i, /hubungan/i, /persahabatan/i], reason: "The concept contains relationship/bond mechanics." },
  { id: "inventory", patterns: [/inventory/i, /tas/i, /backpack/i, /equipment/i, /peralatan/i], reason: "The concept contains inventory/equipment." },
  { id: "items", patterns: [/item/i, /potion/i, /ramuan/i, /loot/i, /drop/i], reason: "The concept contains collectible/useable items." },
  { id: "progression", patterns: [/level/i, /leveling/i, /xp/i, /experience/i, /skill/i, /progress/i, /upgrade/i], reason: "The concept contains progression." },
  { id: "exploration", patterns: [/explor/i, /jelajah/i, /menjelajah/i, /petualang/i, /open world/i, /dunia/i], reason: "The concept contains exploration." },
  { id: "combat", patterns: [/combat/i, /fight/i, /battle/i, /bertarung/i, /perang/i, /shooter/i, /menembak/i, /musuh/i, /monster/i], reason: "The concept contains combat." },
  { id: "farming", patterns: [/farm/i, /bertani/i, /tanam/i, /panen/i, /kebun/i, /berkebun/i], reason: "The concept contains farming." },
  { id: "crafting", patterns: [/craft/i, /membuat item/i, /forging/i, /tempa/i, /kerajinan/i], reason: "The concept contains crafting." },
  { id: "economy", patterns: [/shop/i, /toko/i, /jual/i, /beli/i, /uang/i, /currency/i, /ekonomi/i], reason: "The concept contains an economy." },
  { id: "racing", patterns: [/racing/i, /race/i, /balap/i, /mobil/i, /kendaraan/i, /driving/i], reason: "The concept contains racing/vehicle gameplay." },
  { id: "puzzle", patterns: [/puzzle/i, /teka/i, /logic/i, /match/i, /grid/i], reason: "The concept contains puzzle gameplay." },
  { id: "stealth", patterns: [/stealth/i, /siluman/i, /infiltrat/i, /patrol/i, /mata.?mata/i], reason: "The concept contains stealth/infiltration." },
  { id: "survival", patterns: [/survival/i, /bertahan/i, /zombie/i, /horror/i], reason: "The concept contains survival pressure." },
  { id: "strategy", patterns: [/strategy/i, /strategi/i, /tower/i, /defense/i, /pertahanan/i, /taktik/i], reason: "The concept contains strategic/tactical gameplay." },
  { id: "platforming", patterns: [/platformer/i, /platforming/i, /lompat/i, /jump/i, /side.?scroll/i], reason: "The concept contains platforming." },
];

function primaryMode(text: string): GameSystemPlan["primaryMode"] {
  if (/(runner|endless|lari|run)/i.test(text)) return "runner";
  if (/(puzzle|teka|logic|match|grid)/i.test(text)) return "puzzle";
  if (/(racing|race|balap|driving|kendaraan|mobil)/i.test(text)) return "racing";
  if (/(stealth|siluman|infiltrat|patrol|spy)/i.test(text)) return "stealth";
  if (/(farm|farming|bertani|tanam|simulation|simulasi)/i.test(text)) return "farming";
  if (/(strategy|strategi|tower|defense|pertahan)/i.test(text)) return "strategy";
  if (/(combat|fight|battle|perang|shooter|menembak|arena)/i.test(text)) return "combat";
  if (/(survival|bertahan|zombie|monster|horror)/i.test(text)) return "survival";
  return "adventure";
}

export function buildGameSystemPlan(b: GameBlueprint): GameSystemPlan {
  const text = [b.genre, b.concept, b.objective, b.coreLoop, b.progression, b.replayability, ...b.mechanics, ...b.playerActions, ...b.testRequirements].join(" ");
  const systems = new Set<GameSystemId>();
  const reasons = {} as Record<GameSystemId, string>;

  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      systems.add(rule.id);
      reasons[rule.id] = rule.reason;
    }
  }

  // RPG-style games naturally benefit from these systems when the blueprint
  // already describes progression, exploration, battles, quests or creatures.
  if (/(rpg|role.?playing|adventure|petualang|pokemon|creature|monster|fantasy)/i.test(text)) {
    for (const id of ["exploration", "progression", "inventory"] as GameSystemId[]) {
      systems.add(id);
      reasons[id] ??= "RPG/adventure structure benefits from this system.";
    }
  }

  if (systems.size === 0) {
    systems.add("exploration");
    reasons.exploration = "Default foundational system for a novel game concept.";
  }

  return {
    primaryMode: primaryMode(text),
    systems: [...systems],
    reasons,
  };
}
