import {
  aiProviders,
  type AIGenerateRequest,
  type AIGenerateResponse,
  type AIStreamEvent,
} from "./aiProvider";
import { openRouterProvider } from "./openRouterProvider";
import { groqProvider } from "./groqProvider";

export type AIRouterResult = AIGenerateResponse & {
  attempts: string[];
};

type ProviderError = Error & {
  provider?: string;
  status?: number;
  retryAfterMs?: number;
};

const PROVIDER_TIMEOUTS_MS: Record<string, number> = {
  gemini: 15_000,
  openrouter: 8_000,
  groq: 10_000,
  openai: 8_000,
};
const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000;
const MAX_TRANSIENT_RETRIES = 1;
const DEFAULT_TRANSIENT_RETRY_MS = 750;
const MAX_TRANSIENT_RETRY_MS = 4_000;
const TRANSIENT_COOLDOWN_MS = 30_000;
const USER_FACING_PROVIDER_ERROR = "James sedang kehabisan jalur AI yang tersedia. Provider utama sedang terkena batas penggunaan, dan jalur cadangan juga belum dapat dipakai. Coba lagi beberapa detik lagi.";
const DAILY_QUOTA_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Best-effort cooldown for warm serverless instances.
// It prevents repeatedly hammering a provider that just returned 429/503.
const providerCooldownUntil = new Map<string, number>();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown provider error.";
}

function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function getRetryAfterMs(error: unknown): number | undefined {
  if (error && typeof error === "object" && "retryAfterMs" in error) {
    const value = (error as { retryAfterMs?: unknown }).retryAfterMs;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  const message = getErrorMessage(error).toLowerCase();
  const msMatch = message.match(/(?:try again|retry)(?: in)?\\s*(\\d+)\\s*ms/);
  if (msMatch) return Number(msMatch[1]);

  const secMatch = message.match(
    /(?:try again|retry)(?: in)?\\s*(\\d+(?:\\.\\d+)?)\\s*s(?:ec(?:ond)?s?)?/
  );
  if (secMatch) return Math.ceil(Number(secMatch[1]) * 1000);

  return undefined;
}

function isDailyQuotaError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("free-models-per-day") ||
    message.includes("requests per day") ||
    message.includes("daily limit") ||
    message.includes("daily quota") ||
    message.includes("insufficient_quota") ||
    message.includes("insufficient quota") ||
    message.includes("no credits") ||
    message.includes("not enough credits") ||
    message.includes("quota exceeded") ||
    message.includes("billing") ||
    message.includes("credit balance")
  );
}

function isRetryableProviderError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error).toLowerCase();

  if (status === 401 || status === 403) return false;

  if ([408, 429, 500, 502, 503, 504].includes(status ?? -1)) {
    return true;
  }

  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("too many requests") ||
    message.includes("temporarily unavailable") ||
    message.includes("network") ||
    message.includes("fetch failed")
  );
}

