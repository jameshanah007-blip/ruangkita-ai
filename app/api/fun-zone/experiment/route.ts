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

export async function GET(request: Request) {
  const experimentId = new URL(request.url).searchParams.get("experimentId") || "";
  if (!experimentId) {
    return NextResponse.json({ success: false, error: "experimentId wajib diberikan." }, { status: 400 });
  }

  const client = db();
  if (!client) {
    return NextResponse.json({ success: false, error: "Supabase secret configuration is missing." }, { status: 503 });
  }

  const { data, error } = await client
    .from("james_game_experiments")
    .select("id,user_id,conversation_id,capability_key,capability_name,prompt,blueprint,game_html,status,attempt,test_report,learning_result,created_at,verified_at")
    .eq("id", experimentId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ success: false, error: "Experiment job tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    status: data.status,
    experiment: data,
    provider: "james-autonomous",
    model: "game-brain-experiment-v1",
  });
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
