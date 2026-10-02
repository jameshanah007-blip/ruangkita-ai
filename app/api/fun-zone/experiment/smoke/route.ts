import { NextResponse } from "next/server";
import {
  applyJamesAutonomousMutationToExperimentBlueprint,
  createJamesGameExperimentJob,
} from "../../../../fun-zone/engine/jamesGameLearning";
import { buildAutonomousGameHtml } from "../../../../fun-zone/engine/jamesAutonomousGameEngine";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.JAMES_AUTONOMY_CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === "Bearer " + secret;
}

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await createJamesGameExperimentJob({
      userId: "system:game-brain-smoke-test",
      conversationId: "smoke-test",
    });

    if (result.status === "no-gap") {
      return NextResponse.json({
        success: true,
        smokeTest: "james-game-experiment-v1",
        status: "no-gap",
        persisted: false,
        message: "Planner found no experiment gap.",
        plan: result.plan,
      });
    }

    if (!result.blueprint) {
      return NextResponse.json(
        { success: false, error: "Smoke test planner returned no blueprint." },
        { status: 500 },
      );
    }

    const mutated = await applyJamesAutonomousMutationToExperimentBlueprint(
      result.blueprint,
      result.plan?.targetCapability?.key || result.plan?.targetCapability?.name || "fun-zone",
    );
    const gameHtml = buildAutonomousGameHtml(mutated.blueprint);

    let persisted = false;
    const client = db();
    if (client && result.experimentId) {
      const { error } = await client
        .from("james_game_experiments")
        .update({
          blueprint: mutated.blueprint,
          game_html: gameHtml,
          status: "pending_verification",
        })
        .eq("id", result.experimentId)
        .eq("user_id", "system:game-brain-smoke-test");

      if (error) throw new Error("Smoke test persistence update failed: " + error.message);
      persisted = true;
    }

    return NextResponse.json({
      success: true,
      smokeTest: "james-game-experiment-v1",
      status: result.status,
      persisted,
      experimentId: result.experimentId,
      capability: result.plan?.targetCapability || null,
      mutationDirective: mutated.directive,
      verificationRequired: true,
      message: "Experiment created and persisted. A real browser TestReport is still required before verification.",
    });
  } catch (error) {
    console.error("James Game Experiment smoke test failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Game experiment smoke test failed.",
      },
      { status: 500 },
    );
  }
}
