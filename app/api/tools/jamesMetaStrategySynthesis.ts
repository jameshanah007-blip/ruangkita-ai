import { createClient } from "@supabase/supabase-js";

export type JamesMetaStrategyCandidate = {
  patternKey: string;
  attribution: string;
  recommendedRecovery: string;
  confidence: number;
  occurrences: number;
  recoverySuccessRate: number;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function synthesizeJamesMetaStrategy(
  taskClass: string,
  candidates: JamesMetaStrategyCandidate[],
) {
  const usable = candidates
    .filter((candidate) => candidate.occurrences >= 2)
    .filter((candidate) => candidate.recoverySuccessRate >= 0.6)
    .sort((a, b) => b.confidence - a.confidence);

  if (usable.length === 0) return null;

  const steps = usable.slice(0, 5).map(
    (candidate, index) =>
      `${index + 1}. If attribution is ${candidate.attribution}, prefer ${candidate.recommendedRecovery}.`,
  );

  const confidence =
    usable.reduce((sum, candidate) => sum + candidate.confidence, 0) / usable.length;

  return {
    strategyKey: `meta:${taskClass}:${usable.map((candidate) => candidate.patternKey).sort().join("|")}`,
    taskClass,
    strategy: steps.join(" "),
    sourcePatterns: usable.map((candidate) => candidate.patternKey),
    confidence: Math.max(0.5, Math.min(0.9, confidence)),
  };
}

export async function saveJamesMetaStrategy(input: {
  strategyKey: string;
  taskClass: string;
  strategy: string;
  sourcePatterns: string[];
  confidence: number;
}) {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("synthesize_james_meta_strategy", {
    p_strategy_key: input.strategyKey,
    p_task_class: input.taskClass,
    p_strategy: input.strategy,
    p_source_patterns: input.sourcePatterns,
    p_confidence: input.confidence,
  });

  if (error) {
    console.warn("James meta-strategy synthesis unavailable:", error.message);
    return null;
  }

  return data as string;
}
