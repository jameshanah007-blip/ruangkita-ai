import {
  aiProviders,
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

function isRetryableProviderError(
  error: unknown
): boolean {
  const status =
    getErrorStatus(error);

  const message =
    getErrorMessage(error)
      .toLowerCase();

  if (
    status === 401 ||
    status === 403
  ) {
    return false;
  }

  if (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
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
  const providers = [
    ...aiProviders,
    openRouterProvider,
    groqProvider,
  ];

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

      const result =
        await generateWithTimeout(
          provider.name,
          () =>
            provider.generate(
              request
            )
        );

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

      const retryable =
        isRetryableProviderError(
          error
        );

      const detail =
        status
          ? `${provider.name}: HTTP ${status} - ${message}`
          : `${provider.name}: ${message}`;

      attempts.push(detail);

      console.error(
        `AI provider ${provider.name} gagal:`,
        {
          message,
          status,
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
      if (!retryable) {
        console.warn(
          `Provider ${provider.name} mengalami error yang tidak retryable. Tetap lanjut ke provider berikutnya.`
        );
      } else {
        console.warn(
          `Provider ${provider.name} mengalami error retryable. Lanjut ke provider berikutnya.`
        );
      }
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
        const result = await generateWithTimeout(
          provider.name,
          () => provider.generate(request)
        );
        return { ...result, attempts };
      } catch (error) {
        attempts.push(
          `${provider.name}: ${getErrorMessage(error)}`
        );
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
