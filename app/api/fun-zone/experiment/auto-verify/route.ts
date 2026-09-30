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
    const claimed = await claimJamesGameExperiment({ userId: "00000000-0000-0000-0000-000000000001" });
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

    const { verifyGameInBrowser } = await import("../../../../fun-zone/laboratory/browserVerifier");
    const attempt = Number(claimed.attempt || 0) + 1;
    const report = await verifyGameInBrowser(claimed.game_html, claimed.blueprint, attempt);

    const origin = new URL(request.url).origin;
    const verifyResponse = await fetch(origin + "/api/fun-zone/experiment/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: request.headers.get("authorization") || "",
      },
      body: JSON.stringify({
        experimentId: claimed.id,
        claimToken: claimed.runner_token,
        report,
        blueprint: claimed.blueprint,
      }),
      cache: "no-store",
    });

    const verification = await verifyResponse.json().catch(() => ({
      success: false,
      error: "Verification endpoint returned invalid JSON.",
    }));

    return NextResponse.json({
      success: verifyResponse.ok && verification.success !== false,
      status: verification.status || (report.passed ? "verified" : "pending_verification"),
      experimentId: claimed.id,
      attempt,
      report,
      verification,
      browser: "vercel-sandbox + agent-browser",
    }, { status: verifyResponse.ok ? 200 : verifyResponse.status });
  } catch (error) {
    console.error("James autonomous browser verification failed:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Browser verification failed.",
    }, { status: 500 });
  }
}
