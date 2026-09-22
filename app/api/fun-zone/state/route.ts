import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Environment variable Supabase belum dikonfigurasi."
    );
  }

  return createClient(url, key);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      sessionId,
      gameTitle,
      gameBlueprint,
      gameState,
    } = body;

    if (
      typeof sessionId !== "string" ||
      !sessionId.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "sessionId wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (
      typeof gameTitle !== "string" ||
      !gameTitle.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "gameTitle wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (!gameBlueprint || !gameState) {
      return NextResponse.json(
        {
          success: false,
          error:
            "gameBlueprint dan gameState wajib diisi.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("fun_game_states")
      .upsert(
        {
          session_id: sessionId,
          game_title: gameTitle,
          game_blueprint: gameBlueprint,
          game_state: gameState,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "session_id",
        }
      )
      .select(
        "id,session_id,game_title,created_at,updated_at"
      )
      .single();

    if (error) {
      console.error(
        "Gagal menyimpan Game State:",
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
      state: data,
    });
  } catch (error) {
    console.error(
      "State API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan server.",
      },
      { status: 500 }
    );
  }
}