export type JamesKnowledgeCandidate = {
  strategy: string;
  confidence: number;
  successCount: number;
  failureCount: number;
  evidenceCount: number;
  createdAt?: string | null;
};

export type JamesKnowledgeResolution = {
  selected: "a" | "b" | "unresolved";
  scoreA: number;
  scoreB: number;
  reason: string;
};

function score(candidate: JamesKnowledgeCandidate) {
  const total = candidate.successCount + candidate.failureCount;
  const successRate = total > 0 ? candidate.successCount / total : 0.5;
  const evidence = Math.min(1, candidate.evidenceCount / 10);
  const confidence = Math.max(0, Math.min(1, candidate.confidence));
  const recency = candidate.createdAt
    ? Math.max(0, Math.min(1, 1 - (Date.now() - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : 0.5;
  return confidence * 0.45 + successRate * 0.35 + evidence * 0.15 + recency * 0.05;
}

export function resolveJamesKnowledgeConflict(a: JamesKnowledgeCandidate, b: JamesKnowledgeCandidate): JamesKnowledgeResolution {
  const scoreA = score(a);
  const scoreB = score(b);
  const difference = Math.abs(scoreA - scoreB);

  if (difference < 0.08) {
    return {
      selected: "unresolved",
      scoreA,
      scoreB,
      reason: "Evidence is too close to safely prefer one strategy; preserve both and request contextual verification.",
    };
  }

  const selected = scoreA > scoreB ? "a" : "b";
  return {
    selected,
    scoreA,
    scoreB,
    reason: "Selected using confidence, observed success rate, evidence volume, and limited recency weighting.",
  };
}
