import type { AIProviderName } from "../../fun-zone/aiProvider";
import type { JamesResourceTask } from "./jamesResourceManager";
import { getJamesProviderPerformance, scoreJamesProviderPerformance } from "./jamesProviderPerformance";
import { getJamesDecisionMemory } from "./jamesDecisionMemory";

export type JamesDecisionStrategy =
  | "single-provider"
  | "multi-provider"
  | "fallback-first"
  | "explore-and-verify";

export type JamesBrainDecision = {
  task: JamesResourceTask;
  strategy: JamesDecisionStrategy;
  rankedProviders: AIProviderName[];
  confidence: number;
  evidenceCount: number;
  successfulEvidence: number;
  failedEvidence: number;
  reason: string;
};

const PROVIDERS: AIProviderName[] = ["openai", "gemini", "openrouter", "groq"];

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function taskDefaultOrder(task: JamesResourceTask): AIProviderName[] {
  switch (task) {
    case "planning":
    case "reasoning":
    case "verification":
      return ["openai", "gemini", "groq", "openrouter"];
    case "research":
      return ["gemini", "openai", "openrouter", "groq"];
    case "learning":
      return ["gemini", "openai", "groq", "openrouter"];
    case "fallback":
      return ["openrouter", "groq", "gemini", "openai"];
    default:
      return ["openai", "gemini", "groq", "openrouter"];
  }
}

/**
 * James Brain Decision Engine.
 *
 * It does not declare a permanent "best" provider. It combines:
 * - provider performance for the current task
 * - successful/failed historical routing decisions
 * - evidence strength
 * - exploration needs
 *
 * The output is a decision with explicit evidence and a reason that can be
 * persisted by the self-evaluation layer.
 */
export async function decideJamesBrainStrategy(
  task: JamesResourceTask,
): Promise<JamesBrainDecision> {
  const [performance, decisions] = await Promise.all([
    getJamesProviderPerformance(task),
    getJamesDecisionMemory(task, 30),
  ]);

  const defaults = taskDefaultOrder(task);
  const performanceByProvider = new Map(performance.map((item) => [item.provider, item]));

  const providerEvidence = new Map<AIProviderName, {
    success: number;
    failure: number;
    quality: number;
    count: number;
  }>();

  for (const provider of PROVIDERS) {
    providerEvidence.set(provider, { success: 0, failure: 0, quality: 0, count: 0 });
  }

  // Decision memory is outcome evidence about complete routing choices.
  // Attribute it only to providers actually present in that decision.
  for (const decision of decisions) {
    for (const provider of decision.providers) {
      const evidence = providerEvidence.get(provider);
      if (!evidence) continue;
      evidence.count += 1;
      evidence.quality += decision.quality;
      if (decision.verified && decision.outcome === "success") evidence.success += 1;
      if (decision.outcome === "failure") evidence.failure += 1;
    }
  }

  const ranked = defaults.map((provider, index) => {
    const item = performanceByProvider.get(provider);
    const base = scoreJamesProviderPerformance(item, index);
    const history = providerEvidence.get(provider)!;
    const historicalSuccess = history.count
      ? history.success / history.count
      : 0.5;
    const historicalQuality = history.count
      ? history.quality / history.count
      : 0.5;
    const historicalFailure = history.count
      ? history.failure / history.count
      : 0;

    // Prior provider performance remains the strongest signal; decision memory
    // modifies it rather than replacing it.
    const score = clamp(
      base * 0.60 +
      historicalSuccess * 0.18 +
      historicalQuality * 0.12 +
      (1 - historicalFailure) * 0.10
    );

    return {
      provider,
      score,
      attempts: item?.attempts || 0,
      evidence: history.count,
    };
  }).sort((a, b) => b.score - a.score);

  const totalEvidence = decisions.length + performance.reduce((sum, item) => sum + item.attempts, 0);
  const successfulEvidence = decisions.filter(
    (item) => item.verified && item.outcome === "success"
  ).length;
  const failedEvidence = decisions.filter((item) => item.outcome === "failure").length;

  const top = ranked[0];
  const second = ranked[1];
  const closeRace = Boolean(second && Math.abs(top.score - second.score) < 0.07);
  const weakEvidence = totalEvidence < 4 || top.attempts < 3;
  const failurePressure = failedEvidence >= 2 || (top.evidence >= 3 &&
    providerEvidence.get(top.provider)!.failure >= 2);

  const successfulModes = decisions
    .filter((item) => item.verified && item.outcome === "success")
    .map((item) => item.mode);

  const multiSuccess = successfulModes.filter(
    (mode) => mode === "multi" || mode === "specialized"
  ).length;
  const singleSuccess = successfulModes.filter((mode) => mode === "single").length;

  let strategy: JamesDecisionStrategy;
  if (task === "fallback") {
    strategy = "fallback-first";
  } else if (weakEvidence || closeRace || failurePressure) {
    strategy = "explore-and-verify";
  } else if (multiSuccess > singleSuccess + 1) {
    strategy = "multi-provider";
  } else {
    strategy = "single-provider";
  }

  const confidence = clamp(
    top.score * 0.55 +
    Math.min(1, totalEvidence / 12) * 0.25 +
    (successfulEvidence / Math.max(1, successfulEvidence + failedEvidence)) * 0.20
  );

  const reasonParts = [
    "Strategi " + strategy + " dipilih dari evidence task " + task + ".",
    "Provider teratas: " + top.provider + " dengan skor " + top.score.toFixed(2) + ".",
  ];

  if (weakEvidence) reasonParts.push("Evidence masih tipis sehingga James perlu eksplorasi dan verifikasi.");
  if (closeRace) reasonParts.push("Dua provider teratas berdekatan sehingga single-provider belum cukup kuat.");
  if (failurePressure) reasonParts.push("Riwayat kegagalan meningkatkan kebutuhan fallback/verifikasi.");
  if (multiSuccess > singleSuccess) {
    reasonParts.push("Decision memory menunjukkan beberapa routing multi-provider berhasil.");
  } else if (singleSuccess > multiSuccess) {
    reasonParts.push("Decision memory menunjukkan routing single-provider cukup konsisten.");
  }

  return {
    task,
    strategy,
    rankedProviders: ranked.map((item) => item.provider),
    confidence,
    evidenceCount: totalEvidence,
    successfulEvidence,
    failedEvidence,
    reason: reasonParts.join(" "),
  };
}
