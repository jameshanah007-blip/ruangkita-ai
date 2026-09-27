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
    .select("provider, task, attempts, successes, failures, total_quality, total_latency_ms, last_quality, confidence")
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
    .select("id, attempts, successes, failures, total_quality, total_latency_ms")
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
