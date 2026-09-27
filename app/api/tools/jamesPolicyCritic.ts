import { createClient } from "@supabase/supabase-js";
import type { JamesLearningMode, JamesLearningPolicy } from "./jamesLearningPolicy";
import type { JamesResourceTask } from "./jamesResourceManager";
import { getJamesDecisionMemory } from "./jamesDecisionMemory";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export type JamesPolicyCritique = {
  task: JamesResourceTask;
  policyMode: JamesLearningMode;
  policyConfidence: number;
  decisionCount: number;
  successCount: number;
  failureCount: number;
  averageQuality: number;
  policyScore: number;
  recommendation: "hold" | "reduce_confidence" | "increase_confidence" | "explore";
  reason: string;
};

export async function critiqueJamesPolicy(
  task: JamesResourceTask,
  policy: JamesLearningPolicy,
): Promise<JamesPolicyCritique> {
  const decisions = await getJamesDecisionMemory(task, 20);
  const matching = decisions.filter((item) => item.mode === policy.mode);
  const decisionCount = matching.length;
  const successCount = matching.filter((item) => item.verified && item.outcome === "success").length;
  const failureCount = matching.filter((item) => item.outcome === "failure").length;
  const averageQuality = decisionCount
    ? matching.reduce((sum, item) => sum + item.quality, 0) / decisionCount
    : 0.5;

  const empiricalSuccess = decisionCount ? successCount / decisionCount : 0.5;
  const policyScore = decisionCount
    ? empiricalSuccess * 0.55 + averageQuality * 0.45
    : 0.5;

  let recommendation: JamesPolicyCritique["recommendation"] = "hold";
  let reason = "Belum ada cukup evidence untuk mengubah confidence policy.";

  if (decisionCount < 3) {
    recommendation = "explore";
    reason = "Evidence policy masih tipis; pertahankan eksplorasi sebelum mengunci strategi.";
  } else if (failureCount >= 3 && policyScore < 0.55) {
    recommendation = "reduce_confidence";
    reason = "Beberapa keputusan policy gagal dan skor empiris menurun.";
  } else if (successCount >= 4 && policyScore >= 0.78) {
    recommendation = "increase_confidence";
    reason = "Policy menunjukkan keberhasilan berulang dengan quality yang konsisten.";
  }

  return {
    task,
    policyMode: policy.mode,
    policyConfidence: policy.confidence,
    decisionCount,
    successCount,
    failureCount,
    averageQuality,
    policyScore,
    recommendation,
    reason,
  };
}

export async function saveJamesPolicyCritique(
  critique: JamesPolicyCritique,
) {
  const supabase = db();
  if (!supabase) return false;

  const { error } = await supabase.from("james_policy_critiques").insert({
    task: critique.task,
    policy_mode: critique.policyMode,
    policy_confidence: critique.policyConfidence,
    decision_count: critique.decisionCount,
    success_count: critique.successCount,
    failure_count: critique.failureCount,
    average_quality: critique.averageQuality,
    policy_score: critique.policyScore,
    recommendation: critique.recommendation,
    reason: critique.reason.slice(0, 700),
  });

  return !error;
}
