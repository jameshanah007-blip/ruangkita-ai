import { NextResponse } from "next/server";
import { resolveLegacyUserId } from "../../../auth/cloudIdentity";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Environment variable Supabase belum dikonfigurasi.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const userId = await resolveLegacyUserId();
    if (!userId) return NextResponse.json({ success: false, error: "Session James tidak valid." }, { status: 403 });

    const { sessionId } = await context.params;
    if (!sessionId?.trim()) return NextResponse.json({ success: false, error: "sessionId wajib diisi." }, { status: 400 });

    const ownedSessionId = userId + ":" + sessionId;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("fun_game_states")
      .select("id,session_id,game_title,game_blueprint,game_state,created_at,updated_at")
      .eq("session_id", ownedSessionId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: "Game State tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ success: true, state: data });
  } catch (error) {
    console.error("Get Game State API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan server." }, { status: 500 });
  }
}
