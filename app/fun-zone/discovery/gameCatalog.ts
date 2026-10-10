export type GameGenre =
  | "adventure"
  | "platformer"
  | "puzzle"
  | "racing"
  | "farming"
  | "multiplayer"
  | "casual"
  | "all";

export type GamePortal = {
  id: "crazygames" | "gamescoid" | "playhop" | "poki";
  name: string;
  url: string;
  description: string;
  tags: GameGenre[];
  accent: string;
};

export const GAME_PORTALS: GamePortal[] = [
  {
    id: "crazygames",
    name: "CrazyGames",
    url: "https://www.crazygames.com/id/t/2d",
    description: "Petualangan, platformer, arcade, puzzle, dan banyak genre 2D.",
    tags: ["adventure", "platformer", "puzzle", "racing", "farming", "casual", "all"],
    accent: "from-violet-500/25 to-indigo-500/10",
  },
  {
    id: "gamescoid",
    name: "Games.co.id",
    url: "https://www.games.co.id/permainan/2d",
    description: "Game 2D kasual dan klasik, termasuk seri Fireboy and Watergirl.",
    tags: ["adventure", "platformer", "puzzle", "casual", "all"],
    accent: "from-orange-500/25 to-amber-500/10",
  },
  {
    id: "playhop",
    name: "Playhop",
    url: "https://playhop.com/id/tag/2d_764",
    description: "Koleksi game 2D yang bisa dimainkan lewat browser ponsel atau komputer.",
    tags: ["adventure", "platformer", "puzzle", "racing", "multiplayer", "casual", "all"],
    accent: "from-cyan-500/25 to-sky-500/10",
  },
  {
    id: "poki",
    name: "Poki 2 Pemain",
    url: "https://poki.com/id/2-pemain",
    description: "Pilihan game untuk bermain bersama teman di satu perangkat atau browser.",
    tags: ["multiplayer", "casual", "all"],
    accent: "from-emerald-500/25 to-teal-500/10",
  },
];

export const GENRE_LABELS: Record<GameGenre, string> = {
  adventure: "Petualangan",
  platformer: "Platformer",
  puzzle: "Puzzle & logika",
  racing: "Balapan",
  farming: "Farming & simulasi",
  multiplayer: "2 pemain / multiplayer",
  casual: "Kasual & arcade",
  all: "Semua game 2D",
};

export const GENRE_KEYWORDS: Record<Exclude<GameGenre, "all">, string[]> = {
  adventure: ["petualangan", "adventure", "explore", "eksplorasi", "quest", "misi", "dungeon", "survival", "rpg"],
  platformer: ["platformer", "platform", "lompat", "melompat", "jump", "mario", "lari", "run", "side scrolling"],
  puzzle: ["puzzle", "teka teki", "teka-teki", "logika", "brain", "match", "bubble", "merge", "susun", "cocokkan"],
  racing: ["balapan", "racing", "race", "mobil", "motor", "drift", "driving", "kendaraan"],
  farming: ["farming", "bertani", "kebun", "petani", "farm", "tanam", "memanen", "simulasi"],
  multiplayer: ["2 pemain", "dua pemain", "berdua", "multiplayer", "teman", "bersama", "co-op", "co op", "poki"],
  casual: ["kasual", "casual", "arcade", "santai", "shooter", "menembak", "stickman", "bubble shooter"],
};

export function normalizeGamePrompt(prompt: string): string {
  return prompt
    .normalize("NFKD")
    .toLocaleLowerCase("id")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveGameDiscovery(prompt: string): {
  genre: GameGenre;
  label: string;
  explanation: string;
  portals: GamePortal[];
} {
  const normalized = normalizeGamePrompt(prompt);
  const scores = (Object.entries(GENRE_KEYWORDS) as [Exclude<GameGenre, "all">, string[]][])
    .map(([genre, keywords]) => ({
      genre,
      score: keywords.reduce((score, keyword) => score + (normalized.includes(keyword) ? (keyword.includes(" ") ? 3 : 2) : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);

  // Multiplayer is a strong intent modifier: if the user explicitly asks to play
  // together, prioritize portals with two-player/multiplayer collections.
  const multiplayerIntent = /\\b(2 pemain|dua pemain|berdua|multiplayer|co-op|co op|main bersama|main bareng|dengan teman)\\b/.test(normalized);
  const winner = multiplayerIntent
    ? scores.find((entry) => entry.genre === "multiplayer")
    : scores[0];
  const genre: GameGenre = winner && winner.score > 0 ? winner.genre : "all";
  const portals = GAME_PORTALS.filter((portal) => portal.tags.includes(genre));

  const explanations: Record<GameGenre, string> = {
    adventure: "Saya memilih portal dengan koleksi petualangan, eksplorasi, dan misi 2D.",
    platformer: "Saya memilih portal yang cocok untuk game lompat, berlari, dan melewati rintangan.",
    puzzle: "Saya memilih portal untuk teka-teki, logika, merge, dan game mencocokkan.",
    racing: "Saya memilih portal dengan koleksi game balapan dan berkendara.",
    farming: "Koleksi farming 2D khusus lebih terbatas di katalog ini; portal berikut adalah titik awal untuk mencari simulasi dan game kasual terkait.",
    multiplayer: "Saya memprioritaskan portal yang menyediakan koleksi game dua pemain atau multiplayer.",
    casual: "Saya memilih portal untuk game kasual dan arcade yang cepat dimainkan.",
    all: "Saya belum menemukan genre yang spesifik, jadi saya menampilkan beberapa portal 2D gratis untuk kamu jelajahi.",
  };

  return {
    genre,
    label: GENRE_LABELS[genre],
    explanation: explanations[genre],
    portals,
  };
}
