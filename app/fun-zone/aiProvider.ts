export type AIProviderName =
  | "gemini"
  | "openrouter"
  | "groq"
  | "openai";

export type AIGenerateRequest = {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type AIGenerateResponse = {
  text: string;
  provider: AIProviderName;
  model: string;
};

export interface AIProvider {
  readonly name: AIProviderName;
  isAvailable(): boolean;
  generate(
    request: AIGenerateRequest
  ): Promise<AIGenerateResponse>;
}

const GEMINI_MODEL = "gemini-3.6-flash";
const OPENAI_MODEL = "gpt-5.6-luna";
const OPENAI_URL = "https://api.openai.com/v1/responses";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

function extractText(data: any): string {
  if (!Array.isArray(data?.steps)) {
    return "";
  }

  const texts: string[] = [];

  for (const step of data.steps) {
    if (step?.type !== "model_output") {
      continue;
    }

    const content = step?.content;

    if (typeof content === "string") {
      texts.push(content);
      continue;
    }

    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === "string") {
          texts.push(item);
          continue;
        }

        if (
          item &&
          typeof item === "object" &&
          typeof item.text === "string"
        ) {
          texts.push(item.text);
        }
      }
    }
  }

  return texts.join("\n").trim();
}

class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;

  isAvailable(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async generate(
    request: AIGenerateRequest
  ): Promise<AIGenerateResponse> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY belum dikonfigurasi."
      );
    }

    const response = await fetch(GEMINI_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },

      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: request.prompt,
        system_instruction:
          request.systemInstruction,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message =
        data?.error?.message ||
        "Gemini gagal menghasilkan respons.";

      const error = new Error(message) as Error & {
        provider?: string;
        status?: number;
      };

      error.provider = "gemini";
      error.status = response.status;

      throw error;
    }

    const text = extractText(data);

    if (!text) {
      throw new Error(
        "Gemini tidak menghasilkan output teks."
      );
    }

    return {
      text,
      provider: "gemini",
      model: GEMINI_MODEL,
    };
  }
}

class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  isAvailable(): boolean { return Boolean(process.env.OPENAI_API_KEY); }
  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY belum dikonfigurasi.");
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: OPENAI_MODEL, instructions: request.systemInstruction, input: request.prompt, max_output_tokens: request.maxOutputTokens ?? 4000 }),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data?.error?.message || "OpenAI gagal menghasilkan respons.") as Error & { provider?: string; status?: number };
      error.provider = "openai"; error.status = response.status; throw error;
    }
    const text = typeof data?.output_text === "string" ? data.output_text.trim() : "";
    if (!text) throw new Error("OpenAI tidak menghasilkan output teks.");
    return { text, provider: "openai", model: typeof data?.model === "string" ? data.model : OPENAI_MODEL };
  }
}

export const aiProviders: AIProvider[] = [
  new GeminiProvider(),
  new OpenAIProvider(),
];