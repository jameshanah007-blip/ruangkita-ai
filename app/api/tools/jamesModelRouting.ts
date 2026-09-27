import { createClient } from "@supabase/supabase-js";
import type { AIGenerateRequest, AIProviderName } from "../../fun-zone/aiProvider";

type Candidate = {
  id: string;
  provider: "openai" | "groq";
  candidate_model: string;
  status: "experimental" | "eligible" | "active" | "rejected" | "failed";
  routing_weight: number;
  canary_attempts: number;
  canary_successes: number;
  canary_quality: number;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

function heuristicQuality(text: string) {
  if (!text.trim()) return 0;
  const length = Math.min(1, text.length / 300);
  const structure = /[.!?]/.test(text) ? 0.25 : 0;
  return Math.min(1, length * 0.75 + structure);
}

async function invoke(candidate: Candidate, request: AIGenerateRequest) {
  const key = candidate.provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GROQ_API_KEY;
  if (!key) throw new Error(candidate.provider.toUpperCase() + "_API_KEY belum dikonfigurasi.");

  const response = await fetch(
    candidate.provider === "openai"
      ? "https://api.openai.com/v1/responses"
      : "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(
        candidate.provider === "openai"
          ? { model: candidate.candidate_model, instructions: request.systemInstruction, input: request.prompt, max_output_tokens: request.maxOutputTokens ?? 4000 }
          : { model: candidate.candidate_model, messages: [{ role: "system", content: request.systemInstruction }, { role: "user", content: request.prompt }], max_tokens: request.maxOutputTokens ?? 4000 }
      ),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Candidate model failed.");

  const text = candidate.provider === "openai"
    ? String(data?.output_text || "")
    : String(data?.choices?.[0]?.message?.content || "");

  return { text, model: candidate.candidate_model, provider: candidate.provider as AIProviderName };
}

export async function tryJamesCandidateCanary(input: {
  userId: string;
  task: string;
  request: AIGenerateRequest;
}) {
  const client = db();
  if (!client) return null;

  const { data } = await client
    .from("james_model_registry")
    .select("id, provider, candidate_model, status, routing_weight, canary_attempts, canary_successes, canary_quality")
    .eq("user_id", input.userId)
    .in("status", ["eligible", "active"])
    .gt("routing_weight", 0)
    .order("routing_weight", { ascending: false })
    .limit(5);

  const candidates = (data || []) as Candidate[];
  if (!candidates.length) return null;

  // Small bounded canary: adapted models never replace the four primary providers.
  const selected = candidates.find((candidate) => Math.random() < Math.min(candidate.routing_weight, 0.20));
  if (!selected) return null;

  try {
    const started = Date.now();
    const result = await invoke(selected, input.request);
    const quality = heuristicQuality(result.text);
    const attempts = selected.canary_attempts + 1;
    const successes = selected.canary_successes + (result.text.trim() ? 1 : 0);
    const avgQuality = ((selected.canary_quality * selected.canary_attempts) + quality) / attempts;

    // Candidate becomes active only after sustained canary evidence.
    const active = attempts >= 10 && successes / attempts >= 0.80 && avgQuality >= 0.72;

    await client.from("james_model_registry").update({
      status: active ? "active" : "eligible",
      canary_attempts: attempts,
      canary_successes: successes,
      canary_quality: avgQuality,
      routing_weight: active ? 0.10 : Math.min(selected.routing_weight, 0.05),
      last_canary_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", selected.id).eq("user_id", input.userId);

    return {
      ...result,
      task: input.task,
      latencyMs: Date.now() - started,
      candidateId: selected.id,
      canary: true,
      quality,
      active,
    };
  } catch {
    await client.from("james_model_registry").update({
      canary_attempts: selected.canary_attempts + 1,
      routing_weight: Math.max(0, Math.min(selected.routing_weight, 0.02)),
      last_canary_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", selected.id).eq("user_id", input.userId);
    return null;
  }
}
