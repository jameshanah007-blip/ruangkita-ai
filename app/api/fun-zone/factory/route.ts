import { NextResponse } from "next/server";
import { generateWithAIRouter } from "../../../fun-zone/aiRouter";
import type { GameBlueprint } from "../../../fun-zone/laboratory/types";

function extractHtml(text: string): string {
  const cleaned = text
    .replace(/```html/gi, "")
    .replace(/```/g, "")
    .trim();

  const htmlMatch = cleaned.match(
    /<!doctype html[\s\S]*<\/html>/i
  );

  if (htmlMatch) {
    return htmlMatch[0].trim();
  }

  const documentMatch = cleaned.match(
    /<html[\s\S]*<\/html>/i
  );

  if (documentMatch) {
    return documentMatch[0].trim();
  }

  const bodyMatch = cleaned.match(
    /<body[\s\S]*<\/body>/i
  );

  if (bodyMatch) {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>
<title>AI Game</title>
</head>
${bodyMatch[0]}
</html>
`.trim();
  }

  throw new Error(
    "AI Builder tidak menghasilkan HTML game yang valid."
  );
}

function validateGameHtml(
  html: string
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const lower = html.toLowerCase();

  if (!lower.includes("<!doctype html")) {
    warnings.push(
      "DOCTYPE HTML tidak ditemukan."
    );
  }

  if (!lower.includes("<html")) {
    errors.push(
      "HTML document tidak memiliki <html>."
    );
  }

  if (!lower.includes("<head")) {
    errors.push(
      "HTML document tidak memiliki <head>."
    );
  }

  if (!lower.includes("<body")) {
    errors.push(
      "HTML document tidak memiliki <body>."
    );
  }

  /*
   * Canvas sekarang WAJIB.
   */
  if (!lower.includes("<canvas")) {
    errors.push(
      "Game wajib memiliki elemen <canvas>."
    );
  }

  /*
   * Canvas context harus digunakan.
   */
  if (
    !lower.includes("getcontext(") &&
    !lower.includes("getcontext (")
  ) {
    errors.push(
      "Game Canvas tidak menggunakan getContext()."
    );
  }

  /*
   * Game loop wajib ada.
   */
  if (
    !lower.includes("requestanimationframe")
  ) {
    errors.push(
      "Game wajib menggunakan requestAnimationFrame() untuk game loop."
    );
  }

  /*
   * Input harus tersedia.
   */
  const hasInput =
    lower.includes("keydown") ||
    lower.includes("keyup") ||
    lower.includes("pointerdown") ||
    lower.includes("pointermove") ||
    lower.includes("pointerup") ||
    lower.includes("touchstart") ||
    lower.includes("touchmove") ||
    lower.includes("touchend") ||
    lower.includes("click");

  if (!hasInput) {
    errors.push(
      "Game tidak memiliki sistem input."
    );
  }

  /*
   * Game harus memiliki player/game entity.
   */
  const hasPlayerConcept =
    lower.includes("player") ||
    lower.includes("hero") ||
    lower.includes("character") ||
    lower.includes("playerx") ||
    lower.includes("playery");

  if (!hasPlayerConcept) {
    warnings.push(
      "Player/game entity tidak terdeteksi secara eksplisit."
    );
  }

  /*
   * Win / lose logic.
   */
  const hasWinLose =
    lower.includes("win") ||
    lower.includes("lose") ||
    lower.includes("gameover") ||
    lower.includes("victory") ||
    lower.includes("defeat");

  if (!hasWinLose) {
    errors.push(
      "Win/Lose condition tidak terdeteksi."
    );
  }

  /*
   * Restart.
   */
  if (
    !lower.includes("restart") &&
    !lower.includes("resetgame")
  ) {
    warnings.push(
      "Fungsi restart game tidak terdeteksi secara eksplisit."
    );
  }

  /*
   * Diagnostic flags yang harus dibuat Builder.
   */
  if (
    !lower.includes("__rk_game_ready__")
  ) {
    errors.push(
      "Game wajib menyediakan __RK_GAME_READY__ untuk runtime diagnostics."
    );
  }

  if (
    !lower.includes("__rk_game_rendered__")
  ) {
    errors.push(
      "Game wajib menyediakan __RK_GAME_RENDERED__ untuk runtime diagnostics."
    );
  }

  if (
    !lower.includes("__rk_game_loop_started__")
  ) {
    errors.push(
      "Game wajib menyediakan __RK_GAME_LOOP_STARTED__ untuk runtime diagnostics."
    );
  }

  /*
   * External dependencies.
   */
  if (
    lower.includes("https://") ||
    lower.includes("http://") ||
    lower.includes("<script src=") ||
    lower.includes("<link href=")
  ) {
    warnings.push(
      "HTML mengandung referensi external resource. Game seharusnya standalone."
    );
  }

  /*
   * Basic runtime markers.
   */
  if (
    !lower.includes("update(") &&
    !lower.includes("update =") &&
    !lower.includes("function update")
  ) {
    warnings.push(
      "Fungsi update() tidak terdeteksi secara eksplisit."
    );
  }

  if (
    !lower.includes("render(") &&
    !lower.includes("render =") &&
    !lower.includes("function render")
  ) {
    warnings.push(
      "Fungsi render() tidak terdeteksi secara eksplisit."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function stringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidBlueprint(
  value: unknown
): value is GameBlueprint {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const blueprint =
    value as Record<string, unknown>;

  const requiredStrings = [
    "title",
    "concept",
    "genre",
    "mood",
    "difficulty",
    "theme",
    "world",
    "coreLoop",
    "objective",
    "progression",
    "replayability",
    "winCondition",
    "loseCondition",
    "visualStyle",
  ];

  for (const key of requiredStrings) {
    if (
      typeof blueprint[key] !== "string" ||
      !blueprint[key].trim()
    ) {
      return false;
    }
  }

  const requiredArrays = [
    "mechanics",
    "playerActions",
    "controls",
    "mobileNotes",
    "testRequirements",
  ];

  for (const key of requiredArrays) {
    if (
      !Array.isArray(blueprint[key])
    ) {
      return false;
    }
  }

  return true;
}

const SYSTEM_INSTRUCTION = `
Kamu adalah AI GAME BUILDER untuk RuangKita AI.

Tugasmu adalah mengubah GAME BLUEPRINT menjadi
GAME ARTIFACT HTML yang benar-benar dapat dimainkan.

==================================================
SOURCE OF TRUTH
==================================================

GAME BLUEPRINT adalah sumber kebenaran utama.

Jangan mengubah:

- konsep utama
- genre
- objective
- mechanics utama
- win condition
- lose condition
- progression

Implementasikan blueprint secara konkret.

==================================================
OUTPUT
==================================================

Output harus berupa SATU FILE HTML LENGKAP.

Output hanya HTML.

Jangan gunakan Markdown.

Jangan gunakan:

\`\`\`html

Jangan memberikan penjelasan.

Jangan memberikan JSON.

Jangan menulis teks di luar HTML.

==================================================
STANDALONE
==================================================

Game harus dapat berjalan langsung di browser.

Hanya gunakan:

- HTML
- CSS
- JavaScript

DILARANG:

- React
- Next.js
- Phaser
- Three.js
- PixiJS
- Babylon.js
- npm
- package
- build step
- backend
- database
- API
- CDN
- external library
- external script
- external stylesheet

Semua CSS dan JavaScript harus berada
di dalam HTML yang sama.

==================================================
WAJIB CANVAS
==================================================

INI ADALAH PERSYARATAN KERAS.

Game WAJIB menggunakan:

<canvas>

Canvas adalah area utama gameplay.

Canvas harus:

- terlihat
- memiliki width > 0
- memiliki height > 0
- responsive
- cocok untuk desktop
- cocok untuk Android

Contoh:

<canvas id="gameCanvas"></canvas>

JavaScript wajib mendapatkan context:

const canvas =
  document.getElementById("gameCanvas");

const ctx =
  canvas.getContext("2d");

Jangan membuat game hanya berupa:

- halaman teks
- dashboard
- menu statis
- kumpulan tombol
- HTML cards

Game harus benar-benar terlihat seperti game.

==================================================
CANVAS RESPONSIVE
==================================================

Canvas harus memiliki ukuran nyata.

Gunakan mekanisme seperti:

function resizeCanvas() {
  const rect =
    canvas.getBoundingClientRect();

  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );

  canvas.width =
    Math.max(
      320,
      Math.floor(rect.width * dpr)
    );

  canvas.height =
    Math.max(
      480,
      Math.floor(rect.height * dpr)
    );

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );
}

Panggil saat:

- startup
- resize

Canvas harus tetap terlihat pada layar mobile.

==================================================
RUNTIME DIAGNOSTICS
==================================================

Game WAJIB membuat tiga global diagnostic flag.

Pada startup:

window.__RK_GAME_READY__ = false;
window.__RK_GAME_RENDERED__ = false;
window.__RK_GAME_LOOP_STARTED__ = false;

==================================================
GAME TEST PROTOCOL
==================================================

Game WAJIB menyediakan object global berikut:

window.__RK_GAME_TEST__ = {
  getState() {},
  getPlayerState() {},
  getObjectiveState() {},
  getWinState() {},
  getLoseState() {},
  performTestAction(action) {},
  restart() {}
};

GAME TEST PROTOCOL ADALAH KONTRAK WAJIB.

Semua method harus benar-benar terhubung
ke state dan logic game yang sebenarnya.

getState():
Mengembalikan state utama game saat ini.

getPlayerState():
Mengembalikan state player saat ini,
misalnya posisi, health, lives, inventory,
score, atau state relevan lainnya.

getObjectiveState():
Mengembalikan progress objective game saat ini.

getWinState():
Mengembalikan true hanya jika game benar-benar
berada pada kondisi menang.

getLoseState():
Mengembalikan true hanya jika game benar-benar
berada pada kondisi kalah.

performTestAction(action):
Menjalankan aksi gameplay melalui logic game
yang sebenarnya.

Aksi harus dapat mempengaruhi game secara nyata
jika aksi tersebut valid untuk game.

Jangan membuat performTestAction() langsung
mengubah win state secara paksa.

Jangan membuat performTestAction() langsung
mengubah objective menjadi selesai.

Jangan membuat fungsi test yang memalsukan
hasil gameplay.

restart():
Mengembalikan game ke kondisi awal yang valid.

Setelah restart():

- player kembali ke state awal
- objective kembali ke progress awal
- win state kembali false
- lose state kembali false
- game kembali dapat dimainkan

Game Test Protocol digunakan oleh AI Sandbox
untuk menguji game secara otomatis.

Protocol tidak boleh mengubah aturan permainan.

Protocol hanya boleh:

1. membaca state game
2. menjalankan aksi gameplay yang valid
3. melakukan restart

Semua hasil test harus berasal dari behavior
game yang sebenarnya.


Setelah game berhasil diinisialisasi:

window.__RK_GAME_READY__ = true;

Saat render pertama berhasil:

window.__RK_GAME_RENDERED__ = true;

Saat game loop dimulai:

window.__RK_GAME_LOOP_STARTED__ = true;

Jangan hanya membuat nama flag.

Flag harus benar-benar diubah
berdasarkan kondisi runtime.

==================================================
GAME LOOP
==================================================

Gunakan:

requestAnimationFrame()

Game loop harus memiliki pola:

INPUT
↓
UPDATE
↓
RENDER
↓
requestAnimationFrame
↓
UPDATE
↓
RENDER

Contoh struktur:

function update(dt) {
  // update gameplay
}

function render() {
  // draw game
}

function gameLoop(timestamp) {
  window.__RK_GAME_LOOP_STARTED__ = true;

  update(...);

  render();

  requestAnimationFrame(gameLoop);
}

Game loop harus dimulai setelah
canvas dan game state siap.

==================================================
RENDERING
==================================================

Render sesuatu yang benar-benar terlihat.

Minimal harus terdapat:

- background
- player
- gameplay objects
- UI game

Render harus menggunakan:

ctx.clearRect(...)
ctx.fillRect(...)
ctx.fillText(...)
ctx.arc(...)
atau drawing Canvas lain yang sesuai.

Jangan hanya membuat canvas kosong.

Render harus berubah ketika gameplay berjalan.

==================================================
PLAYER
==================================================

Game WAJIB mempunyai player atau
controlled game entity.

Player harus terlihat di Canvas.

Player harus mempunyai state.

Contoh:

player.x
player.y
player.health
player.speed

Gunakan hanya state yang relevan
dengan blueprint.

==================================================
INPUT
==================================================

Input harus benar-benar bekerja.

Desktop dapat menggunakan:

- keydown
- keyup
- pointerdown
- pointermove
- pointerup

Mobile wajib dapat menggunakan:

- touchstart
- touchmove
- touchend

atau pointer events yang bekerja
pada perangkat touch.

Jika menggunakan virtual joystick,
implementasikan logic joystick sebenarnya.

Jika menggunakan action button,
button harus benar-benar mengubah
game state.

==================================================
GAMEPLAY STATE
==================================================

Game harus memiliki state nyata.

Contoh:

player position
health
score
keys
battery
stamina
enemy position
game state
level progress

State harus berubah karena gameplay.

Jangan membuat state palsu
yang tidak memengaruhi game.

==================================================
OBJECTIVE
==================================================

Objective dari blueprint harus benar-benar
dapat dilakukan oleh player.

Untuk game seperti:

"cari 3 kunci"

maka harus ada:

- key objects
- collision/proximity detection
- collected key state
- key counter
- exit zone
- actual win condition

Objective tidak boleh hanya ditampilkan
sebagai teks.

==================================================
WIN CONDITION
==================================================

Win condition harus benar-benar terjadi.

Ketika kondisi menang tercapai:

- ubah game state
- tampilkan UI kemenangan
- hentikan atau pause gameplay
- tampilkan tombol RESTART

==================================================
LOSE CONDITION
==================================================

Lose condition harus benar-benar terjadi.

Contoh:

- HP mencapai 0
- monster menangkap player
- timer habis
- resource habis

Ketika kalah:

- ubah game state
- tampilkan UI kekalahan
- hentikan atau pause gameplay
- tampilkan tombol RESTART

==================================================
RESTART
==================================================

Implementasikan restart game yang sebenarnya.

Restart harus:

- reset player
- reset objective
- reset enemy
- reset health
- reset progress
- reset game state
- menghilangkan win/lose screen
- memulai kembali gameplay

==================================================
MOBILE
==================================================

Game harus mobile-first friendly.

WAJIB:

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, viewport-fit=cover"
>

Jangan mengandalkan keyboard
sebagai satu-satunya cara bermain.

Touch/pointer control harus benar-benar
mengubah player/game state.

UI jangan terlalu kecil.

Hindari hover sebagai satu-satunya interaction.

==================================================
ROBUSTNESS
==================================================

Gunakan defensive programming.

Sebelum menggunakan element:

if (!element) {
  return;
}

Pastikan:

- canvas tersedia
- context tersedia
- DOM tersedia
- semua state memiliki nilai awal
- event listener tidak menyebabkan exception
- animation loop tidak melempar exception

Jangan menggunakan variable
sebelum didefinisikan.

Jangan menggunakan:

undefined.property

Jangan menggunakan infinite loop.

Jangan membuat uncaught exception.

==================================================
ERROR HANDLING
==================================================

Runtime game harus tahan terhadap
error yang tidak fatal.

Namun jangan menyembunyikan
error programming dengan catch kosong.

Pastikan kode utama benar-benar valid
dan dapat dijalankan browser.

==================================================
VISUAL GAME
==================================================

Game harus terlihat seperti game.

Gunakan Canvas untuk:

- dunia
- player
- enemy
- collectible
- obstacle
- lighting
- effect
- UI gameplay

Sesuai kebutuhan blueprint.

==================================================
GAME STATE
==================================================

Gunakan state eksplisit seperti:

const gameState = {
  mode: "playing",
  ...
};

Gunakan mode seperti:

"playing"
"won"
"lost"

atau state yang sesuai.

==================================================
FINAL CHECK SEBELUM OUTPUT
==================================================

Sebelum menghasilkan HTML,
pastikan semua hal berikut benar-benar ada:

1. <!DOCTYPE html>
2. <html>
3. <head>
4. viewport meta
5. <body>
6. <canvas>
7. canvas.getContext("2d")
8. requestAnimationFrame
9. player
10. input
11. update()
12. render()
13. game state
14. objective
15. progression
16. win condition
17. lose condition
18. restart
19. mobile controls
20. __RK_GAME_READY__
21. __RK_GAME_RENDERED__
22. __RK_GAME_LOOP_STARTED__
23. __RK_GAME_TEST__
24. getState()
25. getPlayerState()
26. getObjectiveState()
27. getWinState()
28. getLoseState()
29. performTestAction()
30. restart() pada Game Test Protocol

Game Test Protocol harus benar-benar bekerja
pada runtime.

Jangan hanya menuliskan nama function.

Semua function harus terhubung ke state game
yang sebenarnya.



Semua harus bekerja secara runtime,
bukan hanya muncul sebagai teks.

==================================================
FINAL OUTPUT
==================================================

Output HANYA HTML LENGKAP.

Tidak ada Markdown.

Tidak ada penjelasan.

Tidak ada JSON.
`;

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const blueprint =
      body?.blueprint;

    if (!isValidBlueprint(blueprint)) {
      return NextResponse.json(
        {
          success: false,
          stage: "builder",
          error:
            "GameBlueprint tidak valid atau belum diberikan.",
        },
        {
          status: 400,
        }
      );
    }

    const mechanics =
      stringArray(
        blueprint.mechanics
      );

    const playerActions =
      stringArray(
        blueprint.playerActions
      );

    const controls =
      stringArray(
        blueprint.controls
      );

    const mobileNotes =
      stringArray(
        blueprint.mobileNotes
      );

    const testRequirements =
      stringArray(
        blueprint.testRequirements
      );

    const blueprintPrompt = `
GAME BLUEPRINT
==================================================

TITLE:
${blueprint.title}

CONCEPT:
${blueprint.concept}

GENRE:
${blueprint.genre}

MOOD:
${blueprint.mood}

DIFFICULTY:
${blueprint.difficulty}

THEME:
${blueprint.theme}

WORLD:
${blueprint.world}

CORE LOOP:
${blueprint.coreLoop}

OBJECTIVE:
${blueprint.objective}

MECHANICS:
- ${mechanics.join("\n- ")}

PLAYER ACTIONS:
- ${playerActions.join("\n- ")}

CONTROLS:
- ${controls.join("\n- ")}

PROGRESSION:
${blueprint.progression}

REPLAYABILITY:
${blueprint.replayability}

WIN CONDITION:
${blueprint.winCondition}

LOSE CONDITION:
${blueprint.loseCondition}

VISUAL STYLE:
${blueprint.visualStyle}

MOBILE REQUIREMENTS:
- ${mobileNotes.join("\n- ")}

TEST REQUIREMENTS:
- ${testRequirements.join("\n- ")}

==================================================

IMPLEMENT THIS BLUEPRINT AS A REAL PLAYABLE
CANVAS GAME.

Jangan membuat game generik.

Jangan mengganti genre.

Jangan mengganti objective.

Jangan menghilangkan mechanics utama.

Implementasikan objective secara nyata.

Implementasikan playerActions secara nyata.

Implementasikan controls secara nyata.

Implementasikan progression secara nyata.

Implementasikan win condition secara nyata.

Implementasikan lose condition secara nyata.

Pastikan player dapat benar-benar bermain.

Pastikan game dapat dimainkan dengan touch
pada Android.

Pastikan Canvas menghasilkan visual sejak
startup.

Pastikan requestAnimationFrame berjalan terus
selama gameplay.

Pastikan ketiga diagnostic flags benar-benar
diubah selama runtime:

window.__RK_GAME_READY__
window.__RK_GAME_RENDERED__
window.__RK_GAME_LOOP_STARTED__

Sebelum output final, lakukan pemeriksaan
mental terhadap seluruh runtime agar tidak
menghasilkan JavaScript yang undefined
atau struktur HTML yang rusak.
==================================================
CRITICAL RUNTIME SIMPLICITY
==================================================

Prioritaskan GAME YANG BENAR-BENAR BERJALAN
daripada game yang terlalu kompleks.

Jangan membuat kode JavaScript yang terlalu panjang
atau arsitektur yang tidak diperlukan.

Gunakan SATU canvas utama.

Gunakan SATU game loop utama.

Gunakan state game sederhana dan eksplisit.

Hindari:

- recursive initialization
- nested animation loops
- dynamic script injection
- eval()
- new Function()
- document.write()
- document.open()
- document.close()
- iframe
- WebSocket
- fetch()
- external resource
- module import
- asynchronous dependency

Semua gameplay harus dapat berjalan
secara lokal setelah HTML dibuka.

==================================================
CANVAS VISIBILITY
==================================================

Canvas WAJIB langsung terlihat setelah startup.

Gunakan CSS yang eksplisit:

canvas {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 480px;
}

Pastikan parent canvas memiliki tinggi nyata.

Jangan bergantung pada parent dengan
height: 100% jika parent tidak memiliki
height yang jelas.

Body dan game container harus memiliki
layout yang menghasilkan canvas dengan
ukuran nyata.

==================================================
STARTUP SAFETY
==================================================

Game harus melakukan initialization
dengan urutan:

1. cari canvas
2. cari context
3. buat game state
4. pasang input
5. pasang resize handler
6. buat __RK_GAME_TEST__
7. set __RK_GAME_READY__ = true
8. render pertama
9. set __RK_GAME_RENDERED__ = true
10. mulai requestAnimationFrame
11. set __RK_GAME_LOOP_STARTED__ = true

Jangan memulai game loop sebelum canvas
dan context berhasil dibuat.

==================================================
INPUT SAFETY
==================================================

Keyboard dan touch harus menggunakan
fungsi input yang sama.

Contoh:

input.left
input.right
input.up
input.down
input.action

Keyboard hanya mengubah input state.

Touch controls juga hanya mengubah
input state.

Game update membaca input state tersebut.

Dengan demikian desktop dan mobile
menggunakan gameplay logic yang sama.

==================================================
GAME TEST PROTOCOL SAFETY
==================================================

__RK_GAME_TEST__ harus dibuat setelah
seluruh game state siap.

Semua method harus cepat dan tidak boleh
menjalankan infinite loop.

getState()
getPlayerState()
getObjectiveState()
getWinState()
getLoseState()

harus hanya membaca state.

performTestAction(action)
hanya boleh menjalankan satu aksi sederhana.

restart()
harus reset state tanpa membuat
animation loop kedua.

JANGAN membuat restart() memanggil
window.location.reload().

JANGAN membuat restart() membuat
requestAnimationFrame loop baru tanpa
menghentikan loop lama.

==================================================
ERROR SAFETY
==================================================

Pastikan tidak ada:

- variable yang belum didefinisikan
- function yang belum didefinisikan
- reference element yang null
- typo nama variable
- duplicate const/let
- duplicate function declaration
- syntax error
- infinite loop
- recursive function tanpa base case

Sebelum output final, pastikan seluruh
JavaScript berada di dalam <script>
dan seluruh tag HTML ditutup.

==================================================
OUTPUT SIZE
==================================================

Jika harus memilih antara:

GAME BESAR tetapi berisiko rusak

dan

GAME LEBIH SEDERHANA tetapi benar-benar playable,

pilih GAME YANG LEBIH SEDERHANA DAN PLAYABLE.

Jangan mengulang kode yang sama.

Jangan membuat komentar panjang.

Gunakan helper function untuk menghindari
duplikasi kode.

Targetkan HTML yang cukup ringkas agar
seluruh JavaScript dapat selesai dihasilkan
sebelum output limit.

`;

    const result =
      await generateWithAIRouter({
        systemInstruction:
          SYSTEM_INSTRUCTION,

        prompt:
          blueprintPrompt,

        temperature: 0.55,

        maxOutputTokens: 24000,
      });

    const gameHtml =
      extractHtml(result.text);

    const validation =
      validateGameHtml(gameHtml);

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,

          stage: "builder",

          error:
            "AI Builder menghasilkan HTML game yang belum memenuhi kontrak runtime.",

          validation,

          provider:
            result.provider,

          model:
            result.model,
        },
        {
          status: 422,
        }
      );
    }

    return NextResponse.json({
      success: true,

      stage: "builder",

      provider:
        result.provider,

      model:
        result.model,

      blueprint,

      gameHtml,

      size:
        gameHtml.length,

      validation,
    });
  } catch (error) {
    console.error(
      "AI Game Builder error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        stage: "builder",

        error:
          error instanceof Error
            ? error.message
            : "AI Game Builder gagal.",
      },
      {
        status: 500,
      }
    );
  }
}