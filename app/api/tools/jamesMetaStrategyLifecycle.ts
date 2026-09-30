import { createClient } from "@supabase/supabase-js";

export type JamesMetaStrategyLifecycleResult = {
  reconciled: boolean;
  changed?: boolean;
  strategyId?: string;
  previousStatus?: "candidate" | "active" | "retired";
  status?: "candidate" | "active" | "retired";
  score?: number;
  evidenceCount?: number;
  confidence?: number;
  reason?: string;
  eventId?: string | null;
  idempotent?: boolean;
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

export async function reconcileJamesMetaStrategyLifecycle(
  strategyId: string,
  options?: {
    minSamples?: number;
    promoteScore?: number;
    retireScore?: number;
  },
): Promise<JamesMetaStrategyLifecycleResult | null> {
  const client = db();
  if (!client || !strategyId) return null;

  const { data, error } = await client.rpc(
    "reconcile_james_meta_strategy_lifecycle",
    {
      p_strategy_id: strategyId,
      p_min_samples: options?.minSamples ?? 4,
      p_promote_score: options?.promoteScore ?? 0.75,
      p_retire_score: options?.retireScore ?? 0.35,
    },
  );

  if (error) {
    console.warn("James lifecycle reconciliation failed:", error.message);
    return null;
  }

  return data as JamesMetaStrategyLifecycleResult;
}

export async function reconcileAllJamesMetaStrategyLifecycle(
  options?: {
    minSamples?: number;
    promoteScore?: number;
    retireScore?: number;
  },
) {
  const client = db();
  if (!client) return 0;

  const { data, error } = await client.rpc(
    "reconcile_all_james_meta_strategy_lifecycle",
    {
      p_min_samples: options?.minSamples ?? 4,
      p_promote_score: options?.promoteScore ?? 0.75,
      p_retire_score: options?.retireScore ?? 0.35,
    },
  );

  if (error) {
    console.warn("James lifecycle bulk reconciliation failed:", error.message);
    return 0;
  }

  const count = Number(data);
  return Number.isFinite(count) ? count : 0;
}
