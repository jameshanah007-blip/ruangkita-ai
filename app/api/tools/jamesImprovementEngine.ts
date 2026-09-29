import { createClient } from "@supabase/supabase-js";
import { generateWithAIRouter } from "../../fun-zone/aiRouter";
import { aiProviders, type AIGenerateRequest, type AIGenerateResponse } from "../../fun-zone/aiProvider";
import { openRouterProvider } from "../../fun-zone/openRouterProvider";
import { groqProvider } from "../../fun-zone/groqProvider";
import type { JamesAgentResult } from "./jamesAgentLoop";
import { evaluateJamesTask } from "./jamesSelfEvaluation";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function clean(v: unknown, max = 1000) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function clamp(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}

async function generateWithAllAIProviders(request: AIGenerateRequest): Promise<AIGenerateResponse[]> {
  const providers = [...aiProviders, openRouterProvider, groqProvider];
  const results: AIGenerateResponse[] = [];
  for (const provider of providers) {
    if (!provider.isAvailable()) continue;
    try {
      results.push(await provider.generate(request));
    } catch {
      // One provider failing must not prevent the remaining providers from evaluating mastery.
    }
  }
  return results;
}

function validProvider(value: unknown): value is "gemini" | "openai" | "openrouter" | "groq" {
  return value === "gemini" || value === "openai" || value === "openrouter" || value === "groq";
}

export function normalizeJamesCapability(value: unknown) {
  const raw = clean(value, 180).toLowerCase().replace(/[\\/]+/g, " ").replace(/\\s+/g, " ").trim();
  if (!raw) return { key: "", name: "" };
  const aliases: Array<[RegExp, string]> = [
    [/\\b(web[ -]?search|internet research|online research)\\b/, "web research"],
    [/\\b(code generation|coding|software development|programming)\\b/, "code generation"],
    [/\\b(code review|review code|software review)\\b/, "code review"],
    [/\\b(debugging|debug|troubleshooting)\\b/, "debugging"],
    [/\\b(planning|task planning|plan tasks)\\b/, "task planning"],
    [/\\b(reasoning|logical reasoning|problem solving)\\b/, "reasoning"],
    [/\\b(verification|verify|fact checking|fact-checking)\\b/, "verification"],
    [/\\b(learning|knowledge learning|knowledge acquisition)\\b/, "knowledge learning"],
    [/\\b(summarization|summarizing|summary)\\b/, "summarization"],
    [/\\b(translation|translating)\\b/, "translation"],
  ];
  const matched = aliases.find(([pattern]) => pattern.test(raw));
  const name = matched ? matched[1] : raw.replace(/[^a-z0-9._ -]+/g, "").replace(/\\s+/g, " ").trim();
  const key = name.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  return { key, name: name.slice(0, 180) };
}

function parse(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>; } catch { return null; }
}

export async function detectJamesImprovementGoal(input: {
  userId: string;
  conversationId: string;
  request: string;
  result: JamesAgentResult;
  evaluationId?: string | null;
}) {
  const client = db();
  if (!client) return null;

  const evaluation = await evaluateJamesTask({
    userId: input.userId,
    conversationId: input.conversationId,
    taskId: input.result.taskId,
    request: input.request,
    result: input.result,
  });

  const prompt = [
    "Kamu adalah James Capability Gap Detector.",
    "Cari satu gap teknis atau kemampuan yang paling konkret dari evidence.",
    "Jangan membuat gap hanya karena ingin mengubah kode.",
    "Jika tidak ada gap yang cukup kuat, hasGap=false.",
    "Jangan menyentuh credentials, secrets, auth policy, database security policy, atau deployment config.",
    "",
    "REQUEST:",
    input.request.slice(0, 2500),
    "",
    "RESULT:",
    input.result.answer.slice(0, 4500),
    "",
    "EVALUATION:",
    JSON.stringify(evaluation || {}),
    "",
    "Output JSON saja:",
    '{"hasGap":false,"title":"","problem":"","targetCapability":"","priority":0,"confidence":0.0,"evidence":[]}',
  ].join("\n");

  const generated = await generateWithAIRouter({
    prompt,
    systemInstruction:
      "Kamu adalah capability-gap detector James. Hanya identifikasi gap yang didukung evidence. Satu gap paling penting.",
    temperature: 0.1,
    maxOutputTokens: 1200,
  });

  const parsed = parse(generated.text);
  if (!parsed || parsed.hasGap !== true) return null;

  const title = clean(parsed.title, 180);
  const problem = clean(parsed.problem, 1600);
  const rawTargetCapability = clean(parsed.targetCapability, 180);
  const target = normalizeJamesCapability(rawTargetCapability);
  const targetCapability = target.name;
  if (!title || !problem || !targetCapability || !target.key) return null;

  const { data, error } = await client
    .from("james_improvement_goals")
    .insert({
      user_id: input.userId,
      source_evaluation_id: evaluation?.id || input.evaluationId || null,
      title,
      problem,
      target_capability: targetCapability,
      evidence: {
        request: input.request.slice(0, 2500),
        result: input.result.answer.slice(0, 4500),
        evaluation,
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 8) : [],
      },
      priority: Math.min(Math.max(Math.round(Number(parsed.priority) || 50), 0), 100),
      confidence: clamp(parsed.confidence),
      status: "proposed",
    })
    .select("id, title, problem, target_capability, priority, confidence, status, created_at")
    .maybeSingle();

  if (error) {
    console.warn("James improvement goal unavailable:", error.message);
    return null;
  }

  return data;
}


