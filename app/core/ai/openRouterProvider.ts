import type {
  AIProvider,
  AIGenerateRequest,
  AIGenerateResponse,
} from "./aiProvider";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_MODEL = "openrouter/free";

function extractTextFromResponse(data: any): string {
  const choice = data?.choices?.[0];
  const message = choice?.message;

  const candidates = [
    message?.content,
    message?.text,
    message?.output_text,
    data?.output_text,
    data?.text,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }

    if (Array.isArray(candidate)) {
      const text = candidate
        .map((item: any) => {
          if (typeof item === "string") {
            return item;
          }

          if (
            item &&
            typeof item.text === "string"
          ) {
            return item.text;
          }

          if (
            item &&
            typeof item.content === "string"
          ) {
            return item.content;
          }

          return "";
        })
        .join("")
        .trim();

      if (text) {
        return text;
      }
    }

    if (
      candidate &&
      typeof candidate === "object"
    ) {
      const text =
        candidate.text ||
        candidate.value ||
        candidate.content;

      if (
        typeof text === "string" &&
        text.trim()
      ) {
        return text.trim();
      }
    }
  }

  return "";
}

class OpenRouterProvider
  implements AIProvider
{
  readonly name = "openrouter" as const;

  isAvailable(): boolean {
    return Boolean(
      process.env.OPENROUTER_API_KEY
    );
  }

  async generate(
    request: AIGenerateRequest
  ): Promise<AIGenerateResponse> {
    const apiKey =
      process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY belum dikonfigurasi."
      );
    }

    const response = await fetch(
      OPENROUTER_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${apiKey}`,

          "HTTP-Referer":
            "http://localhost:3000",

          "X-Title":
            "RuangKita AI",
        },

        body: JSON.stringify({
          model: OPENROUTER_MODEL,

          messages: [
            {
              role: "system",
              content:
                request.systemInstruction,
            },
            {
              role: "user",
              content:
                request.prompt,
            },
          ],

          temperature:
            request.temperature ?? 0.7,

          max_tokens:
            request.maxOutputTokens ?? 4000,
        }),
      }
    );

    const rawText =
      await response.text();

    let data: any;

    try {
      data = JSON.parse(rawText);
    } catch {
      const error =
        new Error(
          `OpenRouter mengembalikan respons non-JSON: ${rawText.slice(
            0,
            500
          )}`
        ) as Error & {
          provider?: string;
          status?: number;
        };

      error.provider =
        "openrouter";

      error.status =
        response.status;

      throw error;
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        "OpenRouter gagal menghasilkan respons.";

      const error =
        new Error(message) as Error & {
          provider?: string;
          status?: number;
        };

      error.provider =
        "openrouter";

      error.status =
        response.status;

      throw error;
    }

    const text =
      extractTextFromResponse(data);

    if (!text) {
      const finishReason =
        data?.choices?.[0]?.finish_reason ||
        "unknown";

      const refusal =
        data?.choices?.[0]?.message?.refusal;

      console.error(
        "OpenRouter tidak menghasilkan output teks.",
        {
          model:
            data?.model ||
            OPENROUTER_MODEL,

          finishReason,

          refusal:
            typeof refusal === "string"
              ? refusal.slice(0, 500)
              : undefined,

          responsePreview:
            JSON.stringify(data).slice(
              0,
              5000
            ),
        }
      );

      throw new Error(
        `OpenRouter tidak menghasilkan output teks (finish_reason: ${finishReason}).`
      );
    }

    return {
      text,

      provider:
        "openrouter",

      model:
        typeof data?.model === "string"
          ? data.model
          : OPENROUTER_MODEL,
    };
  }
}

export const openRouterProvider =
  new OpenRouterProvider();