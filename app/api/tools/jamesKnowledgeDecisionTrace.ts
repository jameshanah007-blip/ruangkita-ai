import { createClient } from "@supabase/supabase-js";

export type JamesKnowledgeDecisionOutcome =
  | "selected"
  | "rejected"
  | "verify"
  | "unresolved"
  | "insufficient_evidence";

export type JamesKnowledgeDecisionFactors = {
  relevance?: number;
  confidence?: number;
  freshness?: number;
  lifecycle?: number;
  evidence?: number;
  conflict?: number;
  finalScore?: number;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function buildJamesKnowledgeDecisionExplanation(
  outcome: JamesKnowledgeDecisionOutcome,
  factors: JamesKnowledgeDecisionFactors,
) {
  const parts: string[] = [];
  if (factors.relevance != null) parts.push(`relevance=${factors.relevance.toFixed(2)}`);
  if (factors.confidence != null) parts.push(`confidence=${factors.confidence.toFixed(2)}`);
  if (factors.freshness != null) parts.push(`freshness=${factors.freshness.toFixed(2)}`);
  if (factors.lifecycle != null) parts.push(`lifecycle=${factors.lifecycle.toFixed(2)}`);
  if (factors.evidence != null) parts.push(`evidence=${factors.evidence.toFixed(2)}`);
  if (factors.conflict != null) parts.push(`conflict=${factors.conflict.toFixed(2)}`);
  if (factors.finalScore != null) parts.push(`score=${factors.finalScore.toFixed(2)}`);

  const reason = parts.length ? `Factors: ${parts.join(", ")}.` : "No numeric factors were supplied.";
  return `Knowledge decision: ${outcome}. ${reason}`;
}

export async function recordJamesKnowledgeDecisionTrace(input: {
  task: string;
  selectedKnowledgeId?: string;
  selectedKnowledgeSource?: "consolidation" | "experience";
  decision: JamesKnowledgeDecisionOutcome;
  factors?: JamesKnowledgeDecisionFactors;
  evidenceRefs?: unknown;
  explanation?: string;
}) {
  const supabase = db();
  if (!supabase) return null;

  const factors = input.factors ?? {};
  const explanation =
    input.explanation ?? buildJamesKnowledgeDecisionExplanation(input.decision, factors);

  const { data, error } = await supabase.rpc("record_james_knowledge_decision_trace", {
    p_task: input.task,
    p_selected_knowledge_id: input.selectedKnowledgeId ?? null,
    p_selected_knowledge_source: input.selectedKnowledgeSource ?? null,
    p_decision: input.decision,
    p_factors: factors,
    p_evidence_refs: input.evidenceRefs ?? [],
    p_explanation: explanation,
  });

  if (error) {
    console.warn("James knowledge decision trace unavailable:", error.message);
    return null;
  }

  return data as string;
}
