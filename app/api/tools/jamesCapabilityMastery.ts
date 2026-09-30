import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function updateJamesCapabilityMastery(
  capability: string,
  outcome: "success" | "failure" | "partial",
  quality: number,
  evidence: unknown,
) {
  const supabase = db();
  if (!supabase || !capability.trim()) return null;

  const { data, error } = await supabase.rpc("update_james_capability_mastery", {
    p_capability: capability.trim().slice(0, 200),
    p_outcome: outcome,
    p_quality: Math.max(0, Math.min(1, quality)),
    p_evidence: evidence ?? null,
  });

  if (error) {
    console.warn("James capability mastery update unavailable:", error.message);
    return null;
  }
  return data;
}

export async function getJamesCapabilityMastery(limit = 30) {
  const supabase = db();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("james_capability_mastery")
    .select("capability, mastery, attempts, successes, last_evaluated_at, last_outcome")
    .order("mastery", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) {
    console.warn("James capability mastery read unavailable:", error.message);
    return [];
  }
  return data ?? [];
}
