import { createClient } from "@supabase/supabase-js";

export type JamesKnowledgeProvenanceEvent =
  | "created"
  | "feedback"
  | "recalibrated"
  | "aged"
  | "revalidated"
  | "conflict_detected"
  | "conflict_resolved"
  | "rejected"
  | "promoted";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function recordJamesKnowledgeProvenance(input: {
  knowledgeId: string;
  knowledgeSource: "consolidation" | "experience";
  eventType: JamesKnowledgeProvenanceEvent;
  sourceId?: string;
  sourceType?: string;
  parentKnowledgeId?: string;
  parentKnowledgeSource?: "consolidation" | "experience";
  confidenceBefore?: number;
  confidenceAfter?: number;
  evidence?: unknown;
  metadata?: unknown;
}) {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("record_james_knowledge_provenance", {
    p_knowledge_id: input.knowledgeId,
    p_knowledge_source: input.knowledgeSource,
    p_event_type: input.eventType,
    p_source_id: input.sourceId ?? null,
    p_source_type: input.sourceType ?? null,
    p_parent_knowledge_id: input.parentKnowledgeId ?? null,
    p_parent_knowledge_source: input.parentKnowledgeSource ?? null,
    p_confidence_before: input.confidenceBefore ?? null,
    p_confidence_after: input.confidenceAfter ?? null,
    p_evidence: input.evidence ?? {},
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    console.warn("James knowledge provenance unavailable:", error.message);
    return null;
  }

  return data as string;
}

export async function getJamesKnowledgeProvenance(
  knowledgeId: string,
  knowledgeSource: "consolidation" | "experience",
  limit = 50,
) {
  const supabase = db();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("james_knowledge_provenance")
    .select("*")
    .eq("knowledge_id", knowledgeId)
    .eq("knowledge_source", knowledgeSource)
    .order("created_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));

  if (error) {
    console.warn("James knowledge provenance read unavailable:", error.message);
    return [];
  }

  return data ?? [];
}
