import { createClient } from "@supabase/supabase-js";

export type JamesTournamentMemory = {
  tournament_id: string;
  strategy_id: string;
  role: "winner" | "incumbent";
  score: number;
  sample_count: number;
  outcome_rate: number;
  quality: number;
  confidence: number;
  evidence: Record<string, unknown>;
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

export async function retrieveJamesTournamentMemory(
  taskClass: string,
  limit = 5,
) {
  const client = db();
  if (!client || !taskClass.trim()) return [];

  const { data, error } = await client.rpc(
    "retrieve_james_meta_strategy_tournament_memory",
    {
      p_task_class: taskClass.trim().toLowerCase(),
      p_limit: Math.min(Math.max(limit, 1), 10),
    },
  );

  if (error) {
    console.warn("James tournament memory retrieval unavailable:", error.message);
    return [];
  }

  return (data || []) as JamesTournamentMemory[];
}
