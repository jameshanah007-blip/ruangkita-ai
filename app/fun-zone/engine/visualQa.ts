import type { GameBlueprint } from "../laboratory/types";
import type { GameBuildPlan } from "./gameBuildPlan";
import type { VisualBlueprint } from "./visualBlueprint";

export type VisualQaIssue = {
  severity: "info" | "warning" | "critical";
  area: "style" | "character" | "animation" | "world" | "mobile" | "audio";
  message: string;
  repair: string;
};

export type VisualQaReport = {
  version: 1;
  passed: boolean;
  score: number;
  referenceDriven: boolean;
  checks: {
    styleConsistency: boolean;
    characterIdentity: boolean;
    animationCoverage: boolean;
    worldCoverage: boolean;
    mobilePresentation: boolean;
    audioCoverage: boolean;
  };
  issues: VisualQaIssue[];
  repairPriority: string[];
};

function textOf(b: GameBlueprint): string {
  return [b.title,b.concept,b.genre,b.mood,b.theme,b.world,b.visualStyle,b.coreLoop,b.objective,...b.mechanics,...b.playerActions].join(" ").toLowerCase();
}

export function evaluateVisualBuild(
  blueprint: GameBlueprint,
  plan: GameBuildPlan,
  visual: VisualBlueprint,
): VisualQaReport {
  const text = textOf(blueprint);
  const issues: VisualQaIssue[] = [];
  const characters = visual.characters.length;
  const protagonist = visual.protagonist;
  const animated = new Set(plan.assets.animated);
  const directional = new Set(plan.assets.directional);

  const styleConsistency = Boolean(
    visual.artDirection.style &&
    visual.artDirection.genre &&
    visual.artDirection.theme &&
    visual.artDirection.camera,
  );

  const characterIdentity = Boolean(
    protagonist.appearance.length &&
    protagonist.outfit.length &&
    protagonist.equipment.length &&
    protagonist.animationNeeds.length,
  );

  const animationCoverage = animated.has("player") &&
    (!directional.size || directional.has("player")) &&
    protagonist.animationNeeds.length >= 3;

  const worldCoverage = visual.environments.length > 0 &&
    visual.environments.every((env) => env.description && env.props.length > 0);

  const mobilePresentation = plan.controls.touch.length > 0 &&
    visual.ui.some((item) => /mobile|responsive/i.test(item));

  const audioCoverage = plan.audio.required && plan.audio.events.length >= 3;

  if (!styleConsistency) {
    issues.push({
      severity: "critical",
      area: "style",
      message: "Visual specification belum memiliki identitas style/camera yang lengkap.",
      repair: "Lengkapi art direction sebelum build ulang.",
    });
  }

  if (!characterIdentity || characters === 0) {
    issues.push({
      severity: "critical",
      area: "character",
      message: "Karakter belum memiliki DNA visual yang cukup untuk mempertahankan identitas.",
      repair: "Perkuat appearance, outfit, equipment, expression, dan animation needs.",
    });
  }

  if (!animationCoverage) {
    issues.push({
      severity: "warning",
      area: "animation",
      message: "Coverage animasi karakter belum cukup untuk runtime yang diminta.",
      repair: "Tambahkan idle/walk/action/hit/talk atau state yang relevan dengan genre.",
    });
  }

  if (!worldCoverage) {
    issues.push({
      severity: "warning",
      area: "world",
      message: "World specification terlalu tipis untuk menghasilkan area yang berbeda.",
      repair: "Tambahkan environment areas dan props yang spesifik terhadap prompt.",
    });
  }

  if (!mobilePresentation) {
    issues.push({
      severity: "warning",
      area: "mobile",
      message: "Kontrol atau UI mobile belum terdefinisi dengan jelas.",
      repair: "Tambahkan touch controls dan responsive UI.",
    });
  }

  if (!audioCoverage) {
    issues.push({
      severity: "info",
      area: "audio",
      message: "Coverage audio masih minimal.",
      repair: "Tambahkan event audio sesuai gameplay.",
    });
  }

  const score = Math.max(
    0,
    Math.round(
      ([styleConsistency, characterIdentity, animationCoverage, worldCoverage, mobilePresentation, audioCoverage]
        .filter(Boolean).length / 6) * 100,
    ),
  );

  const repairPriority = issues
    .sort((a, b) => ({ critical: 0, warning: 1, info: 2 }[a.severity] - ({ critical: 0, warning: 1, info: 2 }[b.severity])))
    .map((issue) => issue.repair);

  return {
    version: 1,
    passed: !issues.some((issue) => issue.severity === "critical"),
    score,
    referenceDriven: /reference|screenshot|image|gambar|seperti/i.test(text),
    checks: {
      styleConsistency,
      characterIdentity,
      animationCoverage,
      worldCoverage,
      mobilePresentation,
      audioCoverage,
    },
    issues,
    repairPriority,
  };
}
