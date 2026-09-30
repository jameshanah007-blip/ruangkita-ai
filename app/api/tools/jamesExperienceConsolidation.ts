import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export type JamesConsolidationCandidate = {
  id: string;
  pattern: string;
  strategy: string;
  capabilities: unknown;
  successCount: number;
  failureCount: number;
  confidence: number;
};

export async function getJamesConsolidationCandidates(limit = 50) {
  const supabase = db();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("james_experiences")
    .select("id, pattern, strategy, capabilities, success_count, failure_count, confidence")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) {
    console.warn("James consolidation candidates unavailable:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    pattern: String(row.pattern ?? ""),
    strategy: String(row.strategy ?? ""),
    capabilities: row.capabilities ?? [],
    successCount: Number(row.success_count ?? 0),
    failureCount: Number(row.failure_count ?? 0),
    confidence: Number(row.confidence ?? 0),
  }));
}

export function buildJamesConsolidationGroups(
  experiences: JamesConsolidationCandidate[],
) {
  const groups = new Map<string, JamesConsolidationCandidate[]>();

  for (const experience of experiences) {
    const key = [
      experience.pattern.trim().toLowerCase(),
      experience.strategy.trim().toLowerCase(),
    ].join("::");

    if (!key || key === "::") continue;
    const group = groups.get(key) ?? [];
    group.push(experience);
    groups.set(key, group);
  }

  return [...groups.values()].filter((group) => group.length >= 2);
}

export async function saveJamesConsolidation(
  group: JamesConsolidationCandidate[],
  mergedPattern: string,
  mergedStrategy: string,
  confidence: number,
) {
  const supabase = db();
  if (!supabase || group.length < 2) return null;

  const sourceIds = group.map((item) => item.id);
  const capabilities = [...new Set(
    group.flatMap((item) => Array.isArray(item.capabilities) ? item.capabilities.map(String) : []),
  )];

  const { data, error } = await supabase
    .from("james_experience_consolidations")
    .insert({
      source_experience_ids: sourceIds,
      merged_pattern: mergedPattern.slice(0, 2000),
      merged_strategy: mergedStrategy.slice(0, 2000),
      capabilities,
      confidence: Math.max(0, Math.min(1, confidence)),
      evidence_count: group.reduce((sum, item) => sum + item.successCount + item.failureCount, 0),
      status: "active",
    })
    .select("*")
    .single();

  if (error) {
    console.warn("James consolidation save unavailable:", error.message);
    return null;
  }

  return data;
}
