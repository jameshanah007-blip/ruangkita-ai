import { createClient } from "@supabase/supabase-js";
import type { AIProviderName } from "../../fun-zone/aiProvider";
import type { JamesLearningMode } from "./jamesLearningPolicy";
import type { JamesResourceTask } from "./jamesResourceManager";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export type JamesDecisionMemory = {
  task: JamesResourceTask;
  mode: JamesLearningMode | "specialized";
  providers: AIProviderName[];
  reason: string;
  outcome: "success" | "failure" | "partial";
  quality: number;
  verified: boolean;
  evidenceCount: number;
};

export async function getJamesDecisionMemory(task: JamesResourceTask, limit = 12) {
  const supabase = db();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("james_decision_memory")
    .select("task, mode, providers, reason, outcome, quality, verified, evidence_count")
    .eq("task", task)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((item) => ({
    task: item.task as JamesResourceTask,
    mode: item.mode as JamesLearningMode | "specialized",
    providers: Array.isArray(item.providers)
      ? item.providers.filter((provider): provider is AIProviderName =>
          provider === "gemini" || provider === "openai" || provider === "openrouter" || provider === "groq"
        )
      : [],
    reason: typeof item.reason === "string" ? item.reason : "",
    outcome: item.outcome as "success" | "failure" | "partial",
    quality: Number(item.quality || 0.5),
    verified: Boolean(item.verified),
    evidenceCount: Number(item.evidence_count || 0),
  }));
}

export async function recordJamesDecisionMemory(input: JamesDecisionMemory) {
  const supabase = db();
  if (!supabase) return false;

  const { error } = await supabase.from("james_decision_memory").insert({
    task: input.task,
    mode: input.mode,
    providers: input.providers,
    reason: input.reason.slice(0, 700),
    outcome: input.outcome,
    quality: Math.max(0, Math.min(1, input.quality)),
    verified: input.verified,
    evidence_count: Math.max(0, Math.min(50, input.evidenceCount)),
  });

  return !error;
}
