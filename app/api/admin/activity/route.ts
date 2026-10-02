import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOmantoVerified } from "../../ai/verify-identity/route";

export async function GET(request: Request) {
  if (!isOmantoVerified(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    return NextResponse.json(
      {
        error:
          "Environment variable Supabase belum dikonfigurasi.",
      },
      { status: 500 }
    );
  }

  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("ai_activity_logs")
    .select(
      "id,user_request,intent,tool,result_preview,created_at"
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(50);

  if (error) {
    console.error(
      "Gagal mengambil aktivitas:",
      error.message
    );

    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    activities: data || [],
  });
}