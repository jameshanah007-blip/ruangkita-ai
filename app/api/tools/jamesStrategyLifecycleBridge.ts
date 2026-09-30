import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function reconcileJamesMetaStrategyLifecycle(strategyId: string) {
  const supabase = db();
  if (!supabase || !strategyId) return null;

  const { data, error } = await supabase.rpc("promote_retire_james_meta_strategy", {
    p_strategy_id: strategyId,
    p_min_samples: 4,
    p_promote_score: 0.75,
    p_retire_score: 0.35,
  });

  if (error) {
    // The lifecycle RPC is introduced by the strategy lifecycle migration.
    // Keeping this bridge fail-open lets feedback continue to be recorded
    // while older deployments are upgraded.
    console.warn("James strategy lifecycle reconciliation unavailable:", error.message);
    return null;
  }

  return data;
}
