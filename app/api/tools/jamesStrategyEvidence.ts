import { createClient } from "@supabase/supabase-js";

export type JamesStrategyEvidence = {
  strategyId: string;
  taskClass: string;
  trialCount: number;
  successCount: number;
  failureCount: number;
  partialCount: number;
  avgQuality: number;
  outcomeRate: number;
  comparisonCount: number;
  comparisonImprovedCount: number;
  tournamentCount: number;
  tournamentWinCount: number;
  avgTournamentScore: number;
  confidence: number;
  evidenceCount: number;
  evidence: Record<string, unknown>;
  refreshedAt: string;
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

function numberOr(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapRow(row: Record<string, unknown>): JamesStrategyEvidence {
  return {
    strategyId: String(row.strategy_id ?? ""),
    taskClass: String(row.task_class ?? ""),
    trialCount: numberOr(row.trial_count),
    successCount: numberOr(row.success_count),
    failureCount: numberOr(row.failure_count),
    partialCount: numberOr(row.partial_count),
    avgQuality: numberOr(row.avg_quality),
    outcomeRate: numberOr(row.outcome_rate),
    comparisonCount: numberOr(row.comparison_count),
    comparisonImprovedCount: numberOr(row.comparison_improved_count),
    tournamentCount: numberOr(row.tournament_count),
    tournamentWinCount: numberOr(row.tournament_win_count),
    avgTournamentScore: numberOr(row.avg_tournament_score),
    confidence: numberOr(row.confidence),
    evidenceCount: numberOr(row.evidence_count),
    evidence:
      row.evidence && typeof row.evidence === "object"
        ? (row.evidence as Record<string, unknown>)
        : {},
    refreshedAt: String(row.refreshed_at ?? ""),
  };
}

export async function refreshJamesStrategyEvidence(strategyId: string) {
  const client = db();
  if (!client || !strategyId) return null;

  const { data, error } = await client.rpc(
    "refresh_james_meta_strategy_evidence",
    { p_strategy_id: strategyId },
  );

  if (error) {
    console.warn("James strategy evidence refresh failed:", error.message);
    return null;
  }

  return data;
}

export async function refreshAllJamesStrategyEvidence() {
  const client = db();
  if (!client) return 0;

  const { data, error } = await client.rpc(
    "refresh_all_james_meta_strategy_evidence",
  );

  if (error) {
    console.warn("James strategy evidence bulk refresh failed:", error.message);
    return 0;
  }

  return numberOr(data);
}

export async function retrieveJamesStrategyEvidence(
  taskClass: string,
  limit = 10,
): Promise<JamesStrategyEvidence[]> {
  const client = db();
  if (!client || !taskClass) return [];

  const safeLimit = Math.max(1, Math.min(20, Math.trunc(limit)));

  const { data, error } = await client.rpc(
    "retrieve_james_meta_strategy_evidence",
    {
      p_task_class: taskClass,
      p_limit: safeLimit,
    },
  );

  if (error) {
    console.warn("James strategy evidence retrieval failed:", error.message);
    return [];
  }

  return (Array.isArray(data) ? data : []).map(mapRow);
}
