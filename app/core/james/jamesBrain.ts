import {
  generateWithAIRouter,
  type AIRouterResult,
} from "../ai/aiRouter";

export type JamesBrainSurface =
  | "tanya_saya"
  | "fun_zone"
  | "learning"
  | "system";

export type JamesBrainMode =
  | "chat"
  | "game_director"
  | "game_builder"
  | "game_debugger"
  | "learning"
  | "planning"
  | "reasoning";

export type JamesBrainRequest = {
  prompt: string;
  systemInstruction: string;
  surface: JamesBrainSurface;
  mode: JamesBrainMode;
  context?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type JamesBrainResponse = AIRouterResult & {
  brain: "james";
  surface: JamesBrainSurface;
  mode: JamesBrainMode;
};

function buildSharedBrainInstruction(input: JamesBrainRequest) {
  const context = input.context?.trim();

  return [
    "JAMES SHARED AI BRAIN",
    "",
    "Identity:",
    "- James is the shared AI intelligence of RuangKita.",
    "- Tanya Saya and Fun Zone are different surfaces of the same brain.",
    "- Never treat Fun Zone as the owner of James intelligence.",
    "- Keep user-specific memory scoped to the current user/session.",
    "- Do not invent unavailable facts, memories, tools, or capabilities.",
    "",
    `Surface: ${input.surface}`,
    `Mode: ${input.mode}`,
    "",
    "Shared operating principles:",
    "- understand the task before responding",
    "- use the requested role without changing core identity",
    "- preserve useful context when explicitly provided",
    "- prefer stable, deterministic behavior over unnecessary complexity",
    "",
    context ? `RELEVANT CONTEXT:\n${context}` : "",
    "",
    "SURFACE-SPECIFIC SYSTEM INSTRUCTION:",
    input.systemInstruction,
  ].filter(Boolean).join("\n");
}

export async function runJamesBrain(
  input: JamesBrainRequest
): Promise<JamesBrainResponse> {
  if (!input.prompt?.trim()) {
    throw new Error("James Brain membutuhkan prompt.");
  }

  const result = await generateWithAIRouter({
    prompt: input.prompt,
    systemInstruction: buildSharedBrainInstruction(input),
    temperature: input.temperature ?? 0.7,
    maxOutputTokens: input.maxOutputTokens ?? 4000,
  });

  return {
    ...result,
    brain: "james",
    surface: input.surface,
    mode: input.mode,
  };
}

export async function runJamesBrainChat(input: {
  prompt: string;
  systemInstruction: string;
  context?: string;
  temperature?: number;
  maxOutputTokens?: number;
}) {
  return runJamesBrain({
    ...input,
    surface: "tanya_saya",
    mode: "chat",
  });
}

export async function runJamesBrainGameDirector(input: {
  prompt: string;
  systemInstruction: string;
  context?: string;
  temperature?: number;
  maxOutputTokens?: number;
}) {
  return runJamesBrain({
    ...input,
    surface: "fun_zone",
    mode: "game_director",
  });
}

export async function runJamesBrainGameBuilder(input: {
  prompt: string;
  systemInstruction: string;
  context?: string;
  temperature?: number;
  maxOutputTokens?: number;
}) {
  return runJamesBrain({
    ...input,
    surface: "fun_zone",
    mode: "game_builder",
  });
}
