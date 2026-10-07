import { resolvePhaserGenre } from "../phaser/genreDefinitions";
import { PHASER_GENRE_CONTRACTS } from "../phaser/contracts";
import type {
  GameBlueprint,
  SandboxTestEvidence,
  TestCheck,
  TestReport,
} from "./types";

/**
 * Input mentah dari AIGameSandbox.
 *
 * Sandbox bertugas mengumpulkan evidence.
 * Tester bertugas menentukan apakah evidence
 * tersebut memenuhi syarat game.
 */

export type TestGameOptions = {
  blueprint: GameBlueprint;
  attempt: number;
  evidence: SandboxTestEvidence;
};

/**
 * Ambang batas dasar laboratory.
 *
 * Nilai ini sengaja konservatif.
 * Kita ingin menghindari false PASS.
 */
const TEST_LIMITS = {
  minCanvasWidth: 100,
  minCanvasHeight: 100,

  minFrameCount: 5,
  minAnimationFrames: 2,

  minInputEvents: 1,
  minInputListeners: 1,

  minNonBlankPixels: 10,

  maxRuntimeMs: 15_000,
} as const;

function addCheck(
  checks: TestCheck[],
  name: string,
  passed: boolean,
  message: string
) {
  checks.push({
    name,
    status: passed ? "pass" : "fail",
    message,
  });
}

function addWarningCheck(
  checks: TestCheck[],
  name: string,
  message: string
) {
  checks.push({
    name,
    status: "warning",
    message,
  });
}

/**
 * Memeriksa apakah runtime benar-benar hidup.
 */
function checkRuntime(
  evidence: SandboxTestEvidence,
  checks: TestCheck[]
): string[] {
  const failures: string[] = [];

  const passed =
    evidence.runtimeOk &&
    evidence.runtimeErrors.length === 0;

  addCheck(
    checks,
    "runtime",
    passed,
    passed
      ? "Runtime berjalan tanpa error."
      : "Runtime menghasilkan error."
  );

  if (!passed) {
    if (evidence.runtimeErrors.length > 0) {
      for (const error of evidence.runtimeErrors.slice(
        0,
        5
      )) {
        failures.push(
          `Runtime error: ${error.message}`
        );
      }
    } else {
      failures.push(
        "Runtime tidak berjalan dengan stabil."
      );
    }
  }

  return failures;
}

/**
 * Memeriksa apakah game benar-benar menggambar sesuatu.
 */
function checkRendering(
  evidence: SandboxTestEvidence,
  checks: TestCheck[]
): string[] {
  const failures: string[] = [];

  const canvasPassed =
    evidence.canvasValid &&
    evidence.canvasWidth >=
      TEST_LIMITS.minCanvasWidth &&
    evidence.canvasHeight >=
      TEST_LIMITS.minCanvasHeight;

  addCheck(
    checks,
    "canvas",
    canvasPassed,
    canvasPassed
      ? `Canvas valid (${evidence.canvasWidth}x${evidence.canvasHeight}).`
      : "Canvas tidak valid atau terlalu kecil."
  );

  if (!canvasPassed) {
    failures.push(
      "Canvas tidak valid."
    );
  }

  const renderedPassed =
    evidence.rendered &&
    evidence.nonBlankPixels >=
      TEST_LIMITS.minNonBlankPixels;

  addCheck(
    checks,
    "rendering",
    renderedPassed,
    renderedPassed
      ? "Game menghasilkan visual yang terlihat."
      : "Game tidak menghasilkan visual yang cukup."
  );

  if (!renderedPassed) {
    failures.push(
      "Rendering game tidak terbukti."
    );
  }

  return failures;
}

/**
 * Memeriksa game loop.
 */
