import type { AIProviderName } from "../../fun-zone/aiProvider";
import { getJamesModelLearningCapabilities } from "./jamesModelLearning";
import { createClient } from "@supabase/supabase-js";

export type JamesModelLearningDecision = {
  shouldDistill: boolean;
  shouldAdapt: boolean;
  teacherProviders: AIProviderName[];
  targetProvider: "openai" | "groq" | null;
  baseModel: string | null;
  confidence: number;
  evidenceCount: number;
  reason: string;
};

const PROVIDERS: AIProviderName[] = ["openai", "gemini", "openrouter", "groq"];
const MIN_DISTILLATION_EVIDENCE = 8;
const MIN_ADAPTATION_EVIDENCE = 16;
const COOLDOWN_HOURS = 24;

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function configuredBaseModel(provider: "openai" | "groq") {
  return provider === "openai"
    ? process.env.JAMES_OPENAI_FINE_TUNE_BASE_MODEL || process.env.OPENAI_FINE_TUNE_BASE_MODEL || null
    : process.env.JAMES_GROQ_FINE_TUNE_BASE_MODEL || process.env.GROQ_FINE_TUNE_BASE_MODEL || null;
}

/**
 * James decides autonomously when provider knowledge should be distilled
 * and when a validated adaptation is justified.
 *
 * Important: this is a policy gate, not an infinite API loop. It prevents
 * repeated paid fine-tuning while still allowing autonomous learning during
 * normal brain cycles.
 */
export async function decideJamesModelLearning(input: {
  userId: string;
  confidence: number;
  evidenceCount: number;
  verified: boolean;
  autonomous: boolean;
}) : Promise<JamesModelLearningDecision> {
  const capabilities = getJamesModelLearningCapabilities();
  const availableTeachers = PROVIDERS.filter((provider) => capabilities[provider].distillation);
  const client = db();

  if (!input.autonomous || !input.verified) {
    return {
      shouldDistill: false,
      shouldAdapt: false,
      teacherProviders: availableTeachers,
      targetProvider: null,
      baseModel: null,
      confidence: input.confidence,
      evidenceCount: input.evidenceCount,
      reason: "Model learning hanya berjalan pada siklus autonomous yang tervalidasi.",
    };
  }

  if (input.evidenceCount < MIN_DISTILLATION_EVIDENCE) {
    return {
      shouldDistill: false,
      shouldAdapt: false,
      teacherProviders: availableTeachers,
      targetProvider: null,
      baseModel: null,
      confidence: input.confidence,
      evidenceCount: input.evidenceCount,
      reason: "Evidence belum cukup untuk distillation otomatis.",
    };
  }

  if (client) {
    const since = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
    const { data } = await client
      .from("james_model_learning_jobs")
      .select("id, mode, status, created_at")
      .eq("user_id", input.userId)
      .gte("created_at", since)
      .in("status", ["dataset_ready", "submitted", "running", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        shouldDistill: false,
        shouldAdapt: false,
        teacherProviders: availableTeachers,
        targetProvider: null,
        baseModel: null,
        confidence: input.confidence,
        evidenceCount: input.evidenceCount,
        reason: "James sudah melakukan model learning baru-baru ini; cooldown mencegah loop biaya tanpa batas.",
      };
    }
  }

  const targetCandidates: Array<"openai" | "groq"> = ["openai", "groq"];
  const targetProvider = targetCandidates.find((provider) => {
    return capabilities[provider].fineTuning && configuredBaseModel(provider);
  }) || null;

  const shouldAdapt =
    input.evidenceCount >= MIN_ADAPTATION_EVIDENCE &&
    input.confidence >= 0.82 &&
    Boolean(targetProvider);

  return {
    shouldDistill: true,
    shouldAdapt,
    teacherProviders: availableTeachers,
    targetProvider,
    baseModel: targetProvider ? configuredBaseModel(targetProvider) : null,
    confidence: input.confidence,
    evidenceCount: input.evidenceCount,
    reason: shouldAdapt
      ? "Evidence dan confidence cukup kuat untuk distillation lalu kandidat model adaptation yang tervalidasi."
      : "James siap melakukan distillation; fine-tuning ditahan sampai evidence, confidence, dan base model memenuhi gate.",
  };
}
