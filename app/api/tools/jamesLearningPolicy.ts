import type { AIProviderName } from "../../fun-zone/aiProvider";
import type { JamesResourceTask } from "./jamesResourceManager";
import { decideJamesBrainStrategy } from "./jamesDecisionEngine";
import { critiqueJamesPolicy, saveJamesPolicyCritique } from "./jamesPolicyCritic";

export type JamesLearningMode = "single" | "fallback" | "multi";

export type JamesLearningPolicy = {
  mode: JamesLearningMode;
  rankedProviders: AIProviderName[];
  confidence: number;
  reason: string;
};

export async function planJamesLearningPolicy(task: JamesResourceTask, userId?: string): Promise<JamesLearningPolicy> {
  const decision = await decideJamesBrainStrategy(task, userId);

  const mode: JamesLearningMode =
    decision.strategy === "single-provider"
      ? "single"
      : decision.strategy === "fallback-first"
        ? "fallback"
        : "multi";

  const critique = await critiqueJamesPolicy(task, {
    mode,
    rankedProviders: decision.rankedProviders,
    confidence: decision.confidence,
    reason: decision.reason,
  });
  await saveJamesPolicyCritique(critique);

  if (critique.recommendation === "reduce_confidence") {
    return {
      mode: "multi",
      rankedProviders: decision.rankedProviders,
      confidence: Math.max(0.25, decision.confidence - 0.15),
      reason: decision.reason + " Policy critic meminta confidence lebih rendah: " + critique.reason,
    };
  }

  if (critique.recommendation === "increase_confidence") {
    return {
      mode,
      rankedProviders: decision.rankedProviders,
      confidence: Math.min(0.95, decision.confidence + 0.05),
      reason: decision.reason + " Policy critic menemukan evidence positif berulang: " + critique.reason,
    };
  }

  if (critique.recommendation === "explore" && mode === "single") {
    return {
      mode: "multi",
      rankedProviders: decision.rankedProviders,
      confidence: Math.min(0.70, decision.confidence),
      reason: decision.reason + " Policy critic meminta eksplorasi tambahan: " + critique.reason,
    };
  }

  return {
    mode,
    rankedProviders: decision.rankedProviders,
    confidence: decision.confidence,
    reason: decision.reason,
  };
}
