import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function applyJamesConflictResolution(input: {
  conflictId: string;
  winner: "candidate_a" | "candidate_b" | "none";
  outcome: "resolved" | "unresolved" | "verification_failed";
  evidence?: unknown;
}) {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("apply_james_conflict_resolution", {
    p_conflict_id: input.conflictId,
    p_winner: input.winner,
    p_outcome: input.outcome,
    p_evidence: input.evidence ?? {},
  });

  if (error) {
    console.warn("James conflict resolution learning unavailable:", error.message);
    return null;
  }

  return data;
}