export async function queueJamesCapabilityGap(input: {
  userId: string;
  conversationId: string;
  capability?: string;
}) {
  const client = db();
  if (!client) return null;

  let query = client
    .from("james_self_model")
    .select("capability_name, competence, confidence, evidence_count, status, next_learning_action")
    .eq("user_id", input.userId)
    .in("status", ["unknown", "developing"])
    .order("competence", { ascending: true })
    .order("confidence", { ascending: true })
    .limit(1);

  if (input.capability?.trim()) {
    const normalizedRequested = normalizeJamesCapability(input.capability);
    query = client
      .from("james_self_model")
      .select("capability_name, competence, confidence, evidence_count, status, next_learning_action")
      .eq("user_id", input.userId)
      .eq("capability_key", normalizedRequested.key)
      .limit(1);
  }
  const { data: rows } = await query;
  const gap = rows?.[0];
  if (!gap) return null;

  const { data: existing } = await client
    .from("james_improvement_goals")
    .select("id, status, target_capability, priority, confidence")
    .eq("user_id", input.userId)
    .eq("target_capability", gap.capability_name)
    .in("status", ["proposed", "queued", "running"])
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const priority = Math.min(100, Math.max(40, Math.round(
    (1 - Number(gap.competence || 0.5)) * 70 + Number(gap.confidence || 0.2) * 30
  )));

  const { data, error } = await client
    .from("james_improvement_goals")
    .insert({
      user_id: input.userId,
      title: "Strengthen capability: " + gap.capability_name,
      problem: "Self-model menunjukkan capability ini masih " + gap.status +
        " dengan competence " + Number(gap.competence || 0).toFixed(2) +
        " berdasarkan " + Number(gap.evidence_count || 0) + " evidence.",
      target_capability: gap.capability_name,
      evidence: {
        source: "james_self_model",
        competence: Number(gap.competence || 0),
        confidence: Number(gap.confidence || 0),
        evidence_count: Number(gap.evidence_count || 0),
        next_learning_action: gap.next_learning_action || "distill-more-evidence",
      },
      priority,
      confidence: Number(gap.confidence || 0.2),
      status: "proposed",
    })
    .select("id, title, problem, target_capability, priority, confidence, status, created_at")
    .maybeSingle();

  if (error) {
    console.warn("James capability learning queue unavailable:", error.message);
    return null;
  }

  return data;
}

export async function evolveJamesImprovementGoal(input: {
  userId: string;
  conversationId: string;
  improvementGoalId: string;
}) {
  const client = db();
  if (!client) return null;

  const { data: goal, error } = await client
    .from("james_improvement_goals")
    .select("*")
    .eq("id", input.improvementGoalId)
    .maybeSingle();

  if (error || !goal) return null;

  if (goal.status !== "proposed" && goal.status !== "queued") return goal;

  const proposal = { status: "blocked", proposalId: null };

  await client
    .from("james_improvement_goals")
    .update({
      status: proposal.status === "approved" ? "queued" : "blocked",
      evolution_proposal_id: proposal.proposalId,
    })
    .eq("id", input.improvementGoalId);

  return {
    ...goal,
    status: proposal.status === "approved" ? "queued" : "blocked",
    evolution_proposal_id: proposal.proposalId,
  };
}

