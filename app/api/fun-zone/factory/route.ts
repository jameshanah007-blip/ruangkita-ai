import { NextResponse } from "next/server";
import { generateWithAIRouter } from "../../../fun-zone/aiRouter";

function extractHtml(text: string): string {
  const trimmed = text.trim();

  const fenced = trimmed.match(
    /```(?:html)?\s*([\s\S]*?)\s*```/i
  );

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.search(
    /<!doctype html|<html[\s>]/i
  );

  if (start >= 0) {
    return trimmed.slice(start).trim();
  }

  return trimmed;
}

function validateGameHtml(html: string): string[] {
  const errors: string[] = [];

  if (!html.trim()) {
    errors.push("AI tidak menghasilkan HTML.");
  }

  if (!/<html[\s>]/i.test(html)) {
    errors.push("Dokumen tidak memiliki tag HTML.");
  }

  if (!/<body[\s>]/i.test(html)) {
    errors.push("Dokumen tidak memiliki tag body.");
  }

  if (!/<script[\s>]/i.test(html)) {
    errors.push("Game tidak memiliki JavaScript.");
  }

  if (!/<canvas[\s>]/i.test(html)) {
    errors.push("Game tidak menggunakan Canvas.");
  }

  if (html.length > 500_000) {
    errors.push("Ukuran game terlalu besar.");
  }

  const forbiddenPatterns = [
    /fetch\s*\(/i,
    /XMLHttpRequest/i,
    /WebSocket/i,
    /localStorage/i,
    /sessionStorage/i,
    /document\.cookie/i,
    /window\.parent/i,
    /parent\./i,
    /window\.top/i,
    /top\./i,
    /eval\s*\(/i,
    /new\s+Function\s*\(/i,
    /import\s*\(/i,
  ];

  const forbiddenNames = [
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "localStorage",
    "sessionStorage",
    "document.cookie",
    "window.parent",
    "parent",
    "window.top",
    "top",
    "eval",
    "Function",
    "import",
  ];

  forbiddenPatterns.forEach((pattern, index) => {
    if (pattern.test(html)) {
      errors.push(
        `Game menggunakan kemampuan yang tidak diizinkan: ${forbiddenNames[index]}.`
      );
    }
  });

  return errors;
}

function pickRandom<T>(items: T[]): T {
  return items[
    Math.floor(Math.random() * items.length)
  ];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const theme =
      typeof body?.theme === "string"
        ? body.theme.trim().slice(0, 300)
        : "";

    const genres = [
      "adventure",
      "action",
      "combat",
      "survival",
      "strategy",
      "mystery",
      "runner",
      "rpg",
      "puzzle",
      "arcade",
      "simulation",
      "tower defense",
      "stealth",
      "platformer",
      "space shooter",
    ];

    const mechanics = [
      "exploration",
      "combat",
      "dodging",
      "platform jumping",
      "resource management",
      "enemy waves",
      "boss battle",
      "stealth",
      "time challenge",
      "collecting",
      "crafting",
      "upgrade system",
      "physics",
      "procedural obstacles",
      "base defense",
      "survival waves",
      "puzzle solving",
      "chase",
      "escape",
      "risk and reward",
    ];

    const worlds = [
      "kota cyberpunk",
      "hutan misterius",
      "planet asing",
      "laut dalam",
      "reruntuhan kuno",
      "stasiun luar angkasa",
      "laboratorium rahasia",
      "dunia fantasi",
      "gurun berbahaya",
      "kota yang ditinggalkan",
      "kerajaan futuristik",
      "dimensi alternatif",
      "gunung berapi",
      "pulau terapung",
      "dunia bawah tanah",
    ];

    const visualStyles = [
      "neon futuristik",
      "dark atmospheric",
      "retro arcade",
      "minimal modern",
      "fantasy",
      "sci-fi",
      "pixel inspired",
      "comic style",
      "misterius",
      "cinematic",
    ];

    const requestedGenre =
  typeof body?.genre === "string"
    ? body.genre.trim().toLowerCase()
    : "";

const genre = genres.includes(requestedGenre)
  ? requestedGenre
  : pickRandom(genres);

    const mechanic = pickRandom(mechanics);
    const world = pickRandom(worlds);
    const visualStyle = pickRandom(visualStyles);

    const prompt = `
Ciptakan SATU VIDEO GAME ORIGINAL yang benar-benar dapat
dimainkan di browser mobile dan desktop.

Kali ini kamu mendapatkan design direction berikut:

GENRE:
${genre}

MEKANIK UTAMA:
${mechanic}

DUNIA:
${world}

GAYA VISUAL:
${visualStyle}

Tema tambahan dari pengguna:
${theme || "Tidak ada."}

==================================================
ATURAN KREATIF
==================================================

Jangan kembali membuat game runner sederhana kecuali
genre yang dipilih memang runner.

Game harus benar-benar mengikuti GENRE yang diberikan.

Gunakan mekanik utama yang diberikan sebagai inti gameplay.

Game harus memiliki identitas yang berbeda dari game
yang biasanya dibuat pada request sebelumnya.

Jangan membuat quiz.

Jangan membuat form.

Jangan membuat dashboard.

Jangan membuat halaman informasi.

Buat VIDEO GAME sungguhan.

==================================================
TEKNOLOGI
==================================================

Gunakan:

- HTML
- CSS
- JavaScript vanilla
- Canvas 2D API

Semua kode harus berada dalam satu file HTML.

Jangan menggunakan:

- React
- framework
- external JavaScript
- external CSS
- external image
- external font
- external asset
- external API

==================================================
CANVAS
==================================================

Canvas wajib memiliki ukuran nyata.

Gunakan pola:

const canvas =
  document.getElementById("gameCanvas");

const ctx =
  canvas.getContext("2d");

function resizeCanvas() {
  canvas.width =
    Math.max(
      320,
      Math.min(window.innerWidth, 1200)
    );

  canvas.height =
    Math.max(
      480,
      Math.min(window.innerHeight, 800)
    );
}

resizeCanvas();

window.addEventListener(
  "resize",
  resizeCanvas
);

Canvas tidak boleh berukuran 0 × 0.

==================================================
BOOT GAME
==================================================

Urutan startup wajib:

1. Ambil canvas
2. Ambil context
3. Resize canvas
4. Buat game state
5. Buat player
6. Buat dunia
7. Render frame pertama
8. Mulai game loop

Game harus langsung terlihat ketika dibuka.

==================================================
RENDER PERTAMA
==================================================

Sebelum game loop:

- gambar background
- gambar dunia
- gambar player
- gambar minimal satu objek interaktif

Contoh:

ctx.fillStyle = "#111827";

ctx.fillRect(
  0,
  0,
  canvas.width,
  canvas.height
);

Kemudian gambar player.

==================================================
GAME LOOP
==================================================

Gunakan requestAnimationFrame.

Contoh:

let lastTime = performance.now();

function gameLoop(time) {
  const delta =
    Math.min(
      (time - lastTime) / 1000,
      0.05
    );

  lastTime = time;

  update(delta);
  render();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

Game loop wajib dimulai otomatis.

==================================================
PLAYER
==================================================

Player harus terlihat.

Player harus memiliki:

- posisi
- ukuran
- kecepatan
- kontrol
- interaksi
- state

==================================================
GAMEPLAY
==================================================

Wajib memiliki:

- objective
- tantangan
- interaksi
- score atau progress
- kondisi menang
- kondisi kalah
- restart
- feedback visual
- keyboard control
- touch/mobile control

==================================================
GENRE
==================================================

Genre yang diberikan di atas adalah WAJIB.

Contoh:

Jika genre = mystery:

buat investigasi,
petunjuk,
objek tersembunyi,
dan sistem deduksi.

Jika genre = combat:

buat musuh,
serangan,
damage,
health,
dan pertarungan.

Jika genre = strategy:

buat resource,
decision making,
unit atau struktur,
dan objective strategis.

Jika genre = survival:

buat resource terbatas,
ancaman,
gelombang musuh,
dan survival objective.

Jika genre = tower defense:

buat base,
tower,
enemy wave,
upgrade,
dan defense system.

Jangan hanya mengganti warna atau judul.

MEKANIK harus benar-benar berbeda.

==================================================
MOBILE
==================================================

Game wajib bisa dimainkan di mobile.

Gunakan pointer/touch controls.

Keyboard juga harus tersedia untuk desktop.

==================================================
SELF TEST
==================================================

Setelah initialization:

window.__RK_GAME_READY__ = true;

Setelah render pertama:

window.__RK_GAME_RENDERED__ = true;

Setelah game loop dimulai:

window.__RK_GAME_LOOP_STARTED__ = true;

==================================================
KEAMANAN
==================================================

Jangan gunakan:

fetch
XMLHttpRequest
WebSocket
localStorage
sessionStorage
cookies
window.parent
window.top
eval
Function constructor
import
require
process

Jangan mengakses filesystem,
server,
environment variable,
database,
Supabase,
atau Node.js.

Semua gameplay harus berjalan di browser.

==================================================
OUTPUT
==================================================

Output hanya satu dokumen HTML lengkap.

Tidak boleh ada markdown.

Tidak boleh ada code fence.

Mulai dengan:

<!DOCTYPE html>

dan akhiri dengan:

</html>
`;

    const result =
      await generateWithAIRouter({
        systemInstruction: `
Kamu adalah AI Game Director sekaligus
AI Game Factory untuk RuangKita AI.

Kamu bertanggung jawab menciptakan
game browser yang benar-benar playable.

Setiap request harus menghasilkan
game yang memiliki identitas gameplay berbeda.

Ikuti design direction yang diberikan.

Prioritas:

1. Game playable
2. Canvas terlihat
3. Game loop berjalan
4. Genre benar-benar terasa
5. Gameplay berbeda
6. Mobile playable
7. Visual menarik

Output hanya HTML lengkap.
`,
        prompt,
        temperature: 1.0,
        maxOutputTokens: 12000,
      });

    const html = extractHtml(result.text);

    const errors =
      validateGameHtml(html);

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          provider: result.provider,
          model: result.model,
          errors,
          htmlPreview:
            html.slice(0, 1000),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: result.provider,
      model: result.model,
      genre,
      mechanic,
      world,
      visualStyle,
      gameHtml: html,
      size: html.length,
    });
  } catch (error) {
    console.error(
      "AI Game Factory error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AI Game Factory gagal membuat game.",
      },
      { status: 500 }
    );
  }
}