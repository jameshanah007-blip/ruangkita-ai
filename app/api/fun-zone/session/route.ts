import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const USER_COOKIE = "ruangkita-session-user";

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$/.test(value);
}

async function getUserId() {
  const store = await cookies();
  const value = store.get(USER_COOKIE)?.value;
  return validUuid(value) ? value : null;
}

export async function GET() {
  try {
    const userId = await getUserId();
    const db = getDb();

    if (!userId || !db) {
      return NextResponse.json({ success: true, session: null });
    }

    const { data, error } = await db
      .from("fun_zone_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ success: true, session: data || null });
  } catch (error) {
    console.error("Fun Zone cloud session read error:", error);
    return NextResponse.json(
      { success: false, error: "Data Fun Zone online gagal dibaca." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Backward-compatible save for the existing fun_sessions gameplay table.
    if (!body?.labSession) {
      const {
        sessionId,
        gameTitle,
        gameTheme,
        gameGenre,
        difficulty,
        mood,
        source,
        score,
        livesRemaining,
        totalChallenges,
        completed,
        startedAt,
        finishedAt,
      } = body;

      if (!sessionId || !gameTitle) {
        return NextResponse.json(
          { success: false, error: "Data session tidak lengkap." },
          { status: 400 }
        );
      }

      const db = getDb();
      if (!db) {
        return NextResponse.json(
          { success: false, error: "Environment variable Supabase belum dikonfigurasi." },
          { status: 500 }
        );
      }

      const { data, error } = await db
        .from("fun_sessions")
        .upsert(
          {
            session_id: sessionId,
            game_title: gameTitle,
            game_theme: gameTheme || null,
            game_genre: gameGenre || null,
            difficulty: difficulty || null,
            mood: mood || null,
            source: source || "local",
            score: Number.isFinite(score) ? score : 0,
            lives_remaining: Number.isFinite(livesRemaining) ? livesRemaining : 0,
            total_challenges: Number.isFinite(totalChallenges) ? totalChallenges : 0,
            completed: Boolean(completed),
            started_at: startedAt || new Date().toISOString(),
            finished_at: finishedAt || null,
          },
          { onConflict: "session_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, session: data });
    }

    const userId = await getUserId();
    const db = getDb();

    if (!userId || !db) {
      return NextResponse.json(
        { success: false, error: "Session cloud belum tersedia." },
        { status: 503 }
      );
    }

    const session = body.labSession;

    if (
      !session ||
      typeof session !== "object" ||
      typeof session.id !== "string"
    ) {
      return NextResponse.json(
        { success: false, error: "Data Laboratory session tidak valid." },
        { status: 400 }
      );
    }

    const row = {
      id: session.id,
      user_id: userId,
      prompt: typeof session.prompt === "string" ? session.prompt.slice(0, 3000) : "",
      seed: typeof session.seed === "string" ? session.seed.slice(0, 120) : null,
      status: typeof session.status === "string" ? session.status : "idle",
      stage: typeof session.stage === "string" ? session.stage : "director",
      blueprint: session.blueprint ?? null,
      game_artifact: session.artifact ?? null,
      game_html: typeof body.gameHtml === "string" ? body.gameHtml.slice(0, 400000) : null,
      test_reports: Array.isArray(session.testReports) ? session.testReports : [],
      repair_reports: Array.isArray(session.repairReports) ? session.repairReports : [],
      events: Array.isArray(session.events) ? session.events : [],
      current_attempt: Number.isInteger(session.currentAttempt) ? session.currentAttempt : 0,
      max_repair_attempts: Number.isInteger(session.maxRepairAttempts) ? session.maxRepairAttempts : 5,
      error: typeof session.error === "string" ? session.error.slice(0, 4000) : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from("fun_zone_sessions")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ success: true, session: data });
  } catch (error) {
    console.error("Fun Zone session error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Data Fun Zone online gagal disimpan.",
      },
      { status: 500 }
    );
  }
}
