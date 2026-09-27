import type { AIProviderName } from "../../fun-zone/aiProvider";
import type { JamesResourceTask } from "./jamesResourceManager";
import { getJamesProviderPerformance, scoreJamesProviderPerformance } from "./jamesProviderPerformance";
import { getJamesDecisionMemory } from "./jamesDecisionMemory";
import { critiqueJamesPolicy, saveJamesPolicyCritique } from "./jamesPolicyCritic";

export type JamesLearningMode = "single" | "fallback" | "multi";

export type JamesLearningPolicy = {
  mode: JamesLearningMode;
  rankedProviders: AIProviderName[];
  confidence: number;
  reason: string;
};

export async function planJamesLearningPolicy(task: JamesResourceTask): Promise<JamesLearningPolicy> {
  const performance = await getJamesProviderPerformance(task);
  const decisions = await getJamesDecisionMemory(task, 12);
  const defaults: AIProviderName[] = ["openai", "gemini", "openrouter", "groq"];

  const ranked = defaults
    .map((provider, index) => ({
      provider,
      score: scoreJamesProviderPerformance(
        performance.find((item) => item.provider === provider),
        index
      ),
      evidence: performance.find((item) => item.provider === provider),
    }))
    .sort((a, b) => b.score - a.score);

  const observed = ranked.filter((item) => Boolean(item.evidence));
  const successfulDecisions = decisions.filter((item) => item.verified && item.outcome === "success");
  const failedDecisions = decisions.filter((item) => item.outcome === "failure");
  const top = ranked[0];

  if (!top || observed.length === 0) {
    return {
      mode: "fallback",
      rankedProviders: ranked.map((item) => item.provider),
      confidence: 0.25,
      reason: "Belum ada evidence provider yang cukup; gunakan fallback konservatif.",
    };
  }

  const second = ranked[1];
  const rememberedMulti = successfulDecisions.filter((item) => item.mode === "multi" || item.mode === "specialized").length;
  const rememberedSingle = successfulDecisions.filter((item) => item.mode === "single").length;
  const rememberedFailures = failedDecisions.length;
  const closeRace = second && Math.abs(top.score - second.score) < 0.08;
  const weakEvidence = !top.evidence || top.evidence.attempts < 3;
  const lowConfidence = top.evidence ? top.evidence.confidence < 0.55 : true;

  const basePolicy: JamesLearningPolicy = closeRace || weakEvidence || lowConfidence
    ? {
        mode: "multi",
        rankedProviders: ranked.map((item) => item.provider),
        confidence: Math.min(0.65, top.score),
        reason: "Evidence belum cukup kuat untuk mempercayai satu provider; pertahankan beberapa resource.",
      }
    : {
        mode: "single",
        rankedProviders: ranked.map((item) => item.provider),
        confidence: Math.min(0.95, top.score),
        reason: "Evidence historis menunjukkan provider teratas cukup konsisten untuk task ini.",
      };

  const critique = await critiqueJamesPolicy(task, basePolicy);
  await saveJamesPolicyCritique(critique);
  if (critique.recommendation === "reduce_confidence" && basePolicy.mode === "single") {
    return {
      ...basePolicy,
      mode: "multi",
      confidence: Math.max(0.25, basePolicy.confidence - 0.15),
      reason: critique.reason,
    };
  }

  if (critique.recommendation === "increase_confidence") {
    return {
      ...basePolicy,
      confidence: Math.min(0.95, basePolicy.confidence + 0.05),
      reason: critique.reason,
    };
  }

  if (rememberedMulti >= 2 && rememberedMulti > rememberedSingle + 1 && rememberedFailures < 4) {
    return {
      mode: "multi",
      rankedProviders: ranked.map((item) => item.provider),
      confidence: Math.min(0.8, top.score + 0.05),
      reason: "Decision memory menunjukkan kolaborasi multi-provider sebelumnya efektif untuk task ini.",
    };
  }

  if (rememberedSingle >= 3 && rememberedSingle >= rememberedMulti + 1 && top.evidence && top.evidence.attempts >= 3) {
    return {
      mode: "single",
      rankedProviders: ranked.map((item) => item.provider),
      confidence: Math.min(0.9, top.score + 0.03),
      reason: "Decision memory menunjukkan single-provider sebelumnya konsisten untuk task ini.",
    };
  }

  if (closeRace || weakEvidence || lowConfidence) {
    return {
      mode: "multi",
      rankedProviders: ranked.map((item) => item.provider),
      confidence: Math.min(0.65, top.score),
      reason: "Evidence belum cukup kuat untuk mempercayai satu provider; pertahankan beberapa resource.",
    };
  }

  return {
    mode: "single",
    rankedProviders: ranked.map((item) => item.provider),
    confidence: Math.min(0.95, top.score),
    reason: "Evidence historis menunjukkan provider teratas cukup konsisten untuk task ini.",
  };
}
