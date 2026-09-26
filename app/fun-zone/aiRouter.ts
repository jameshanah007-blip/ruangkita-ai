import {
  aiProviders,
  type AIProvider,
  type AIGenerateRequest,
  type AIGenerateResponse,
} from "./aiProvider";

import {
  openRouterProvider,
} from "./openRouterProvider";

import {
  groqProvider,
} from "./groqProvider";

export type AIRouterResult =
  AIGenerateResponse & {
    attempts: string[];
  };

type ProviderError = Error & {
  provider?: string;
  status?: number;
};

const PROVIDER_TIMEOUT_MS = 20_000;

type ProviderFailureReason = "timeout" | "quota" | "rate_limit" | "auth" | "server" | "network" | "empty" | "invalid" | "unknown";

function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown provider error.";
}

function getErrorStatus(
  error: unknown
): number | undefined {
  if (
    error &&
    typeof error === "object" &&
    "status" in error
  ) {
    const status =
      (error as {
        status?: unknown;
      }).status;

    if (typeof status === "number") {
      return status;
    }
  }

  return undefined;
}

function classifyProviderFailure(error: unknown): ProviderFailureReason {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error).toLowerCase();
  if (status === 401 || status === 403) return "auth";
  if (status === 429 || message.includes("rate limit") || message.includes("too many requests")) return "rate_limit";
  if (message.includes("quota") || message.includes("insufficient quota") || message.includes("exceeded")) return "quota";
  if (status === 408 || message.includes("timeout") || message.includes("timed out")) return "timeout";
  if (status === 500 || status === 502 || status === 503 || status === 504 || message.includes("temporarily unavailable") || message.includes("server error")) return "server";
  if (message.includes("network") || message.includes("fetch failed") || message.includes("econn") || message.includes("socket")) return "network";
  if (message.includes("tidak menghasilkan output teks") || message.includes("output kosong") || message.includes("empty output")) return "empty";
  if (status && status >= 400) return "invalid";
  return "unknown";
}

function isRetryableProviderError(error: unknown): boolean {
  return ["timeout", "quota", "rate_limit", "server", "network", "empty"].includes(classifyProviderFailure(error));
}

function validateProviderResponse(providerName: string, result: AIGenerateResponse): AIGenerateResponse {
  if (!result || typeof result.text !== "string") {
    const error = new Error(providerName + " mengembalikan respons dengan format tidak valid.") as ProviderError;
    error.provider = providerName;
    throw error;
  }
  const text = result.text.trim();
  if (!text) {
    const error = new Error(providerName + " menghasilkan output kosong.") as ProviderError;
    error.provider = providerName;
    throw error;
  }
  if (typeof result.provider !== "string" || typeof result.model !== "string") {
    const error = new Error(providerName + " mengembalikan metadata respons tidak valid.") as ProviderError;
    error.provider = providerName;
    throw error;
  }
  return { ...result, text };
}

function getProviderList(): AIProvider[] {
  const providers = [...aiProviders, openRouterProvider, groqProvider];
  return Array.from(new Map(providers.map((provider) => [provider.name, provider])).values());
}

function formatProviderFailure(providerName: string, error: unknown): string {
  const status = getErrorStatus(error);
  const reason = classifyProviderFailure(error);
  const message = getErrorMessage(error);
  const prefix = status ? providerName + ": HTTP " + status : providerName;
  return prefix + " [" + reason + "] - " + message;
}

async function tryProvider(provider: AIProvider, request: AIGenerateRequest): Promise<AIGenerateResponse> {
  const result = await generateWithTimeout(provider.name, () => provider.generate(request));
  return validateProviderResponse(provider.name, result);
}
async function generateWithTimeout(
  providerName: string,
  providerGenerate: () =>
    Promise<AIGenerateResponse>
): Promise<AIGenerateResponse> {
  let timeoutId:
    ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise =
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const error =
          new Error(
            `${providerName} timeout setelah ${
              PROVIDER_TIMEOUT_MS / 1000
            } detik.`
          ) as ProviderError;

        error.provider =
          providerName;

        error.status = 408;

        reject(error);
      }, PROVIDER_TIMEOUT_MS);
    });

  try {
    return await Promise.race([
      providerGenerate(),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function generateWithAIRouter(
  request: AIGenerateRequest
): Promise<AIRouterResult> {
  const providers = getProviderList();

  const availableProviders =
    providers.filter(
      (provider) =>
        provider.isAvailable()
    );

  if (
    availableProviders.length === 0
  ) {
    throw new Error(
      "Tidak ada AI provider yang tersedia. Periksa konfigurasi API key."
    );
  }

  const attempts: string[] = [];

  for (
    const provider of availableProviders
  ) {
    try {
      console.log(
        `AI Router mencoba provider: ${provider.name}`
      );

      const startedAt =
        Date.now();

      const result = await tryProvider(provider, request);

      const elapsed =
        Date.now() - startedAt;

      console.log(
        `AI Router berhasil menggunakan: ${provider.name} (${elapsed}ms)`
      );

      return {
        ...result,
        attempts,
      };
    } catch (error) {
      const message =
        getErrorMessage(error);

      const status =
        getErrorStatus(error);

      const reason = classifyProviderFailure(error);
      const retryable = isRetryableProviderError(error);
      const detail = formatProviderFailure(provider.name, error);

      attempts.push(detail);

      console.error(
        `AI provider ${provider.name} gagal:`,
        {
          message,
          status,
          reason,
          retryable,
        }
      );

      /*
       * Semua provider dicoba secara berurutan.
       *
       * Contoh:
       * Gemini quota habis
       *   ↓
       * OpenRouter dicoba
       *   ↓
       * OpenRouter timeout/error
       *   ↓
       * Groq dicoba
       *
       * Jadi kegagalan satu provider tidak
       * menghentikan AI Game Lab.
       */
      console.warn(
        `Provider ${provider.name} gagal [${reason}]. ${retryable ? "Fallback dilanjutkan." : "Tetap mencoba provider berikutnya untuk menjaga availability."}`
      );
    }
  }

  const error =
    new Error(
      `Semua AI provider gagal. ${attempts.join(
        " | "
      )}`
    ) as ProviderError;

  error.provider =
    "ai-router";

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

  const availableProviders = providers.filter((provider) => provider.isAvailable());

  if (!availableProviders.length) {
    throw new Error("Tidak ada AI provider yang tersedia untuk James Learning.");
  }

  const results = await Promise.allSettled(
    availableProviders.map(async (provider) => {
      const attempts: string[] = [];
      try {
        const result = await tryProvider(provider, request);
        return { ...result, attempts };
      } catch (error) {
        attempts.push(formatProviderFailure(provider.name, error));
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
          attempts,
        });
      }
    })
  );

  const successful = results
    .filter(
      (result): result is PromiseFulfilledResult<AIGenerateResponse & { attempts: string[] }> =>
        result.status === "fulfilled"
    )
    .map((result) => result.value);

  if (!successful.length) {
    const failures = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => getErrorMessage(result.reason))
      .join(" | ");

    throw new Error(`Semua AI provider gagal dalam James Learning. ${failures}`);
  }

  return successful;
}
