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

  const row = {
    category: clean(input.category, 60),
    key: clean(input.key, 80),
    value: clean(input.value, 240),
    rationale: clean(input.rationale),
    evidence_count: Math.max(1, Math.min(input.evidenceCount, 1000000)),
    status: "candidate",
    updated_at: new Date().toISOString(),
  };

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
  await supabase.from("james_global_learning_runs").insert({
    candidate_id: input.candidateId,
    provider: input.provider,
    decision: input.decision,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    rationale: clean(input.rationale),
  });
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
