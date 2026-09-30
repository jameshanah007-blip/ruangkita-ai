import { createClient } from "@supabase/supabase-js";
import type { AIProviderName } from "../../core/ai/aiProvider";
import type { JamesResourceTask } from "./jamesResourceManager";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export type JamesProviderPerformance = {
  provider: AIProviderName;
  task: JamesResourceTask;
  attempts: number;
  successes: number;
  failures: number;
  quality: number;
  averageLatencyMs: number;
  confidence: number;
};

export async function getJamesProviderPerformance(task: JamesResourceTask) {
  const supabase = db();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("james_provider_performance")
    .select("provider, task, attempts, successes, failures, total_quality, total_latency_ms, last_quality, confidence, cooldown_until, last_failure_at, last_success_at, last_failure_kind")
    .eq("task", task);

  if (error || !data) return [];

  return data.map((item) => ({
    provider: item.provider as AIProviderName,
    task: item.task as JamesResourceTask,
    attempts: Number(item.attempts || 0),
    successes: Number(item.successes || 0),
    failures: Number(item.failures || 0),
    quality: Number(item.attempts || 0) > 0
      ? Number(item.total_quality || 0) / Number(item.attempts || 1)
      : Number(item.last_quality || 0.5),
    averageLatencyMs: Number(item.attempts || 0) > 0
      ? Number(item.total_latency_ms || 0) / Number(item.attempts || 1)
      : 0,
    confidence: Number(item.confidence || 0.2),
  }));
}

export function scoreJamesProviderPerformance(
  item: JamesProviderPerformance | undefined,
  fallbackOrder: number,
) {
  if (!item) return 0.35 - fallbackOrder * 0.01;

  const successRate = item.attempts > 0 ? item.successes / item.attempts : 0.5;
  const latencyScore = item.averageLatencyMs > 0
    ? Math.max(0, Math.min(1, 1 - item.averageLatencyMs / 20000))
    : 0.5;

  return (
    item.quality * 0.40 +
    successRate * 0.30 +
    item.confidence * 0.20 +
    latencyScore * 0.10
  );
}

