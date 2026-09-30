import { createClient } from "@supabase/supabase-js";

export type JamesKnowledgeLifecycleState =
  | "active"
  | "aging"
  | "stale"
  | "revalidating"
  | "trusted"
  | "rejected";

type Event =
  | "created"
  | "aging"
  | "stale"
  | "revalidation_started"
  | "revalidation_success"
  | "revalidation_partial"
  | "revalidation_failure"
  | "reactivate";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function transitionJamesKnowledgeLifecycle(input: {
  knowledgeId: string;
  knowledgeSource: "consolidation" | "experience";
  event: Event;
  confidence?: number;
  reason?: string;
  metadata?: unknown;
}) {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("transition_james_knowledge_lifecycle", {
    p_knowledge_id: input.knowledgeId,
    p_knowledge_source: input.knowledgeSource,
    p_event: input.event,
    p_confidence: input.confidence ?? null,
    p_reason: input.reason ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    console.warn("James knowledge lifecycle unavailable:", error.message);
    return null;
  }

  return data;
}
