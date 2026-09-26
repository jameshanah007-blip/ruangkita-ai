import {
  aiProviders,
  type AIProvider,
  type AIProviderName,
  type AIGenerateRequest,
  type AIGenerateResponse,
} from "../../fun-zone/aiProvider";
import { openRouterProvider } from "../../fun-zone/openRouterProvider";
import { groqProvider } from "../../fun-zone/groqProvider";

export type JamesResourceTask =
  | "planning"
  | "chat"
  | "research"
  | "reasoning"
  | "learning"
  | "verification"
  | "fallback";

export type JamesProviderHealth = {
  provider: AIProviderName;
  available: boolean;
  failures: number;
  lastFailureAt: number | null;
  cooldownUntil: number | null;
};

export type JamesResourceResult = AIGenerateResponse & {
  task: JamesResourceTask;
  latencyMs: number;
};

const COOLDOWN_MS = 30_000;
const FAILURE_THRESHOLD = 2;

const providers: AIProvider[] = [
  ...aiProviders,
  openRouterProvider,
  groqProvider,
];

const state = new Map<AIProviderName, {
  failures: number;
  lastFailureAt: number | null;
  cooldownUntil: number | null;
}>();

for (const provider of providers) {
  if (!state.has(provider.name)) {
    state.set(provider.name, {
      failures: 0,
      lastFailureAt: null,
      cooldownUntil: null,
    });
  }
}

function errorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isQuotaOrTransient(error: unknown) {
  const status = errorStatus(error);
  const message = errorMessage(error).toLowerCase();

  return status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable") ||
    message.includes("network") ||
    message.includes("fetch failed");
}

function recordFailure(provider: AIProviderName, error: unknown) {
  const current = state.get(provider);
  if (!current) return;

  current.failures += 1;
  current.lastFailureAt = Date.now();

  if (isQuotaOrTransient(error) && current.failures >= FAILURE_THRESHOLD) {
    current.cooldownUntil = Date.now() + COOLDOWN_MS;
  }
}

function recordSuccess(provider: AIProviderName) {
  const current = state.get(provider);
  if (!current) return;

  current.failures = 0;
  current.lastFailureAt = null;
  current.cooldownUntil = null;
}

function taskOrder(task: JamesResourceTask): AIProviderName[] {
  switch (task) {
    case "planning":
      return ["openai", "gemini", "groq", "openrouter"];
    case "research":
      return ["gemini", "openai", "openrouter", "groq"];
    case "verification":
      return ["openai", "gemini", "groq", "openrouter"];
    case "learning":
      return ["gemini", "openai", "groq", "openrouter"];
    case "reasoning":
      return ["openai", "gemini", "groq", "openrouter"];
    case "fallback":
      return ["openrouter", "groq", "gemini", "openai"];
    default:
      return ["openai", "gemini", "groq", "openrouter"];
  }
}

function getCandidates(task: JamesResourceTask) {
  const order = taskOrder(task);

  return order
    .map((name) => providers.find((provider) => provider.name === name))
    .filter((provider): provider is AIProvider => Boolean(provider))
    .filter((provider) => provider.isAvailable())
    .filter((provider) => {
      const current = state.get(provider.name);
      return !current?.cooldownUntil || current.cooldownUntil <= Date.now();
    });
}

export function getJamesProviderHealth(): JamesProviderHealth[] {
  return providers.map((provider) => {
    const current = state.get(provider.name);
    return {
      provider: provider.name,
      available: provider.isAvailable(),
      failures: current?.failures ?? 0,
      lastFailureAt: current?.lastFailureAt ?? null,
      cooldownUntil: current?.cooldownUntil ?? null,
    };
  });
}

export async function generateWithJamesResourceManager(
  task: JamesResourceTask,
  request: AIGenerateRequest
): Promise<JamesResourceResult> {
  const candidates = getCandidates(task);

  if (!candidates.length) {
    throw new Error(
      `Tidak ada resource AI yang tersedia untuk task James: ${task}.`
    );
  }

  const failures: string[] = [];

  for (const provider of candidates) {
    const startedAt = Date.now();

    try {
      const result = await Promise.race([
        provider.generate(request),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`${provider.name} timeout.`)),
            20_000
          )
        ),
      ]);

      recordSuccess(provider.name);

      return {
        ...result,
        task,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      recordFailure(provider.name, error);
      failures.push(`${provider.name}: ${errorMessage(error)}`);
    }
  }

  throw new Error(
    `James Resource Manager gagal menjalankan task ${task}. ${failures.join(" | ")}`
  );
}

export function getJamesResourceProviderNames(task: JamesResourceTask) {
  return getCandidates(task).map((provider) => provider.name);
}
