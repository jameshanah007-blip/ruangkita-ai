import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function consolidateJamesMetaLearningPattern(input: {
  patternKey: string;
  attribution: "knowledge" | "retrieval" | "decision_policy" | "mixed" | "insufficient_evidence";
  recovery: string;
  recoverySuccess: boolean;
  confidence?: number;
  evidence?: unknown;
}) {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("consolidate_james_meta_learning_memory", {
    p_pattern_key: input.patternKey,
    p_attribution: input.attribution,
    p_recovery: input.recovery,
    p_recovery_success: input.recoverySuccess,
    p_confidence: input.confidence ?? 0.5,
    p_evidence: input.evidence ?? {},
  });

  if (error) {
    console.warn("James meta-learning memory unavailable:", error.message);
    return null;
  }

  return data;
}

export async function getJamesMetaLearningPattern(patternKey: string) {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("james_meta_learning_memory")
    .select("*")
    .eq("pattern_key", patternKey)
    .maybeSingle();

  if (error) {
    console.warn("James meta-learning memory read unavailable:", error.message);
    return null;
  }

  return data;
}
