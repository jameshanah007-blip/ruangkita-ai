import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export async function recordJamesKnowledgeFeedback(input: {
  knowledgeId: string;
  knowledgeSource: "consolidation" | "experience";
  task: string;
  outcome: "success" | "failure" | "partial" | "unknown";
  quality: number;
  evidence?: unknown;
}) {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("record_james_knowledge_feedback", {
    p_knowledge_id: input.knowledgeId,
    p_knowledge_source: input.knowledgeSource,
    p_task: input.task,
    p_outcome: input.outcome,
    p_quality: Math.max(0, Math.min(1, input.quality)),
    p_evidence: input.evidence ?? null,
  });

  if (error) {
    console.warn("James knowledge feedback unavailable:", error.message);
    return null;
  }
  return data as string | null;
}
