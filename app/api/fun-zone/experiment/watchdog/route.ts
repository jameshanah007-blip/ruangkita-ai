import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = db();
  if (!client) return NextResponse.json({ error: "Supabase secret configuration is missing." }, { status: 503 });

  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: stale, error: findError } = await client
      .from("james_game_experiments")
      .select("id,user_id,capability_key,capability_name,attempt,started_at,test_report,learning_result")
      .eq("status", "running")
      .lt("started_at", cutoff)
      .order("started_at", { ascending: true })
      .limit(50);

    if (findError) throw findError;

    if (!stale?.length) {
      return NextResponse.json({
        success: true,
        watchdog: "james-game-experiment-watchdog-v1",
        recovered: 0,
        message: "No stale experiment runners.",
      });
    }

    const ids = stale.map((job) => job.id);

    const recoveredPatterns = stale.map((job) => {
      const report = job.test_report as Record<string, unknown> | null;
      const failures = Array.isArray(report?.hardFailures) ? report.hardFailures : [];
      const warnings = Array.isArray(report?.softWarnings) ? report.softWarnings : [];
      return {
        id: job.id,
        capability: job.capability_key || "unknown",
        failures: failures.slice(0, 5),
        warnings: warnings.slice(0, 5),
        attempt: Number(job.attempt || 0),
      };
    });

    const repeatedFailureCapabilities = Array.from(new Set(
      recoveredPatterns.filter((item) => item.failures.length > 0).map((item) => item.capability),
    ));
    const { error: recoverError } = await client
      .from("james_game_experiments")
      .update({ status: "pending_verification", runner_token: null, started_at: null })
      .in("id", ids)
      .eq("status", "running")
      .lt("started_at", cutoff);

    if (recoverError) throw recoverError;

    const pattern = "fun-zone:queue:stale-runner-recovery";
    const strategy = repeatedFailureCapabilities.length
      ? "Recover stale runners and strengthen the next experiment around recurring failed capabilities: " + repeatedFailureCapabilities.join(", ") + "."
      : "Recover abandoned experiment runners after a 10-minute lease timeout and return the job to the verification queue.";
    const { data: existing } = await client
      .from("james_experiences")
      .select("id,success_count,failure_count,confidence")
      .eq("pattern", pattern)
      .eq("strategy", strategy)
      .eq("user_id", "system:fun-zone")
      .maybeSingle();

    const successCount = Number(existing?.success_count || 0) + stale.length;
    const confidence = Math.min(0.99, Math.max(Number(existing?.confidence || 0.7), 0.7) + 0.02);

    const experience = {
      user_id: "system:fun-zone",
      pattern,
      strategy,
      confidence,
      success_count: successCount,
      failure_count: Number(existing?.failure_count || 0),
      capabilities: Array.from(new Set(["fun-zone-runtime-observability", "fun-zone-restart-integrity", ...repeatedFailureCapabilities])),
      status: "active",
    };

    if (existing?.id) {
      await client.from("james_experiences").update(experience).eq("id", existing.id).eq("user_id", "system:fun-zone");
    } else {
      await client.from("james_experiences").insert(experience);
    }

    return NextResponse.json({
      success: true,
      watchdog: "james-game-experiment-watchdog-v1",
      recovered: stale.length,
      experimentIds: ids,
      learning: {
        recorded: true,
        pattern,
        strategy,
        repeatedFailureCapabilities,
        recoveredPatterns,
        directive: repeatedFailureCapabilities.length
          ? "Do not repeat the failed runner pattern; target the recurring capability gaps in the next experiment."
          : "Keep runner leases bounded and recover abandoned jobs automatically.",
      },
    });
  } catch (error) {
    console.error("James Game Experiment Watchdog failed:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Watchdog failed.",
    }, { status: 500 });
  }
}
