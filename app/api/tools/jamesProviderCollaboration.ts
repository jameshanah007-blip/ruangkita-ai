import type { AIProviderName, AIGenerateRequest, AIGenerateResponse } from "../../fun-zone/aiProvider";
import type { JamesResourceTask } from "./jamesResourceManager";
import { getJamesProviderPerformance, scoreJamesProviderPerformance } from "./jamesProviderPerformance";

export type JamesCollaborationResult = AIGenerateResponse & {
  task: JamesResourceTask;
  latencyMs: number;
};

export async function selectJamesCollaborationProviders(
  task: JamesResourceTask,
  limit = 3
): Promise<AIProviderName[]> {
  const performance = await getJamesProviderPerformance(task);
  const defaults: AIProviderName[] = ["openai", "gemini", "openrouter", "groq"];

  return defaults
    .map((provider, index) => ({
      provider,
      score: scoreJamesProviderPerformance(
        performance.find((item) => item.provider === provider),
        index
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(2, Math.min(limit, 3)))
    .map((item) => item.provider);
}

export function buildCollaborationPrompt(
  request: string,
  task: JamesResourceTask,
  provider: AIProviderName
) {
  return [
    "Kamu adalah collaborating provider dalam sistem James.",
    "Kerjakan hanya bagian yang paling berguna untuk task ini.",
    "Jangan mengaku sebagai James dan jangan mengubah identity, memory, atau security policy.",
    "",
    "TASK: " + task,
    "PROVIDER ROLE: " + provider,
    "USER REQUEST:",
    request.slice(0, 5000),
    "",
    "Berikan hasil kerja yang konkret dan dapat diverifikasi oleh synthesizer James.",
  ].join("\n");
}
