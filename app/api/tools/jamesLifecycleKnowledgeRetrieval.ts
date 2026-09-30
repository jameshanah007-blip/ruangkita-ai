import { createClient } from "@supabase/supabase-js";

export type JamesKnowledgeLifecycleState =
  | "active"
  | "aging"
  | "stale"
  | "revalidating"
  | "trusted"
  | "rejected";

export type JamesLifecycleKnowledge = {
  knowledgeId: string;
  knowledgeSource: "consolidation" | "experience";
  state: JamesKnowledgeLifecycleState;
  confidence: number;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function jamesLifecycleRetrievalWeight(state: JamesKnowledgeLifecycleState) {
  switch (state) {
    case "trusted": return 1;
    case "active": return 0.90;
    case "aging": return 0.72;
    case "revalidating": return 0.55;
    case "stale": return 0.35;
    case "rejected": return 0.10;
    default: return 0.50;
  }
}

export async function getJamesKnowledgeLifecycle(
  knowledgeIds: Array<{ id: string; source: "consolidation" | "experience" }>,
) {
  const supabase = db();
  if (!supabase || knowledgeIds.length === 0) return new Map<string, JamesLifecycleKnowledge>();

  const ids = knowledgeIds.map((item) => item.id);
  const { data, error } = await supabase
    .from("james_knowledge_lifecycle")
    .select("knowledge_id,knowledge_source,state,confidence")
    .in("knowledge_id", ids);

  if (error) {
    console.warn("James lifecycle retrieval unavailable:", error.message);
    return new Map();
  }

  const result = new Map<string, JamesLifecycleKnowledge>();
  for (const row of data ?? []) {
    const key = `${row.knowledge_source}:${row.knowledge_id}`;
    result.set(key, {
      knowledgeId: row.knowledge_id,
      knowledgeSource: row.knowledge_source,
      state: row.state,
      confidence: Number(row.confidence ?? 0.5),
    });
  }
  return result;
}

export function rankJamesKnowledgeWithLifecycle(
  baseScore: number,
  state: JamesKnowledgeLifecycleState,
  confidence: number,
) {
  const lifecycleWeight = jamesLifecycleRetrievalWeight(state);
  const confidenceWeight = Math.max(0, Math.min(1, confidence));
  return baseScore * (0.65 + 0.20 * confidenceWeight + 0.15 * lifecycleWeight);
}
