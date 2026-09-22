import type {
  AIProvider,
  AIGenerateRequest,
  AIGenerateResponse,
} from "./aiProvider";

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const GROQ_MODEL =
  "openai/gpt-oss-20b";

class GroqProvider
  implements AIProvider
{
  readonly name = "groq" as const;

  isAvailable(): boolean {
    return Boolean(
      process.env.GROQ_API_KEY
    );
  }

  async generate(
    request: AIGenerateRequest
  ): Promise<AIGenerateResponse> {
    const apiKey =
      process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY belum dikonfigurasi."
      );
    }

    const response = await fetch(
      GROQ_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
          Authorization: `Bearer ${apiKey}`,
        },

        body: JSON.stringify({
          model: GROQ_MODEL,

          messages: [
            {
              role: "system",
              content:
                request.systemInstruction,
            },
            {
              role: "user",
              content: request.prompt,
            },
          ],

          temperature:
            request.temperature ?? 0.7,

          max_tokens:
            request.maxOutputTokens ?? 4000,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const message =
        data?.error?.message ||
        "Groq gagal menghasilkan respons.";

      const error = new Error(
        message
      ) as Error & {
        provider?: string;
        status?: number;
      };

      error.provider = "groq";
      error.status = response.status;

      throw error;
    }

    const text =
      data?.choices?.[0]?.message?.content;

    if (
      typeof text !== "string" ||
      !text.trim()
    ) {
      throw new Error(
        "Groq tidak menghasilkan output teks."
      );
    }

    return {
      text: text.trim(),
      provider: "groq",
      model:
        data?.model ||
        GROQ_MODEL,
    };
  }
}

export const groqProvider =
  new GroqProvider();