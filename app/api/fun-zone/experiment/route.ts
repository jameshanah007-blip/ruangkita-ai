import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyJamesAutonomousMutationToExperimentBlueprint, claimJamesGameExperiment, createJamesGameExperimentJob, getJamesPendingExperiment, revalidateJamesCoreSkills } from "../../../fun-zone/engine/jamesGameLearning";
import { buildAutonomousGameHtml } from "../../../fun-zone/engine/jamesAutonomousGameEngine";
import { LEGACY_USER_COOKIE, LEGACY_USER_SIGNATURE_COOKIE, verifyLegacyUserIdSignature } from "../../auth/cloudIdentity";

export const runtime = "nodejs";
export const maxDuration = 120;

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  return cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1) || "";
}

function getSignedSessionUser(request: Request) {
  const userId = readCookie(request, LEGACY_USER_COOKIE);
  const signature = readCookie(request, LEGACY_USER_SIGNATURE_COOKIE);
  return verifyLegacyUserIdSignature(userId, signature) ? userId : null;
}

function authorizedWorker(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.JAMES_AUTONOMY_CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === "Bearer " + secret;
}

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export async function GET(request: Request) {
  const userId = getSignedSessionUser(request);
  if (!userId) return NextResponse.json({ success: false, error: "Session James tidak valid." }, { status: 403 });

  const experimentId = new URL(request.url).searchParams.get("experimentId") || "";
  if (!experimentId) return NextResponse.json({ success: false, error: "experimentId wajib diberikan." }, { status: 400 });
  const client = db();
  if (!client) return NextResponse.json({ success: false, error: "Supabase secret configuration is missing." }, { status: 503 });
  const { data, error } = await client.from("james_game_experiments").select("*").eq("id", experimentId).eq("user_id", userId).maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ success: false, error: "Experiment job tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ success: true, status: data.status, experiment: data, provider: "james-autonomous", model: "game-brain-experiment-v1" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body?.mode === "revalidate") {
      if (!authorizedWorker(request)) return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
      const result = await revalidateJamesCoreSkills(12);
      return NextResponse.json({ success: true, mode: "revalidate", skills: result, provider: "james-autonomous", model: "game-brain-experiment-v1" });
    }

    if (body?.mode === "claim") {
      if (!authorizedWorker(request)) return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
      const claimed = await claimJamesGameExperiment({ userId: "system:fun-zone" });
      if (!claimed) return NextResponse.json({ success: true, claimed: false, message: "Tidak ada experiment pending." });
      return NextResponse.json({
        success: true, claimed: true, status: "running", experimentId: claimed.id,
        claimToken: claimed.runner_token, experiment: claimed,
        blueprint: claimed.blueprint, gameHtml: claimed.game_html,
        provider: "james-autonomous", model: "game-brain-experiment-v1",
      });
    }

    const userId = getSignedSessionUser(request);
    if (!userId) return NextResponse.json({ success: false, error: "Session James tidak valid." }, { status: 403 });

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
      const mutationDirective = mutated.directive;
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
      return NextResponse.json({
        success: true, status: result.status, source: "new-queue-job",
        experimentId: result.experimentId, provider: "james-autonomous",
        model: "game-brain-experiment-v1", plan: result.plan,
        mutationDirective,
        blueprint: result.blueprint, gameHtml: result.gameHtml,
        verification: { verified: false, reason: "Artifact awaits a real sandbox TestReport." },
      });
    }

    if (result.status === "no-gap") return NextResponse.json({
      success: true, status: "no-gap", provider: "james-autonomous",
      model: "game-brain-experiment-planner-v1", plan: result.plan,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Unexpected Game Brain experiment result state.",
      },
      { status: 500 },
    );
  } catch (error) {
    console.error("James Game Brain experiment execution failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Experiment execution failed." }, { status: 500 });
  }
}

