import { NextResponse } from "next/server";
import type { GameBlueprint, TestReport } from "../../../fun-zone/laboratory/types";
import {
  evolveJamesStrategyMemory,
  recordJamesGameBrainEvidence,
  recordJamesGameTestLearning,
} from "../../../fun-zone/engine/jamesGameLearning";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const blueprint = body?.blueprint as GameBlueprint | undefined;
    const report = body?.report as TestReport | undefined;
    const attempt = Number(body?.attempt || report?.attempt || 1);

    if (!blueprint || !report) {
      return NextResponse.json(
        { success: false, error: "Blueprint dan test report wajib tersedia." },
        { status: 400 },
      );
    }

    const testLearning = await recordJamesGameTestLearning(blueprint, report, attempt);
    const brainEvidence = await recordJamesGameBrainEvidence(blueprint, report, attempt);
    const strategyEvolution = await evolveJamesStrategyMemory(blueprint, report);

    return NextResponse.json({
      success: true,
      provider: "james-autonomous",
      model: "game-brain-v2",
      learning: {
        testLearning,
        brainEvidence,
        strategyEvolution,
      },
    });
  } catch (error) {
    console.error("James Game Brain learning failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Learning failed.",
      },
      { status: 500 },
    );
  }
}
