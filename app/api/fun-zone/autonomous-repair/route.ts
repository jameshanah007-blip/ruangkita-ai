import { LEGACY_USER_COOKIE, LEGACY_USER_SIGNATURE_COOKIE, verifyLegacyUserIdSignature } from "../../auth/cloudIdentity";
import { NextResponse } from "next/server";
import type { GameBlueprint, TestReport } from "../../../fun-zone/laboratory/types";
import { buildAutonomousGameHtml } from "../../../fun-zone/engine/jamesAutonomousGameEngine";


export const runtime = "nodejs";

function clean(value: string, max = 700) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function evolveBlueprint(blueprint: GameBlueprint, report: TestReport, attempt: number): GameBlueprint {
  const failures = Array.isArray(report.hardFailures) ? report.hardFailures.join(" ") : "";
  const warnings = Array.isArray(report.softWarnings) ? report.softWarnings.join(" ") : "";
  const evidence = clean([failures, warnings].filter(Boolean).join(" | "), 900);

  const mechanics = [...blueprint.mechanics];
  const actions = [...blueprint.playerActions];

  if (!report.inputTest && !actions.includes("move")) actions.push("move");
  if (!report.gameplayTest && !actions.includes("interact")) actions.push("interact");
  if (!report.objectiveChanged && !mechanics.includes("collect")) mechanics.push("collect");
  if (!report.playerChanged && !actions.includes("explore")) actions.push("explore");

  return {
    ...blueprint,
    concept: clean(
      blueprint.concept +
      " | James autonomous repair " +
      attempt +
      ": " +
      (evidence || "increase runtime observability and reachable gameplay"),
      1200
    ),
    mechanics: mechanics.slice(0, 8),
    playerActions: actions.slice(0, 12),
    testRequirements: Array.from(new Set([
      ...blueprint.testRequirements,
      "repair attempt " + attempt + " must change observable gameplay state",
      "objective must remain reachable",
      "restart must return to playable state",
    ])).slice(0, 20),
    visualStyle: clean(
      blueprint.visualStyle + " · evolved runtime variant " + attempt,
      220
    ),
  };
}

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const readCookie = (name: string) => cookieHeader
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`))
      ?.slice(name.length + 1) || "";
    const sessionUserId = readCookie(LEGACY_USER_COOKIE);
    const sessionSignature = readCookie(LEGACY_USER_SIGNATURE_COOKIE);
    if (!verifyLegacyUserIdSignature(sessionUserId, sessionSignature)) {
      return NextResponse.json(
        { success: false, error: "Sesi James tidak valid. Silakan buat sesi James terlebih dahulu." },
        { status: 401 },
      );
    }
    const body = await request.json();
    const blueprint = body?.blueprint as GameBlueprint | undefined;
    const report = body?.report as TestReport | undefined;
    const attempt = Math.max(1, Math.min(5, Number(body?.attempt || 1)));

    if (!blueprint || !report) {
      return NextResponse.json(
        { success: false, error: "Blueprint dan test report diperlukan." },
        { status: 400 }
      );
    }

    const evolvedBlueprint = evolveBlueprint(blueprint, report, attempt);
    const gameHtml = buildAutonomousGameHtml(evolvedBlueprint);

    return NextResponse.json({
      success: true,
      provider: "james-autonomous",
      model: "autonomous-evolution-engine-v1",
      attempt,
      blueprint: evolvedBlueprint,
      gameHtml,
      repair: {
        reason: Array.isArray(report.hardFailures) ? report.hardFailures : [],
        evidence: Array.isArray(report.softWarnings) ? report.softWarnings : [],
        changes: [
          "James analyzed runtime evidence.",
          "James evolved the gameplay genome.",
          "James regenerated the standalone game artifact.",
        ],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Autonomous repair gagal.",
      },
      { status: 500 }
    );
  }
}
