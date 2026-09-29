import { createClient } from "@supabase/supabase-js";
import type { AIProviderName } from "../../fun-zone/aiProvider";
import type { JamesResourceTask } from "./jamesResourceManager";
import { getJamesProviderPerformance, scoreJamesProviderPerformance } from "./jamesProviderPerformance";
import { getJamesDecisionMemory } from "./jamesDecisionMemory";

export type JamesDecisionStrategy = "single-provider" | "multi-provider" | "fallback-first" | "explore-and-verify";
export type JamesBrainDecision = {
  task: JamesResourceTask; strategy: JamesDecisionStrategy; rankedProviders: AIProviderName[];
  confidence: number; evidenceCount: number; successfulEvidence: number; failedEvidence: number; reason: string;
};
const PROVIDERS: AIProviderName[] = ["openai", "gemini", "openrouter", "groq"];
function clamp(value: number) { return Math.max(0, Math.min(1, value)); }
function taskDefaultOrder(task: JamesResourceTask): AIProviderName[] {
  switch (task) {
    case "planning": case "reasoning": case "verification": return ["openai", "gemini", "groq", "openrouter"];
    case "research": return ["gemini", "openai", "openrouter", "groq"];
    case "learning": return ["gemini", "openai", "groq", "openrouter"];
    case "fallback": return ["openrouter", "groq", "gemini", "openai"];
    default: return ["openai", "gemini", "groq", "openrouter"];
  }
}

export async function decideJamesBrainStrategy(task: JamesResourceTask, userId?: string): Promise<JamesBrainDecision> {
  const [performance, decisions] = await Promise.all([
    getJamesProviderPerformance(task), getJamesDecisionMemory(task, 30),
  ]);
  const defaults = taskDefaultOrder(task);
  const performanceByProvider = new Map(performance.map((item) => [item.provider, item]));
  const providerEvidence = new Map<AIProviderName, { success: number; failure: number; quality: number; count: number }>();
  for (const provider of PROVIDERS) providerEvidence.set(provider, { success: 0, failure: 0, quality: 0, count: 0 });

  for (const decision of decisions) {
    for (const provider of decision.providers) {
      const evidence = providerEvidence.get(provider); if (!evidence) continue;
      evidence.count += 1; evidence.quality += decision.quality;
      if (decision.verified && decision.outcome === "success") evidence.success += 1;
      if (decision.outcome === "failure") evidence.failure += 1;
    }
  }

  const ranked = defaults.map((provider, index) => {
    const item = performanceByProvider.get(provider);
    const base = scoreJamesProviderPerformance(item, index);
    const history = providerEvidence.get(provider)!;
    const historicalSuccess = history.count ? history.success / history.count : 0.5;
    const historicalQuality = history.count ? history.quality / history.count : 0.5;
    const historicalFailure = history.count ? history.failure / history.count : 0;
    return { provider, score: clamp(base * 0.60 + historicalSuccess * 0.18 + historicalQuality * 0.12 + (1 - historicalFailure) * 0.10), attempts: item?.attempts || 0, evidence: history.count };
  }).sort((a, b) => b.score - a.score);

  const totalEvidence = decisions.length + performance.reduce((sum, item) => sum + item.attempts, 0);
  const successfulEvidence = decisions.filter((item) => item.verified && item.outcome === "success").length;
  const failedEvidence = decisions.filter((item) => item.outcome === "failure").length;
  const top = ranked[0];
  const second = ranked[1];
  const closeRace = Boolean(second && Math.abs(top.score - second.score) < 0.07);
  const weakEvidence = totalEvidence < 4 || top.attempts < 3;
  const failurePressure = failedEvidence >= 2 || (top.evidence >= 3 && providerEvidence.get(top.provider)!.failure >= 2);

  const { data: selfModel } = await (async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) return Promise.resolve({ data: null });
    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
    let query = client
      .from("james_self_model")
      .select("capability_name,competence,confidence,status")
      .order("competence", { ascending: false })
      .limit(12);
    if (userId) query = query.eq("user_id", userId);
    return query;
  })();

  const capabilityEvidence = Array.isArray(selfModel) ? selfModel.length : 0;
  const weakCapabilities = Array.isArray(selfModel) ? selfModel.filter((row: any) => Number(row.competence) < 0.70 || row.status === "developing" || row.status === "unknown").length : 0;
  const selfModelConfidence = capabilityEvidence ? (Array.isArray(selfModel) ? selfModel.reduce((sum: number, row: any) => sum + Number(row.confidence || 0), 0) / capabilityEvidence : 0) : 0;
  const successfulModes = decisions.filter((item) => item.verified && item.outcome === "success").map((item) => item.mode);
  const multiSuccess = successfulModes.filter((mode) => mode === "multi" || mode === "specialized").length;
  const singleSuccess = successfulModes.filter((mode) => mode === "single").length;

  let strategy: JamesDecisionStrategy;
  if (task === "fallback") strategy = "fallback-first";
  else if (weakEvidence || closeRace || failurePressure || weakCapabilities > Math.max(2, capabilityEvidence / 2)) strategy = "explore-and-verify";
  else if (multiSuccess > singleSuccess + 1) strategy = "multi-provider";
  else strategy = "single-provider";

  const confidence = clamp(top.score * 0.50 + Math.min(1, totalEvidence / 12) * 0.20 + (successfulEvidence / Math.max(1, successfulEvidence + failedEvidence)) * 0.15 + selfModelConfidence * 0.15);
  const reasonParts = [
    "Strategi " + strategy + " dipilih dari evidence task " + task + ".",
    "Provider teratas: " + top.provider + " dengan skor " + top.score.toFixed(2) + ".",
  ];
  if (weakCapabilities > 0) reasonParts.push("Self-model menemukan " + weakCapabilities + " capability yang masih lemah sehingga verifikasi/pembelajaran diprioritaskan.");
  if (weakEvidence) reasonParts.push("Evidence provider masih tipis sehingga James perlu eksplorasi dan verifikasi.");
  if (closeRace) reasonParts.push("Dua provider teratas berdekatan sehingga single-provider belum cukup kuat.");
  if (failurePressure) reasonParts.push("Riwayat kegagalan meningkatkan kebutuhan fallback/verifikasi.");
  if (multiSuccess > singleSuccess) reasonParts.push("Decision memory menunjukkan routing multi-provider berhasil lebih sering.");
  else if (singleSuccess > multiSuccess) reasonParts.push("Decision memory menunjukkan routing single-provider cukup konsisten.");

  return { task, strategy, rankedProviders: ranked.map((item) => item.provider), confidence, evidenceCount: totalEvidence + capabilityEvidence, successfulEvidence, failedEvidence, reason: reasonParts.join(" ") };
}