async function generateWithTimeout(
  providerName: string,
  providerGenerate: () => Promise<AIGenerateResponse>
): Promise<AIGenerateResponse> {
  const timeoutMs =
    PROVIDER_TIMEOUTS_MS[providerName] ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(
        `${providerName} timeout setelah ${timeoutMs / 1000} detik.`
      ) as ProviderError;
      error.provider = providerName;
      error.status = 408;
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([providerGenerate(), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function generateWithAIRouter(
  request: AIGenerateRequest
): Promise<AIRouterResult> {
  // RuangKita's primary provider chain is Gemini -> OpenRouter -> Groq.
  // OpenAI remains an additional last-resort fallback when configured.
  const providers = [
    ...aiProviders.filter((provider) => provider.name === "gemini"),
    openRouterProvider,
    groqProvider,
    ...aiProviders.filter((provider) => provider.name === "openai"),
  ];

  const availableProviders = providers.filter((provider) =>
    provider.isAvailable()
  );

  if (!availableProviders.length) {
    throw new Error(
      "Tidak ada AI provider yang tersedia. Periksa konfigurasi API key."
    );
  }

  const attempts: string[] = [];

  for (const provider of availableProviders) {
    const cooldownUntil = providerCooldownUntil.get(provider.name) ?? 0;
    if (cooldownUntil > Date.now()) {
      attempts.push(
        `${provider.name}: cooldown aktif sampai ${new Date(cooldownUntil).toISOString()}`
      );
      continue;
    }

    let providerSucceeded = false;

    for (let retry = 0; retry <= MAX_TRANSIENT_RETRIES; retry += 1) {
      try {
        console.log(
          `AI Router mencoba provider: ${provider.name}${retry ? ` (retry ${retry})` : ""}`
        );

        const startedAt = Date.now();
        const result = await generateWithTimeout(provider.name, () =>
          provider.generate(request)
        );

        console.log(
          `AI Router berhasil menggunakan: ${provider.name} (${Date.now() - startedAt}ms)`
        );

        providerCooldownUntil.delete(provider.name);
        providerSucceeded = true;

        return {
          ...result,
          attempts,
        };
      } catch (error) {
        const message = getErrorMessage(error);
        const status = getErrorStatus(error);
        const retryable = isRetryableProviderError(error);
        const detail = status
          ? `${provider.name}: HTTP ${status} - ${message}`
          : `${provider.name}: ${message}`;

        if (retry === 0) attempts.push(detail);

        console.error(`AI provider ${provider.name} gagal:`, {
          message,
          status,
          retryable,
          retry,
        });

        // A daily free-model quota will not recover by retrying immediately.
        if (isDailyQuotaError(error)) {
          providerCooldownUntil.set(
            provider.name,
            Date.now() + DAILY_QUOTA_COOLDOWN_MS
          );
          break;
        }

        if (!retryable || retry >= MAX_TRANSIENT_RETRIES) {
          if (retryable) {
            providerCooldownUntil.set(
              provider.name,
              Date.now() + TRANSIENT_COOLDOWN_MS
            );
          }
          break;
        }

        const retryAfterMs = Math.min(
          Math.max(
            getRetryAfterMs(error) ?? DEFAULT_TRANSIENT_RETRY_MS,
            250
          ),
          MAX_TRANSIENT_RETRY_MS
        );

        providerCooldownUntil.set(
          provider.name,
          Date.now() + retryAfterMs
        );

        console.warn(
          `Provider ${provider.name} akan di-retry setelah ${retryAfterMs}ms.`
        );

        await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      }
    }

    if (!providerSucceeded) {
      console.warn(
        `AI Router berpindah dari provider ${provider.name} ke provider berikutnya.`
      );
    }
  }

  const error = new Error(
    USER_FACING_PROVIDER_ERROR
  ) as ProviderError;

  error.provider = "ai-router";
  (error as ProviderError & { attempts?: string[] }).attempts = attempts;
  console.error("AI Router exhausted all providers:", attempts);
  throw error;
}


export async function* streamWithAIRouter(
  request: AIGenerateRequest
): AsyncGenerator<AIStreamEvent, void, unknown> {
  // RuangKita's primary provider chain is Gemini -> OpenRouter -> Groq.
  // OpenAI remains an additional last-resort fallback when configured.
  const providers = [
    ...aiProviders.filter((provider) => provider.name === "gemini"),
    openRouterProvider,
    groqProvider,
    ...aiProviders.filter((provider) => provider.name === "openai"),
  ];
  const availableProviders = providers.filter((provider) => provider.isAvailable());
  if (!availableProviders.length) {
    throw new Error("Tidak ada AI provider yang tersedia. Periksa konfigurasi API key.");
  }

  const attempts: string[] = [];

  for (const provider of availableProviders) {
    const cooldownUntil = providerCooldownUntil.get(provider.name) ?? 0;
    if (cooldownUntil > Date.now()) {
      attempts.push(
        `${provider.name}: cooldown aktif sampai ${new Date(cooldownUntil).toISOString()}`
      );
      continue;
    }

    let emitted = false;
    let fullText = "";

    try {
      console.log(`AI Router streaming mencoba provider: ${provider.name}`);
      const startedAt = Date.now();

      let resolvedModel = provider.name === "gemini"
        ? "gemini-3.6-flash"
        : provider.name === "groq"
          ? "openai/gpt-oss-20b"
          : provider.name === "openrouter"
            ? "openrouter/free"
            : provider.name === "openai"
              ? "gpt-5.6-luna"
              : "unknown";

      if (provider.generateStream) {
        for await (const chunk of provider.generateStream(request)) {
          if (!chunk) continue;
          emitted = true;
          fullText += chunk;
          yield { type: "delta", text: chunk };
        }
      } else {
        const result = await provider.generate(request);
        resolvedModel = result.model;
        if (result.text) {
          emitted = true;
          fullText = result.text;
          yield { type: "delta", text: result.text };
        }
      }

      if (!fullText.trim()) {
        throw new Error(`${provider.name} tidak menghasilkan output teks.`);
      }

      providerCooldownUntil.delete(provider.name);
      console.log(
        `AI Router streaming berhasil menggunakan: ${provider.name} (${Date.now() - startedAt}ms)`
      );

      yield {
        type: "done",
        provider: provider.name,
        model: resolvedModel,
        text: fullText,
        attempts,
      };
      return;
    } catch (error) {
      const message = getErrorMessage(error);
      const status = getErrorStatus(error);
      const detail = status
        ? `${provider.name}: HTTP ${status} - ${message}`
        : `${provider.name}: ${message}`;
      attempts.push(detail);

      console.error(`AI provider streaming ${provider.name} gagal:`, {
        message,
        status,
        emitted,
      });

      if (isDailyQuotaError(error)) {
        providerCooldownUntil.set(provider.name, Date.now() + DAILY_QUOTA_COOLDOWN_MS);
      }

      if (emitted) throw error;
    }
  }

  const error = new Error(
    `Semua AI provider gagal. ${attempts.join(" | ")}`
  ) as ProviderError;
  error.provider = "ai-router";
  throw error;
}

export async function generateWithAllAIProviders(
  request: AIGenerateRequest
): Promise<Array<AIGenerateResponse & { attempts: string[] }>> {
  const providers = [
    ...aiProviders,
    openRouterProvider,
    groqProvider,
  ];

  const availableProviders = providers.filter((provider) =>
    provider.isAvailable()
  );

  if (!availableProviders.length) {
    throw new Error(
      "Tidak ada AI provider yang tersedia untuk James Learning."
    );
  }

  const results = await Promise.allSettled(
    availableProviders.map(async (provider) => {
      const attempts: string[] = [];
      try {
        console.log(`James Learning mencoba provider: ${provider.name}`);
        const startedAt = Date.now();
        const result = await generateWithTimeout(provider.name, () =>
          provider.generate(request)
        );
        console.log(`James Learning berhasil menggunakan: ${provider.name} (${Date.now() - startedAt}ms)`);
        return { ...result, attempts };
      } catch (error) {
        console.error(`James Learning provider ${provider.name} gagal:`, {
          message: getErrorMessage(error),
          status: getErrorStatus(error),
        });
        attempts.push(
          `${provider.name}: ${getErrorMessage(error)}`
        );
        throw Object.assign(
          error instanceof Error
            ? error
            : new Error(String(error)),
          { attempts }
        );
      }
    })
  );

  const successful = results
    .filter(
      (
        result
      ): result is PromiseFulfilledResult<
        AIGenerateResponse & { attempts: string[] }
      > => result.status === "fulfilled"
    )
    .map((result) => result.value);

  if (!successful.length) {
    const failures = results
      .filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected"
      )
      .map((result) => getErrorMessage(result.reason))
      .join(" | ");

    throw new Error(
      `Semua AI provider gagal dalam James Learning. ${failures}`
    );
  }

  return successful;
}
