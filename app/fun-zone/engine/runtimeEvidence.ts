export type RuntimeEvidenceSource = "sandbox" | "browser";

export type RuntimeScreenshotEvidence = {
  available: boolean;
  width: number;
  height: number;
  nonBlankPixels: number;
  capturedAt?: string;
  dataUrl?: string;
};

export type RuntimeEvidence = {
  version: 1;
  source: RuntimeEvidenceSource;
  rendered: boolean;
  canvas: {
    width: number;
    height: number;
    visiblePixels: number;
  };
  input: {
    events: number;
    listeners: number;
  };
  gameLoop: {
    animationFrames: number;
  };
  audio: {
    events: number;
  };
  errors: string[];
  screenshot: RuntimeScreenshotEvidence;
};

export type RuntimeVisualIssue = {
  severity: "info" | "warning" | "critical";
  area: "rendering" | "canvas" | "animation" | "input" | "audio" | "runtime";
  message: string;
  repair: string;
};

export type RuntimeVisualAnalysis = {
  version: 1;
  passed: boolean;
  score: number;
  issues: RuntimeVisualIssue[];
};

export function analyzeRuntimeEvidence(evidence: RuntimeEvidence): RuntimeVisualAnalysis {
  const issues: RuntimeVisualIssue[] = [];

  if (!evidence.rendered || evidence.canvas.visiblePixels <= 0) {
    issues.push({
      severity: "critical",
      area: "rendering",
      message: "Runtime tidak menghasilkan visual yang terlihat.",
      repair: "Periksa canvas initialization, render loop, asset loading, dan camera.",
    });
  }

  if (evidence.canvas.width <= 0 || evidence.canvas.height <= 0) {
    issues.push({
      severity: "critical",
      area: "canvas",
      message: "Ukuran canvas runtime tidak valid.",
      repair: "Pastikan canvas responsive dan memiliki ukuran saat runtime dimulai.",
    });
  }

  if (evidence.gameLoop.animationFrames <= 0) {
    issues.push({
      severity: "critical",
      area: "runtime",
      message: "Game loop tidak menghasilkan animation frame.",
      repair: "Periksa requestAnimationFrame dan lifecycle runtime.",
    });
  }

  if (evidence.errors.length > 0) {
    issues.push({
      severity: "critical",
      area: "runtime",
      message: "Runtime melaporkan error.",
      repair: "Perbaiki error runtime sebelum refinement visual dilanjutkan.",
    });
  }

  if (evidence.screenshot.available && evidence.screenshot.nonBlankPixels <= 0) {
    issues.push({
      severity: "warning",
      area: "rendering",
      message: "Screenshot tersedia tetapi tidak memiliki piksel visual.",
      repair: "Periksa timing capture dan render readiness.",
    });
  }

  if (evidence.input.events <= 0) {
    issues.push({
      severity: "warning",
      area: "input",
      message: "Belum ada bukti input gameplay diterima.",
      repair: "Jalankan keyboard/touch smoke test sebelum menyatakan runtime siap.",
    });
  }

  if (evidence.audio.events <= 0) {
    issues.push({
      severity: "info",
      area: "audio",
      message: "Belum ada bukti event audio dipicu.",
      repair: "Jalankan interaction/movement audio smoke test.",
    });
  }

  const score = Math.round(
    ([evidence.rendered && evidence.canvas.visiblePixels > 0,
      evidence.canvas.width > 0 && evidence.canvas.height > 0,
      evidence.gameLoop.animationFrames > 0,
      evidence.errors.length === 0,
      evidence.input.events > 0,
      evidence.audio.events > 0].filter(Boolean).length / 6) * 100,
  );

  return {
    version: 1,
    passed: !issues.some((issue) => issue.severity === "critical"),
    score,
    issues,
  };
}
