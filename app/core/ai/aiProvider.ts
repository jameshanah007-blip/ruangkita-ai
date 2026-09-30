export type AIProviderName =
  | "gemini"
  | "openrouter"
  | "groq"
  | "openai"
  | "local";

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
  generateStream?(
    request: AIGenerateRequest
  ): AsyncGenerator<string, void, unknown>;
}

export type AIStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; provider: AIProviderName; model: string; text: string; attempts: string[] };

const GEMINI_MODEL = "gemini-3.6-flash";
const OPENAI_MODEL = "gpt-5.6-luna";
const OPENAI_URL = "https://api.openai.com/v1/responses";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

export async function* readSSEText(
  body: ReadableStream<Uint8Array>,
  extractText: (data: any) => string | undefined
): AsyncGenerator<string, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";

      for (const event of events) {
        const dataLine = event
          .split(/\r?\n/)
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue;

        const raw = dataLine.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;

        try {
          const data = JSON.parse(raw);
          const text = extractText(data);
          if (text) yield text;
        } catch {
          // Ignore incomplete/non-JSON SSE frames.
        }
      }
    }

    buffer += decoder.decode();
    const dataLine = buffer
      .split(/\r?\n/)
      .find((line) => line.startsWith("data:"));
    if (dataLine) {
      const raw = dataLine.slice(5).trim();
      if (raw && raw !== "[DONE]") {
        try {
          const text = extractText(JSON.parse(raw));
          if (text) yield text;
        } catch {
          // Ignore malformed final SSE frame.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function createProviderError(
  provider: AIProviderName,
  status: number,
  message: string
) {
  const error = new Error(message) as Error & {
    provider?: string;
    status?: number;
  };
  error.provider = provider;
  error.status = status;
  return error;
}

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

  async *generateStream(
    request: AIGenerateRequest
  ): AsyncGenerator<string, void, unknown> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY belum dikonfigurasi.");

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: request.prompt,
        system_instruction: request.systemInstruction,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      let message = "Gemini streaming gagal.";
      try {
        const data = await response.json();
        message = data?.error?.message || message;
      } catch {}
      throw createProviderError("gemini", response.status, message);
    }

    yield* readSSEText(response.body, (data) => {
      if (
        data?.event_type === "step.delta" &&
        data?.delta?.type === "text" &&
        typeof data.delta.text === "string"
      ) {
        return data.delta.text;
      }
      return undefined;
    });
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

class LocalOllamaProvider implements AIProvider {
  readonly name = "local" as const;

  private baseUrl(): string | null {
    const value = process.env.JAMES_LOCAL_AI_URL?.trim();
    return value ? value.replace(/\\/$/, "") : null;
  }

  private model(): string {
    return process.env.JAMES_LOCAL_MODEL?.trim() || "qwen3:8b";
  }

  isAvailable(): boolean {
    return Boolean(this.baseUrl());
  }

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const baseUrl = this.baseUrl();
    if (!baseUrl) {
      throw new Error("JAMES_LOCAL_AI_URL belum dikonfigurasi.");
    }

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model(),
        messages: [
          { role: "system", content: request.systemInstruction },
          { role: "user", content: request.prompt },
        ],
        stream: false,
        options: {
          temperature: request.temperature ?? 0.2,
          num_predict: request.maxOutputTokens ?? 1200,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const error = new Error(
        data?.error || "Local AI gagal menghasilkan respons."
      ) as Error & { provider?: string; status?: number };
      error.provider = "local";
      error.status = response.status;
      throw error;
    }

    const text = typeof data?.message?.content === "string"
      ? data.message.content.trim()
      : "";

    if (!text) throw new Error("Local AI tidak menghasilkan output teks.");

    return {
      text,
      provider: "local",
      model: typeof data?.model === "string" ? data.model : this.model(),
    };
  }

  async *generateStream(
    request: AIGenerateRequest
  ): AsyncGenerator<string, void, unknown> {
    const baseUrl = this.baseUrl();
    if (!baseUrl) throw new Error("JAMES_LOCAL_AI_URL belum dikonfigurasi.");

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model(),
        messages: [
          { role: "system", content: request.systemInstruction },
          { role: "user", content: request.prompt },
        ],
        stream: true,
        options: {
          temperature: request.temperature ?? 0.2,
          num_predict: request.maxOutputTokens ?? 1200,
        },
      }),
    });

    if (!response.ok || !response.body) {
      let message = "Local AI streaming gagal.";
      try {
        const data = await response.json();
        message = data?.error || message;
      } catch {}
      const error = new Error(message) as Error & { provider?: string; status?: number };
      error.provider = "local";
      error.status = response.status;
      throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        for (const line of buffer.split(/\\r?\\n/)) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            const text = data?.message?.content;
            if (typeof text === "string" && text) yield text;
          } catch {
            // Keep partial JSON for the next network chunk.
          }
        }

        const lines = buffer.split(/\\r?\\n/);
        buffer = lines.pop() ?? "";
      }

      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          const text = data?.message?.content;
          if (typeof text === "string" && text) yield text;
        } catch {}
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const aiProviders: AIProvider[] = [
  new GeminiProvider(),
  new OpenAIProvider(),
  new LocalOllamaProvider(),
];