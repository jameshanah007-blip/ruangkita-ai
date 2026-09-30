import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export type JamesRecoveryState = {
  capability: string;
  baselineMastery: number;
  targetMastery: number;
  status: "pending" | "verifying" | "recovered" | "failed";
  attempts: number;
  lastTaskId: string | null;
  lastEvidence: unknown;
};

export async function beginJamesCapabilityRecovery(capability: string, baselineMastery: number, taskId?: string | null) {
  const supabase = db();
  if (!supabase || !capability.trim()) return null;
  const { data, error } = await supabase.rpc("begin_james_capability_recovery", {
    p_capability: capability.trim().slice(0, 200),
    p_baseline_mastery: Math.max(0, Math.min(1, baselineMastery)),
    p_task_id: taskId ?? null,
  });
  if (error) {
    console.warn("James recovery state unavailable:", error.message);
    return null;
  }
  return data as JamesRecoveryState | null;
}

export async function verifyJamesCapabilityRecovery(capability: string, newMastery: number, evidence: unknown) {
  const supabase = db();
  if (!supabase || !capability.trim()) return null;
  const { data, error } = await supabase.rpc("verify_james_capability_recovery", {
    p_capability: capability.trim().slice(0, 200),
    p_new_mastery: Math.max(0, Math.min(1, newMastery)),
    p_evidence: evidence ?? null,
  });
  if (error) {
    console.warn("James recovery verification unavailable:", error.message);
    return null;
  }
  return data as JamesRecoveryState | null;
}