export async function recordJamesProviderPerformance(input: {
  provider: AIProviderName;
  task: JamesResourceTask;
  quality: number;
  verified: boolean;
  latencyMs: number;
}) {
  const supabase = db();
  if (!supabase) return false;

  const { data: existing } = await supabase
    .from("james_provider_performance")
    .select("id, attempts, successes, failures, total_quality, total_latency_ms, cooldown_until")
    .eq("provider", input.provider)
    .eq("task", input.task)
    .maybeSingle();

  const attempts = Number(existing?.attempts || 0) + 1;
  const successes = Number(existing?.successes || 0) + (input.verified ? 1 : 0);
  const failures = Number(existing?.failures || 0) + (input.verified ? 0 : 1);
  const totalQuality = Number(existing?.total_quality || 0) + Math.max(0, Math.min(1, input.quality));
  const totalLatency = Number(existing?.total_latency_ms || 0) + Math.max(0, Math.min(120000, input.latencyMs));
  const empirical = successes / attempts;
  const confidence = Math.min(0.99, 0.20 + Math.min(0.70, attempts / 20));

  const { error } = await supabase
    .from("james_provider_performance")
    .upsert({
      provider: input.provider,
      task: input.task,
      attempts,
      successes,
      failures,
      total_quality: totalQuality,
      total_latency_ms: totalLatency,
      last_quality: Math.max(0, Math.min(1, input.quality)),
      last_latency_ms: Math.round(input.latencyMs),
      confidence: confidence * 0.5 + empirical * 0.5,
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider,task" });

  return !error;
}
\n\nexport type JamesProviderFailureKind =\n  | "quota"\n  | "rate_limit"\n  | "timeout"\n  | "auth"\n  | "server"\n  | "network"\n  | "invalid_output"\n  | "unknown";\n\nexport function classifyJamesProviderFailure(error: unknown): JamesProviderFailureKind {\n  const status = error && typeof error === "object" && "status" in error\n    ? Number((error as { status?: unknown }).status)\n    : undefined;\n  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();\n  if (status === 401 || status === 403 || message.includes("api key") || message.includes("unauthorized")) return "auth";\n  if (status === 429 || message.includes("rate limit") || message.includes("too many requests") || message.includes("tokens per minute")) return "rate_limit";\n  if (message.includes("quota") || message.includes("daily limit") || message.includes("requests per day") || message.includes("free-models-per-day")) return "quota";\n  if (status === 408 || message.includes("timeout") || message.includes("timed out")) return "timeout";\n  if ([500,502,503,504].includes(status ?? -1) || message.includes("temporarily unavailable")) return "server";\n  if (message.includes("network") || message.includes("fetch failed")) return "network";\n  if (message.includes("output") || message.includes("empty") || message.includes("invalid")) return "invalid_output";\n  return "unknown";\n}\n\nfunction cooldownForFailure(kind: JamesProviderFailureKind): number {\n  switch (kind) {\n    case "quota": return 24 * 60 * 60 * 1000;\n    case "rate_limit": return 60 * 60 * 1000;\n    case "auth": return 6 * 60 * 60 * 1000;\n    case "timeout":\n    case "server":\n    case "network": return 5 * 60 * 1000;\n    case "invalid_output": return 2 * 60 * 1000;\n    default: return 60 * 1000;\n  }\n}\n\nexport async function getJamesProviderCooldowns() {\n  const supabase = db();\n  if (!supabase) return new Map<AIProviderName, string>();\n  const { data, error } = await supabase\n    .from("james_provider_performance")\n    .select("provider, cooldown_until")\n    .not("cooldown_until", "is", null);\n  if (error || !data) return new Map<AIProviderName, string>();\n  const now = Date.now();\n  const result = new Map<AIProviderName, string>();\n  for (const row of data) {\n    if (typeof row.cooldown_until !== "string") continue;\n    if (new Date(row.cooldown_until).getTime() > now) {\n      const provider = row.provider as AIProviderName;\n      const current = result.get(provider);\n      if (!current || new Date(row.cooldown_until).getTime() > new Date(current).getTime()) result.set(provider, row.cooldown_until);\n    }\n  }\n  return result;\n}\n\nexport async function recordJamesProviderFailure(input: {\n  provider: AIProviderName;\n  task: JamesResourceTask;\n  error: unknown;\n}) {\n  const supabase = db();\n  if (!supabase) return false;\n  const kind = classifyJamesProviderFailure(input.error);\n  const cooldownUntil = new Date(Date.now() + cooldownForFailure(kind)).toISOString();\n  const now = new Date().toISOString();\n  const { data: existing } = await supabase\n    .from("james_provider_performance")\n    .select("attempts, failures, successes, total_quality, total_latency_ms, confidence")\n    .eq("provider", input.provider)\n    .eq("task", input.task)\n    .maybeSingle();\n  const attempts = Number(existing?.attempts || 0) + 1;\n  const failures = Number(existing?.failures || 0) + 1;\n  const successes = Number(existing?.successes || 0);\n  const { error } = await supabase.from("james_provider_performance").upsert({\n    provider: input.provider, task: input.task, attempts, failures, successes,\n    total_quality: Number(existing?.total_quality || 0),\n    total_latency_ms: Number(existing?.total_latency_ms || 0),\n    last_quality: 0, last_latency_ms: null,\n    confidence: Number(existing?.confidence || 0.2),\n    cooldown_until: cooldownUntil, last_failure_at: now, last_failure_kind: kind,\n    updated_at: now,\n  }, { onConflict: "provider,task" });\n  return !error;\n}\n\nexport async function recordJamesProviderSuccess(input: {\n  provider: AIProviderName;\n  task: JamesResourceTask;\n}) {\n  const supabase = db();\n  if (!supabase) return false;\n  const now = new Date().toISOString();\n  const { error } = await supabase\n    .from("james_provider_performance")\n    .update({ cooldown_until: null, last_success_at: now, last_failure_kind: null, updated_at: now })\n    .eq("provider", input.provider)\n    .eq("task", input.task);\n  return !error;\n}\n