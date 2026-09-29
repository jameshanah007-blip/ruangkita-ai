import type { GameBlueprint } from "../laboratory/types";

function text(prompt: string): string { return prompt.toLowerCase(); }

function inferMode(prompt: string): string {
  const p=text(prompt);
  if (/(runner|endless|lari|running)/.test(p)) return "runner";
  if (/(puzzle|teka|logic|match|grid)/.test(p)) return "puzzle";
  if (/(racing|race|balap|mobil|kendaraan)/.test(p)) return "racing";
  if (/(stealth|siluman|infiltrat|patrol|mata-mata)/.test(p)) return "stealth";
  if (/(farm|farming|bertani|tanam|simulasi)/.test(p)) return "farming";
  if (/(strategy|strategi|tower|defense|pertahanan)/.test(p)) return "strategy";
  if (/(combat|fight|battle|perang|shooter|menembak|arena)/.test(p)) return "combat";
  if (/(survival|bertahan|zombie|monster|horror)/.test(p)) return "survival";
  return "adventure";
}

function inferDifficulty(prompt: string): string {
  const p=text(prompt);
  if (/(sangat sulit|extreme|hardcore)/.test(p)) return "extreme";
  if (/(sulit|hard|menantang)/.test(p)) return "hard";
  if (/(mudah|easy|santai)/.test(p)) return "easy";
  return "medium";
}

export function createLocalGameBlueprint(prompt: string): GameBlueprint {
  const clean=prompt.trim().slice(0,1200)||"petualangan interaktif";
  const mode=inferMode(clean), difficulty=inferDifficulty(clean);
  const presets: Record<string,{core:string;objective:string;mechanics:string[];actions:string[];win:string;lose:string}> = {
    runner:{core:"lari, hindari rintangan, kumpulkan item, bertahan selama mungkin",objective:"Bertahan dalam lintasan dan mencapai target jarak.",mechanics:["auto-run","obstacles","collection","distance","health"],actions:["move","jump","collect","restart"],win:"Mencapai target jarak.",lose:"HP habis karena menabrak rintangan."},
    puzzle:{core:"amati pola, lakukan aksi, selesaikan rangkaian puzzle",objective:"Menyelesaikan lima pola puzzle.",mechanics:["grid","pattern","actions","progression"],actions:["select","solve","restart"],win:"Lima puzzle terselesaikan.",lose:"Tidak ada kondisi kalah; pemain dapat mencoba lagi."},
    racing:{core:"mengendalikan kendaraan, menghindari lawan, mencapai garis akhir",objective:"Mencapai garis akhir sebelum terlalu banyak kerusakan.",mechanics:["driving","steering","obstacles","timer","finish"],actions:["steer","accelerate","brake","restart"],win:"Mencapai target waktu/lintasan.",lose:"HP kendaraan habis."},
    stealth:{core:"bergerak diam-diam, menghindari patroli, mengambil intel",objective:"Mengambil empat intel tanpa tertangkap.",mechanics:["stealth","patrol","visibility","intel"],actions:["move","hide","collect","restart"],win:"Empat intel berhasil diamankan.",lose:"HP habis setelah terlalu dekat dengan patroli."},
    farming:{core:"bergerak di area kebun, mengumpulkan resource, mengembangkan produksi",objective:"Mencapai target produksi delapan resource.",mechanics:["farming","resource","progression","action"],actions:["move","harvest","plant","restart"],win:"Target produksi tercapai.",lose:"Tidak ada kondisi kalah."},
    strategy:{core:"mengatur posisi, mengambil keputusan aksi, mengalahkan ancaman bertahap",objective:"Menyelesaikan lima keputusan strategis.",mechanics:["tactics","positioning","waves","action","progression"],actions:["move","command","attack","restart"],win:"Lima tahap strategi diselesaikan.",lose:"HP habis."},
    combat:{core:"bergerak, menyerang musuh, menghindari serangan, mengalahkan semua lawan",objective:"Mengalahkan seluruh musuh di arena.",mechanics:["movement","attack","enemy_ai","health","arena"],actions:["move","attack","dodge","restart"],win:"Semua musuh dikalahkan.",lose:"HP pemain mencapai nol."},
    survival:{core:"bergerak, menghindari ancaman, bertahan dari waktu ke waktu",objective:"Bertahan selama tiga puluh detik.",mechanics:["survival","enemy_ai","health","timer"],actions:["move","dodge","escape","restart"],win:"Bertahan sampai timer selesai.",lose:"HP pemain mencapai nol."},
    adventure:{core:"menjelajah, menemukan objek, menghadapi ancaman, menyelesaikan tujuan",objective:"Menemukan lima objek penting dan menyelesaikan perjalanan.",mechanics:["exploration","collection","collision","progression"],actions:["move","explore","collect","restart"],win:"Lima objek penting ditemukan.",lose:"HP pemain mencapai nol."}
  };
  const preset=presets[mode]||presets.adventure;
  return {
    title:`RuangKita: ${clean.slice(0,56)}`,
    concept:clean, genre:mode, mood:"dynamic", difficulty, theme:clean,
    world:"an original interactive browser game world",
    coreLoop:preset.core, objective:preset.objective,
    mechanics:preset.mechanics, playerActions:preset.actions,
    controls:["keyboard","pointer","touch","virtual_buttons"],
    progression:"Progress is represented by real gameplay state and increases through valid player actions.",
    replayability:"Restart the run and try a different strategy or faster route.",
    winCondition:preset.win, loseCondition:preset.lose,
    visualStyle:"clean colorful 2D Canvas game optimized for mobile screens",
    mobileNotes:["touch-first controls","large virtual buttons","responsive canvas","no external assets","offline after HTML loads"],
    testRequirements:["canvas renders","game loop advances","input changes gameplay","player state changes","objective state changes","win or lose is reachable","restart resets the game"]
  };
}
