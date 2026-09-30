import { createClient } from "@supabase/supabase-js";

export type JamesKnowledgeDecision =
  | "candidate_a"
  | "candidate_b"
  | "unresolved"
  | "verify";

export type JamesKnowledgeDecisionCandidate = {
  knowledgeId: string;
  knowledgeSource: "consolidation" | "experience";
  confidence: number;
  evidenceCount: number;
  successRate: number;
  freshnessWeight: number;
  lifecycleWeight: number;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function scoreJamesKnowledgeDecision(candidate: JamesKnowledgeDecisionCandidate) {
  return (
    candidate.confidence * 0.40 +
    candidate.successRate * 0.25 +
    Math.min(1, candidate.evidenceCount / 10) * 0.10 +
    candidate.freshnessWeight * 0.10 +
    candidate.lifecycleWeight * 0.15
  );
}

export async function recordJamesKnowledgeConflict(input: {
  capability: string;
  contextKey: string;
  candidateA: JamesKnowledgeDecisionCandidate;
  candidateB: JamesKnowledgeDecisionCandidate;
}) {
  const supabase = db();
  if (!supabase) return null;

  const scoreA = scoreJamesKnowledgeDecision(input.candidateA);
  const scoreB = scoreJamesKnowledgeDecision(input.candidateB);

  const { data, error } = await supabase.rpc("record_james_knowledge_conflict", {
    p_capability: input.capability,
    p_context_key: input.contextKey,
    p_candidate_a: input.candidateA,
    p_candidate_b: input.candidateB,
    p_score_a: scoreA,
    p_score_b: scoreB,
  });

  if (error) {
    console.warn("James knowledge conflict decision unavailable:", error.message);
    return null;
  }

  return { ...(data ?? {}), scoreA, scoreB };
}
