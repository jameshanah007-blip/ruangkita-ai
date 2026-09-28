import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const USER_COOKIE = "ruangkita-session-user";

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function getUserId() {
  const store = await cookies();
  const value = store.get(USER_COOKIE)?.value;
  return typeof value === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$/.test(value)
    ? value
    : null;
}

function encodeLabState(session: Record<string, unknown>, gameHtml?: string) {
  return "lab:" + JSON.stringify({
    session,
    gameHtml: typeof gameHtml === "string" ? gameHtml : "",
  });
}

function decodeLabState(source: unknown) {
  if (typeof source !== "string" || !source.startsWith("lab:")) return null;
  try {
    const parsed = JSON.parse(source.slice(4));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const userId = await getUserId();
    const db = getDb();

    if (!userId || !db) return NextResponse.json({ success: true, session: null });

    const { data, error } = await db
      .from("fun_sessions")
      .select("*")
      .like("session_id", userId + ":%")
      .like("source", "lab:%")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const decoded = decodeLabState(data?.source);
    let gameHtml = decoded?.gameHtml || "";

    if (!gameHtml && data?.game_html_path) {
      const downloaded = await db.storage
        .from("fun-zone-games")
        .download(data.game_html_path);

      if (!downloaded.error && downloaded.data) {
        gameHtml = await downloaded.data.text();
      }
    }

    return NextResponse.json({
      success: true,
      session: decoded,
      gameHtml,
      gameHtmlPath: data?.game_html_path || null,
    });
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
    const db = getDb();

    // Existing gameplay session persistence remains unchanged.
    if (!body?.labSession) {
      const {
        sessionId, gameTitle, gameTheme, gameGenre, difficulty, mood,
        source, score, livesRemaining, totalChallenges, completed,
        startedAt, finishedAt,
      } = body;

      if (!sessionId || !gameTitle || !db) {
        return NextResponse.json(
          { success: false, error: "Data session tidak lengkap." },
          { status: 400 }
        );
      }

      const { data, error } = await db
        .from("fun_sessions")
        .upsert({
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
        }, { onConflict: "session_id" })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, session: data });
    }

    if (!db) {
      return NextResponse.json(
        { success: false, error: "Supabase belum dikonfigurasi." },
        { status: 503 }
      );
    }

    const userId = await getUserId();
    const session = body.labSession;

    if (!userId || !session || typeof session.id !== "string") {
      return NextResponse.json(
        { success: false, error: "Session Laboratory tidak valid." },
        { status: 400 }
      );
    }

    const payload = encodeLabState(session);

    // Laboratory sessions use a dedicated composite session key so they
    // cannot overwrite the user's normal gameplay session.
    const laboratorySessionId = userId + ":" + session.id;

    const { data, error } = await db
      .from("fun_sessions")
      .upsert({
        session_id: laboratorySessionId,
        game_title: session?.artifact?.title || session?.blueprint?.title || "AI Game Laboratory",
        game_theme: session?.blueprint?.theme || null,
        game_genre: session?.blueprint?.genre || null,
        difficulty: session?.blueprint?.difficulty || null,
        mood: session?.blueprint?.mood || null,
        source: payload,
        score: 0,
        lives_remaining: 0,
        total_challenges: 0,
        completed: session.status === "ready",
        started_at: session.createdAt || new Date().toISOString(),
        finished_at: new Date().toISOString(),
      }, { onConflict: "session_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      session: decodeLabState(data?.source),
    });
  } catch (error) {
    console.error("Fun Zone session error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Data Fun Zone online gagal disimpan.",
      },
      { status: 500 }
    );
  }
}
