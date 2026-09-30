import { createClient } from "@supabase/supabase-js";

export type JamesRetrievedKnowledge = {
  source: "consolidation" | "experience";
  id: string;
  pattern: string;
  strategy: string;
  capabilities: unknown;
  confidence: number;
  evidenceCount: number;
  relevance: number;
  score: number;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function tokens(value: string) {
  return new Set(value.toLowerCase().split(/[^a-z0-9_:-]+/).filter((x) => x.length > 2));
}

function relevance(query: string, pattern: string, strategy: string, capabilities: unknown) {
  const q = tokens(query);
  const text = [
    pattern,
    strategy,
    Array.isArray(capabilities) ? capabilities.join(" ") : "",
  ].join(" ");
  const t = tokens(text);
  if (!q.size || !t.size) return 0;
  let hits = 0;
  for (const token of q) if (t.has(token)) hits++;
  return Math.min(1, hits / q.size);
}

export async function retrieveJamesKnowledge(query: string, limit = 8) {
  const supabase = db();
  if (!supabase || !query.trim()) return [];

  const [consolidated, experiences] = await Promise.all([
    supabase.from("james_experience_consolidations")
      .select("id, merged_pattern, merged_strategy, capabilities, confidence, evidence_count")
      .eq("status", "active").limit(100),
    supabase.from("james_experiences")
      .select("id, pattern, strategy, capabilities, confidence, success_count, failure_count")
      .eq("status", "active").limit(100),
  ]);

  const results: JamesRetrievedKnowledge[] = [];

  for (const row of consolidated.data ?? []) {
    const rel = relevance(query, String(row.merged_pattern ?? ""), String(row.merged_strategy ?? ""), row.capabilities);
    if (rel <= 0) continue;
    const confidence = Math.max(0, Math.min(1, Number(row.confidence ?? 0)));
    const evidence = Math.min(1, Number(row.evidence_count ?? 0) / 10);
    results.push({
      source: "consolidation", id: String(row.id),
      pattern: String(row.merged_pattern ?? ""), strategy: String(row.merged_strategy ?? ""),
      capabilities: row.capabilities ?? [], confidence, evidenceCount: Number(row.evidence_count ?? 0),
      relevance: rel, score: rel * 0.55 + confidence * 0.30 + evidence * 0.15,
    });
  }

  for (const row of experiences.data ?? []) {
    const rel = relevance(query, String(row.pattern ?? ""), String(row.strategy ?? ""), row.capabilities);
    if (rel <= 0) continue;
    const confidence = Math.max(0, Math.min(1, Number(row.confidence ?? 0)));
    const evidenceCount = Number(row.success_count ?? 0) + Number(row.failure_count ?? 0);
    const evidence = Math.min(1, evidenceCount / 10);
    results.push({
      source: "experience", id: String(row.id),
      pattern: String(row.pattern ?? ""), strategy: String(row.strategy ?? ""),
      capabilities: row.capabilities ?? [], confidence, evidenceCount,
      relevance: rel, score: rel * 0.55 + confidence * 0.30 + evidence * 0.15,
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, Math.min(Math.max(limit, 1), 20));
}

export function formatJamesKnowledgeContext(items: JamesRetrievedKnowledge[]) {
  if (!items.length) return "No verified James knowledge was retrieved for this task.";
  return items.map((item, index) =>
    `[${index + 1}] source=${item.source}; score=${item.score.toFixed(3)}; confidence=${item.confidence.toFixed(2)}; evidence=${item.evidenceCount}
pattern: ${item.pattern}
strategy: ${item.strategy}`
  ).join("\n\n");
}
