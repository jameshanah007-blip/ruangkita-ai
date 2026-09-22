import type {
  AIProvider,
  AIGenerateRequest,
  AIGenerateResponse,
} from "./aiProvider";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_MODEL = "openrouter/free";

function extractTextFromResponse(data: any): string {
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const text = content
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

        return "";
      })
      .join("")
      .trim();

    if (text) {
      return text;
    }
  }

  const messageContent =
    data?.choices?.[0]?.message?.content;

  if (
    messageContent &&
    typeof messageContent === "object"
  ) {
    const text =
      messageContent.text ||
      messageContent.value ||
      messageContent.content;

    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }
  }

  if (
    typeof data?.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  if (
    typeof data?.text === "string" &&
    data.text.trim()
  ) {
    return data.text.trim();
  }

  return "";
}

class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter" as const;

  isAvailable(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }

  async generate(
    request: AIGenerateRequest
  ): Promise<AIGenerateResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY belum dikonfigurasi."
      );
    }

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "RuangKita AI",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: "system",
            content: request.systemInstruction,
          },
          {
            role: "user",
            content: request.prompt,
          },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxOutputTokens ?? 4000,
      }),
    });

    const rawText = await response.text();

    let data: any;

    try {
      data = JSON.parse(rawText);
    } catch {
      const error = new Error(
        `OpenRouter mengembalikan respons non-JSON: ${rawText.slice(
          0,
          500
        )}`
      ) as Error & {
        provider?: string;
        status?: number;
      };

      error.provider = "openrouter";
      error.status = response.status;

      throw error;
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        "OpenRouter gagal menghasilkan respons.";

      const error = new Error(message) as Error & {
        provider?: string;
        status?: number;
      };

      error.provider = "openrouter";
      error.status = response.status;

      throw error;
    }

    const text = extractTextFromResponse(data);

    if (!text) {
      console.error(
        "OpenRouter response tidak memiliki output teks:",
        JSON.stringify(data).slice(0, 5000)
      );

      throw new Error(
        "OpenRouter tidak menghasilkan output teks."
      );
    }

    return {
      text,
      provider: "openrouter",
      model:
        typeof data?.model === "string"
          ? data.model
          : OPENROUTER_MODEL,
    };
  }
}

export const openRouterProvider =
  new OpenRouterProvider();