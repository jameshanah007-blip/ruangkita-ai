import {
  aiProviders,
  type AIProvider,
  type AIProviderName,
  type AIGenerateRequest,
  type AIGenerateResponse,
} from "../../fun-zone/aiProvider";
import { openRouterProvider } from "../../fun-zone/openRouterProvider";
import { groqProvider } from "../../fun-zone/groqProvider";
import { getJamesProviderPerformance, scoreJamesProviderPerformance, getJamesProviderCooldowns, recordJamesProviderFailure, recordJamesProviderSuccess } from "./jamesProviderPerformance";
import { planJamesLearningPolicy } from "./jamesLearningPolicy";

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
const RATE_LIMIT_COOLDOWN_MS = 60_000;

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

function isRateLimited(error: unknown) {
  const status = errorStatus(error);
  const message = errorMessage(error).toLowerCase();

  return status === 429 ||
    message.includes("rate limit") ||
    message.includes("rate_limit") ||
    message.includes("too many requests") ||
    message.includes("tokens per minute") ||
    message.includes("requests per minute") ||
    message.includes("quota exceeded");
}

function isQuotaOrTransient(error: unknown) {
  const status = errorStatus(error);
  const message = errorMessage(error).toLowerCase();

  return isRateLimited(error) ||
    status === 408 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes("quota") ||
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

  if (isRateLimited(error)) {
    current.cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    return;
  }

  if (isQuotaOrTransient(error)) {
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

async function generateWithTimeout(
  provider: AIProvider,
  request: AIGenerateRequest,
  timeoutMs = 20_000
) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      provider.generate(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(provider.name + " timeout.")),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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

async function getCandidates(task: JamesResourceTask) {
  const fallbackOrder = taskOrder(task);
  let rankedProviders: AIProviderName[] = [];

  try {
    const policy = await planJamesLearningPolicy(task);
    rankedProviders = Array.isArray(policy.rankedProviders)
      ? policy.rankedProviders
      : [];
  } catch (error) {
    console.warn("James provider policy unavailable; using static provider order.", error);
  }

  // Policy may rank only a subset of providers. Never let that subset
  // disable the hard fallback chain.
  const order = [...new Set([...rankedProviders, ...fallbackOrder])];
  const performance = await getJamesProviderPerformance(task);\n  const persistentCooldowns = await getJamesProviderCooldowns();

  return order
    .map((name, index) => ({
      provider: providers.find((provider) => provider.name === name),
      score: scoreJamesProviderPerformance(
        performance.find((item) => item.provider === name),
        index
      ),
    }))
    .filter((item): item is { provider: AIProvider; score: number } => Boolean(item.provider))
    .filter((item) => item.provider.isAvailable())
    .filter((item) => {
      const current = state.get(item.provider.name);
      return !current?.cooldownUntil || current.cooldownUntil <= Date.now();
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.provider);
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
  const candidates = await getCandidates(task);

  if (!candidates.length) {
    throw new Error(
      `Tidak ada resource AI yang tersedia untuk task James: ${task}.`
    );
  }

  const failures: string[] = [];

  for (const provider of candidates) {
    const startedAt = Date.now();

    try {
      const result = await generateWithTimeout(provider, request);

      if (!result.text || !result.text.trim()) {
        throw new Error(provider.name + " menghasilkan output teks kosong.");
      }

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

export async function generateWithJamesProviderCollaboration(
  task: JamesResourceTask,
  request: AIGenerateRequest,
  selectedNames: AIProviderName[],
): Promise<JamesResourceResult[]> {
  const selected = selectedNames
    .map((name) => providers.find((provider) => provider.name === name))
    .filter((provider): provider is AIProvider => Boolean(provider))
    .filter((provider) => provider.isAvailable())
    .filter((provider) => {
      const current = state.get(provider.name);
      return !current?.cooldownUntil || current.cooldownUntil <= Date.now();
    })
    .slice(0, 3);

  const results = await Promise.allSettled(selected.map(async (provider) => {
    const startedAt = Date.now();
    try {
      const result = await generateWithTimeout(provider, request);
      if (!result.text || !result.text.trim()) {
        throw new Error(provider.name + " menghasilkan output teks kosong.");
      }
      recordSuccess(provider.name);
      return {
        ...result,
        task,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      recordFailure(provider.name, error);
      throw error;
    }
  }));

  const successful: JamesResourceResult[] = [];
  for (const item of results) {
    if (item.status === "fulfilled") {
      successful.push(item.value);
    }
  }

  return successful;
}

export function getJamesResourceProviderNames(task: JamesResourceTask) {
  return providers.filter((provider) => provider.isAvailable()).map((provider) => provider.name);
}
