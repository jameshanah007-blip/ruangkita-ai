import { NextResponse } from "next/server";
import { createJamesGameExperimentPlan } from "../../../fun-zone/engine/jamesGameLearning";
import { createAutonomousGameBlueprint } from "../../../fun-zone/engine/localBlueprint";
import { buildAutonomousGameHtml } from "../../../fun-zone/engine/jamesAutonomousGameEngine";

export const runtime = "nodejs";
export const maxDuration = 120;

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

export async function POST(request: Request) {
  try {
    const plan = await createJamesGameExperimentPlan();

    if (!plan || plan.status !== "experiment") {
      return NextResponse.json({
        success: true,
        status: "no-gap",
        provider: "james-autonomous",
        model: "game-brain-experiment-planner-v1",
        plan,
      });
    }

    const blueprint = createAutonomousGameBlueprint(plan.prompt);
    const gameHtml = buildAutonomousGameHtml(blueprint);

    return NextResponse.json({
      success: true,
      status: "pending-verification",
      provider: "james-autonomous",
      model: "game-brain-experiment-v1",
      plan,
      blueprint,
      gameHtml,
      verification: {
        verified: false,
        reason:
          "Artifact generated successfully, but Game Brain learning must wait for a real sandbox TestReport.",
      },
    });
  } catch (error) {
    console.error("James Game Brain experiment execution failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Experiment execution failed.",
      },
      { status: 500 },
    );
  }
}