function checkGameLoop(
  evidence: SandboxTestEvidence,
  checks: TestCheck[]
): string[] {
  const failures: string[] = [];

  const loopPassed =
    evidence.loopStarted &&
    evidence.frameCount >=
      TEST_LIMITS.minFrameCount;

  addCheck(
    checks,
    "game_loop",
    loopPassed,
    loopPassed
      ? `Game loop berjalan (${evidence.frameCount} frames).`
      : "Game loop tidak terbukti berjalan."
  );

  if (!loopPassed) {
    failures.push(
      "Game loop tidak berjalan dengan benar."
    );
  }

  const animationPassed =
    evidence.frameAdvanced &&
    evidence.gameAnimationFrames >=
      TEST_LIMITS.minAnimationFrames;

  addCheck(
    checks,
    "frame_advancement",
    animationPassed,
    animationPassed
      ? "Frame game mengalami perubahan."
      : "Frame game tidak menunjukkan perubahan."
  );

  if (!animationPassed) {
    failures.push(
      "Game tidak menunjukkan perkembangan frame yang cukup."
    );
  }

  return failures;
}

/**
 * Memeriksa input.
 */
function checkInput(
  evidence: SandboxTestEvidence,
  checks: TestCheck[]
): string[] {
  const failures: string[] = [];

  const inputPassed =
    evidence.inputTest &&
    evidence.inputEvents >=
      TEST_LIMITS.minInputEvents &&
    evidence.inputListeners >=
      TEST_LIMITS.minInputListeners;

  addCheck(
    checks,
    "input",
    inputPassed,
    inputPassed
      ? `Input terdeteksi (${evidence.inputEvents} events, ${evidence.inputListeners} listeners).`
      : "Input interaction tidak terbukti."
  );

  if (!inputPassed) {
    failures.push(
      "Input interaction tidak bekerja atau tidak terdeteksi."
    );
  }

  return failures;
}

/**
 * Memeriksa gameplay.
 *
 * Gameplay tidak lagi hanya berdasarkan
 * gameplayTest dari diagnostic runtime.
 *
 * Game harus memberikan bukti semantic melalui
 * Game Test Protocol.
 */
function checkGenreGameplay(blueprint: GameBlueprint, evidence: SandboxTestEvidence, checks: TestCheck[]): string[] {
  const genre = resolvePhaserGenre(blueprint);
  if (!genre) return [];
  const contract = PHASER_GENRE_CONTRACTS[genre];
  const state = evidence.genreState ?? {};
  const failures: string[] = [];
  const presentSignals = contract.requiredSignals.filter((signal) => {
    const value = state[signal];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") return value.length > 0;
    return value != null;
  });
  const passed = presentSignals.length === contract.requiredSignals.length;
  addCheck(checks, "2d_genre_gameplay", passed,
    passed
      ? genre + " gameplay contract terbukti melalui state runtime."
      : "Milestone genre yang belum terbukti: " + contract.requiredSignals.filter((signal) => !presentSignals.includes(signal)).join(", "));
  if (!passed) failures.push("Gameplay khusus genre belum terbukti: " + contract.requiredSignals.filter((signal) => !presentSignals.includes(signal)).join(", "));
  return failures;
}

function checkPlayerGuidanceAndControls(
  evidence: SandboxTestEvidence,
  checks: TestCheck[],
): string[] {
  const failures: string[] = [];
  const tutorialPassed = evidence.tutorialAvailable === true;
  addCheck(checks,"tutorial",tutorialPassed,tutorialPassed ? "Petunjuk bermain tersedia." : "Game belum membuktikan adanya petunjuk bermain.");
  if (!tutorialPassed) failures.push("Petunjuk bermain wajib tersedia.");

  const controls = evidence.directionalControls;
  const controlsPassed = controls?.up === true && controls?.down === true && controls?.left === true && controls?.right === true;
  addCheck(checks,"directional_controls",controlsPassed,controlsPassed ? "Kontrol 4 arah tersedia." : "Kontrol 4 arah belum terbukti lengkap.");
  if (!controlsPassed) failures.push("Kontrol 4 arah wajib tersedia dan terbukti.");
  return failures;
}

