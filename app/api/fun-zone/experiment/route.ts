import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createJamesGameExperimentPlan } from "../../../fun-zone/engine/jamesGameLearning";
import { createAutonomousGameBlueprint } from "../../../fun-zone/engine/localBlueprint";
import { buildAutonomousGameHtml } from "../../../fun-zone/engine/jamesAutonomousGameEngine";

export const runtime = "nodejs";
export const maxDuration = 120;

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

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
    const body = await request.json().catch(() => ({}));
    const userId = typeof body?.userId === "string" ? body.userId : null;
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
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
    let experimentId: string | null = null;

    const client = db();
    if (client) {
      const { data, error } = await client
        .from("james_game_experiments")
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          capability_key: plan.targetCapability?.key || null,
          capability_name: plan.targetCapability?.name || null,
          prompt: plan.prompt,
          blueprint,
          game_html: gameHtml,
          status: "pending_verification",
          attempt: 0,
        })
        .select("id")
        .single();

      if (error) {
        console.warn("James Game Brain experiment persistence failed:", error.message);
      } else {
        experimentId = data?.id || null;
      }
    }

    return NextResponse.json({
      success: true,
      status: "pending-verification",
      experimentId,
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
