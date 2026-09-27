import { createHash } from "crypto";
import type { AIProviderName } from "../../fun-zone/aiProvider";
import {
  generateWithJamesProviderCollaboration,
  type JamesResourceTask,
} from "./jamesResourceManager";
import { createClient } from "@supabase/supabase-js";
import { registerJamesAdaptedModel, validateRegisteredJamesModelFromLearningJob } from "./jamesModelValidation";

export type JamesModelLearningMode =
  | "distillation"
  | "fine_tuning"
  | "lora_registration";

export type JamesModelLearningCapability = {
  provider: AIProviderName;
  distillation: boolean;
  fineTuning: boolean;
  directModelCopying: false;
  notes: string;
};

const CAPABILITIES: Record<AIProviderName, JamesModelLearningCapability> = {
  openai: {
    provider: "openai",
    distillation: true,
    fineTuning: true,
    directModelCopying: false,
    notes: "Fine-tuning melalui API resmi pada model yang didukung.",
  },
  gemini: {
    provider: "gemini",
    distillation: true,
    fineTuning: false,
    directModelCopying: false,
    notes: "Gemini API tidak menyediakan fine-tuning langsung saat ini; distillation tetap dapat dilakukan melalui output.",
  },
  openrouter: {
    provider: "openrouter",
    distillation: true,
    fineTuning: false,
    directModelCopying: false,
    notes: "OpenRouter adalah gateway multi-model; gunakan output untuk distillation, bukan menyalin bobot model.",
  },
  groq: {
    provider: "groq",
    distillation: true,
    fineTuning: true,
    directModelCopying: false,
    notes: "Fine-tuning/LoRA tersedia melalui API dengan model dan akses yang didukung; LoRA inference memiliki batas tier.",
  },
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function clean(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validProvider(value: unknown): value is AIProviderName {
  return value === "gemini" || value === "openai" ||
    value === "openrouter" || value === "groq";
}

function hashDataset(dataset: unknown[]) {
  return createHash("sha256")
    .update(JSON.stringify(dataset))
    .digest("hex");
}

function jsonl(dataset: Array<{ prompt: string; response: string }>) {
  return dataset.map((item) => JSON.stringify({
    messages: [
      { role: "user", content: item.prompt },
      { role: "assistant", content: item.response },
    ],
  })).join("\n");
}

export function getJamesModelLearningCapabilities() {
  return CAPABILITIES;
}

/**
 * Knowledge Distillation:
 * James asks selected teacher providers for final answers and stores only
 * the useful teaching signal. Hidden chain-of-thought/reasoning is never
 * requested or persisted.
 */
export async function distillJamesKnowledge(input: {
  userId: string;
  prompts: string[];
  teacherProviders: AIProviderName[];
  systemInstruction?: string;
  task?: JamesResourceTask;
}) {
  const teachers = [...new Set(input.teacherProviders)].filter(validProvider);
  if (!teachers.length) throw new Error("Minimal satu teacher provider diperlukan.");
  if (input.prompts.length < 1 || input.prompts.length > 50) {
    throw new Error("Distillation menerima 1 sampai 50 prompt per batch.");
  }

  const dataset: Array<{
    prompt: string;
    response: string;
    teacherProvider: string;
    teacherModel: string;
  }> = [];

  for (const prompt of input.prompts) {
    const results = await generateWithJamesProviderCollaboration(
      input.task || "learning",
      {
        systemInstruction: [
          input.systemInstruction || "Berikan jawaban final yang akurat dan ringkas.",
          "Ini adalah proses knowledge distillation.",
          "Jangan tampilkan chain-of-thought atau reasoning internal.",
          "Berikan hanya jawaban final dan fakta/struktur yang dapat dipelajari.",
        ].join("\n"),
        prompt: clean(prompt, 4000),
        temperature: 0.15,
        maxOutputTokens: 3000,
      },
      teachers,
    );

    for (const result of results) {
      if (!result.text.trim()) continue;
      dataset.push({
        prompt: clean(prompt, 4000),
        response: clean(result.text, 7000),
        teacherProvider: result.provider,
        teacherModel: result.model,
      });
    }
  }

  const hash = hashDataset(dataset);
  const supabase = db();
  let jobId: string | null = null;

  if (supabase) {
    const { data } = await supabase
      .from("james_model_learning_jobs")
      .insert({
        user_id: input.userId,
        mode: "distillation",
        teacher_providers: teachers,
        dataset: dataset.map(({ prompt, response, teacherProvider, teacherModel }) => ({
          prompt, response, teacherProvider, teacherModel,
        })),
        dataset_hash: hash,
        status: dataset.length ? "dataset_ready" : "failed",
        evidence: {
          sampleCount: dataset.length,
          teacherCount: teachers.length,
          source: "provider_final_outputs",
          reasoningExcluded: true,
        },
      })
      .select("id")
      .maybeSingle();
    jobId = data?.id || null;
  }

  return {
    jobId,
    mode: "distillation" as const,
    teachers,
    dataset,
    datasetHash: hash,
    sampleCount: dataset.length,
    trainingJsonl: jsonl(dataset.map((item) => ({
      prompt: item.prompt,
      response: item.response,
    }))),
  };
}

async function openAIUploadAndFineTune(input: {
  apiKey: string;
  baseModel: string;
  trainingJsonl: string;
}) {
  const fileBody = new Blob([input.trainingJsonl], { type: "application/jsonl" });
  const form = new FormData();
  form.append("file", fileBody, "james-distillation.jsonl");
  form.append("purpose", "fine-tune");

  const upload = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: "Bearer " + input.apiKey },
    body: form,
  });
  const uploadData = await upload.json();
  if (!upload.ok) throw new Error(uploadData?.error?.message || "OpenAI file upload gagal.");

  const job = await fetch("https://api.openai.com/v1/fine_tuning/jobs", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + input.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.baseModel,
      training_file: uploadData.id,
      method: { type: "supervised" },
    }),
  });
  const jobData = await job.json();
  if (!job.ok) throw new Error(jobData?.error?.message || "OpenAI fine-tuning gagal dibuat.");

  return {
    jobId: jobData.id as string,
    status: jobData.status as string,
    fineTunedModel: jobData.fine_tuned_model || null,
    trainingFile: uploadData.id as string,
  };
}