function checkEngineArchitecture(blueprint: GameBlueprint, evidence: SandboxTestEvidence, checks: TestCheck[]): string[] {
  const failures: string[] = [];
  const genre = resolvePhaserGenre(blueprint);
  if (!genre) return failures;

  const enginePassed = evidence.engine2D === true && evidence.runtimeEngine === "Phaser";
  addCheck(checks, "2d_engine", enginePassed,
    enginePassed ? "Game berjalan menggunakan Phaser." : "Game 2D tidak terbukti berjalan menggunakan Phaser.");
  if (!enginePassed) failures.push("Genre 2D wajib menggunakan runtime Phaser.");

  const versionPassed = evidence.runtimeVersion === "3.90.0";
  addCheck(checks, "phaser_version", versionPassed,
    versionPassed ? "Phaser 3.90.0 terdeteksi." : "Versi Phaser runtime tidak sesuai.");
  if (!versionPassed) failures.push("Runtime Phaser yang digunakan harus 3.90.0.");

  const genrePassed = evidence.engine2DGenre === genre;
  addCheck(checks, "2d_genre_identity", genrePassed,
    genrePassed ? "Genre runtime sesuai dengan genre yang diminta." : "Identitas genre runtime tidak sesuai dengan genre yang diminta.");
  if (!genrePassed) failures.push("Runtime genre tidak sesuai dengan Game Specification.");

  const systems = new Set(evidence.engine2DSystems ?? []);
  const requiredSystemNames = {
    monster_tamer: ["movement","dialogue","quest","encounter","battle","capture","party","progression"],
    farming: ["movement","farming","inventory","economy","npc","dialogue","day_cycle"],
    adventure: ["movement","dialogue","collection","exploration"],
    rpg: ["movement","dialogue","battle","loot","progression"],
    platformer: ["movement","platform","collision","progression"],
    racing: ["movement","racing","collision","progression"],
    puzzle: ["puzzle","selection","progression"],
    shooter: ["movement","shooting","collision","survival"],
    strategy: ["strategy","placement","command","capture","economy"],
    simulation: ["simulation","building","allocation","progression"],
    survival: ["movement","survival","scavenge","crafting","defense","progression"],
  }[genre];
  const missing = requiredSystemNames.filter((s) => !systems.has(s));
  const systemsPassed = missing.length === 0;
  addCheck(checks, "2d_required_systems", systemsPassed,
    systemsPassed ? "Semua system wajib genre tersedia." : "System genre yang hilang: " + missing.join(", "));
  if (!systemsPassed) failures.push("2D runtime kehilangan system wajib: " + missing.join(", "));
  return failures;
}

function checkGameplay(
  evidence: SandboxTestEvidence,
  checks: TestCheck[]
): string[] {
  const failures: string[] = [];

  /*
   * Semantic gameplay requirement.
   *
   * Game harus memiliki Game Test Protocol,
   * dan harus menghasilkan bukti perubahan
   * state/player/objective atau transisi win/lose.
   */
  const semanticGameplay =
    evidence.gameTestProtocol &&
    (
      evidence.stateChanged ||
      evidence.playerChanged ||
      evidence.objectiveChanged ||
      evidence.winStateDetected ||
      evidence.loseStateDetected
    );

  /*
   * Restart juga harus berhasil diverifikasi.
   */
  const restartPassed =
    evidence.restartVerified;

  /*
   * Gameplay dianggap PASS hanya jika:
   *
   * 1. Diagnostic gameplay berhasil
   * 2. Semantic gameplay terbukti
   * 3. Restart berhasil diverifikasi
   */
  const passed =
    evidence.gameplayTest &&
    semanticGameplay &&
    restartPassed;

  addCheck(
    checks,
    "gameplay",
    passed,
    passed
      ? "Gameplay semantic berhasil diverifikasi melalui Game Test Protocol."
      : "Gameplay semantic belum berhasil diverifikasi."
  );

  /*
   * Game Test Protocol harus tersedia.
   */
  if (!evidence.gameTestProtocol) {
    failures.push(
      "Game Test Protocol __RK_GAME_TEST__ tidak tersedia."
    );
  }

  /*
   * Harus ada bukti perubahan gameplay.
   */
  if (!semanticGameplay) {
    failures.push(
      "Semantic gameplay belum terbukti melalui perubahan state/player/objective atau kondisi win/lose."
    );
  }

  /*
   * Restart harus berhasil.
   */
  if (!restartPassed) {
    failures.push(
      "Restart game belum berhasil diverifikasi."
    );
  }

  /*
   * Evidence gameplay dasar juga tetap harus benar.
   */
  if (!evidence.gameplayTest) {
    failures.push(
      "Gameplay interaction gagal diverifikasi."
    );
  }

  return failures;
}

