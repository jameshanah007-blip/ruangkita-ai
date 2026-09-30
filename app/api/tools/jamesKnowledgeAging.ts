import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export async function getJamesKnowledgeFreshness(
  knowledgeId: string,
  knowledgeSource: "consolidation" | "experience",
) {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_james_knowledge_freshness", {
    p_knowledge_id: knowledgeId,
    p_knowledge_source: knowledgeSource,
  });

  if (error) {
    console.warn("James knowledge freshness unavailable:", error.message);
    return null;
  }

  return data as {
    validatedAt: string;
    createdAt: string;
    ageDays: number;
    staleAfterDays: number;
    stale: boolean;
  } | null;
}

export function jamesKnowledgeFreshnessWeight(ageDays: number, staleAfterDays: number) {
  const age = Math.max(0, ageDays);
  const threshold = Math.max(1, staleAfterDays);
  if (age >= threshold) return 0.25;
  return Math.max(0.25, 1 - age / (threshold * 1.5));
}
