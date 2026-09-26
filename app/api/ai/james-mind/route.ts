import { NextResponse } from "next/server";
import { getGlobalGrowth } from "../../tools/jamesGlobalLearning";
import { getJamesGoals } from "../../tools/jamesGoals";
import { getJamesFeedbackStats } from "../../tools/jamesEvolution";
import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }) : null;
}

export async function GET() {
  try {
    const supabase = db();
    const [globalGrowth, goals, feedbackStats] = await Promise.all([
      getGlobalGrowth(30),
      getJamesGoals(undefined, 20),
      getJamesFeedbackStats(),
    ]);

    let reflections: any[] = [];
    let providerRuns: any[] = [];

    if (supabase) {
      const [reflectionResult, providerResult] = await Promise.all([
        supabase.from("james_reflections").select("id, observation, lesson, confidence, created_at").order("created_at", { ascending: false }).limit(12),
        supabase.from("james_learning_runs").select("id, provider, model, success, created_at").order("created_at", { ascending: false }).limit(20),
      ]);
      reflections = reflectionResult.data || [];
      providerRuns = providerResult.data || [];
    }

    return NextResponse.json({
      core: {
        name: "James",
        friend: "Omanto",
        mission: "Selalu berevolusi menjadi lebih baik, modern, dan mengikuti perkembangan teknologi.",
      },
      globalGrowth,
      goals,
      curiosity: [],
      reflections,
      providerRuns,
      feedbackStats,
    });
  } catch (error) {
    console.error("James Mind error:", error);
    return NextResponse.json({ error: "Gagal memuat James Mind." }, { status: 500 });
  }
}
