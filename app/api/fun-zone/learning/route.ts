import { NextResponse } from "next/server";
import type { GameBlueprint, TestReport } from "../../../fun-zone/laboratory/types";
import {
  evolveJamesStrategyMemory,
  recordJamesGameBrainEvidence,
  recordJamesGameTestLearning,
} from "../../../fun-zone/engine/jamesGameLearning";
import { getAuthenticatedUser } from "../../auth/cloudIdentity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const workerSecret = process.env.CRON_SECRET || process.env.JAMES_AUTONOMY_CRON_SECRET;
    const authorization = request.headers.get("authorization") || "";
    const workerAuthorized =
      Boolean(workerSecret) && authorization === "Bearer " + workerSecret;

    // Normal Fun Zone sessions are authenticated browser sessions. Keep the
    // worker-secret path for autonomous/internal jobs, but do not expose the
    // learning engine to anonymous callers.
    if (!workerAuthorized) {
      const user = await getAuthenticatedUser();
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Fun Zone learning membutuhkan sesi pengguna yang terautentikasi." },
          { status: 401 },
        );
      }
    }

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