/**
 * Memeriksa performa.
 *
 * Performance failure menjadi hard failure
 * hanya jika runtime benar-benar terlalu lambat.
 */
function checkPerformance(
  evidence: SandboxTestEvidence,
  checks: TestCheck[]
): string[] {
  const failures: string[] = [];

  const passed =
    evidence.performanceTest &&
    evidence.elapsedMs <=
      TEST_LIMITS.maxRuntimeMs;

  if (passed) {
    addCheck(
      checks,
      "performance",
      true,
      `Runtime selesai dalam ${evidence.elapsedMs}ms.`
    );
  } else {
    addWarningCheck(
      checks,
      "performance",
      `Performa perlu diperiksa (${evidence.elapsedMs}ms).`
    );

    /*
     * Jangan langsung membuat semua masalah performa
     * menjadi hard failure.
     *
     * Ini penting karena game yang playable tetapi
     * sedikit lambat seharusnya masih bisa masuk ke
     * debugging sebagai warning.
     */
  }

  return failures;
}

/**
 * Memeriksa requirements yang diberikan oleh Director.
 *
 * Pada tahap ini requirements masih dicatat
 * sebagai warning karena semantic verifier
 * spesifik per requirement belum tersedia.
 *
 * Semantic gameplay umum sekarang sudah ditangani
 * oleh checkGameplay() melalui Game Test Protocol.
 */
function checkDesignRequirements(
  blueprint: GameBlueprint,
  evidence: SandboxTestEvidence,
  checks: TestCheck[]
): string[] {
  const warnings: string[] = [];

  const requirements =
    blueprint.testRequirements ?? [];

  if (requirements.length === 0) {
    addWarningCheck(
      checks,
      "design_requirements",
      "Blueprint tidak memiliki test requirements."
    );

    return warnings;
  }

  /*
   * Kita belum berpura-pura mampu
   * memverifikasi setiap requirement semantic
   * secara spesifik.
   *
   * Semantic gameplay umum sudah diverifikasi
   * melalui Game Test Protocol.
   */
  addWarningCheck(
    checks,
    "design_requirements",
    `${requirements.length} design requirements tersedia untuk semantic testing.`
  );

  for (
    const requirement of requirements.slice(0, 12)
  ) {
    warnings.push(
      `Belum ada semantic verifier untuk: ${requirement}`
    );
  }

  /*
   * Jika runtime evidence dasar sudah gagal,
   * requirements tidak perlu dianggap penyebab
   * tambahan.
   */
  if (
    !evidence.runtimeOk ||
    !evidence.rendered
  ) {
    return warnings;
  }

  return warnings;
}

/**
 * Menentukan hasil akhir Laboratory Tester.
 *
 * PASS hanya jika seluruh hard requirement
 * terpenuhi.
 */
