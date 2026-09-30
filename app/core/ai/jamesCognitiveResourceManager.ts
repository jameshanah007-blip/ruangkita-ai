import type { AIGenerateRequest } from "./aiProvider";

export type JamesTaskClass = "routine" | "standard" | "critical";

export type JamesProviderName = "gemini" | "openrouter" | "groq" | "openai";

function textOf(request: AIGenerateRequest) {
  return `${request.systemInstruction ?? ""}\n${request.prompt ?? ""}`.toLowerCase();
}

export function classifyJamesTask(request: AIGenerateRequest): JamesTaskClass {
  const text = textOf(request);

  const criticalSignals = [
    "security", "authentication", "jwt", "database migration", "production",
    "architecture", "debug", "debugging", "repair", "self evaluation",
    "self-evaluation", "autonomous brain", "strategy mutation", "game laboratory",
    "game engine", "critical", "failure analysis",
  ];

  const routineSignals = [
    "heartbeat", "health check", "summarize", "summary", "classification",
    "extract", "cleanup", "routine", "provider performance", "daily learning",
  ];

  if (criticalSignals.some((signal) => text.includes(signal))) return "critical";
  if (routineSignals.some((signal) => text.includes(signal))) return "routine";
  return "standard";
}

function premiumMode() {
  const mode = (process.env.JAMES_PREMIUM_PROVIDER_MODE ?? "critical-only").toLowerCase();
  return mode === "always" || mode === "critical-only" || mode === "disabled"
    ? mode
    : "critical-only";
}

export function getJamesProviderOrder(
  request: AIGenerateRequest,
  available: JamesProviderName[]
): JamesProviderName[] {
  const taskClass = classifyJamesTask(request);
  const mode = premiumMode();

  const base: JamesProviderName[] =
    taskClass === "routine"
      ? ["gemini", "groq", "openrouter", "openai"]
      : taskClass === "critical"
        ? ["openrouter", "groq", "gemini", "openai"]
        : ["gemini", "openrouter", "groq", "openai"];

  return base.filter((provider) => {
    if (!available.includes(provider)) return false;
    if (provider === "openai") {
      if (mode === "disabled") return false;
      if (mode === "critical-only" && taskClass !== "critical") return false;
    }
    return true;
  });
}

export function jamesTaskClassLabel(request: AIGenerateRequest) {
  return classifyJamesTask(request);
}
