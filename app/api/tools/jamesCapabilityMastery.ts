import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function updateJamesCapabilityMastery(capability: string, outcome: "success" | "failure" | "partial", quality: number, evidence: unknown) {
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

export async function getJamesLowMasteryCapabilities(limit = 20) {
  const supabase = db();
  if (!supabase) return [];
  const { data, error } = await supabase.from("james_capability_mastery")
    .select("capability, mastery, attempts, successes, last_outcome, last_evaluated_at")
    .order("mastery", { ascending: true }).limit(Math.min(Math.max(limit, 1), 50));
  if (error) return [];
  return (data ?? []).map((item) => ({
    capability: String(item.capability), mastery: Number(item.mastery ?? 0.5),
    attempts: Number(item.attempts ?? 0), successes: Number(item.successes ?? 0),
    lastOutcome: item.last_outcome as string | null, lastEvaluatedAt: item.last_evaluated_at as string | null,
  }));
}

export async function getJamesMasteryHistory(capability: string, limit = 20) {
  const supabase = db();
  if (!supabase || !capability.trim()) return [];
  const { data, error } = await supabase.from("james_capability_mastery_history")
    .select("capability, previous_mastery, new_mastery, delta, outcome, quality, evidence, regression, created_at")
    .eq("capability", capability.trim()).order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) return [];
  return data ?? [];
}

export async function getJamesRecentRegressions(limit = 20) {
  const supabase = db();
  if (!supabase) return [];
  const { data, error } = await supabase.from("james_capability_mastery_history")
    .select("capability, previous_mastery, new_mastery, delta, outcome, quality, evidence, created_at")
    .eq("regression", true).order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) return [];
  return data ?? [];
}

export async function enqueueJamesRegressionRecovery(
  capability: string,
  reason: string,
  evidence: unknown,
) {
  const supabase = db();
  if (!supabase || !capability.trim()) return null;
  const { data, error } = await supabase.rpc("enqueue_james_regression_recovery", {
    p_capability: capability.trim().slice(0, 500),
    p_reason: reason.slice(0, 700),
    p_evidence: evidence ?? null,
  });
  if (error) {
    console.warn("James regression recovery enqueue unavailable:", error.message);
    return null;
  }
  return data as string | null;
}
