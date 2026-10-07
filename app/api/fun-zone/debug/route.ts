import { resolveLegacyUserId } from "../../auth/cloudIdentity";
import { consumeJamesRateLimit } from "../../tools/jamesRateLimit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;
import { runJamesBrain } from "../../../core/james/jamesBrain";
import { resolvePhaserGenre } from "../../../fun-zone/phaser/genreDefinitions";
import { PHASER_GENRE_CONTRACTS } from "../../../fun-zone/phaser/contracts";
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
  if (!html.trim()) return ["AI tidak menghasilkan HTML."];
  if (!/<html[\s>]/i.test(html)) errors.push("Dokumen tidak memiliki tag HTML.");
  if (!/<\/html>/i.test(html)) errors.push("Dokumen tidak memiliki penutup </html>.");
  if (!/<canvas[\s>]/i.test(html)) errors.push("Game Phaser tidak memiliki canvas.");
  if (!/phaser@3\.90\.0[\\/"']|Phaser\.Game|Phaser\.Scene/i.test(html)) errors.push("Game 2D wajib menggunakan Phaser 3.90.0.");
  if (!/new\s+Phaser\.Game\s*\(/i.test(html)) errors.push("Phaser.Game tidak diinisialisasi.");
  if (html.length > 400_000) errors.push("Ukuran game terlalu besar.");
  const forbiddenPatterns = [
    /fetch\s*\(/i,
    /XMLHttpRequest/i,
    /WebSocket/i,
    /EventSource/i,
    /localStorage/i,
    /sessionStorage/i,
    /document\.cookie/i,
    /window\.parent/i,
    /window\.top/i,
    /eval\s*\(/i,
    /new\s+Function\s*\(/i,
    /import\s*\(/i,
    /require\s*\(/i,
    /process\./i,
  ];
  const forbiddenNames = [
    "fetch","XMLHttpRequest","WebSocket","EventSource","localStorage",
    "sessionStorage","document.cookie","window.parent","window.top",
    "eval","Function","import","require","process",
  ];
  forbiddenPatterns.forEach((pattern, index) => {
    if (pattern.test(html)) errors.push("Game menggunakan kemampuan yang tidak diizinkan: " + forbiddenNames[index] + ".");
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
  const resolvedGenre = blueprint ? resolvePhaserGenre(blueprint) : null;
  const contract = resolvedGenre ? PHASER_GENRE_CONTRACTS[resolvedGenre] : null;
  return `
RUANGKITA FUN ZONE — PHASER REPAIR AGENT

You are repairing an existing Phaser browser game.

This is a PATCH task, not a redesign task.

ENGINE CONTRACT
- Phaser 3.90.0 is mandatory.
- Keep the existing game concept, genre, scenes, mechanics, visual direction and controls.
- Never replace Phaser with Canvas-only JavaScript, another engine, a generic template, or a different genre.
- Preserve the Game Test Protocol: __RK_GAME_TEST__.
- Preserve runtime identity: __RK_2D_ENGINE_V2__.
- Preserve the canonical Phaser boot spec: __RK_PHASER_BOOT_SPEC__.
- Do not remove gameplay to make a test pass.

GENRE
${resolvedGenre || genre || "unknown"}

CONTRACT ACTIONS
${contract ? contract.requiredActions.join(", ") : "Use the actions already declared by the game."}

REQUIRED SIGNALS
${contract ? contract.requiredSignals.join(", ") : "Preserve all existing semantic state signals."}

REPAIR ATTEMPT
${attempt}

FAILURE
${errorMessage || "none"}

SOURCE
${errorSource || "unknown"} line=${errorLine ?? "unknown"} column=${errorColumn ?? "unknown"}

RUNTIME ERRORS
${runtimeErrors.length ? runtimeErrors.map((e) => e.message).join("\n") : "none"}

TEST REPORT
${formatTestReport(testReport)}

GAME SPECIFICATION
${formatBlueprint(blueprint)}

REPAIR RULES
1. Find the smallest root-cause fix.
2. Prefer patching the existing Phaser scene/system code.
3. Keep the same Phaser scenes and runtime id unless the current source is demonstrably corrupted.
4. Keep input, mobile controls, restart, objective, win/lose behavior.
5. Keep genre-specific gameplay contract intact.
6. Never add network calls, browser storage, cookies, Node APIs, eval, Function constructor, dynamic import or external APIs.
7. The returned file must be one complete runnable HTML document.
8. The returned file must load Phaser 3.90.0 and instantiate Phaser.Game.
9. Return the repaired source, not an explanation.

CURRENT GAME SOURCE
${gameHtml}

OUTPUT ONLY THE COMPLETE REPAIRED HTML.
`;
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

    const normalizedBlueprint = blueprint ? normalizeBlueprint(blueprint) : null;
    const resolvedGenre = normalizedBlueprint ? resolvePhaserGenre(normalizedBlueprint) : null;

    if (!resolvedGenre) {
      return NextResponse.json(
        { success: false, error: "Blueprint tidak memiliki genre Phaser yang didukung." },
        { status: 422 },
      );
    }

    const prompt = buildDebuggerPrompt({
      gameHtml,
      errorMessage,
      errorSource,
      errorLine,
      errorColumn,
      genre: resolvedGenre,
      runtimeErrors,
      testReport,
      blueprint: normalizedBlueprint,
      attempt,
    });

    let provider = "james-brain";
    let model = "provider";
    let fixedHtml = "";

    const result = await runJamesBrain({
      surface: "fun_zone",
      mode: "game_debugger",
      systemInstruction: "Repair the existing Phaser 3.90.0 game. Return only the complete repaired HTML. Preserve the canonical GameSpec, Phaser runtime identity, genre contract and Test Protocol. Do not generate a new generic game.",
      prompt,
      temperature: 0.1,
      maxOutputTokens: 24000,
    });

    provider = result.provider;
    model = result.model;
    fixedHtml = extractHtml(result.text);

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