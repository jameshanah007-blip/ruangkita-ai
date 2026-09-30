import type { AIGenerateRequest } from "./aiProvider";

export type JamesCognitiveBudgetClass = "routine" | "standard" | "critical";

export type JamesCognitiveBudget = {
  taskClass: JamesCognitiveBudgetClass;
  maxOutputTokens: number;
  temperature: number;
  premiumAllowed: boolean;
  providerFanout: number;
};

function textOf(request: AIGenerateRequest) {
  return `${request.systemInstruction ?? ""}\n${request.prompt ?? ""}`.toLowerCase();
}

function taskClass(request: AIGenerateRequest): JamesCognitiveBudgetClass {
  const text = textOf(request);

  const critical = [
    "security", "authentication", "jwt", "database migration",
    "production", "architecture", "repair", "debugging",
    "autonomous brain", "strategy mutation", "failure analysis",
  ];

  const routine = [
    "heartbeat", "health check", "summarize", "summary",
    "classification", "extract", "cleanup", "routine",
    "provider performance", "daily learning",
  ];

  if (critical.some((signal) => text.includes(signal))) return "critical";
  if (routine.some((signal) => text.includes(signal))) return "routine";
  return "standard";
}

export function getJamesCognitiveBudget(
  request: AIGenerateRequest
): JamesCognitiveBudget {
  const kind = taskClass(request);

  if (kind === "critical") {
    return {
      taskClass: kind,
      maxOutputTokens: Math.min(request.maxOutputTokens ?? 4000, 6000),
      temperature: request.temperature ?? 0.2,
      premiumAllowed: true,
      providerFanout: 1,
    };
  }

  if (kind === "routine") {
    return {
      taskClass: kind,
      maxOutputTokens: Math.min(request.maxOutputTokens ?? 1200, 1200),
      temperature: request.temperature ?? 0.1,
      premiumAllowed: false,
      providerFanout: 1,
    };
  }

  return {
    taskClass: kind,
    maxOutputTokens: Math.min(request.maxOutputTokens ?? 2500, 2500),
    temperature: request.temperature ?? 0.2,
    premiumAllowed: false,
    providerFanout: 1,
  };
}

export function applyJamesCognitiveBudget(
  request: AIGenerateRequest
): AIGenerateRequest {
  const budget = getJamesCognitiveBudget(request);

  return {
    ...request,
    maxOutputTokens: budget.maxOutputTokens,
    temperature: budget.temperature,
  };
}
