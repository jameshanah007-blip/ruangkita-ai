import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function getJamesLowMasteryCapabilities(limit = 20) {
  const supabase = db();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("james_capability_mastery")
    .select("capability, mastery, attempts, successes, last_outcome, last_evaluated_at")
    .order("mastery", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error) {
    console.warn("James mastery priority read unavailable:", error.message);
    return [];
  }

  return (data ?? []).map((item) => ({
    capability: String(item.capability),
    mastery: Number(item.mastery ?? 0.5),
    attempts: Number(item.attempts ?? 0),
    successes: Number(item.successes ?? 0),
    lastOutcome: item.last_outcome as string | null,
    lastEvaluatedAt: item.last_evaluated_at as string | null,
  }));
}
