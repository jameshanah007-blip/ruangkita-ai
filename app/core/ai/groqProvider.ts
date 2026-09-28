import type {
  AIProvider,
  AIGenerateRequest,
  AIGenerateResponse,
} from "./aiProvider";

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const GROQ_MODEL =
  "openai/gpt-oss-20b";

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
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();

    if (Array.isArray(candidate)) {
      const text = candidate.map((item: any) => {
        if (typeof item === "string") return item;
        if (item && typeof item.text === "string") return item.text;
        if (item && typeof item.content === "string") return item.content;
        return "";
      }).join("").trim();

      if (text) return text;
    }

    if (candidate && typeof candidate === "object") {
      const text = candidate.text || candidate.value || candidate.content;
      if (typeof text === "string" && text.trim()) return text.trim();
    }
  }

  return "";
}

class GroqProvider implements AIProvider {
  readonly name = "groq" as const;

  isAvailable(): boolean {
    return Boolean(process.env.GROQ_API_KEY);
  }

  async generate(
    request: AIGenerateRequest
  ): Promise<AIGenerateResponse> {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error("GROQ_API_KEY belum dikonfigurasi.");
    }

    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: request.systemInstruction },
          { role: "user", content: request.prompt },
        ],
        reasoning_effort: "low",
        include_reasoning: false,
        temperature: request.temperature ?? 0.7,
        // Groq currently exposes an 8k TPM limit for this organization/model.\n        // Keep a conservative completion cap so prompt tokens + completion tokens\n        // do not immediately push the request over the TPM window.\n        max_completion_tokens: Math.min(request.maxOutputTokens ?? 5000, 5000),
        stream: false,
      }),
    });

    const rawText = await response.text();

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      const error = new Error(
        `Groq mengembalikan respons non-JSON: ${rawText.slice(0, 500)}`
      ) as Error & { provider?: string; status?: number };
      error.provider = "groq";
      error.status = response.status;
      throw error;
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        "Groq gagal menghasilkan respons.";
      const error = new Error(message) as Error & {
        provider?: string;
        status?: number;
      };
      error.provider = "groq";
      error.status = response.status;
      throw error;
    }

    const text = extractTextFromResponse(data);
    const finishReason = data?.choices?.[0]?.finish_reason || "unknown";
    const refusal = data?.choices?.[0]?.message?.refusal;

    if (!text) {
      console.error("Groq tidak menghasilkan output teks.", {
        model: data?.model || GROQ_MODEL,
        finishReason,
        refusal: typeof refusal === "string" ? refusal.slice(0, 500) : undefined,
        reasoning:
          typeof data?.choices?.[0]?.message?.reasoning === "string"
            ? data.choices[0].message.reasoning.slice(0, 1000)
            : undefined,
        responsePreview: JSON.stringify(data).slice(0, 3000),
      });

      throw new Error(
        `Groq tidak menghasilkan output teks (finish_reason: ${finishReason}).`
      );
    }

    if (finishReason === "length") {
      console.warn("Groq menghasilkan output dengan finish_reason=length.", {
        model: data?.model || GROQ_MODEL,
        outputLength: text.length,
      });
    }

    return {
      text,
      provider: "groq",
      model:
        typeof data?.model === "string"
          ? data.model
          : GROQ_MODEL,
    };
  }
}

export const groqProvider = new GroqProvider();
