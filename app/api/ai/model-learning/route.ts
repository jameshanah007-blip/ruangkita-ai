import { NextResponse } from "next/server";
import { isOmantoVerified } from "../verify-identity/route";
import {
  distillJamesKnowledge,
  getJamesModelLearningCapabilities,
  startJamesModelAdaptation,
} from "../../tools/jamesModelLearning";
import type { AIProviderName } from "../../../fun-zone/aiProvider";

function provider(value: unknown): AIProviderName | null {
  return value === "gemini" || value === "openai" ||
    value === "openrouter" || value === "groq"
    ? value
    : null;
}

export async function GET(request: Request) {
  const verified = await isOmantoVerified(request);
  if (!verified) return NextResponse.json({ error: "Verified Omanto identity required." }, { status: 403 });
  return NextResponse.json({
    brain: "James Model Learning",
    capabilities: getJamesModelLearningCapabilities(),
  });
}

export async function POST(request: Request) {
  try {
    const verified = await isOmantoVerified(request);
    if (!verified) {
      return NextResponse.json({ error: "Model learning control requires verified Omanto identity." }, { status: 403 });
    }

    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const mode = body.mode === "distill" || body.mode === "adapt";
    if (!userId || !mode) {
      return NextResponse.json({ error: "userId and mode=distill|adapt are required." }, { status: 400 });
    }

    if (body.mode === "distill") {
      const prompts = Array.isArray(body.prompts)
        ? body.prompts.filter((item: unknown): item is string => typeof item === "string" && item.trim()).slice(0, 50)
        : [];
      const teachers = Array.isArray(body.teacherProviders)
        ? body.teacherProviders.map(provider).filter((item: AIProviderName | null): item is AIProviderName => Boolean(item))
        : [];

      if (!prompts.length || !teachers.length) {
        return NextResponse.json({ error: "prompts dan teacherProviders diperlukan." }, { status: 400 });
      }

      const result = await distillJamesKnowledge({
        userId,
        prompts,
        teacherProviders: teachers,
        systemInstruction:
          typeof body.systemInstruction === "string" ? body.systemInstruction : undefined,
        task: "learning",
      });

      return NextResponse.json(result);
    }

    const distillationJobId =
      typeof body.distillationJobId === "string" ? body.distillationJobId.trim() : "";
    const targetProvider = provider(body.targetProvider);
    const baseModel =
      typeof body.baseModel === "string" ? body.baseModel.trim() : "";

    if (!distillationJobId || !targetProvider || !baseModel) {
      return NextResponse.json(
        { error: "distillationJobId, targetProvider, dan baseModel diperlukan." },
        { status: 400 },
      );
    }

    const result = await startJamesModelAdaptation({
      userId,
      distillationJobId,
      targetProvider,
      baseModel,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("James model learning error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Model learning gagal.",
    }, { status: 500 });
  }
}
