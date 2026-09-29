export type FunZoneGameIdea = {
  id: string;
  title: string;
  genre: string;
  mood: string;
  difficulty: "easy" | "medium" | "hard" | "extreme";
  prompt: string;
  mechanics: string[];
};

const ARCHETYPES: FunZoneGameIdea[] = [
  { id:"sky-run", title:"Skyline Rush", genre:"Runner", mood:"energetic", difficulty:"medium", prompt:"Buat game endless runner 2D di kota futuristik. Pemain berlari otomatis, melompat melewati rintangan, mengambil energi, dan mengejar skor tertinggi.", mechanics:["auto-run","jump","obstacles","score","speed escalation"] },
  { id:"dungeon-relic", title:"Relic of the Lost Dungeon", genre:"RPG Adventure", mood:"mysterious", difficulty:"hard", prompt:"Buat game RPG adventure 2D di dungeon. Pemain menjelajah, mengambil relic, menghadapi monster, memiliki HP, dan membuka portal setelah objective tercapai.", mechanics:["exploration","combat","loot","health","portal"] },
  { id:"neon-drift", title:"Neon Drift", genre:"Racing", mood:"fast", difficulty:"hard", prompt:"Buat game racing top-down 2D bertema cyberpunk. Pemain mengendalikan kendaraan, menghindari obstacle, mengambil boost, dan mencapai finish secepat mungkin.", mechanics:["driving","steering","boost","lap","timer"] },
  { id:"last-shelter", title:"Last Shelter", genre:"Survival", mood:"tense", difficulty:"hard", prompt:"Buat game survival 2D. Pemain mengumpulkan resource, menghindari atau melawan musuh, menjaga health, dan bertahan sampai timer objective selesai.", mechanics:["survival","resource","enemy","health","timer"] },
  { id:"crystal-logic", title:"Crystal Logic", genre:"Puzzle", mood:"calm", difficulty:"medium", prompt:"Buat game puzzle 2D berbasis grid. Pemain memindahkan crystal untuk mencocokkan pola, membuka target, dan menyelesaikan beberapa tahap.", mechanics:["grid","matching","moves","stages","objective"] },
  { id:"shadow-agent", title:"Shadow Agent", genre:"Stealth", mood:"suspenseful", difficulty:"hard", prompt:"Buat game stealth 2D. Pemain bergerak melewati area patroli, menghindari cone penglihatan musuh, mengambil intel, lalu mencapai extraction point.", mechanics:["stealth","patrol","visibility","intel","extraction"] },
  { id:"tower-core", title:"Tower Core Defense", genre:"Tower Defense", mood:"strategic", difficulty:"hard", prompt:"Buat game tower defense 2D. Musuh datang dalam wave menuju core. Pemain menempatkan defense sederhana, mengelola energy, dan bertahan dari beberapa wave.", mechanics:["waves","defense","energy","enemy path","base health"] },
  { id:"island-farm", title:"Tiny Island Farm", genre:"Simulation", mood:"relaxing", difficulty:"easy", prompt:"Buat game simulation 2D pulau kecil. Pemain menanam, memanen, mengumpulkan resource, dan memperluas area untuk mencapai target produksi.", mechanics:["farming","resource","upgrade","timer","progression"] },
  { id:"monster-arena", title:"Monster Arena", genre:"Action Combat", mood:"intense", difficulty:"hard", prompt:"Buat game arena combat 2D. Pemain bergerak bebas, menyerang monster, menghindari serangan, mengalahkan beberapa musuh, dan menghadapi boss.", mechanics:["movement","attack","enemy AI","boss","health"] },
  { id:"time-mystery", title:"The Missing Hour", genre:"Mystery", mood:"eerie", difficulty:"medium", prompt:"Buat game mystery 2D. Pemain menjelajah lokasi, menemukan clue, memilih interaksi yang benar, dan memecahkan misteri sebelum waktu habis.", mechanics:["exploration","clues","choices","timer","deduction"] },
  { id:"space-miner", title:"Deep Space Miner", genre:"Arcade", mood:"adventurous", difficulty:"medium", prompt:"Buat game arcade 2D di luar angkasa. Pemain mengendalikan kapal, menambang asteroid, menghindari debris, mengumpulkan mineral, dan mencapai target resource.", mechanics:["ship movement","mining","avoidance","resource","score"] },
  { id:"castle-tactics", title:"Pocket Kingdom", genre:"Strategy", mood:"tactical", difficulty:"medium", prompt:"Buat game strategy 2D sederhana. Pemain mengatur unit di arena grid, mempertahankan castle, dan mengalahkan gelombang lawan dengan keputusan posisi.", mechanics:["grid","units","defense","waves","tactics"] },
  { id:"ocean-rescue", title:"Ocean Rescue", genre:"Adventure", mood:"hopeful", difficulty:"easy", prompt:"Buat game adventure 2D di laut. Pemain mengendalikan kapal kecil, menyelamatkan survivor, menghindari badai, dan mencapai safe harbor.", mechanics:["navigation","rescue","hazards","fuel","goal"] },
  { id:"robot-factory", title:"Rogue Factory", genre:"Roguelite", mood:"chaotic", difficulty:"extreme", prompt:"Buat game roguelite 2D di pabrik robot. Setiap run memiliki kombinasi musuh dan reward berbeda, pemain bertarung dan memilih upgrade sampai mencapai core.", mechanics:["combat","random rewards","upgrades","rooms","boss"] },
];

function seededRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export function createFunZoneCatalog(seed = cryptoSafeSeed(), count = 8): FunZoneGameIdea[] {
  const pool = [...ARCHETYPES];
  let state = seededRandom(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) % 1;
    const j = Math.floor(state * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(1, Math.min(count, pool.length)));
}

function cryptoSafeSeed(): string {
  return `${Date.now()}-${Math.random()}-${Math.random()}`;
}
