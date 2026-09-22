import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    return NextResponse.json({
      success: false,
      error: "Environment variable Supabase belum terbaca.",
      hasUrl: Boolean(url),
      hasKey: Boolean(key),
    });
  }

  const supabase = createClient(url, key);

  const { error } = await supabase
    .from("ai_activity_logs")
    .insert({
      user_request: "TEST KONEKSI SUPABASE",
      intent: "test",
      tool: "supabase",
      result_preview: "Koneksi berhasil",
    });

  if (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }

  return NextResponse.json({
    success: true,
    message: "Koneksi Supabase berhasil.",
  });
}