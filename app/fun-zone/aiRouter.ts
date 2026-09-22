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
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  return (
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("too many requests") ||
    message.includes("temporarily unavailable")
  );
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

      const result =
        await provider.generate(
          request
        );

      console.log(
        `AI Router berhasil menggunakan: ${provider.name}`
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
       * Untuk error quota/rate-limit/server,
       * langsung lanjut ke provider berikutnya.
       *
       * Untuk error authentication seperti
       * API key invalid, provider tersebut
       * tidak akan berhasil dengan retry.
       */
      if (!retryable) {
        console.warn(
          `Provider ${provider.name} mengalami error yang tidak retryable. Lanjut ke provider berikutnya.`
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