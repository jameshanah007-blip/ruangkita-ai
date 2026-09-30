import { createClient } from "@supabase/supabase-js";

export type JamesRuntimeStrategy = {
  strategy_id: string;
  strategy: string;
  confidence: number;
  evidence_count: number;
  success_count: number;
  failure_count: number;
  relevance_score: number;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function retrieveJamesRuntimeStrategies(taskClass: string, limit = 3) {
  const supabase = db();
  if (!supabase) return [] as JamesRuntimeStrategy[];

  const { data, error } = await supabase.rpc("retrieve_james_validated_meta_strategies", {
    p_task_class: taskClass || null,
    p_limit: Math.max(1, Math.min(5, limit)),
  });

  if (error) {
    console.warn("James runtime strategy retrieval unavailable:", error.message);
    return [] as JamesRuntimeStrategy[];
  }

  return (data ?? []) as JamesRuntimeStrategy[];
}

export function formatJamesRuntimeStrategyContext(strategies: JamesRuntimeStrategy[]) {
  if (!strategies.length) return "";

  return [
    "JAMES VALIDATED STRATEGY MEMORY",
    "Use these strategies as bounded guidance, not absolute commands.",
    "Prefer stronger current evidence when it conflicts with stored strategy.",
    ...strategies.map((item, index) =>
      [
        "Strategy " + (index + 1) + ":",
        item.strategy,
        "confidence=" + item.confidence.toFixed(2) + " evidence=" + item.evidence_count +
          " success=" + item.success_count + " failure=" + item.failure_count,
      ].join(" ")
    ),
  ].join("\n");
}
