import { saveProviderCapabilities } from "./jamesGoals";

type Provider = "gemini" | "openrouter" | "groq";

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);
  return data;
}

export async function refreshJamesProviderCapabilities() {
  const observations: Array<{
    provider: Provider;
    model: string;
    capability: Record<string, unknown>;
    source: string;
  }> = [];

  if (process.env.GEMINI_API_KEY) {
    try {
      const data = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`
      );
      for (const model of (data.models || []).slice(0, 30)) {
        observations.push({
          provider: "gemini",
          model: String(model.name || "").replace(/^models\//, ""),
          capability: {
            display_name: model.displayName || "",
            description: model.description || "",
            input_token_limit: model.inputTokenLimit ?? null,
            output_token_limit: model.outputTokenLimit ?? null,
            supported_generation_methods: model.supportedGenerationMethods || [],
          },
          source: "Gemini models API",
        });
      }
    } catch (error) {
      console.error("Gemini capability probe failed:", error);
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      const data = await fetchJson("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      });
      for (const model of (data.data || []).slice(0, 50)) {
        observations.push({
          provider: "openrouter",
          model: String(model.id || ""),
          capability: {
            name: model.name || "",
            context_length: model.context_length ?? null,
            architecture: model.architecture || null,
            pricing: model.pricing || null,
            supported_parameters: model.supported_parameters || [],
          },
          source: "OpenRouter models API",
        });
      }
    } catch (error) {
      console.error("OpenRouter capability probe failed:", error);
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      const data = await fetchJson("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      });
      for (const model of (data.data || []).slice(0, 50)) {
        observations.push({
          provider: "groq",
          model: String(model.id || ""),
          capability: {
            context_length: model.context_window ?? model.context_length ?? null,
            owned_by: model.owned_by || "",
          },
          source: "Groq models API",
        });
      }
    } catch (error) {
      console.error("Groq capability probe failed:", error);
    }
  }

  await saveProviderCapabilities(observations);
  return observations;
}