async function groqFineTune(input: {
  apiKey: string;
  baseModel: string;
  trainingJsonl: string;
}) {
  const fileBody = new Blob([input.trainingJsonl], { type: "application/jsonl" });
  const form = new FormData();
  form.append("file", fileBody, "james-distillation.jsonl");
  form.append("purpose", "fine_tuning");

  const upload = await fetch("https://api.groq.com/openai/v1/files", {
    method: "POST",
    headers: { Authorization: "Bearer " + input.apiKey },
    body: form,
  });
  const uploadData = await upload.json();
  if (!upload.ok) throw new Error(uploadData?.error?.message || "Groq file upload gagal.");

  const tuning = await fetch("https://api.groq.com/v1/fine_tunings", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + input.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input_file_id: uploadData.id,
      name: "james-distilled-" + Date.now(),
      type: "lora",
      base_model: input.baseModel,
    }),
  });
  const tuningData = await tuning.json();
  if (!tuning.ok) throw new Error(
    tuningData?.error?.message || "Groq fine-tuning gagal dibuat."
  );

  const data = tuningData?.data || tuningData;
  return {
    jobId: data.id as string,
    status: "submitted",
    fineTunedModel: data.fine_tuned_model || null,
    trainingFile: uploadData.id as string,
  };
}


