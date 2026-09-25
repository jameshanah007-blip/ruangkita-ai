import { NextResponse } from "next/server";
import { generateWithAIRouter } from "../../../fun-zone/aiRouter";
import type {
  GameBlueprint,
  RuntimeError,
  TestReport,
} from "../../../fun-zone/laboratory/types";

function extractHtml(text: string): string {
  const trimmed = text.trim();

  const fenced = trimmed.match(
    /```(?:html)?\s*([\s\S]*?)\s*```/i
  );

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const doctypeStart = trimmed.search(/<!doctype html/i);

  if (doctypeStart >= 0) {
    return trimmed.slice(doctypeStart).trim();
  }

  const htmlStart = trimmed.search(/<html[\s>]/i);

  if (htmlStart >= 0) {
    return trimmed.slice(htmlStart).trim();
  }

  return trimmed;
}

function validateGameHtml(html: string): string[] {
  const errors: string[] = [];

  if (!html.trim()) {
    errors.push("AI tidak menghasilkan HTML.");
    return errors;
  }

  if (!/<html[\s>]/i.test(html)) {
    errors.push("Dokumen tidak memiliki tag HTML.");
  }

  if (!/<\/html>/i.test(html)) {
    errors.push(
      "Dokumen tidak memiliki penutup </html>."
    );
  }

  if (!/<head[\s>]/i.test(html)) {
    errors.push("Dokumen tidak memiliki tag head.");
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

  if (!/getContext\s*\(\s*["']2d["']\s*\)/i.test(html)) {
    errors.push(
      "Game tidak terlihat menggunakan Canvas 2D."
    );
  }

  if (!/requestAnimationFrame\s*\(/i.test(html)) {
    errors.push(
      "Game tidak memiliki game loop requestAnimationFrame."
    );
  }

  if (
    !/addEventListener\s*\(\s*["'](?:pointer|touch|mousedown|keydown|click)/i.test(
      html
    )
  ) {
    errors.push(
      "Game tidak terlihat memiliki input interaction."
    );
  }

  if (html.length > 400_000) {
    errors.push("Ukuran game terlalu besar.");
  }

  const forbiddenPatterns = [
    /fetch\s*\(/i,
    /XMLHttpRequest/i,
    /WebSocket/i,
    /EventSource/i,
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
    /require\s*\(/i,
    /process\./i,
  ];

  const forbiddenNames = [
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
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
    "require",
    "process",
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

function formatRuntimeErrors(
  runtimeErrors: RuntimeError[]
): string {
  if (!runtimeErrors.length) {
    return "Tidak ada runtime error yang tertangkap.";
  }

  return runtimeErrors
    .slice(0, 12)
    .map((error, index) => {
      const location =
        error.source ||
        error.line != null ||
        error.column != null
          ? `Source: ${error.source || "unknown"} | Line: ${
              error.line ?? "unknown"
            } | Column: ${error.column ?? "unknown"}`
          : "Lokasi: unknown";

      return [
        `ERROR ${index + 1}:`,
        `Message: ${error.message || "unknown"}`,
        location,
      ].join("\n");
    })
    .join("\n\n");
}

function formatTestReport(
  report: TestReport | null
): string {
  if (!report) {
    return "Tidak ada TestReport.";
  }

  return `
passed: ${report.passed}
runtimeOk: ${report.runtimeOk}
rendered: ${report.rendered}
loopStarted: ${report.loopStarted}
frameAdvanced: ${report.frameAdvanced}
canvasValid: ${report.canvasValid}
inputTest: ${report.inputTest}
gameplayTest: ${report.gameplayTest}
performanceTest: ${report.performanceTest}

frameCount: ${report.frameCount}
gameAnimationFrames: ${report.gameAnimationFrames}
inputEvents: ${report.inputEvents}
inputListeners: ${report.inputListeners}

canvasWidth: ${report.canvasWidth}
canvasHeight: ${report.canvasHeight}
nonBlankPixels: ${report.nonBlankPixels}
renderChanged: ${report.renderChanged}
elapsedMs: ${report.elapsedMs}

hardFailures:
${report.hardFailures.length
    ? report.hardFailures.map((x) => `- ${x}`).join("\n")
    : "- none"}

softWarnings:
${report.softWarnings.length
    ? report.softWarnings.map((x) => `- ${x}`).join("\n")
    : "- none"}

checks:
${report.checks.length
    ? report.checks
        .map(
          (check) =>
            `- ${check.name}: ${check.status}${
              check.message ? ` — ${check.message}` : ""
            }`
        )
        .join("\n")
    : "- none"}
`;
}

function formatBlueprint(
  blueprint: GameBlueprint | null
): string {
  if (!blueprint) {
    return "Tidak ada blueprint.";
  }

  return `
Title: ${blueprint.title}
Concept: ${blueprint.concept}
Genre: ${blueprint.genre}
Mood: ${blueprint.mood}
Difficulty: ${blueprint.difficulty}
Theme: ${blueprint.theme}
World: ${blueprint.world}
Core Loop: ${blueprint.coreLoop}
Objective: ${blueprint.objective}
Mechanics: ${blueprint.mechanics.join(", ")}
Player Actions: ${blueprint.playerActions.join(", ")}
Controls: ${blueprint.controls.join(", ")}
Progression: ${blueprint.progression}
Replayability: ${blueprint.replayability}
Win Condition: ${blueprint.winCondition}
Lose Condition: ${blueprint.loseCondition}
Visual Style: ${blueprint.visualStyle}
Mobile Notes: ${blueprint.mobileNotes.join(" | ")}
Test Requirements: ${blueprint.testRequirements.join(" | ")}
`;
}

function determineFailureFocus(
  runtimeErrors: RuntimeError[],
  report: TestReport | null
): string[] {
  const focus: string[] = [];

  if (runtimeErrors.length > 0) {
    focus.push(
      "RUNTIME: terdapat JavaScript runtime error nyata."
    );
  }

  if (report) {
    if (!report.canvasValid) {
      focus.push(
        "CANVAS: canvas tidak valid atau tidak dapat digunakan."
      );
    }

    if (!report.rendered) {
      focus.push(
        "RENDERING: game tidak menghasilkan bukti rendering."
      );
    }

    if (!report.loopStarted) {
      focus.push(
        "GAME LOOP: game loop tidak terdeteksi."
      );
    }

    if (!report.frameAdvanced) {
      focus.push(
        "FRAME: frame game tidak mengalami perkembangan."
      );
    }

    if (!report.inputTest) {
      focus.push(
        "INPUT: input game tidak terbukti berfungsi."
      );
    }

    if (!report.gameplayTest) {
      focus.push(
        "GAMEPLAY: gameplay tidak terbukti berjalan."
      );
    }

    if (!report.performanceTest) {
      focus.push(
        "PERFORMANCE: performa membutuhkan pemeriksaan."
      );
    }
  }

  if (!focus.length) {
    focus.push(
      "Tidak ada failure spesifik yang terdeteksi. Lakukan audit kode secara konservatif."
    );
  }

  return focus;
}

function buildDebuggerPrompt({
  gameHtml,
  errorMessage,
  errorSource,
  errorLine,
  errorColumn,
  genre,
  runtimeErrors,
  testReport,
  blueprint,
  attempt,
}: {
  gameHtml: string;
  errorMessage: string;
  errorSource: string;
  errorLine: number | null;
  errorColumn: number | null;
  genre: string;
  runtimeErrors: RuntimeError[];
  testReport: TestReport | null;
  blueprint: GameBlueprint | null;
  attempt: number;
}) {
  const failureFocus =
    determineFailureFocus(
      runtimeErrors,
      testReport
    );

  return `
RUANGKITA AI — GAME DEBUGGER / REPAIR ENGINE

Kamu adalah AI Game Debugger profesional.

Game berikut SUDAH dibuat oleh AI Game Builder.

Game tersebut kemudian dijalankan di isolated browser
sandbox dan mengalami kegagalan pada tahap testing.

Tugasmu adalah memperbaiki GAME YANG SUDAH ADA.

JANGAN membuat game baru.

JANGAN mengganti konsep game.

JANGAN melakukan redesign besar.

JANGAN menghapus gameplay hanya agar tester menjadi PASS.

Pertahankan sebanyak mungkin:

- visual
- mekanik
- objective
- progression
- score
- player
- enemy
- world
- win condition
- lose condition
- restart
- mobile controls
- desktop controls
- identitas game

Jika error hanya berada pada satu bagian kode,
perbaiki bagian tersebut dan pertahankan bagian lainnya.

==================================================
REPAIR ATTEMPT
==================================================

Attempt:
${attempt}

==================================================
GAME IDENTITY
==================================================

Genre:
${genre || blueprint?.genre || "unknown"}

Blueprint:
${formatBlueprint(blueprint)}

==================================================
FAILURE FOCUS
==================================================

${failureFocus.map((item) => `- ${item}`).join("\n")}

==================================================
RUNTIME ERRORS
==================================================

${formatRuntimeErrors(runtimeErrors)}

==================================================
PRIMARY ERROR
==================================================

Message:
${errorMessage || "none"}

Source:
${errorSource || "unknown"}

Line:
${errorLine ?? "unknown"}

Column:
${errorColumn ?? "unknown"}

==================================================
TEST REPORT
==================================================

${formatTestReport(testReport)}

==================================================
DEBUGGING STRATEGY
==================================================

Prioritas debugging:

1. Perbaiki SyntaxError terlebih dahulu.
2. Perbaiki ReferenceError / TypeError.
3. Perbaiki initialization error.
4. Pastikan Canvas dibuat dan context 2D tersedia.
5. Pastikan game loop benar-benar berjalan.
6. Pastikan update state berjalan.
7. Pastikan render berjalan.
8. Pastikan input game terpasang.
9. Pastikan objective/gameplay tetap ada.
10. Pastikan win condition tetap ada.
11. Pastikan lose condition tetap ada.
12. Pastikan restart tetap berfungsi.
13. Pastikan mobile touch input tetap berfungsi.
14. Pastikan desktop keyboard/mouse tetap berfungsi.

Jika tester mengatakan:

CANVAS FAIL
----------------
Cari penyebab canvas/context tidak tersedia.
Jangan sekadar membuat flag menjadi true.

RENDER FAIL
----------------
Pastikan draw/render function benar-benar
menggambar sesuatu ke canvas.

LOOP FAIL
----------------
Pastikan requestAnimationFrame menjalankan
update + render secara terus-menerus.

FRAME FAIL
----------------
Pastikan loop tidak langsung berhenti karena
exception atau kondisi game yang salah.

INPUT FAIL
----------------
Pastikan listener input benar-benar terpasang
pada window/document/canvas dan mengubah state game.

GAMEPLAY FAIL
----------------
Pastikan ada player state, interaction,
objective, dan perubahan state yang nyata.

RUNTIME ERROR
----------------
Perbaiki penyebab error yang sebenarnya.
Jangan menutupi error dengan try/catch kosong.

==================================================
SYNTAX REPAIR
==================================================

Jika ditemukan:

SyntaxError
Unexpected token
Unexpected identifier
Unexpected string
Unexpected end of input
missing )
missing }
missing ]
missing ;
unterminated string
unterminated template literal

periksa secara teliti:

- ()
- {}
- []
- quotes
- template literals
- commas
- semicolons
- function declaration
- arrow function
- object literal
- array literal
- callbacks
- if/else
- nested functions

Pastikan JavaScript dapat diparse browser.

==================================================
SELF DIAGNOSTIC FLAGS
==================================================

Jika game memiliki flag:

window.__RK_GAME_READY__
window.__RK_GAME_RENDERED__
window.__RK_GAME_LOOP_STARTED__

pertahankan dan perbaiki jika rusak.

Flag bukan pengganti gameplay.

JANGAN membuat:

window.__RK_GAME_READY__ = true;

sebagai satu-satunya solusi.

Flag harus mencerminkan kondisi game
yang benar-benar sudah initialized/rendered/running.

==================================================
GAME REQUIREMENTS
==================================================

Game harus:

- standalone HTML
- HTML + CSS + vanilla JavaScript
- Canvas 2D
- playable
- responsive
- mobile friendly
- touch friendly
- mouse friendly
- keyboard friendly jika relevan
- memiliki game loop
- memiliki update
- memiliki render
- memiliki objective
- memiliki win condition
- memiliki lose condition
- memiliki restart
- tidak menggunakan external library
- tidak menggunakan external asset
- tidak menggunakan network
- tidak menggunakan API eksternal

DILARANG:

fetch
XMLHttpRequest
WebSocket
EventSource
localStorage
sessionStorage
document.cookie
window.parent
window.top
eval
Function constructor
import()
require()
process
filesystem
Node.js
server
database
Supabase
API key

==================================================
MOBILE REQUIREMENTS
==================================================

Pastikan:

- viewport tersedia
- canvas menyesuaikan layar
- tidak membutuhkan hover
- touch/pointer input nyaman
- tombol tidak terlalu kecil
- game tidak bergantung pada keyboard saja
- tidak menggunakan layout yang rusak pada portrait mobile

==================================================
IMPORTANT
==================================================

Jangan mengubah game menjadi sekadar demo canvas.

Game harus tetap merupakan GAME.

Jika game memiliki:

player
enemy
items
keys
score
timer
health
stamina
levels
rooms
doors
weapons
puzzles
objectives

pertahankan elemen-elemen tersebut jika tidak
berhubungan langsung dengan error.

==================================================
CURRENT GAME HTML
==================================================

${gameHtml}

==================================================
FINAL VALIDATION
==================================================

Sebelum output:

1. HTML lengkap.
2. JavaScript valid.
3. Semua (), {}, [] tertutup.
4. Semua string tertutup.
5. Semua template literal tertutup.
6. Canvas tetap ada.
7. Canvas 2D tetap ada.
8. requestAnimationFrame tetap ada.
9. update loop tetap ada.
10. render loop tetap ada.
11. input tetap ada.
12. gameplay tetap ada.
13. objective tetap ada.
14. win condition tetap ada.
15. lose condition tetap ada.
16. restart tetap ada.
17. mobile controls tetap ada.
18. tidak ada network request.
19. tidak ada external dependency.
20. tidak ada kode yang terpotong.
21. tidak membuat game baru.
22. tidak menghapus gameplay untuk mengakali tester.

OUTPUT HANYA HTML.

Mulai:

<!DOCTYPE html>

dan akhiri:

</html>

Tanpa markdown.
Tanpa code fence.
Tanpa penjelasan.
`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const gameHtml =
      typeof body?.gameHtml === "string"
        ? body.gameHtml
        : "";

    const errorMessage =
      typeof body?.errorMessage === "string"
        ? body.errorMessage.trim().slice(0, 2000)
        : "";

    const errorSource =
      typeof body?.errorSource === "string"
        ? body.errorSource.trim().slice(0, 1000)
        : "";

    const errorLine =
      typeof body?.errorLine === "number"
        ? body.errorLine
        : null;

    const errorColumn =
      typeof body?.errorColumn === "number"
        ? body.errorColumn
        : null;

    const genre =
      typeof body?.genre === "string"
        ? body.genre.trim().slice(0, 100)
        : "";

    const attempt =
      typeof body?.attempt === "number"
        ? Math.max(1, Math.floor(body.attempt))
        : 1;

    const runtimeErrors: RuntimeError[] =
      Array.isArray(body?.runtimeErrors)
        ? body.runtimeErrors
            .filter(
              (item: unknown): item is RuntimeError =>
                typeof item === "object" &&
                item !== null &&
                typeof (item as RuntimeError).message ===
                  "string"
            )
            .slice(0, 20)
            .map((item: RuntimeError) => ({
              message: item.message
                .slice(0, 2000),
              source:
                typeof item.source === "string"
                  ? item.source.slice(0, 1000)
                  : undefined,
              line:
                typeof item.line === "number"
                  ? item.line
                  : null,
              column:
                typeof item.column === "number"
                  ? item.column
                  : null,
            }))
        : [];

    const testReport: TestReport | null =
      body?.testReport &&
      typeof body.testReport === "object"
        ? body.testReport
        : null;

    const blueprint: GameBlueprint | null =
      body?.blueprint &&
      typeof body.blueprint === "object"
        ? body.blueprint
        : null;

    if (!gameHtml.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Kode game kosong.",
        },
        { status: 400 }
      );
    }

    if (
      !errorMessage &&
      runtimeErrors.length === 0 &&
      !testReport
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tidak ada informasi kegagalan untuk debugging.",
        },
        { status: 400 }
      );
    }

    if (gameHtml.length > 400_000) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Kode game terlalu besar untuk proses debugging.",
        },
        { status: 413 }
      );
    }

    const prompt = buildDebuggerPrompt({
      gameHtml,
      errorMessage,
      errorSource,
      errorLine,
      errorColumn,
      genre,
      runtimeErrors,
      testReport,
      blueprint,
      attempt,
    });

    const result =
      await generateWithAIRouter({
        systemInstruction: `
Kamu adalah AI Game Debugger profesional untuk
laboratorium game RuangKita AI.

Kamu menerima:

- source HTML game
- blueprint game
- runtime errors
- sandbox evidence
- test report

Tugasmu adalah melakukan REPAIR terhadap game
yang sudah ada.

JANGAN membuat game baru.

Perbaiki akar masalah.

Jika runtime error diberikan, gunakan error tersebut
sebagai bukti utama.

Jika tidak ada runtime error tetapi tester gagal,
gunakan bukti Canvas, Rendering, Game Loop, Frame,
Input, Gameplay, dan Performance.

Jangan memalsukan diagnostic flags.

Output harus satu HTML lengkap yang langsung
dapat dijalankan browser.

Tidak boleh ada markdown.
Tidak boleh ada code fence.
Tidak boleh ada penjelasan.

Output hanya HTML.
`,
        prompt,
        temperature: 0.1,
        maxOutputTokens: 16000,
      });

    const fixedHtml = extractHtml(result.text);

    const validationErrors =
      validateGameHtml(fixedHtml);

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          provider: result.provider,
          model: result.model,
          errors: validationErrors,
          htmlPreview: fixedHtml.slice(0, 1600),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: result.provider,
      model: result.model,
      gameHtml: fixedHtml,
      size: fixedHtml.length,
      attempt,
      validation: {
        passed: true,
        errors: [],
      },
    });
  } catch (error) {
    console.error(
      "AI Game Debugger error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AI Game Debugger gagal memperbaiki game.",
      },
      { status: 500 }
    );
  }
}