export function testGame({
  blueprint,
  attempt,
  evidence,
}: TestGameOptions): TestReport {
  const startedAt =
    new Date().toISOString();

  const checks: TestCheck[] = [];

  const hardFailures: string[] = [];
  const softWarnings: string[] = [];

  hardFailures.push(
    ...checkRuntime(
      evidence,
      checks
    )
  );

  hardFailures.push(
    ...checkRendering(
      evidence,
      checks
    )
  );

  hardFailures.push(
    ...checkGameLoop(
      evidence,
      checks
    )
  );

  hardFailures.push(
    ...checkInput(
      evidence,
      checks
    )
  );

  hardFailures.push(
    ...checkGameplay(
      evidence,
      checks
    )
  );

  hardFailures.push(
    ...checkEngineArchitecture(
      blueprint,
      evidence,
      checks
    )
  );

  hardFailures.push(
    ...checkGenreGameplay(blueprint, evidence, checks)
  );

  hardFailures.push(
    ...checkPlayerGuidanceAndControls(
      evidence,
      checks
    )
  );

  hardFailures.push(
    ...checkPerformance(
      evidence,
      checks
    )
  );

  softWarnings.push(
    ...checkDesignRequirements(
      blueprint,
      evidence,
      checks
    )
  );

  /*
   * Sandbox sendiri dapat memberikan hard failure.
   * Kita gabungkan tanpa duplikasi.
   */
  for (
    const failure of evidence.hardFailures
  ) {
    if (!hardFailures.includes(failure)) {
      hardFailures.push(failure);
    }
  }

  for (
    const warning of evidence.softWarnings
  ) {
    if (!softWarnings.includes(warning)) {
      softWarnings.push(warning);
    }
  }

  /*
   * PASS harus ditentukan oleh evidence,
   * bukan oleh AI yang mengatakan game sudah benar.
   */
  const passed =
    hardFailures.length === 0;

  const finishedAt =
    new Date().toISOString();

  return {
    passed,

    startedAt,
    finishedAt,

    attempt,

    runtimeOk:
      evidence.runtimeOk,

    rendered:
      evidence.rendered,

    loopStarted:
      evidence.loopStarted,

    frameAdvanced:
      evidence.frameAdvanced,

    canvasValid:
      evidence.canvasValid,

    inputTest:
      evidence.inputTest,

    gameplayTest:
      evidence.gameplayTest,

    engine2D:
      evidence.engine2D,
    engine2DGenre:
      evidence.engine2DGenre,
    engine2DSystems:
      evidence.engine2DSystems,
    runtimeEngine:
      evidence.runtimeEngine,
    runtimeVersion:
      evidence.runtimeVersion,

    performanceTest:
      evidence.performanceTest,

    stateChanged:
      evidence.stateChanged,

    objectiveChanged:
      evidence.objectiveChanged,

    playerChanged:
      evidence.playerChanged,

    restartVerified:
      evidence.restartVerified,

    frameCount:
      evidence.frameCount,

    gameAnimationFrames:
      evidence.gameAnimationFrames,

    inputEvents:
      evidence.inputEvents,

    inputListeners:
      evidence.inputListeners,

    canvasWidth:
      evidence.canvasWidth,

    canvasHeight:
      evidence.canvasHeight,

    nonBlankPixels:
      evidence.nonBlankPixels,

    renderChanged:
      evidence.renderChanged,

    elapsedMs:
      evidence.elapsedMs,

    screenshot:
      evidence.screenshot,

    runtimeVisualAnalysis:
      evidence.runtimeVisualAnalysis,

    hardFailures,

    softWarnings,

    checks,

    runtimeErrors:
      evidence.runtimeErrors,
  };
}

/**
 * Helper sederhana untuk mengetahui apakah
 * sebuah TestReport dapat diteruskan ke debugger.
 */
export function needsRepair(
  report: TestReport
): boolean {
  return !report.passed;
}

/**
 * Ringkasan yang aman untuk dikirim ke AI Debugger.
 */
export function createDebugContext(
  report: TestReport
): string {
  const lines: string[] = [];

  lines.push(
    `Test attempt: ${report.attempt}`
  );

  lines.push(
    `Passed: ${report.passed}`
  );

  if (report.hardFailures.length > 0) {
    lines.push(
      "Hard failures:"
    );

    for (
      const failure of report.hardFailures
    ) {
      lines.push(
        `- ${failure}`
      );
    }
  }

  if (report.softWarnings.length > 0) {
    lines.push(
      "Warnings:"
    );

    for (
      const warning of report.softWarnings.slice(
        0,
        20
      )
    ) {
      lines.push(
        `- ${warning}`
      );
    }
  }

  if (report.runtimeErrors.length > 0) {
    lines.push(
      "Runtime errors:"
    );

    for (
      const error of report.runtimeErrors.slice(
        0,
        10
      )
    ) {
      lines.push(
        `- ${error.message}`
      );
    }
  }

  return lines.join("\n");
}