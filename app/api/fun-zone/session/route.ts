import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

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
        {
          success: false,
          error: "Data session tidak lengkap.",
        },
        { status: 400 }
      );
    }

    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const key =
      process.env.SUPABASE_SECRET_KEY;

    if (!url || !key) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Environment variable Supabase belum dikonfigurasi.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);

    const { data, error } = await supabase
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
          score: Number.isFinite(score)
            ? score
            : 0,
          lives_remaining: Number.isFinite(
            livesRemaining
          )
            ? livesRemaining
            : 0,
          total_challenges: Number.isFinite(
            totalChallenges
          )
            ? totalChallenges
            : 0,
          completed: Boolean(completed),
          started_at:
            startedAt || new Date().toISOString(),
          finished_at:
            finishedAt || null,
        },
        {
          onConflict: "session_id",
        }
      )
      .select()
      .single();

    if (error) {
      console.error(
        "Gagal menyimpan Fun Zone session:",
        error.message
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session: data,
    });
  } catch (error) {
    console.error(
      "Fun Zone session error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Terjadi kesalahan saat menyimpan session.",
      },
      { status: 500 }
    );
  }
}