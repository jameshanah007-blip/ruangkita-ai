import { NextResponse } from "next/server";
import { createJamesGameExperimentPlan } from "../../../fun-zone/engine/jamesGameLearning";

export const runtime = "nodejs";

export async function GET() {
  try {
    const plan = await createJamesGameExperimentPlan();
    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Game Brain experiment planner belum tersedia." },
        { status: 503 },
      );
    }

    return NextResponse.json({
      success: true,
      provider: "james-autonomous",
      model: "game-brain-experiment-planner-v1",
      plan,
    });
  } catch (error) {
    console.error("James Game Brain experiment planner failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Experiment planning failed.",
      },
      { status: 500 },
    );
  }
}
