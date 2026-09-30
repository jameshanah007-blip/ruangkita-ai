import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export async function recalibrateJamesKnowledgeConfidence(
  knowledgeId: string,
  knowledgeSource: "consolidation" | "experience",
) {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("recalibrate_james_knowledge_confidence", {
    p_knowledge_id: knowledgeId,
    p_knowledge_source: knowledgeSource,
  });

  if (error) {
    console.warn("James knowledge confidence recalibration unavailable:", error.message);
    return null;
  }

  return data as number | null;
}