export async function syncJamesModelLearningJobs(userId: string) {
  const supabase = db();
  if (!supabase) return [];

  const { data: jobs } = await supabase
    .from("james_model_learning_jobs")
    .select("id, target_provider, base_model, job_id, status, fine_tuned_model, teacher_providers")
    .eq("user_id", userId)
    .eq("mode", "fine_tuning")
    .in("status", ["submitted", "running"])
    .not("job_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(10);

  const updates: Array<Record<string, unknown>> = [];

  for (const item of jobs || []) {
    if (item.target_provider !== "openai" && item.target_provider !== "groq") continue;

    const apiKey = item.target_provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.GROQ_API_KEY;
    if (!apiKey) continue;

    const url = item.target_provider === "openai"
      ? "https://api.openai.com/v1/fine_tuning/jobs/" + item.job_id
      : "https://api.groq.com/openai/v1/fine_tunings/" + item.job_id;

    try {
      const response = await fetch(url, {
        headers: { Authorization: "Bearer " + apiKey },
      });
      const data = await response.json();
      if (!response.ok) continue;

      const status = String(data?.status || data?.data?.status || "running");
      const model = data?.fine_tuned_model || data?.data?.fine_tuned_model || null;
      const normalized =
        status === "succeeded" || status === "completed" ? "completed" :
        status === "failed" || status === "cancelled" ? "failed" :
        "running";

      await supabase.from("james_model_learning_jobs").update({
        status: normalized,
        fine_tuned_model: model,
        error_message: normalized === "failed"
          ? String(data?.error?.message || data?.data?.error?.message || "Provider fine-tuning failed.")
          : null,
        updated_at: new Date().toISOString(),
      }).eq("id", item.id).eq("user_id", userId);

      if (normalized === "completed" && model) {
        const registryId = await registerJamesAdaptedModel({
          userId,
          learningJobId: item.id,
          provider: item.target_provider,
          baseModel: item.base_model || "",
          candidateModel: model,
        });
        const teachers = Array.isArray(item.teacher_providers) ? item.teacher_providers : [];
        const baselineProvider = (teachers.find((p: unknown) => p === "openai" || p === "gemini" || p === "openrouter" || p === "groq") || "openai") as AIProviderName;
        const validation = await validateRegisteredJamesModelFromLearningJob({
          userId,
          registryId,
          learningJobId: item.id,
          baselineProvider,
        });
        updates.push({ jobId: item.id, status: normalized, registryId, candidateModel: model, validation });
      } else {
        updates.push({ jobId: item.id, status: normalized, candidateModel: model });
      }
    } catch (error) {
      updates.push({
        jobId: item.id,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return updates;
}

/**
 * "Model copying" is intentionally implemented as compliant model adaptation:
 * fine-tuning/LoRA only where the provider explicitly exposes the API.
 * James never extracts, reconstructs, or copies proprietary model weights.
 */
export async function startJamesModelAdaptation(input: {
  userId: string;
  distillationJobId: string;
  targetProvider: AIProviderName;
  baseModel: string;
}) {
  if (!validProvider(input.targetProvider)) throw new Error("Target provider tidak valid.");
  const capability = CAPABILITIES[input.targetProvider];
  if (!capability.fineTuning) {
    throw new Error(
      input.targetProvider +
      " tidak menyediakan fine-tuning langsung melalui jalur API yang digunakan James."
    );
  }

  const supabase = db();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");

  const { data: source } = await supabase
    .from("james_model_learning_jobs")
    .select("id, user_id, mode, dataset, dataset_hash")
    .eq("id", input.distillationJobId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (!source) throw new Error("Distillation job tidak ditemukan.");

  const dataset = Array.isArray(source.dataset) ? source.dataset : [];
  if (!dataset.length) throw new Error("Dataset distillation kosong.");

  const trainingJsonl = jsonl(
    dataset
      .filter((item): item is { prompt: string; response: string } =>
        Boolean(item && typeof item.prompt === "string" && typeof item.response === "string")
      )
      .map((item) => ({ prompt: item.prompt, response: item.response }))
  );

  const apiKey = input.targetProvider === "openai"
    ? process.env.OPENAI_API_KEY
    : process.env.GROQ_API_KEY;

  if (!apiKey) throw new Error(input.targetProvider.toUpperCase() + "_API_KEY belum dikonfigurasi.");

  const result = input.targetProvider === "openai"
    ? await openAIUploadAndFineTune({ apiKey, baseModel: input.baseModel, trainingJsonl })
    : await groqFineTune({ apiKey, baseModel: input.baseModel, trainingJsonl });

  const { data: job } = await supabase
    .from("james_model_learning_jobs")
    .insert({
      user_id: input.userId,
      mode: "fine_tuning",
      teacher_providers: [],
      target_provider: input.targetProvider,
      base_model: input.baseModel,
      dataset: [{ sourceJobId: source.id, datasetHash: source.dataset_hash }],
      dataset_hash: source.dataset_hash,
      job_id: result.jobId,
      fine_tuned_model: result.fineTunedModel,
      status: "submitted",
      evidence: {
        source: "james_knowledge_distillation",
        sourceJobId: source.id,
      },
    })
    .select("id")
    .maybeSingle();

  return {
    jobId: job?.id || null,
    provider: input.targetProvider,
    baseModel: input.baseModel,
    remoteJobId: result.jobId,
    status: result.status,
    fineTunedModel: result.fineTunedModel,
  };
}
