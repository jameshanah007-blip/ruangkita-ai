import { getJamesLowMasteryCapabilities, getJamesRecentRegressions } from "./jamesCapabilityMastery";
import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

async function getProviderCooldowns() {
  const supabase = db();
  if (!supabase) return {} as Record<string, string | null>;
  const { data, error } = await supabase.from("james_provider_performance").select("provider, cooldown_until");
  if (error) return {} as Record<string, string | null>;
  return Object.fromEntries((data ?? []).map((row) => [String(row.provider), row.cooldown_until as string | null]));
}

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
    getProviderCooldowns(),
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
