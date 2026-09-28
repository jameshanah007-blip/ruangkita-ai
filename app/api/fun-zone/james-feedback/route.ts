import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function bool(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function int(value: unknown, max = 10000000) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(max, Math.floor(value)));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const report = body?.report;

    if (!report || typeof report !== "object") {
      return NextResponse.json(
        { success: false, error: "Test report belum diberikan." },
        { status: 400 }
      );
    }

    const supabase = db();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase belum dikonfigurasi." }, { status: 503 });
    }

    const genre =
      typeof body?.genre === "string"
        ? body.genre.trim().slice(0, 120)
        : null;

    const hardFailures =
      Array.isArray(report.hardFailures) ? report.hardFailures.length : 0;
    const warnings =
      Array.isArray(report.softWarnings) ? report.softWarnings.length : 0;

    const { data, error } = await supabase
      .from("james_fun_zone_runs")
      .insert({
        genre,
        passed: Boolean(report.passed),
        runtime_ok: bool(report.runtimeOk),
        rendered: bool(report.rendered),
        loop_started: bool(report.loopStarted),
        frame_advanced: bool(report.frameAdvanced),
        input_test: bool(report.inputTest),
        gameplay_test: bool(report.gameplayTest),
        performance_test: bool(report.performanceTest),
        game_test_protocol: bool(report.gameTestProtocol),
        state_changed: bool(report.stateChanged),
        objective_changed: bool(report.objectiveChanged),
        player_changed: bool(report.playerChanged),
        win_state_detected: bool(report.winStateDetected),
        lose_state_detected: bool(report.loseStateDetected),
        restart_verified: bool(report.restartVerified),
        frame_count: int(report.frameCount),
        game_animation_frames: int(report.gameAnimationFrames),
        input_events: int(report.inputEvents),
        input_listeners: int(report.inputListeners),
        elapsed_ms: int(report.elapsedMs),
        hard_failure_count: Math.min(hardFailures, 100),
        warning_count: Math.min(warnings, 100),
      })
      .select("id, passed, created_at")
      .maybeSingle();

    if (error) {
      console.warn("James Fun Zone telemetry save unavailable:", error.message);
      return NextResponse.json(
        { success: false, error: "Telemetry tidak dapat disimpan." },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, run: data });
  } catch (error) {
    console.error("James Fun Zone telemetry error:", error);
    return NextResponse.json(
      { success: false, error: "Telemetry request gagal." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Gunakan POST untuk mengirim hasil test." },
    { status: 405 }
  );
}