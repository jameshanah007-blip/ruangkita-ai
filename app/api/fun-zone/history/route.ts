import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
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
      .select(
        "session_id,game_title,game_theme,game_genre,difficulty,mood,source,score,lives_remaining,total_challenges,completed,started_at,finished_at"
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(10);

    if (error) {
      console.error(
        "Gagal mengambil riwayat Fun Zone:",
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
      sessions: data || [],
    });
  } catch (error) {
    console.error(
      "Fun Zone history error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Terjadi kesalahan saat mengambil riwayat.",
      },
      { status: 500 }
    );
  }
}