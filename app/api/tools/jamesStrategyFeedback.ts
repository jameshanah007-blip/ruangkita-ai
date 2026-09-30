import { createClient } from "@supabase/supabase-js";

export type JamesStrategyFeedbackInput = {
  strategyId: string;
  experimentId: string;
  attempt: number;
  scenarioKey: string;
  outcome: "success" | "failure" | "partial" | "unknown";
  quality: number;
  evidence?: Record<string, unknown>;
  sourceEventKey?: string;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5));
}

/**
 * Records one strategy outcome as durable evidence.
 *
 * This function deliberately does not promote, retire, or otherwise decide
 * lifecycle state. It only writes an idempotent trial. Lifecycle reconciliation
 * remains the downstream authority.
 */
export async function recordJamesStrategyFeedback(
  input: JamesStrategyFeedbackInput,
) {
  const client = db();
  if (!client || !input.strategyId || !input.experimentId) return null;

  const sourceEventKey =
    input.sourceEventKey ||
    `strategy-feedback:${input.strategyId}:experiment:${input.experimentId}:attempt:${input.attempt}`;

  const evidence = {
    ...(input.evidence || {}),
    sourceEventKey,
    strategyId: input.strategyId,
    experimentId: input.experimentId,
    attempt: input.attempt,
    recordedAt: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("james_meta_strategy_trials")
    .upsert(
      {
        strategy_id: input.strategyId,
        scenario_key: input.scenarioKey,
        outcome: input.outcome,
        quality: clamp(input.quality),
        evidence,
        source_event_key: sourceEventKey,
      },
      {
        onConflict: "source_event_key",
        ignoreDuplicates: false,
      },
    )
    .select("id,strategy_id,scenario_key,outcome,quality,source_event_key")
    .maybeSingle();

  if (error) {
    console.warn("James strategy feedback persistence failed:", error.message);
    return null;
  }

  return {
    ...data,
    sourceEventKey,
    idempotentKey: sourceEventKey,
  };
}
