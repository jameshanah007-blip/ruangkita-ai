import { getJamesGoals } from "./jamesGoals";
import { getOpenJamesCuriosity } from "./jamesCuriosity";
import { getJamesDecisionMemory } from "./jamesDecisionMemory";

export type JamesLearningPriority = {
  topic: string;
  score: number;
  reasons: string[];
  suggestedTask: "learning" | "verification" | "experiment";
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export async function rankJamesLearningPriorities(limit = 5): Promise<JamesLearningPriority[]> {
  const [goals, curiosity] = await Promise.all([
    getJamesGoals(undefined, 20),
    // Global autonomous learning has no user identity, so curiosity is optional.
    Promise.resolve([] as Array<{ topic: string; question: string; importance: number }>),
  ]);

  const decisionMemory = await Promise.all([
    getJamesDecisionMemory("learning", 20),
    getJamesDecisionMemory("verification", 20),
    getJamesDecisionMemory("reasoning", 20),
  ]);

  const priorities = new Map<string, JamesLearningPriority>();

  for (const goal of goals) {
    const topic = goal.goal.trim();
    if (!topic) continue;

    const progressGap = 1 - Math.max(0, Math.min(1, goal.progress));
    const evidenceBonus = goal.evidence ? 0.10 : 0;
    const score = clamp(0.55 * progressGap + evidenceBonus + 0.20);

    priorities.set(topic.toLowerCase(), {
      topic,
      score,
      reasons: [
        "Aktif sebagai goal James.",
        progressGap > 0.5 ? "Gap progress masih besar." : "Goal belum selesai.",
      ],
      suggestedTask: "learning",
    });
  }

  for (const memory of decisionMemory.flat()) {
    if (memory.outcome !== "failure" && memory.outcome !== "partial") continue;

    const topic = memory.reason.trim();
    if (!topic) continue;

    const key = topic.toLowerCase();
    const current = priorities.get(key);
    const failureBonus = memory.outcome === "failure" ? 0.20 : 0.10;
    const verificationBonus = memory.verified ? 0.05 : 0;

    if (current) {
      current.score = clamp(current.score + failureBonus + verificationBonus);
      current.reasons.push("Decision memory menunjukkan kegagalan atau hasil parsial.");
    } else {
      priorities.set(key, {
        topic: topic.slice(0, 300),
        score: clamp(0.35 + failureBonus + verificationBonus),
        reasons: ["Decision memory menunjukkan area yang perlu diperbaiki."],
        suggestedTask: memory.verified ? "verification" : "learning",
      });
    }
  }

  for (const item of curiosity) {
    const topic = item.topic.trim();
    if (!topic) continue;
    priorities.set(topic.toLowerCase(), {
      topic,
      score: clamp(item.importance),
      reasons: ["Curiosity memiliki tingkat kepentingan tinggi."],
      suggestedTask: "learning",
    });
  }

  return [...priorities.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(limit, 20)));
}
