import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function authorized(request: NextRequest) {
  const expected = process.env.JAMES_LEARNING_SECRET || process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const limit = Math.min(20, Math.max(1, Number(new URL(request.url).searchParams.get("limit") || "10")));
  const { data, error } = await supabase.rpc("enqueue_stale_james_knowledge_revalidation", { p_limit: limit });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ queued: Number(data || 0), limit });
}