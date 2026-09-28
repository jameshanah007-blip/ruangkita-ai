import { getJamesCapabilities } from "./jamesAutonomousBrain";

type LocalBrainResult = {
  available: boolean;
  provider: "local" | "unavailable";
  model?: string;
  text?: string;
  error?: string;
};

const DEFAULT_LOCAL_URL = "http://127.0.0.1:11434/api/generate";

function localConfig() {
  return {
    url: process.env.JAMES_LOCAL_BRAIN_URL || DEFAULT_LOCAL_URL,
    model: process.env.JAMES_LOCAL_BRAIN_MODEL || "qwen2.5:7b",
  };
}

/**
 * James Local Brain adapter.
 *
 * The web application never downloads or trains model weights. It talks to a
 * separately managed local inference service (for example Ollama). This keeps
 * secrets and compute outside Vercel while allowing James to use validated
 * capabilities without a cloud provider.
 */
export async function generateWithJamesLocalBrain(
  prompt: string,
  systemInstruction?: string
): Promise<LocalBrainResult> {
  const config = localConfig();

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        prompt,
        system: systemInstruction || "You are James, the local autonomous brain of RuangKita.",
        stream: false,
        options: { temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return {
        available: false,
        provider: "unavailable",
        error: `Local brain returned HTTP ${response.status}.`,
      };
    }

    const data = await response.json() as { response?: unknown };
    const text = typeof data.response === "string" ? data.response.trim() : "";

    if (!text) {
      return { available: false, provider: "unavailable", error: "Local brain returned empty output." };
    }

    return {
      available: true,
      provider: "local",
      model: config.model,
      text,
    };
  } catch (error) {
    return {
      available: false,
      provider: "unavailable",
      error: error instanceof Error ? error.message : "Local brain unavailable.",
    };
  }
}

/**
 * Builds a compact capability context for the local model.
 * Only validated capabilities are treated as learned abilities.
 */
export async function buildJamesLocalCapabilityContext() {
  const capabilities = await getJamesCapabilities(40);
  const validated = capabilities.filter(
    (item: any) => item.status === "validated" && Number(item.success_rate || 0) >= 0.8
  );

  return validated.map((item: any) => ({
    name: item.name,
    description: item.description,
    domain: item.domain,
    skills: item.skills,
    strategy: item.strategy,
    limitations: item.limitations,
  }));
}

/**
 * Ask the local brain first. Cloud routing remains an explicit fallback,
 * rather than being silently treated as the local brain.
 */
export async function runJamesLocalFirst(prompt: string, systemInstruction?: string) {
  const capabilityContext = await buildJamesLocalCapabilityContext();
  const enriched = `${systemInstruction || "You are James."}

VALIDATED JAMES CAPABILITIES:
${JSON.stringify(capabilityContext)}

Use validated capabilities when relevant. Do not claim a capability is learned
unless it appears in the validated list.

USER/TASK:
${prompt}`;

  return generateWithJamesLocalBrain(enriched, systemInstruction);
}
