import { createClient } from "@supabase/supabase-js";
import { generateWithJamesResourceManager } from "./jamesResourceManager";
import type { JamesAgentResult } from "./jamesAgentLoop";
import { recordJamesProviderPerformance } from "./jamesProviderPerformance";
import { recordJamesDecisionMemory } from "./jamesDecisionMemory";
import { updateJamesCapabilityMastery, enqueueJamesRegressionRecovery } from "./jamesCapabilityMastery";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function clean(value: unknown, max = 700) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clamp(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}

function parseJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object"
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function list(value: unknown, max = 5) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => clean(item, 300)).filter(Boolean).slice(0, max)
    : [];
}

export async function evaluateJamesTask(input: {
  userId: string;
  conversationId: string;
  taskId?: string | null;
  request: string;
  result: JamesAgentResult;
}) {
  const supabase = db();
  if (!supabase || !input.result.answer) return null;

  try {
    const evidence = {
      verified: input.result.verified,
      iterations: input.result.iterations,
      recovered: input.result.recovered,
      plan: input.result.plan,
      steps: input.result.steps.slice(-12),
      capabilities: input.result.capabilityResults.map((item) => item.capability),
      providerTrace: input.result.providerTrace,
    };

    const evaluation = await generateWithJamesResourceManager("verification", {
      prompt: [
        "Evaluasi task James secara singkat dan berbasis evidence.",
        "Jangan mengarang fakta yang tidak ada di evidence.",
        "",
        "REQUEST:",
        input.request.slice(0, 2000),
        "",
        "ANSWER:",
        input.result.answer.slice(0, 5000),
        "",
        "EVIDENCE:",
        JSON.stringify(evidence),
        "",
        "Output JSON saja:",
        '{"outcome":"success|failure|partial","qualityScore":0.0,"rootCause":"...","strengths":[],"weaknesses":[],"improvements":[]}',
        "",
        "qualityScore harus 0 sampai 1.",
        "Jika task verified=true, outcome tidak boleh failure kecuali evidence menunjukkan masalah konkret.",
      ].join("\n"),
      systemInstruction:
        "Kamu adalah James Self-Evaluation Engine. Evaluasi proses dan hasil berdasarkan evidence. Jangan mengubah identity, security, credentials, atau memory inti.",
      temperature: 0.1,
      maxOutputTokens: 1100,
    });

    const parsed = parseJson(evaluation.text);
    if (!parsed) return null;

    const outcome =
      parsed.outcome === "success" ||
      parsed.outcome === "failure" ||
      parsed.outcome === "partial"
        ? parsed.outcome
        : input.result.verified ? "success" : "partial";

    const capabilityNames = [...new Set(input.result.capabilityResults.map((item) => item.capability).filter(Boolean))].slice(0, 10);
    for (const capability of capabilityNames) {
      const mastery = await updateJamesCapabilityMastery(
        capability,
        outcome,
        Number(parsed.qualityScore ?? 0.5),
        { verified: input.result.verified, weaknesses: list(parsed.weaknesses), improvements: list(parsed.improvements) },
      );
      if (outcome === "failure" && mastery?.mastery !== undefined && Number(mastery.mastery) <= 0.65) {
        await enqueueJamesRegressionRecovery(
          capability,
          "Self-evaluation detected a failure after prior capability mastery; retest and relearn.",
          { mastery: mastery.mastery, outcome, quality: parsed.qualityScore, rootCause: parsed.rootCause },
        );
      }
    }

    const row = {
      user_id: input.userId,
      conversation_id: input.conversationId,
      task_id: typeof input.taskId === "string" ? input.taskId : null,
      outcome,
      quality_score: clamp(parsed.qualityScore),
      root_cause: clean(parsed.rootCause, 500),
      strengths: list(parsed.strengths),
      weaknesses: list(parsed.weaknesses),
      improvements: list(parsed.improvements),
      provider_observations: input.result.providerTrace.map((item) => ({
        provider: item.provider,
        model: item.model,
        task: item.task,
        latencyMs: item.latencyMs,
      })),
      evidence,
    };

    const { data, error } = await supabase
      .from("james_self_evaluations")
      .insert(row)
      .select("id, outcome, quality_score, root_cause, strengths, weaknesses, improvements, created_at")
      .maybeSingle();

    if (error) {
      console.warn("James self evaluation save unavailable:", error.message);
      return null;
    }

    const decisions = input.result.routingDecisions?.length
      ? input.result.routingDecisions
      : [{
          task: "reasoning" as const,
          mode: (input.result.providerTrace.length >= 2 ? "multi" : "single") as "multi" | "single",
          providers: [...new Set(input.result.providerTrace.map((item) => item.provider))],
          confidence: 0.5,
          reason: "Fallback decision record dari execution trace.",
          iteration: input.result.iterations,
        }];

    for (const decision of decisions.slice(-3)) {
      const providerNames = [...new Set(decision.providers)]
        .filter((provider): provider is "gemini" | "openai" | "openrouter" | "groq" =>
          provider === "gemini" || provider === "openai" || provider === "openrouter" || provider === "groq"
        );

      await recordJamesDecisionMemory({
        task: decision.task,
        mode: decision.mode,
        providers: providerNames,
        reason: clean(decision.reason, 500) || clean(parsed.rootCause, 500) || "Routing decision dicatat dari policy engine.",
        outcome,
        quality: clamp(parsed.qualityScore),
        verified: input.result.verified,
        evidenceCount: providerNames.length,
      });
    }

    const seen = new Set<string>();
    for (const observation of input.result.providerTrace) {
      const key = observation.provider + ":" + observation.task;
      if (seen.has(key)) continue;
      seen.add(key);
      await recordJamesProviderPerformance({
        provider: observation.provider as "gemini" | "openai" | "openrouter" | "groq",
        task: observation.task as "planning" | "chat" | "research" | "reasoning" | "learning" | "verification" | "fallback",
        quality: Number(data?.quality_score ?? 0.5),
        verified: input.result.verified,
        latencyMs: observation.latencyMs,
      });
    }

    return data || null;
  } catch (error) {
    console.warn("James self evaluation unavailable:", error);
    return null;
  }
}
