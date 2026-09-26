import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

function db() {
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function clean(value: unknown, max = 400) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function getGlobalGrowth(limit = 30) {
  const supabase = db();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("james_global_growth")
    .select("id, category, key, value, rationale, evidence_count, consensus_score, status, version")
    .eq("status", "active")
    .order("consensus_score", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) return [];
  return data || [];
}

export async function getGlobalCandidates(limit = 20) {
  const supabase = db();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("james_global_growth")
    .select("id, category, key, value, rationale, evidence_count, consensus_score, status, version")
    .eq("status", "candidate")
    .order("evidence_count", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 30));
  if (error) return [];
  return data || [];
}

export async function addGlobalCandidate(input: {
  category: string;
  key: string;
  value: string;
  rationale: string;
  evidenceCount: number;
}) {
  const supabase = db();
  if (!supabase) return null;

  const category = clean(input.category, 60);
  const key = clean(input.key, 80);
  const value = clean(input.value, 240);

  const { data: existing } = await supabase
    .from("james_global_growth")
    .select("id, evidence_count, status")
    .eq("category", category)
    .eq("key", key)
    .eq("value", value)
    .maybeSingle();

  // Evidence represents distinct provider support, not repeated cron executions.
  // Never inflate the count merely because the same candidate is seen again.
  const nextEvidence = Math.max(
    1,
    Math.min(
      Math.max(existing?.evidence_count || 0, Math.max(1, input.evidenceCount)),
      1000000
    )
  );

  const row = {
    category,
    key,
    value,
    rationale: clean(input.rationale),
    evidence_count: nextEvidence,
    status: existing?.status === "active" ? "active" : "candidate",
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from("james_global_growth")
      .update({
        rationale: row.rationale,
        evidence_count: row.evidence_count,
        status: row.status,
        updated_at: row.updated_at,
      })
      .eq("id", existing.id)
      .select("id, category, key, value, rationale, evidence_count, status")
      .maybeSingle();

    if (error) return null;
    return data;
  }

  const { data, error } = await supabase
    .from("james_global_growth")
    .insert(row)
    .select("id, category, key, value, rationale, evidence_count, status")
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function recordGlobalDecision(input: {
  candidateId: string;
  provider: string;
  decision: string;
  confidence: number;
  rationale: string;
}) {
  const supabase = db();
  if (!supabase) return;

  const decision = {
    candidate_id: input.candidateId,
    provider: input.provider,
    decision: input.decision,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    rationale: clean(input.rationale),
  };

  // One current validation decision per candidate/provider keeps the
  // autonomous learning loop idempotent across repeated cron runs.
  const { data: existing } = await supabase
    .from("james_global_learning_runs")
    .select("id")
    .eq("candidate_id", input.candidateId)
    .eq("provider", input.provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("james_global_learning_runs")
      .update({
        decision: decision.decision,
        confidence: decision.confidence,
        rationale: decision.rationale,
        created_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("james_global_learning_runs").insert(decision);
}

export async function activateGlobalCandidate(
  candidateId: string,
  consensusScore: number,
  rationale: string,
) {
  const supabase = db();
  if (!supabase) return false;
  const { error } = await supabase
    .from("james_global_growth")
    .update({
      status: "active",
      consensus_score: Math.max(0, Math.min(1, consensusScore)),
      rationale: clean(rationale),
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidateId);
  return !error;
}


