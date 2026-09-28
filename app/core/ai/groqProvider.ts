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

    const combinedInput = [request.systemInstruction, request.prompt].join("\n\n");
    const inputTokens = estimateTokens(combinedInput);
    const compactedInput = compactForGroq(combinedInput, GROQ_INPUT_TOKEN_BUDGET);
    const systemBudget = Math.floor(GROQ_INPUT_TOKEN_BUDGET * 0.55);
    const promptBudget = GROQ_INPUT_TOKEN_BUDGET - systemBudget;
    const compactedSystem = compactForGroq(request.systemInstruction, systemBudget);
    const compactedPrompt = compactedInput === combinedInput
      ? request.prompt
      : compactForGroq(request.prompt, promptBudget);
    const outputBudget = Math.min(
      request.maxOutputTokens ?? GROQ_OUTPUT_TOKEN_BUDGET,
      GROQ_OUTPUT_TOKEN_BUDGET,
      Math.max(512, GROQ_TPM_BUDGET - Math.min(inputTokens, GROQ_INPUT_TOKEN_BUDGET) - 400)
    );

    if (inputTokens > GROQ_INPUT_TOKEN_BUDGET) {
      console.warn("Groq request dipadatkan untuk memenuhi TPM.", {
        estimatedInputTokens: inputTokens,
        inputBudget: GROQ_INPUT_TOKEN_BUDGET,
        outputBudget,
      });
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
          { role: "system", content: compactedSystem },
          { role: "user", content: compactedPrompt },
        ],
        reasoning_effort: "low",
        include_reasoning: false,
        temperature: request.temperature ?? 0.7,
        max_completion_tokens: outputBudget,
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
