import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { claimJamesGameExperiment } from "../../../../fun-zone/engine/jamesGameLearning";


export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request) {
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
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const claimed = await claimJamesGameExperiment({ userId: "system:fun-zone" });
    if (!claimed) {
      return NextResponse.json({
        success: true,
        status: "idle",
        message: "Tidak ada experiment pending untuk browser verification.",
      });
    }

    if (!claimed.blueprint || !claimed.game_html || !claimed.runner_token) {
      return NextResponse.json({
        success: false,
        error: "Experiment claim tidak memiliki blueprint, game HTML, atau runner token.",
        experimentId: claimed.id,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: false,
      status: "browser-runner-required",
      experimentId: claimed.id,
      error: "Browser verification runner is isolated from the Next.js runtime and must execute in the dedicated sandbox worker.",
    }, { status: 503 });
  } catch (error) {
    console.error("James autonomous browser verification failed:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Browser verification failed.",
    }, { status: 500 });
  }
}
