import { createClient } from "@supabase/supabase-js";

export type JamesGoal = {
  id?: string;
  user_id?: string | null;
  goal: string;
  reason: string;
  progress: number;
  status: "active" | "paused" | "completed" | "dismissed";
  evidence: string;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

function db() {
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clamp(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

export async function getJamesGoals(userId?: string, limit = 8) {
  const supabase = db();
  if (!supabase) return [];

  let query = supabase
    .from("james_goals")
    .select("id, user_id, goal, reason, progress, status, evidence, updated_at")
    .eq("status", "active")
    .order("progress", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 20));

  query = userId ? query.or(`user_id.is.null,user_id.eq.${userId}`) : query.is("user_id", null);

  const { data, error } = await query;
  if (error) {
    console.error("James goals read error:", error.message);
    return [];
  }
  return data || [];
}

export async function saveJamesGoal(goal: JamesGoal) {
  const supabase = db();
  if (!supabase || !clean(goal.goal)) return null;

  const row = {
    user_id: goal.user_id || null,
    goal: clean(goal.goal),
    reason: clean(goal.reason, 400),
    progress: clamp(goal.progress),
    status: goal.status || "active",
    evidence: clean(goal.evidence, 500),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("james_goals")
    .insert(row)
    .select("id, goal, reason, progress, status, evidence")
    .maybeSingle();

  if (error) {
    console.error("James goal save error:", error.message);
    return null;
  }
  return data;
}

export async function saveProviderCapabilities(
  observations: Array<{ provider: "gemini" | "openrouter" | "groq"; model: string; capability: Record<string, unknown>; source: string }>
) {
  const supabase = db();
  if (!supabase || !observations.length) return;

  const rows = observations.slice(0, 9).map((item) => ({
    provider: item.provider,
    model: clean(item.model, 120),
    capability: item.capability,
    source: clean(item.source, 300),
  }));

  const { error } = await supabase.from("james_provider_capabilities").insert(rows);
  if (error) console.error("James provider capability save error:", error.message);
}
