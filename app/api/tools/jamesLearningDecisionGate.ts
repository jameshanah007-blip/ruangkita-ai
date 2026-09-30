import { getJamesLowMasteryCapabilities, getJamesRecentRegressions } from "./jamesCapabilityMastery";
import { getJamesProviderCooldowns } from "./jamesProviderPerformance";

export type JamesLearningDecision = "learn_now" | "defer" | "skip";

export type JamesLearningDecisionResult = {
  decision: JamesLearningDecision;
  score: number;
  reasons: string[];
  capability?: string;
  retryAfterMinutes?: number;
};

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export async function decideJamesAutonomousLearning(): Promise<JamesLearningDecisionResult> {
  const [weak, regressions, cooldowns] = await Promise.all([
    getJamesLowMasteryCapabilities(10),
    getJamesRecentRegressions(10),
    getJamesProviderCooldowns(),
  ]);

  const reasons: string[] = [];
  const regression = regressions[0];
  const candidate = weak[0];

  if (regression) {
    reasons.push(`Regression detected for ${regression.capability}.`);
  }

  if (candidate && candidate.mastery < 0.5) {
    reasons.push(`Low mastery for ${candidate.capability}: ${candidate.mastery.toFixed(2)}.`);
  }

  const availableProviders = Object.entries(cooldowns).filter(([, until]) => {
    return !until || new Date(until).getTime() <= Date.now();
  }).length;

  const minimumProviders = Math.max(1, envNumber("JAMES_MIN_AVAILABLE_LEARNING_PROVIDERS", 1));

  if (availableProviders < minimumProviders) {
    return {
      decision: "defer",
      score: 0,
      reasons: ["All usable learning providers are currently under cooldown."],
      retryAfterMinutes: 30,
    };
  }

  if (!regression && (!candidate || candidate.mastery >= 0.85)) {
    return {
      decision: "skip",
      score: 0,
      reasons: ["No urgent mastery gap or regression requires autonomous learning."],
    };
  }

  const regressionBoost = regression ? 0.45 : 0;
  const masteryGap = candidate ? Math.max(0, 1 - candidate.mastery) * 0.4 : 0;
  const score = Math.min(1, regressionBoost + masteryGap + (candidate?.lastOutcome === "failure" ? 0.15 : 0));

  const threshold = Math.max(0, Math.min(1, envNumber("JAMES_AUTONOMOUS_LEARNING_THRESHOLD", 0.35)));

  if (score < threshold) {
    return {
      decision: "defer",
      score,
      reasons: reasons.length ? reasons : ["Learning priority is below the autonomous decision threshold."],
      retryAfterMinutes: 60,
      capability: candidate?.capability,
    };
  }

  return {
    decision: "learn_now",
    score,
    reasons: reasons.length ? reasons : ["A measurable capability gap requires learning."],
    capability: regression?.capability ?? candidate?.capability,
  };
}
