import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyJamesAutonomousMutationToExperimentBlueprint, claimJamesGameExperiment, createJamesGameExperimentJob, getJamesPendingExperiment, revalidateJamesCoreSkills } from "../../../fun-zone/engine/jamesGameLearning";
import { buildAutonomousGameHtml } from "../../../fun-zone/engine/jamesAutonomousGameEngine";

export const runtime = "nodejs";
export const maxDuration = 120;

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export async function GET(request: Request) {
  const experimentId = new URL(request.url).searchParams.get("experimentId") || "";
  if (!experimentId) return NextResponse.json({ success: false, error: "experimentId wajib diberikan." }, { status: 400 });
  const client = db();
  if (!client) return NextResponse.json({ success: false, error: "Supabase secret configuration is missing." }, { status: 503 });
  const { data, error } = await client.from("james_game_experiments").select("*").eq("id", experimentId).maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ success: false, error: "Experiment job tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ success: true, status: data.status, experiment: data, provider: "james-autonomous", model: "game-brain-experiment-v1" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = typeof body?.userId === "string" ? body.userId : null;

    if (body?.mode === "revalidate") {
      const result = await revalidateJamesCoreSkills(12);
      return NextResponse.json({ success: true, mode: "revalidate", skills: result, provider: "james-autonomous", model: "game-brain-experiment-v1" });
    }

    if (body?.mode === "claim") {
      const claimed = await claimJamesGameExperiment({ userId });
      if (!claimed) return NextResponse.json({ success: true, claimed: false, message: "Tidak ada experiment pending." });
      return NextResponse.json({
        success: true, claimed: true, status: "running", experimentId: claimed.id,
        claimToken: claimed.runner_token, experiment: claimed,
        blueprint: claimed.blueprint, gameHtml: claimed.game_html,
        provider: "james-autonomous", model: "game-brain-experiment-v1",
      });
    }

    const pending = await getJamesPendingExperiment({ userId });
    if (pending) return NextResponse.json({
      success: true, status: "pending-verification", source: "existing-queue",
      experimentId: pending.id, experiment: pending, blueprint: pending.blueprint, gameHtml: pending.game_html,
      provider: "james-autonomous", model: "game-brain-experiment-v1",
      verification: { verified: false, reason: "Existing pending experiment returned for sandbox verification." },
    });

    const result = await createJamesGameExperimentJob({
      userId,
      conversationId: typeof body?.conversationId === "string" ? body.conversationId : null,
    });

    if (result.status !== "no-gap" && result.blueprint) {
      const mutated = await applyJamesAutonomousMutationToExperimentBlueprint(
        result.blueprint,
        result.plan?.targetCapability?.key || result.plan?.targetCapability?.name || "fun-zone",
      );
      result.blueprint = mutated.blueprint;
      result.gameHtml = buildAutonomousGameHtml(result.blueprint);
      const planWithMutation = result.plan
        ? { ...result.plan, mutationDirective: mutated.directive }
        : result.plan;
      if (result.experimentId) {
        const client = db();
        if (client) {
          await client.from("james_game_experiments").update({
            blueprint: result.blueprint,
            game_html: result.gameHtml,
            status: "pending_verification",
          }).eq("id", result.experimentId);
        }
      }
      if (result.status !== "no-gap") {
        return NextResponse.json({
          success: true, status: result.status, source: "new-queue-job",
          experimentId: result.experimentId, provider: "james-autonomous",
          model: "game-brain-experiment-v1", plan: planWithMutation,
          blueprint: result.blueprint, gameHtml: result.gameHtml,
          verification: { verified: false, reason: "Artifact awaits a real sandbox TestReport." },
        });
      }
    }

    if (result.status === "no-gap") return NextResponse.json({
      success: true, status: "no-gap", provider: "james-autonomous",
      model: "game-brain-experiment-planner-v1", plan: result.plan,
    });

    return NextResponse.json({
      success: true, status: result.status, source: "new-queue-job",
      experimentId: result.experimentId, provider: "james-autonomous",
      model: "game-brain-experiment-v1", plan: result.plan,
      blueprint: result.blueprint, gameHtml: result.gameHtml,
      verification: { verified: false, reason: "Artifact awaits a real sandbox TestReport." },
    });
  } catch (error) {
    console.error("James Game Brain experiment execution failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Experiment execution failed." }, { status: 500 });
  }
}
