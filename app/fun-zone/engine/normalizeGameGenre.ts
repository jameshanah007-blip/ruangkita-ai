export function normalizeGameGenre(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase().replace(/[ -]+/g, "_");
  const aliases: Record<string, string> = {
    race: "racing",
    balap: "racing",
    car_racing: "racing",
    farm: "farming",
    bertani: "farming",
    pokemon: "monster_tamer",
    "monster-tamer": "monster_tamer",
    creature_collection: "monster_tamer",
    side_scroller: "platformer",
    teka_teki: "puzzle",
    strategi: "strategy",
    simulasi: "simulation",
  };
  return aliases[raw] ?? raw;
}
