import { resolveLegacyUserId } from "../../auth/cloudIdentity";
import { consumeJamesRateLimit } from "../../tools/jamesRateLimit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;
import { runJamesBrain } from "../../../core/james/jamesBrain";
import type {
  GameBlueprint,
  RuntimeError,
  TestReport,
} from "../../../fun-zone/laboratory/types";

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

  const isPhaserRuntime =
    /phaser@4\.2\.1/i.test(html) ||
    /Phaser\.Game\s*\(/i.test(html);

  if (!isPhaserRuntime && !/<canvas[\s>]/i.test(html)) {
    errors.push("Game tidak memiliki Canvas/Phaser runtime.");
  }

  if (!isPhaserRuntime && !/getContext\s*\(\s*["']2d["']\s*\)/i.test(html)) {
    errors.push("Game tidak terlihat menggunakan Canvas 2D.");
  }

  if (!isPhaserRuntime && !/requestAnimationFrame\s*\(/i.test(html)) {
    errors.push("Game tidak memiliki game loop.");
  }

  const hasPhaserInput =
    isPhaserRuntime &&
    /\.on\(\s*["'](?:pointer|pointerdown|pointerup|pointermove|pointerover|pointerout)/i.test(html);

  const hasDomInput =
    /addEventListener\s*\(\s*["'](?:pointer|touch|mousedown|keydown|click)/i.test(html);

  if (!hasPhaserInput && !hasDomInput) {
    errors.push(
      "Game tidak terlihat memiliki input interaction Phaser/DOM."
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
  const hardFailures = Array.isArray(report.hardFailures) ? report.hardFailures : [];
  const softWarnings = Array.isArray(report.softWarnings) ? report.softWarnings : [];
  const checks = Array.isArray(report.checks) ? report.checks : [];

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
${hardFailures.length
    ? report.hardFailures.map((x) => `- ${x}`).join("\n")
    : "- none"}

softWarnings:
${softWarnings.length
    ? report.softWarnings.map((x) => `- ${x}`).join("\n")
    : "- none"}

checks:
${checks.length
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

  const safeBlueprint = normalizeBlueprint(blueprint)!;

  return `
Title: ${safeBlueprint.title}
Concept: ${blueprint.concept}
Genre: ${blueprint.genre}
Mood: ${blueprint.mood}
Difficulty: ${blueprint.difficulty}
Theme: ${blueprint.theme}
World: ${blueprint.world}
Core Loop: ${blueprint.coreLoop}
Objective: ${blueprint.objective}
Mechanics: ${safeBlueprint.mechanics.join(", ")}
Player Actions: ${safeBlueprint.playerActions.join(", ")}
Controls: ${safeBlueprint.controls.join(", ")}
Progression: ${blueprint.progression}
Replayability: ${blueprint.replayability}
Win Condition: ${blueprint.winCondition}
Lose Condition: ${blueprint.loseCondition}
Visual Style: ${blueprint.visualStyle}
Mobile Notes: ${safeBlueprint.mobileNotes.join(" | ")}
Test Requirements: ${safeBlueprint.testRequirements.join(" | ")}
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

function normalizeBlueprint(blueprint: GameBlueprint | null): GameBlueprint | null {
  if (!blueprint) return null;
  return {
    ...blueprint,
    mechanics: Array.isArray(blueprint.mechanics) ? blueprint.mechanics : [],
    playerActions: Array.isArray(blueprint.playerActions) ? blueprint.playerActions : [],
    controls: Array.isArray(blueprint.controls) ? blueprint.controls : [],
    mobileNotes: Array.isArray(blueprint.mobileNotes) ? blueprint.mobileNotes : [],
    testRequirements: Array.isArray(blueprint.testRequirements) ? blueprint.testRequirements : [],
  };
}

function selectRelevantHtmlContext(
  html: string,
  errorLine: number | null,
): string {
  const lines = html.split(/\r?\n/);
  const selected = new Set<number>();
  const addRange = (start: number, end: number) => {
    for (let i = Math.max(0, start); i < Math.min(lines.length, end); i += 1) selected.add(i);
  };

  if (errorLine != null && Number.isFinite(errorLine)) addRange(errorLine - 14, errorLine + 15);
  addRange(0, Math.min(lines.length, 8));
  addRange(Math.max(0, lines.length - 8), lines.length);

  const markers = [
    /<script\b/i,
    /Phaser\.Game|new Phaser/i,
    /addEventListener|\.on\(\s*["'](?:pointer|keyboard)/i,
    /function\s+(?:update|create|init)\b|update\s*:/i,
    /__RK_GAME_/i,
  ];
  for (let i = 0; i < lines.length; i += 1) {
    if (markers.some((pattern) => pattern.test(lines[i]))) addRange(i - 2, i + 3);
  }

  const ordered = [...selected].sort((a, b) => a - b);
  const chunks: string[] = [];
  let previous = -2;
  for (const index of ordered) {
    if (index > previous + 1) chunks.push("… [baris HTML dilewati] …");
    chunks.push(lines[index]);
    previous = index;
  }
  const context = chunks.join("\n");
  return context.length > 6000
    ? context.slice(0, 3000) + "\n… [konteks dipangkas] …\n" + context.slice(-2500)
    : context;
}

function parseRepairPatches(text: string): Array<{ find: string; replace: string }> {
  const trimmed = text.trim().replace(/^`{3}(?:json)?\s*/i, "").replace(/\s*`{3}$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("OUTPUT_FORMAT_INVALID: Debugger tidak mengembalikan JSON patch yang lengkap.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new Error("OUTPUT_TRUNCATED_OR_INVALID: JSON patch Debugger terpotong atau tidak valid.");
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { patches?: unknown }).patches)) {
    throw new Error("OUTPUT_FORMAT_INVALID: Respons Debugger harus berisi array patches.");
  }
  const patches = (parsed as { patches: unknown[] }).patches;
  if (patches.length > 4) {
    throw new Error("OUTPUT_FORMAT_INVALID: Debugger maksimal menghasilkan 4 patch kecil.");
  }

  return patches.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error("OUTPUT_FORMAT_INVALID: Patch " + (index + 1) + " tidak valid.");
    const patch = item as { find?: unknown; replace?: unknown };
    if (typeof patch.find !== "string" || !patch.find.trim() || typeof patch.replace !== "string") {
      throw new Error("OUTPUT_FORMAT_INVALID: Patch " + (index + 1) + " harus memiliki find dan replace berbentuk string.");
    }
    return { find: patch.find, replace: patch.replace };
  });
}

function applyRepairPatches(
  originalHtml: string,
  patches: Array<{ find: string; replace: string }>,
): string {
  let repaired = originalHtml;
  for (const [index, patch] of patches.entries()) {
    const first = repaired.indexOf(patch.find);
    if (first < 0) throw new Error("PATCH_NOT_FOUND: Potongan target patch " + (index + 1) + " tidak ditemukan di HTML asli.");
    if (repaired.indexOf(patch.find, first + patch.find.length) >= 0) {
      throw new Error("PATCH_NOT_UNIQUE: Potongan target patch " + (index + 1) + " muncul lebih dari sekali; perubahan dibatalkan.");
    }
    repaired = repaired.slice(0, first) + patch.replace + repaired.slice(first + patch.find.length);
  }
  return repaired;
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
  const failureFocus = determineFailureFocus(runtimeErrors, testReport);
  const htmlContext = selectRelevantHtmlContext(gameHtml, errorLine);

  return [
    "RUANGKITA AI — SURGICAL GAME DEBUGGER",
    "",
    "Perbaiki game yang sudah ada dengan PATCH KECIL. DILARANG menulis ulang seluruh HTML.",
    "Jangan membuat game baru, mengganti genre, menghapus gameplay, atau mengganti aset.",
    "Runtime otoritatif tetap Phaser 4.2.1. Pertahankan semua kode yang tidak terkait langsung dengan error.",
    "",
    "IDENTITAS",
    "Attempt: " + attempt,
    "Genre: " + (genre || blueprint?.genre || "unknown"),
    "Blueprint:",
    formatBlueprint(blueprint),
    "",
    "KEGAGALAN",
    ...failureFocus.map((item) => "- " + item),
    "Error: " + (errorMessage || "none"),
    "Source: " + (errorSource || "unknown"),
    "Line: " + (errorLine ?? "unknown"),
    "Column: " + (errorColumn ?? "unknown"),
    "",
    "RUNTIME ERRORS",
    formatRuntimeErrors(runtimeErrors),
    "",
    "TEST REPORT",
    formatTestReport(testReport),
    "",
    "HTML ASLI (KONTEKS TERPILIH; beberapa bagian mungkin dilewati):",
    htmlContext,
    "",
    "FORMAT OUTPUT WAJIB",
    'Keluarkan JSON saja, tanpa markdown atau code fence: {"patches":[{"find":"potongan kode asli yang unik dan persis","replace":"potongan kode pengganti"}]}',
    "",
    "Aturan:",
    "- Jika menemukan perbaikan yang jelas dan aman, keluarkan 1 sampai 4 patch kecil.",
    '- "find" harus berupa potongan persis dari HTML asli yang ditampilkan di atas dan hanya muncul sekali.',
    "- Jangan menambahkan kode yang tidak terkait.",
    "- Jangan gunakan ellipsis sebagai isi find.",
    '- Gunakan {"patches":[]} hanya jika benar-benar tidak ada perbaikan aman yang dapat ditentukan; server akan mencoba satu kali lagi sebelum mempertahankan HTML asli.',
    "- Jangan mengembalikan seluruh HTML.",
    "- Jangan menyetel flag readiness sebagai pengganti gameplay.",
    "- Jangan gunakan network, fetch, WebSocket, storage, eval, Function, import(), require(), process, atau API eksternal."
  ].join("\n");
}
export async function POST(request: Request) {
  try {
    const userId = await resolveLegacyUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Session James tidak valid." },
        { status: 403 },
      );
    }

    const rateLimit = await consumeJamesRateLimit(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Batas penggunaan James tercapai. Silakan coba lagi setelah beberapa saat." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }
    const body = await request.json();

    const gameHtml =
      typeof body?.gameHtml === "string"
        ? body.gameHtml
        : "";

    if (gameHtml.length > 400000) {
      return NextResponse.json({ success: false, error: "Game HTML terlalu besar. Maksimum 400 KB." }, { status: 413 });
    }

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

    let provider = "james-brain";
    let model = "provider";
    let fixedHtml = "";

    try {
      const result = await runJamesBrain({
        surface: "fun_zone",
        mode: "game_debugger",
        systemInstruction: `
Kamu adalah AI Game Debugger profesional untuk laboratorium game RuangKita AI.

Tugasmu memperbaiki game yang sudah ada melalui patch kecil, bukan menulis ulang seluruh HTML.
Pertahankan genre, gameplay, aset, kontrol, dan Phaser 4.2.1. Jangan membuat game baru.

Keluarkan JSON saja dengan format:
{"patches":[{"find":"potongan kode asli yang unik dan persis","replace":"potongan kode pengganti"}]}

Berikan 1 sampai 4 patch kecil. Setiap find harus berupa substring persis dan unik dari HTML yang diberikan. Jangan keluarkan HTML lengkap, markdown, atau penjelasan.
Jika tidak yakin, kembalikan {"patches":[]} tanpa menebak.
`,
        prompt,
        temperature: 0.1,
        maxOutputTokens: 16000,
      });

      provider = result.provider;
      model = result.model;
      if (result.finishReason === "length") {
        console.warn("AI Game Debugger output truncated by provider token limit.", {
          provider,
          model,
          outputLength: result.text.length,
        });
        return NextResponse.json(
          {
            success: false,
            code: "OUTPUT_TRUNCATED",
            error: "Output Debugger terpotong oleh batas token provider. HTML asli dipertahankan dan tidak diganti.",
            provider,
            model,
          },
          { status: 422 },
        );
      }
      let patches = parseRepairPatches(result.text);

      // A documented empty-patch response is not a repair. Retry once with a
      // focused instruction instead of treating the model's own safe-abort
      // response as malformed JSON or silently accepting unchanged HTML.
      if (patches.length === 0) {
        const retryResult = await runJamesBrain({
          surface: "fun_zone",
          mode: "game_debugger",
          systemInstruction: `
Kamu sedang mencoba ulang perbaikan game RuangKita karena respons sebelumnya berisi patches kosong.
Analisis ulang error dan konteks HTML. Jika ada perbaikan konkret yang didukung bukti, berikan 1 patch minimal (maksimal 4) dengan find yang persis dan unik dari konteks HTML. Jangan menebak atau mengubah genre, aset, gameplay, maupun arsitektur Phaser.
Keluarkan JSON saja: {"patches":[{"find":"substring asli yang unik","replace":"substring pengganti"}]}.
Jika tidak ada patch aman yang dapat ditentukan, keluarkan {"patches":[]} saja. Jangan pernah mengembalikan seluruh HTML.
`,
          prompt: [
            prompt,
            "",
            "RETRY FOKUS:",
            "Respons sebelumnya: " + result.text.slice(0, 2000),
            "Tinjau kembali bukti error dan konteks HTML. Jangan mengarang substring. Prioritaskan satu perubahan kecil yang secara langsung memperbaiki kegagalan yang dilaporkan.",
          ].join("\n"),
          temperature: 0.05,
          maxOutputTokens: 8000,
        });

        provider = retryResult.provider;
        model = retryResult.model;
        if (retryResult.finishReason === "length") {
          return NextResponse.json(
            {
              success: false,
              code: "OUTPUT_TRUNCATED",
              error: "Output percobaan ulang Debugger terpotong. HTML asli dipertahankan.",
              provider,
              model,
            },
            { status: 422 },
          );
        }
        patches = parseRepairPatches(retryResult.text);
        if (patches.length === 0) {
          throw new Error("NO_SAFE_PATCH: Debugger tidak menemukan perubahan yang aman berdasarkan error dan konteks HTML. HTML asli tetap dipertahankan.");
        }
      }

      fixedHtml = applyRepairPatches(gameHtml, patches);
    } catch (providerError) {
      const detail = providerError instanceof Error ? providerError.message : String(providerError);
      const isPatchFailure = /^(OUTPUT_FORMAT_INVALID|OUTPUT_TRUNCATED_OR_INVALID|PATCH_NOT_FOUND|PATCH_NOT_UNIQUE|NO_SAFE_PATCH):/.test(detail);
      console.error("AI Game Debugger failed; original HTML remains unchanged:", {
        category: isPatchFailure ? "repair-output" : "provider",
        detail,
      });
      return NextResponse.json(
        {
          success: false,
          code: isPatchFailure ? "REPAIR_OUTPUT_INVALID" : "PROVIDER_FAILURE",
          error: isPatchFailure
            ? detail.startsWith("NO_SAFE_PATCH:")
              ? "Debugger sudah mencoba ulang, tetapi tidak menemukan patch yang cukup aman. HTML asli dipertahankan agar game tidak rusak. " + detail
              : "Hasil perbaikan Debugger tidak dapat diterapkan dengan aman. HTML asli dipertahankan. " + detail
            : "AI Game Debugger tidak tersedia. HTML asli dipertahankan; coba lagi setelah provider tersedia.",
          detail,
          provider: isPatchFailure ? provider : "james-brain",
          model: isPatchFailure ? model : "game_debugger",
        },
        { status: isPatchFailure ? 422 : 503 },
      );
    }

    let validationErrors =
      validateGameHtml(fixedHtml);

    if (validationErrors.length > 0) {
      console.warn("AI Game Debugger returned invalid HTML; refusing to replace the game with another genre template.", validationErrors);
      return NextResponse.json(
        {
          success: false,
          code: "REPAIRED_HTML_INVALID",
          error: "Patch Debugger menghasilkan HTML yang tidak valid. HTML game asli dipertahankan; tidak ada template pengganti yang dijalankan.",
          provider,
          model,
          errors: validationErrors,
          htmlPreview: fixedHtml.slice(0, 1600),
          originalPreserved: true,
        },
        { status: 422 },
      );
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          provider,
          model,
          errors: validationErrors,
          htmlPreview: fixedHtml.slice(0, 1600),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      provider,
      model,
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