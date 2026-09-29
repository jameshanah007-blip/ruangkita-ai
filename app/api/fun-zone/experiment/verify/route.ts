import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { GameBlueprint, TestReport } from "../../../../fun-zone/laboratory/types";
import { recordJamesGameTestLearning, recordJamesGameBrainEvidence, evolveJamesStrategyMemory } from "../../../../fun-zone/engine/jamesGameLearning";

export const runtime = "nodejs";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const experimentId = typeof body?.experimentId === "string" ? body.experimentId : "";
    const report = body?.report as TestReport | undefined;
    const blueprint = body?.blueprint as GameBlueprint | undefined;

    if (!experimentId || !report || !blueprint) {
      return NextResponse.json(
        { success: false, error: "experimentId, blueprint, dan TestReport wajib tersedia." },
        { status: 400 },
      );
    }

    const client = db();
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Supabase secret configuration is missing." },
        { status: 503 },
      );
    }

    const { data: experiment, error: readError } = await client
      .from("james_game_experiments")
      .select("*")
      .eq("id", experimentId)
      .maybeSingle();

    if (readError) throw readError;
    if (!experiment) {
      return NextResponse.json(
        { success: false, error: "Experiment job tidak ditemukan." },
        { status: 404 },
      );
    }

    const learning = await recordJamesGameTestLearning(
      blueprint,
      report,
      Number(report.attempt || experiment.attempt || 0),
    );

    const brainEvidence = await recordJamesGameBrainEvidence(
      blueprint,
      report,
      Number(report.attempt || experiment.attempt || 0),
    );

    const evolved = await evolveJamesStrategyMemory(blueprint, report);

    const verified = report.passed === true;
    const attempt = Number(report.attempt || experiment.attempt || 0);
    const terminalFailure = !verified && attempt >= 5;

    const { error: updateError } = await client
      .from("james_game_experiments")
      .update({
        status: verified ? "verified" : terminalFailure ? "failed" : "pending_verification",
        test_report: report,
        learning_result: {
          learning,
          brainEvidence,
          evolved,
        },
        attempt,
        verified_at: verified ? new Date().toISOString() : null,
      })
      .eq("id", experimentId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      experimentId,
      status: verified ? "verified" : terminalFailure ? "failed" : "pending_verification",
      learning,
      brainEvidence,
      evolved,
    });
  } catch (error) {
    console.error("James Game Brain experiment verification failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Experiment verification failed.",
      },
      { status: 500 },
    );
  }
}