export async function executeJamesLearningGoal(input: {
  userId: string;
  conversationId: string;
  improvementGoalId: string;
}) {
  const client = db();
  if (!client) return null;

  const { data: candidate } = await client
    .from("james_improvement_goals")
    .select("*")
    .eq("id", input.improvementGoalId)
    .eq("user_id", input.userId)
    .in("status", ["proposed", "queued"])
    .maybeSingle();

  if (!candidate) return null;

  const { data: goal, error: claimError } = await client
    .from("james_improvement_goals")
    .update({ status: "running" })
    .eq("id", input.improvementGoalId)
    .eq("user_id", input.userId)
    .in("status", ["proposed", "queued"])
    .select("*")
    .maybeSingle();

  if (claimError || !goal) return null;

  const { data: selfModel } = await client
    .from("james_self_model")
    .select("capability_name, competence, confidence, evidence_count, success_count, failure_count, teacher_providers, active_models, next_learning_action, status")
    .eq("user_id", input.userId)
    .eq("capability_name", goal.target_capability)
    .maybeSingle();

  const teachers = ["gemini", "openai", "openrouter", "groq"] as const;
  const normalized = normalizeJamesCapability(goal.target_capability);
  const capability = normalized.name;
  const problem = clean(goal.problem, 1600);
  const prompts = [
    `Ajarkan capability berikut kepada James secara praktis: ${capability}. Masalah: ${problem}. Berikan prinsip, contoh, dan hasil yang bisa diuji. Jangan tampilkan chain-of-thought.`,
    `Buat latihan terarah untuk menguji capability ${capability}. Sertakan input, expected outcome, dan jebakan umum. Fokus pada hasil final yang dapat diverifikasi.`,
    `Berikan solusi alternatif yang lebih robust untuk capability ${capability}. Jelaskan kriteria keberhasilan dan cara memverifikasinya. Jangan tampilkan reasoning internal.`,
    `Buat checklist pengetahuan dan implementasi yang harus dikuasai James untuk capability ${capability}. Prioritaskan hal yang dapat dibuktikan lewat pengujian.`,
  ];

  try {
    const distilled = await (await import("./jamesModelLearning")).distillJamesKnowledge({
      userId: input.userId,
      prompts,
      teacherProviders: [...teachers],
      systemInstruction:
        "Kamu adalah teacher untuk James. Ajarkan hanya pengetahuan final yang dapat diverifikasi. Jangan keluarkan chain-of-thought, secrets, credentials, atau protected internals.",
      task: "learning",
    });

    if (!distilled.sampleCount || !distilled.jobId) {
      await client
        .from("james_improvement_goals")
        .update({
          status: "queued",
          evidence: {
            ...(goal.evidence || {}),
            last_learning_attempt: { sampleCount: distilled.sampleCount, result: "no-dataset" },
          },
        })
        .eq("id", input.improvementGoalId)
        .eq("user_id", input.userId);
      return { ...goal, status: "queued", learningJobId: distilled.jobId, sampleCount: distilled.sampleCount };
    }

    const masteryProbe = await generateWithAllAIProviders({
      prompt: [
        "CAPABILITY MASTERY TEST FOR JAMES",
        "Target capability: " + capability,
        "Problem: " + problem,
        "",
        "Buat 3 tugas uji yang berbeda dan konkret untuk capability ini.",
        "Setiap tugas harus dapat dinilai benar/salah atau memenuhi kriteria yang jelas.",
        "Output JSON saja: [{\"task\":\"\",\"criteria\":\"\",\"expected\":\"\"}]",
      ].join("\n"),
      systemInstruction:
        "Kamu adalah test designer. Jangan tampilkan chain-of-thought. Hanya hasil akhir yang dapat diuji.",
      temperature: 0.1,
      maxOutputTokens: 1800,
    });
    const probeSource = masteryProbe
      .map((item) => item.text)
      .join("\n\n---\n\n")
      .slice(0, 12000);

    const masteryEvaluation = await generateWithAllAIProviders({
      prompt: [
        "Nilai capability James berdasarkan test evidence berikut.",
        "TARGET: " + capability,
        "PROBLEM: " + problem,
        "",
        "TEST DESIGN EVIDENCE:",
        probeSource,
        "",
        "Knowledge distilled:",
        JSON.stringify(distilled.dataset.slice(0, 8)),
        "",
        "Beri skor keseluruhan berdasarkan kecukupan evidence, consistency, dan verifiability.",
        'Output JSON saja: {"score":0.0,"passed":false,"reason":""}',
      ].join("\n"),
      systemInstruction:
        "Kamu adalah independent mastery evaluator. Jangan tampilkan reasoning internal. Hanya JSON final.",
      temperature: 0.05,
      maxOutputTokens: 1200,
    });

    const evaluations = masteryEvaluation
      .map((item) => parse(item.text))
      .filter((item): item is { score?: unknown; passed?: unknown; reason?: unknown } => Boolean(item));
    const validationScores = evaluations.map((item) => clamp(item.score));
    const validationScore = validationScores.length
      ? validationScores.reduce((sum, value) => sum + value, 0) / validationScores.length
      : 0;
    const passedVotes = evaluations.filter((item) => item.passed === true).length;
    const validated = evaluations.length >= 2 &&
      passedVotes / evaluations.length >= 0.75 &&
      validationScore >= 0.78;

    const oldEvidence = Number(selfModel?.evidence_count || 0);
    const oldCompetence = Number(selfModel?.competence || 0.5);
    const oldConfidence = Number(selfModel?.confidence || 0.2);
    const gainedEvidence = Math.min(4, distilled.sampleCount);
    const evidenceCount = oldEvidence + gainedEvidence + 1;
    const competence = Math.max(0, Math.min(1,
      oldCompetence * 0.50 +
      Math.min(1, 0.55 + distilled.sampleCount / 60) * 0.20 +
      validationScore * 0.30
    ));
    const confidence = Math.max(0, Math.min(1,
      oldConfidence * 0.50 + Math.min(0.90, 0.25 + evidenceCount / 20) * 0.30 + validationScore * 0.20
    ));
    const successCount = Number(selfModel?.success_count || 0) + (validated ? 1 : 0);
    const failureCount = Number(selfModel?.failure_count || 0) + (validated ? 0 : 1);
    const status =
      evidenceCount >= 12 && competence >= 0.85 ? "strong" :
      evidenceCount >= 5 && competence >= 0.70 ? "competent" :
      evidenceCount < 2 ? "unknown" : "developing";

    const providerList = [
      ...(Array.isArray(selfModel?.teacher_providers) ? selfModel.teacher_providers : []),
      ...teachers,
    ].filter(validProvider);
    const activeModels = Array.isArray(selfModel?.active_models) ? selfModel.active_models : [];

    const selfModelUpdate = await client
      .from("james_self_model")
      .upsert({
        user_id: input.userId,
        capability_key: normalized.key,
        capability_name: capability,
        competence,
        confidence,
        evidence_count: evidenceCount,
        success_count: successCount,
        failure_count: failureCount,
        teacher_providers: [...new Set(providerList)].slice(0, 4),
        active_models: activeModels,
        last_evidence: {
          source: "learning_queue_executor",
          learningJobId: distilled.jobId,
          sampleCount: distilled.sampleCount,
          teachers,
          validationScore,
          validated,
          evaluator: "multi-provider-mastery-panel",
          evaluatorProviders: masteryEvaluation.map((item) => item.provider),
          probeCount: 3,
          reason: clean(evaluations.find((item) => typeof item.reason === "string")?.reason, 800),
        },
        next_learning_action: status === "strong"
          ? "monitor-and-verify"
          : status === "competent"
            ? "increase-diversity-and-test"
            : "distill-more-evidence",
        status,
      }, { onConflict: "user_id,capability_key" });

    if (selfModelUpdate.error) {
      throw new Error("Self-model update gagal: " + selfModelUpdate.error.message);
    }

    await client.from("james_capability_mastery_history").insert({
      user_id: input.userId,
      capability_key: normalized.key,
      capability_name: capability,
      source: "learning_queue_executor",
      evidence_count: evidenceCount,
      competence,
      confidence,
      validation_score: validationScore,
      verified: validated,
      provider_panel: masteryEvaluation.map((item) => item.provider).filter(validProvider),
      details: {
        learningJobId: distilled.jobId,
        sampleCount: distilled.sampleCount,
        evaluatorCount: evaluations.length,
        passedVotes,
      },
    });

    const goalStatus = validated && (status === "competent" || status === "strong")
      ? "completed"
      : "queued";
    await client
      .from("james_improvement_goals")
      .update({
        status: goalStatus,
        evidence: {
          ...(goal.evidence || {}),
          last_learning_attempt: {
            learningJobId: distilled.jobId,
            sampleCount: distilled.sampleCount,
            teachers,
            competenceBefore: oldCompetence,
            competenceAfter: competence,
            confidenceAfter: confidence,
            selfModelStatus: status,
            validationScore,
            validated,
            reason: clean(evaluations.find((item) => typeof item.reason === "string")?.reason, 800),
          },
        },
      })
      .eq("id", input.improvementGoalId)
      .eq("user_id", input.userId);

    return {
      ...goal,
      status: goalStatus,
      learningJobId: distilled.jobId,
      sampleCount: distilled.sampleCount,
      capability,
      competence,
      confidence,
      selfModelStatus: status,
      validationScore,
      validated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await client
      .from("james_improvement_goals")
      .update({
        status: "queued",
        evidence: { ...(goal.evidence || {}), last_learning_error: message.slice(0, 1000) },
      })
      .eq("id", input.improvementGoalId)
      .eq("user_id", input.userId);
    throw error;
  }
}

