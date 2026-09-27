import { NextResponse } from "next/server";
import { isOmantoVerified } from "../verify-identity/route";
import { validateJamesAdaptedModel } from "../../tools/jamesModelValidation";
import type { AIProviderName } from "../../../fun-zone/aiProvider";

function provider(value: unknown): AIProviderName | null {
  return value === "gemini" || value === "openai" || value === "openrouter" || value === "groq"
    ? value : null;
}

export async function POST(request: Request) {
  try {
    if (!(await isOmantoVerified(request))) {
      return NextResponse.json({ error: "Verified Omanto identity required." }, { status: 403 });
    }
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const registryId = typeof body.registryId === "string" ? body.registryId.trim() : "";
    const baselineProvider = provider(body.baselineProvider);
    const prompts = Array.isArray(body.prompts)
      ? body.prompts.filter((x: any) => typeof x?.prompt === "string").slice(0, 20)
      : [];

    if (!userId || !registryId || !baselineProvider || prompts.length < 3) {
      return NextResponse.json({ error: "userId, registryId, baselineProvider, dan minimal 3 prompts diperlukan." }, { status: 400 });
    }

    return NextResponse.json(await validateJamesAdaptedModel({
      userId,
      registryId,
      prompts,
      baselineProvider,
    }));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Model validation gagal.",
    }, { status: 500 });
  }
}
