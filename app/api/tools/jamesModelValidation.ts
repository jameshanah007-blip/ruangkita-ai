import { createClient } from "@supabase/supabase-js";
import type { AIProviderName } from "../../fun-zone/aiProvider";

type RegistryStatus = "experimental" | "eligible" | "active" | "rejected" | "failed";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function scoreAnswer(answer: string, expectedSignals: string[] = []) {
  if (!answer.trim()) return 0;
  const lengthScore = Math.min(1, answer.length / 250);
  const signalScore = expectedSignals.length
    ? expectedSignals.filter((signal) => answer.toLowerCase().includes(signal.toLowerCase())).length /
      expectedSignals.length
    : 0.5;
  return Math.min(1, lengthScore * 0.35 + signalScore * 0.65);
}

async function callAdaptedModel(provider: "openai" | "groq", model: string, prompt: string) {
  const apiKey = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error(provider.toUpperCase() + "_API_KEY belum dikonfigurasi.");

  const url = provider === "openai"
    ? "https://api.openai.com/v1/responses"
    : "https://api.groq.com/openai/v1/chat/completions";

  const body = provider === "openai"
    ? { model, instructions: "Return only the final answer. No chain-of-thought.", input: prompt, max_output_tokens: 1200 }
    : { model, messages: [{ role: "system", content: "Return only the final answer. No chain-of-thought." }, { role: "user", content: prompt }], max_tokens: 1200 };

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || provider + " candidate invocation failed.");

  return provider === "openai"
    ? String(data?.output_text || "")
    : String(data?.choices?.[0]?.message?.content || "");
}

async function callBaseline(provider: AIProviderName, prompt: string) {
  const key = provider === "openai" ? process.env.OPENAI_API_KEY :
    provider === "gemini" ? process.env.GEMINI_API_KEY :
    provider === "groq" ? process.env.GROQ_API_KEY : process.env.OPENROUTER_API_KEY;
  if (!key) return "";

  if (provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.6-luna", input: prompt, max_output_tokens: 1200 }),
    });
    const d = await r.json(); return r.ok ? String(d?.output_text || "") : "";
  }

  const endpoint = provider === "groq"
    ? "https://api.groq.com/openai/v1/chat/completions"
    : provider === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://generativelanguage.googleapis.com/v1beta/interactions";

  const body = provider === "gemini"
    ? { model: process.env.GEMINI_MODEL || "gemini-3.6-flash", input: prompt, system_instruction: "Return only the final answer." }
    : { model: provider === "groq" ? (process.env.GROQ_MODEL || "llama-3.3-70b-versatile") : (process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini"), messages: [{ role: "system", content: "Return only the final answer." }, { role: "user", content: prompt }] };

  const headers: Record<string,string> = { "Content-Type": "application/json" };
  if (provider === "gemini") headers["x-goog-api-key"] = key;
  else headers.Authorization = "Bearer " + key;

  const r = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) return "";
  return provider === "gemini" ? String(d?.steps?.find((s:any)=>s?.type==="model_output")?.content || "") : String(d?.choices?.[0]?.message?.content || "");
}

export async function registerJamesAdaptedModel(input: {
  userId: string;
  learningJobId: string;
  provider: "openai" | "groq";
  baseModel: string;
  candidateModel: string;
}) {
  const client = db();
  if (!client) throw new Error("Supabase secret configuration is missing.");
  const { data, error } = await client.from("james_model_registry").insert({
    user_id: input.userId,
    learning_job_id: input.learningJobId,
    provider: input.provider,
    base_model: input.baseModel,
    candidate_model: input.candidateModel,
    status: "experimental",
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function validateJamesAdaptedModel(input: {
  userId: string;
  registryId: string;
  prompts: Array<{ prompt: string; expectedSignals?: string[] }>;
  baselineProvider: AIProviderName;
}) {
  const client = db();
  if (!client) throw new Error("Supabase secret configuration is missing.");

  const { data: candidate } = await client
    .from("james_model_registry")
    .select("*")
    .eq("id", input.registryId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (!candidate || !candidate.candidate_model || (candidate.provider !== "openai" && candidate.provider !== "groq")) {
    throw new Error("Candidate model tidak ditemukan atau belum siap divalidasi.");
  }

  if (input.prompts.length < 3 || input.prompts.length > 20) {
    throw new Error("Validation membutuhkan 3 sampai 20 prompt.");
  }

  const rows = await Promise.all(input.prompts.map(async (item) => {
    const [candidateAnswer, baselineAnswer] = await Promise.all([
      callAdaptedModel(candidate.provider, candidate.candidate_model, item.prompt),
      callBaseline(input.baselineProvider, item.prompt),
    ]);
    return {
      candidate: scoreAnswer(candidateAnswer, item.expectedSignals),
      baseline: scoreAnswer(baselineAnswer, item.expectedSignals),
      candidateAnswer: candidateAnswer.slice(0, 3000),
      baselineAnswer: baselineAnswer.slice(0, 3000),
    };
  }));

  const candidateScore = rows.reduce((s, x) => s + x.candidate, 0) / rows.length;
  const baselineScore = rows.reduce((s, x) => s + x.baseline, 0) / rows.length;
  const eligible = candidateScore >= 0.72 && candidateScore >= baselineScore + 0.03;

  const status: RegistryStatus = eligible ? "eligible" : "rejected";
  await client.from("james_model_registry").update({
    status,
    validation_score: candidateScore,
    baseline_score: baselineScore,
    validation_samples: rows.length,
    evidence: { baselineProvider: input.baselineProvider, delta: candidateScore - baselineScore, rows },
    updated_at: new Date().toISOString(),
  }).eq("id", input.registryId).eq("user_id", input.userId);

  return {
    registryId: input.registryId,
    status,
    candidateScore,
    baselineScore,
    delta: candidateScore - baselineScore,
    samples: rows.length,
  };
}

export async function validateRegisteredJamesModelFromLearningJob(input: {
  userId: string;
  registryId: string;
  learningJobId: string;
  baselineProvider: AIProviderName;
}) {
  const client = db();
  if (!client) throw new Error("Supabase secret configuration is missing.");

  const { data: job } = await client
    .from("james_model_learning_jobs")
    .select("dataset")
    .eq("id", input.learningJobId)
    .eq("user_id", input.userId)
    .maybeSingle();

  const dataset = Array.isArray(job?.dataset) ? job.dataset : [];
  const prompts = dataset
    .filter((item: any) => typeof item?.prompt === "string")
    .slice(0, 10)
    .map((item: any) => ({
      prompt: item.prompt,
      expectedSignals: typeof item.response === "string"
        ? item.response.split(/\\s+/).filter(Boolean).slice(0, 8)
        : [],
    }));

  if (prompts.length < 3) {
    await client.from("james_model_registry").update({
      status: "rejected",
      evidence: { reason: "Insufficient validation samples in source dataset." },
      updated_at: new Date().toISOString(),
    }).eq("id", input.registryId).eq("user_id", input.userId);
    return { registryId: input.registryId, status: "rejected", reason: "insufficient_samples" };
  }

  return validateJamesAdaptedModel({
    userId: input.userId,
    registryId: input.registryId,
    prompts,
    baselineProvider: input.baselineProvider,
  });
}

