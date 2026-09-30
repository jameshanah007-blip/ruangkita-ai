import { createClient } from "@supabase/supabase-js";

export type JamesDecisionOutcome =
  | "success"
  | "failure"
  | "partial"
  | "unknown";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function recordJamesDecisionOutcome(input: {
  decisionTraceId: string;
  outcome: JamesDecisionOutcome;
  quality?: number;
  expected?: boolean;
  errorType?: string;
  evidence?: unknown;
}) {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("record_james_decision_outcome", {
    p_decision_trace_id: input.decisionTraceId,
    p_outcome: input.outcome,
    p_quality: input.quality ?? 0.5,
    p_expected: input.expected ?? null,
    p_error_type: input.errorType ?? null,
    p_evidence: input.evidence ?? {},
  });

  if (error) {
    console.warn("James decision outcome feedback unavailable:", error.message);
    return null;
  }

  return data as string;
}

export function jamesDecisionOutcomeSignal(
  outcome: JamesDecisionOutcome,
  quality: number,
) {
  const q = Math.max(0, Math.min(1, quality));
  if (outcome === "success") return 0.5 + 0.5 * q;
  if (outcome === "partial") return 0.5 * q;
  if (outcome === "failure") return -(0.5 + 0.5 * (1 - q));
  return 0;
}
