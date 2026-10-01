import { createClient } from "@supabase/supabase-js";

export type JamesStrategyFeedbackInput = {
  strategyId: string;
  experimentId: string;
  attempt: number;
  scenarioKey: string;
  outcome: "success" | "failure" | "partial" | "unknown";
  quality: number;
  evidence?: Record<string, unknown>;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export async function recordJamesStrategyFeedback(input: JamesStrategyFeedbackInput) {
  const client = db();
  if (!client || !input.strategyId || !input.experimentId) return null;
  const attempt = Math.max(0, Math.trunc(input.attempt));
  const sourceEventKey = input.experimentId + ":" + input.strategyId + ":" + String(attempt);
  const { data, error } = await client.from("james_meta_strategy_trials").upsert({
    strategy_id: input.strategyId,
    scenario_key: input.scenarioKey,
    outcome: input.outcome,
    quality: clamp(input.quality),
    evidence: input.evidence ?? {},
    source_event_key: sourceEventKey,
  }, { onConflict: "source_event_key" }).select("id,strategy_id,scenario_key,outcome,quality,evidence,source_event_key,created_at,provenance_id").maybeSingle();
  if (error) throw new Error("Strategy feedback persistence failed: " + error.message);
  return data;
}
